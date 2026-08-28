/**
 * Daily cron job for subscription lifecycle management.
 * Run daily at 2 AM UTC (configure in your scheduler — Cloudflare Workers Cron, cron-job.org, etc.)
 *
 * Checks:
 * 1. Expired trials → set subscription_status = 'suspended'
 * 2. Past-due subscriptions past grace period → set subscription_status = 'suspended'
 * 3. Increment suspension_months for each month suspended
 * 4. Send reminder emails to churches suspended in the last 24 hours
 * 5. Archive fully canceled orgs after 30-day retention period
 */

export default defineEventHandler(async () => {
  const supabase = useSupabaseServerClient()
  const config = useRuntimeConfig()

  const now = new Date().toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const results = {
    trialsExpired: 0,
    pastDueSuspended: 0,
    suspendedReminderEmails: 0,
    archivedOrgs: 0
  }

  // 1. Suspended expired trials
  const { count: trialsExpired, error: trialErr } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'suspended',
      suspended_at: now
    })
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', now)

  results.trialsExpired = trialsExpired || 0
  if (trialErr) console.error('[Cron] Trial suspension error:', trialErr.message)

  // 2. Suspended past-due orgs past grace period (7 days)
  const { count: pastDueSuspended, error: graceErr } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'suspended',
      suspended_at: now
    })
    .eq('subscription_status', 'past_due')
    .lt('subscription_past_due_at', sevenDaysAgo)

  results.pastDueSuspended = pastDueSuspended || 0
  if (graceErr) console.error('[Cron] Past-due suspension error:', graceErr.message)

  // 3. Increment suspension_months for all currently suspended orgs (once per month)
  const { data: suspendedOrgs, error: fetchErr } = await supabase
    .from('organizations')
    .select('id, name, suspension_months, suspended_at, pastor_email')
    .eq('subscription_status', 'suspended')
    .is('canceled_at', null) // Still interested in reactivation

  if (fetchErr) console.error('[Cron] Fetch suspended error:', fetchErr.message)

  for (const org of suspendedOrgs || []) {
    const lastIncrement = org.suspended_at
    if (lastIncrement) {
      const lastDate = new Date(lastIncrement)
      const monthsDiff =
        (now.getFullYear() - lastDate.getFullYear()) * 12 +
        (now.getMonth() - lastDate.getMonth())

      if (monthsDiff >= 1) {
        await supabase
          .from('organizations')
          .update({
            suspension_months: (org.suspension_months || 0) + monthsDiff,
            suspended_at: now
          })
          .eq('id', org.id)
      }
    }
  }

  // 4. Send reminder emails to orgs suspended in last 24 hours
  const { data: newlySuspended, error: notifyErr } = await supabase
    .from('organizations')
    .select('id, name, suspension_months, pastor_email')
    .eq('subscription_status', 'suspended')
    .gte('suspended_at', oneDayAgo)

  if (notifyErr) console.error('[Cron] Notify query error:', notifyErr.message)

  for (const org of newlySuspended || []) {
    const fee = (org.suspension_months || 0) * 10
    await $fetch('https://api.resend.dev/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}` },
      body: {
        from: 'ChurchOS <billing@churchos.my>',
        to: org.pastor_email,
        subject: `Your ChurchOS subscription has been suspended — reactivation required`,
        html: `
          <h1>${org.name} — subscription suspended</h1>
          <p>Your subscription expired and your account is now read-only.</p>
          <p>To reactivate, visit <a href="${config.public.platformUrl}/account/billing">your billing page</a>.</p>
          <p>A reactivation fee of <strong>RM ${fee}</strong> (RM 10 × ${org.suspension_months || 0} suspended months) will be charged.</p>
          <p>- The ChurchOS Team</p>
        `
      }
    })
    results.suspendedReminderEmails++
  }

  // 5. Archive fully canceled orgs after 30-day retention
  const { error: archiveErr } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'archived'
    })
    .eq('subscription_status', 'cancelled')
    .lt('canceled_at', thirtyDaysAgo)

  if (archiveErr) console.error('[Cron] Archive error:', archiveErr.message)

  console.log('[Cron] Subscription check completed:', results)

  return {
    ok: true,
    timestamp: now,
    results
  }
})
