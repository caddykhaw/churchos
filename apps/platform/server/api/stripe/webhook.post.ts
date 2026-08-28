import Stripe from 'stripe'

const config = useRuntimeConfig()

const stripe = new Stripe(config.stripeSecret || process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
})

/**
 * Webhook endpoint for Stripe events.
 * Must be raw body (not parsed JSON) — Stripe signs the raw payload.
 */
export default defineEventHandler(async (event) => {
  const body = await readRawBody(event)
  const signature = getRequestHeader(event, 'stripe-signature')

  const webhookSecret = config.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET!

  if (!signature) {
    throw createError({ statusCode: 400, message: 'Missing Stripe signature' })
  }

  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    throw createError({ statusCode: 400, message: `Webhook Error: ${err.message}` })
  }

  console.log(`[Stripe Webhook] Received ${stripeEvent.type}`)

  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session)
      break

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription)
      break

    case 'invoice.upcoming':
      await handleUpcomingInvoice(stripeEvent.data.object as Stripe.Invoice)
      break

    default:
      console.log(`[Webhook] Unhandled event type: ${stripeEvent.type}`)
  }

  return { received: true }
})

// ─── Handlers ─────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = useSupabaseServerClient()

  // Only handle subscription checkouts
  if (session.mode !== 'subscription') {
    console.log('[Webhook] Non-subscription checkout, skipping org creation')
    return
  }

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string | null

  // Retrieve the subscription to get details
  const subscription = subscriptionId
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : null

  const tier = session.metadata?.tier || 'starter'
  const billingCycle = session.metadata?.billing_cycle || 'annual'
  const churchName = session.metadata?.church_name || ''
  const slug = session.metadata?.slug || ''

  const modules = (session.metadata?.modules || 'people,journey,pages').split(',')

  // Check if org already exists (retry webhook)
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('subscription_stripe_customer_id', customerId)
    .single()

  if (existingOrg) {
    console.log(`[Webhook] Organization already exists for customer ${customerId}, updating`)
  } else {
    // Create the organization
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert([{
        slug: slug || `church-${crypto.randomUUID().substring(0, 8)}`,
        name: churchName,
        subscription_tier: tier,
        billing_cycle: billingCycle,
        subscribed_modules: modules,
        subscription_status: 'trial',
        subscription_stripe_customer_id: customerId,
        subscription_stripe_subscription_id: subscriptionId,
        trial_ends_at: subscription?.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (createError) {
      console.error('[Webhook] Failed to create organization:', createError)
      throw createError // Let Stripe retry
    }

    console.log(`[Webhook] Created organization ${newOrg.id} for ${churchName}`)
  }

  // Update org with subscription details
  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      subscription_status: subscription?.status === 'trialing' ? 'trial' : (subscription?.status || 'active'),
      trial_ends_at: subscription?.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      subscription_stripe_subscription_id: subscriptionId
    })
    .eq('subscription_stripe_customer_id', customerId)

  if (updateError) console.error('[Webhook] Failed to update org:', updateError)

  // Create subscription record
  if (subscription) {
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert([{
        organization_id: existingOrg?.id || newOrg.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        tier,
        billing_cycle: billingCycle,
        status: subscription.status === 'trialing' ? 'trialing' : subscription.status,
        current_period_start: subscription.items.data[0]?.price.recurring
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      }])
      .eq('stripe_subscription_id', subscriptionId)

    if (subError) console.error('[Webhook] Failed to create subscription record:', subError)
  }

  // Send welcome email
  const pastorEmail = session.metadata?.pastor_email
  if (pastorEmail) {
    await $fetch('https://api.resend.dev/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: {
        from: 'ChurchOS <welcome@churchos.my>',
        to: pastorEmail,
        subject: 'Welcome to ChurchOS! Your 14-day free trial has started',
        html: `
          <h1>Hi ${churchName},</h1>
          <p>Welcome aboard! Your 14-day free trial is now active.</p>
          <p>You can sign in at <a href="https://app.churchos.my/auth/login">app.churchos.my</a> using the email you provided (${pastorEmail}).</p>
          <p>- The ChurchOS Team</p>
        `
      }
    })
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = useSupabaseServerClient()

  // Find org by customer ID
  const customerId = invoice.customer as string
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('subscription_stripe_customer_id', customerId)
    .single()

  if (!org) return

  // Record payment
  await supabase
    .from('payment_history')
    .insert([{
      organization_id: org.id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      stripe_charge_id: invoice.charge as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      payment_method: 'card',
      paid_at: new Date(invoice.created * 1000).toISOString()
    }])

  // Restore org access if it was suspended
  await supabase
    .from('organizations')
    .update({
      subscription_status: 'active',
      suspended_at: null,
      subscription_past_due_at: null
    })
    .eq('id', org.id)

  console.log(`[Webhook] Payment succeeded for org ${org.name}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = useSupabaseServerClient()

  const customerId = invoice.customer as string
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('subscription_stripe_customer_id', customerId)
    .single()

  if (!org) return

  // Mark as past_due, start grace period
  await supabase
    .from('organizations')
    .update({
      subscription_status: 'past_due',
      subscription_past_due_at: new Date().toISOString()
    })
    .eq('id', org.id)

  console.log(`[Webhook] Payment failed for org ${org.name} — entering grace period`)

  // Send email to pastor
  // (you'd need the email — store it on the org or subscription)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = useSupabaseServerClient()

  const subscriptionId = subscription.id
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, subscription_tier, billing_cycle')
    .eq('subscription_stripe_subscription_id', subscriptionId)
    .single()

  if (!org) return

  const status = subscription.status
  let mappedStatus: string
  switch (status) {
    case 'active': mappedStatus = 'active'; break
    case 'past_due': mappedStatus = 'past_due'; break
    case 'unpaid': mappedStatus = 'suspended'; break
    case 'canceled': mappedStatus = 'cancelled'; break
    case 'trialing': mappedStatus = 'trial'; break
    default: mappedStatus = status
  }

  await supabase
    .from('organizations')
    .update({
      subscription_status: mappedStatus,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null
    })
    .eq('id', org.id)

  console.log(`[Webhook] Subscription updated for org ${org.name} → ${mappedStatus}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = useSupabaseServerClient()

  const subscriptionId = subscription.id
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('subscription_stripe_subscription_id', subscriptionId)
    .single()

  if (!org) return

  await supabase
    .from('organizations')
    .update({
      subscription_status: 'cancelled',
      canceled_at: new Date().toISOString()
    })
    .eq('id', org.id)

  console.log(`[Webhook] Subscription canceled for org ${org.name}`)

  // Note: data retention is 30 days, handled by cron cleanup
}

async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  // Only send reminders for paid (non-trial) invoices
  const subscription = invoice.subscription as Stripe.Subscription
  if (!subscription || invoice.total === 0) return

  const customerId = invoice.customer as string
  const supabase = useSupabaseServerClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, pastor_email')
    .eq('subscription_stripe_customer_id', customerId)
    .single()

  if (!org) return

  // Email reminder 7 days before renewal
  await $fetch('https://api.resend.dev/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: {
      from: 'ChurchOS <billing@churchos.my>',
      to: org.pastor_email,
      subject: `${org.name} — subscription renews in 7 days`,
      html: `
        <h1>Hi ${org.name} pastor,</h1>
        <p>Your ChurchOS subscription renews in 7 days. Your card on file will be charged.</p>
        <p>Can't find the email? <a href="${process.env.PLATFORM_URL}/onboard/complete">Click here to manage your payment method</a>.</p>
        <p>- The ChurchOS Team</p>
      `
    }
  })

  console.log(`[Webhook] Sent renewal reminder for org ${org.name}`)
}
