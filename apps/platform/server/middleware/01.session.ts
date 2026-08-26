export default defineEventHandler(async (event) => {
  const token = getCookie(event, '__session')

  if (!token) {
    event.context.user = null
    event.context.org = null
    return
  }

  try {
    const supabase = useSupabaseForRequest(event)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      deleteCookie(event, '__session')
      event.context.user = null
      event.context.org = null
      return
    }

    const admin = useSupabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      deleteCookie(event, '__session')
      event.context.user = null
      event.context.org = null
      return
    }

    const { data: memberships } = await admin
      .from('organization_members')
      .select(`
        organization_id,
        roles,
        status,
        organizations (
          id,
          slug,
          name,
          subscription_status,
          subscribed_modules,
          subscription_tier,
          trial_ends_at
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')

    event.context.user = {
      id: user.id,
      email: user.email!,
      profile,
      organizations: memberships || []
    }
    event.context.org = null
  } catch (err) {
    console.error('Session verification failed:', err)
    deleteCookie(event, '__session')
    event.context.user = null
    event.context.org = null
  }
})
