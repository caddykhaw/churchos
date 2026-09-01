import { createBillingPortalSession } from '../../utils/stripe-client'

/**
 * Creates a Stripe Customer Portal session so churches can:
 * - Update their payment method
 * - View billing history
 * - Cancel or change their subscription
 *
 * Uses direct Stripe REST API call instead of the `stripe` npm package,
 * which bundles node:stream and breaks on Cloudflare Workers.
 */
export default defineEventHandler(async (event) => {
  // Verify the user is authenticated (uses your auth middleware)
  const session = await getServerSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const config = useRuntimeConfig()
  const supabase = useSupabaseServerClient()

  // Look up the org for this user
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!membership) {
    throw createError({ statusCode: 400, message: 'No active organization found' })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_stripe_customer_id, name')
    .eq('id', membership.organization_id)
    .single()

  if (!org?.subscription_stripe_customer_id) {
    throw createError({ statusCode: 400, message: 'No Stripe customer found for this organization' })
  }

  // Create portal session via direct Stripe API call
  const portalSession = await createBillingPortalSession({
    customer: org.subscription_stripe_customer_id,
    return_url: `${config.public.platformUrl}/account/billing`,
  })

  return { url: portalSession.url }
})
