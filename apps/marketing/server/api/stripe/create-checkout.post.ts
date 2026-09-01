import { createCheckoutSession } from '../../utils/stripe-client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { churchName, pastorEmail, tier, billingCycle } = body

  const config = useRuntimeConfig()

  // Validate required fields
  if (!churchName || !pastorEmail || !tier || !billingCycle) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  // Validate tier
  const validTiers = ['starter', 'growth', 'pro']
  if (!validTiers.includes(tier)) {
    throw createError({ statusCode: 400, message: 'Invalid tier selected' })
  }

  // Validate billing cycle
  const validCycles = ['monthly', 'annual']
  if (!validCycles.includes(billingCycle)) {
    throw createError({ statusCode: 400, message: 'Invalid billing cycle' })
  }

  // Map tier + billing cycle to Stripe Price ID
  const priceIdMap = {
    starter: {
      monthly: config.stripePriceStarterMonthly || process.env.STARTER_MONTHLY_PRICE_ID,
      annual: config.stripePriceStarterAnnual || process.env.STARTER_ANNUAL_PRICE_ID,
    },
    growth: {
      monthly: config.stripePriceGrowthMonthly || process.env.GROWTH_MONTHLY_PRICE_ID,
      annual: config.stripePriceGrowthAnnual || process.env.GROWTH_ANNUAL_PRICE_ID,
    },
    pro: {
      monthly: config.stripePriceProMonthly || process.env.PRO_MONTHLY_PRICE_ID,
      annual: config.stripePriceProAnnual || process.env.PRO_ANNUAL_PRICE_ID,
    },
  }

  const priceId = priceIdMap[tier as keyof typeof priceIdMap][billingCycle as 'monthly' | 'annual']

  if (!priceId) {
    throw createError({ statusCode: 400, message: 'Price configuration not found for selected plan' })
  }

  // Generate a unique organization slug from church name
  const baseSlug = churchName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30)

  // Create Checkout Session via direct Stripe REST API (Workers-compatible)
  const session = await createCheckoutSession({
    mode: 'subscription',
    customer_email: pastorEmail,
    customer_creation: 'if_required',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      church_name: churchName,
      pastor_email: pastorEmail,
      tier,
      billing_cycle: billingCycle,
      slug: baseSlug,
    },
    success_url: `${config.public.platformUrl || process.env.PLATFORM_URL}/onboard/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.public.marketingUrl || process.env.MARKETING_URL}/signup`,
    automatic_tax: { enabled: true },
    subscription_data: {
      trial_period_days: 14,
    },
    customer_update: {
      address: 'auto',
    },
    payment_method_collection: 'always',
  })

  return { url: session.url }
})
