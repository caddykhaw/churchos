/**
 * Cloudflare Workers-compatible Stripe client (marketing app).
 *
 * Replaces the `stripe` npm SDK (which bundles node:stream/node:crypto and breaks
 * on Cloudflare Workers) with direct REST API calls + Web Crypto API for webhook
 * signature verification.
 *
 * Only covers the endpoints used by ChurchOS marketing site.
 */

interface StripeConfig {
  secretKey: string
  baseUrl: string
}

const config = useRuntimeConfig()
const stripeConfig: StripeConfig = {
  secretKey: config.stripeSecret || process.env.STRIPE_SECRET_KEY!,
  baseUrl: 'https://api.stripe.com/v1',
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${stripeConfig.secretKey}` }
}

/**
 * Raw Stripe API call — thin wrapper around fetch with auth header.
 */
async function stripeRequest(
  path: string,
  body?: Record<string, any>,
): Promise<any> {
  const params = new URLSearchParams()
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
  }

  const url = `${stripeConfig.baseUrl}/${path}?${params.toString()}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Stripe API error ${res.status}: ${err.error?.message || err.message || res.statusText}`,
    )
  }

  return res.json()
}

/**
 * Create a Stripe Checkout Session (for subscription signups).
 */
export async function createCheckoutSession(params: {
  mode: string
  customer_email?: string
  customer_creation?: string
  line_items: Array<Record<string, any>>
  metadata: Record<string, string>
  success_url: string
  cancel_url: string
  automatic_tax?: { enabled: boolean }
  subscription_data?: Record<string, any>
  customer_update?: Record<string, any>
  payment_method_collection?: string
}): Promise<any> {
  const body: Record<string, any> = {
    mode: params.mode,
    line_items: JSON.stringify(params.line_items),
    metadata: JSON.stringify(params.metadata),
    success_url: params.success_url,
    cancel_url: params.cancel_url,
  }

  if (params.customer_email) body.customer_email = params.customer_email
  if (params.customer_creation) body.customer_creation = params.customer_creation
  if (params.automatic_tax) body.automatic_tax = JSON.stringify(params.automatic_tax)
  if (params.subscription_data) body.subscription_data = JSON.stringify(params.subscription_data)
  if (params.customer_update) body.customer_update = JSON.stringify(params.customer_update)
  if (params.payment_method_collection) body.payment_method_collection = params.payment_method_collection

  return stripeRequest('checkout/sessions', body)
}

/**
 * Retrieve a Stripe Checkout Session.
 */
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<any> {
  const params = new URLSearchParams({
    expand: 'subscription,customer',
  })
  const url = `${stripeConfig.baseUrl}/checkout/sessions/${sessionId}?${params.toString()}`
  const res = await fetch(url, {
    headers: authHeader(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Stripe API error ${res.status}: ${err.error?.message || res.statusText}`,
    )
  }

  return res.json()
}

/**
 * Verify a Stripe webhook signature using the Web Crypto API (HMAC-SHA256).
 *
 * This replaces `stripe.webhooks.constructEvent()` from the `stripe` npm package,
 * which requires `node:crypto` and breaks on Cloudflare Workers.
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret?: string,
): Promise<any> {
  const webhookSecret = secret || config.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET!

  // Parse the Stripe-Signature header to extract t= and v1= values
  const sigParts = signature
    .split(',')
    .map((s) => s.trim())
    .reduce<Record<string, string>>((acc, part) => {
      const [key, val] = part.split('=')
      if (key && val) acc[key] = val
      return acc
    }, {})

  const timestamp = sigParts.t
  const signatureHash = sigParts.v1

  if (!timestamp || !signatureHash) {
    throw new Error('Missing timestamp or signature in stripe-signature header')
  }

  // Check timestamp is within tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new Error('Webhook timestamp outside tolerance')
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(webhookSecret)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (expectedSig.length !== signatureHash.length) {
    throw new Error('Signature length mismatch')
  }

  const expectedBytes = encoder.encode(expectedSig)
  const providedBytes = encoder.encode(signatureHash)
  const anyCrypto = crypto as any
  const match = anyCrypto.timingSafeEqual
    ? anyCrypto.timingSafeEqual(expectedBytes, providedBytes)
    : expectedSig === signatureHash

  if (!match) {
    throw new Error('Signature verification failed')
  }

  return JSON.parse(payload)
}
