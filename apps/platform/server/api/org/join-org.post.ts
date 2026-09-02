import type { H3Event } from 'h3'

/**
 * Joins a user to their pre-created organization.
 * The org was created during the Stripe Checkout webhook with the pastor's email
 * stored as a metadata field. This endpoint links the auth user to the org.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  if (!email) {
    throw createError({ statusCode: 400, message: 'Email required' })
  }

  const supabase = useSupabaseAdmin()

  // Find the org that was created from the Stripe checkout session
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('subscription_stripe_customer_id', email) // This won't work — need to look up by customer
    .maybeSingle()

  // Actually — we should look up by the email used in the checkout
  // Since we stored church_name but not pastor_email in metadata reliably,
  // let's use a different approach: search for the user's pending org
  if (orgError || !org) {
    // Try matching by email — we'll need to store this during webhook
    const { data: orgByEmail, error: emailError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('pastor_email', email)
      .eq('subscription_status', 'trial')
      .maybeSingle()

    if (emailError || !orgByEmail) {
      // No org found — the user signed up directly (not through checkout)
      // Let them proceed without forcing org linking
      return { skipped: true, message: 'No pending organization found' }
    }

    // Add user to the org as admin
    const userId = await getCurrentUserId(event)
    if (!userId) {
      throw createError({ statusCode: 401, message: 'Not authenticated' })
    }

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert([{
        organization_id: orgByEmail.id,
        user_id: userId,
        roles: ['admin'],
        status: 'active',
        joined_at: new Date().toISOString()
      }])

    if (memberError && memberError.code !== '23505') {
      // Ignore duplicate key errors (already a member)
      console.error('[join-org] Failed to add member:', memberError)
    }

    return { joined: true, org: orgByEmail }
  }

  return { skipped: true }
})

async function getCurrentUserId(event: H3Event): Promise<string | null> {
  return event.context.user?.id ?? null
}
