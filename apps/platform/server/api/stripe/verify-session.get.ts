import Stripe from 'stripe'

const config = useRuntimeConfig()

const stripe = new Stripe(config.stripeSecret || process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
})

/**
 * Called by the platform's /onboard/complete page after Stripe redirect.
 * Verifies the checkout session and triggers org creation if not already done.
 */
export default defineEventHandler(async (event) => {
  const { session_id } = getQuery(event)

  if (!session_id || typeof session_id !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing session_id query parameter' })
  }

  // Retrieve the session from Stripe
  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ['subscription', 'customer']
  })

  if (!session.customer || !session.subscription) {
    throw createError({ statusCode: 400, message: 'Invalid checkout session' })
  }

  // Check if org already exists in Supabase
  const supabase = useSupabaseServerClient()
  const customerId = session.customer as string

  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_status, trial_ends_at')
    .eq('subscription_stripe_customer_id', customerId)
    .maybeSingle()

  if (existingOrg) {
    // Org already created (webhook did it)
    return {
      organization: existingOrg,
      session: {
        id: session.id,
        customer_email: session.customer_details?.email || session.customer_email
      }
    }
  }

  // Fallback: create the organization here if the webhook hasn't run yet
  const subscription = session.subscription as Stripe.Subscription
  const tier = session.metadata?.tier || 'starter'
  const billingCycle = session.metadata?.billing_cycle || 'annual'
  const churchName = session.metadata?.church_name || ''
  const slug = session.metadata?.slug || `church-${crypto.randomUUID().substring(0, 8)}`
  const modules = (session.metadata?.modules || 'people,journey,pages').split(',')
  const pastorEmail = session.metadata?.pastor_email || session.customer_details?.email

  const { data: newOrg, error } = await supabase
    .from('organizations')
    .insert([{
      slug,
      name: churchName,
      subscription_tier: tier,
      billing_cycle: billingCycle,
      subscribed_modules: modules,
      subscription_status: subscription.status === 'trialing' ? 'trial' : 'active',
      subscription_stripe_customer_id: customerId,
      subscription_stripe_subscription_id: subscription.id,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: `Failed to create organization: ${error.message}` })

  // Create subscription record
  await supabase
    .from('subscriptions')
    .insert([{
      organization_id: newOrg.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      tier,
      billing_cycle: billingCycle,
      status: subscription.status === 'trialing' ? 'trialing' : subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }])

  // Store pastor email for notifications
  if (pastorEmail) {
    await supabase
      .from('organizations')
      .update({ pastor_email: pastorEmail })
      .eq('id', newOrg.id)
  }

  return {
    organization: newOrg,
    session: {
      id: session.id,
      customer_email: session.customer_details?.email || session.customer_email
    }
  }
})
