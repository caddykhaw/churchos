/**
 * Daily cron job for workspace lifecycle maintenance.
 * Run daily at 2 AM UTC (configure in your scheduler — Cloudflare Workers Cron, cron-job.org, etc.)
 *
 * Checks:
 * 1. Sweep abandoned demo sandboxes (older than 24h) so throwaway demo orgs
 *    don't accumulate when a visitor never signs out.
 */

export default defineEventHandler(async () => {
  const supabase = useSupabaseAdmin()

  const results = {
    demoOrgSwept: 0
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: staleDemoOrgs, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('is_demo', true)
    .lt('created_at', cutoff)

  if (error) {
    console.error('[Cron] Demo sweep query error:', error.message)
  }

  for (const org of staleDemoOrgs || []) {
    // Cascade removes module data + memberships.
    await supabase.from('organizations').delete().eq('id', org.id)
    results.demoOrgSwept++
  }

  console.log('[Cron] Workspace maintenance completed:', results)

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    results
  }
})