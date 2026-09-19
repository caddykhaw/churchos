import { dbAll, dbRun } from '../../utils/db'

/**
 * Daily cron job for workspace lifecycle maintenance.
 * Run daily at 2 AM UTC (configure in your scheduler — Cloudflare Workers Cron, cron-job.org, etc.)
 *
 * Checks:
 * 1. Sweep abandoned demo sandboxes (older than 24h) so throwaway demo orgs
 *    don't accumulate when a visitor never signs out.
 */

export default defineEventHandler(async () => {
  const results = {
    demoOrgSwept: 0
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const staleDemoOrgs = await dbAll(
      'SELECT id FROM organizations WHERE is_demo = 1 AND created_at < ?',
      [cutoff]
    )

    for (const org of staleDemoOrgs) {
      // Cascade removes module data + memberships.
      await dbRun('DELETE FROM organizations WHERE id = ?', [org.id])
      results.demoOrgSwept++
    }
  } catch (error) {
    console.error('[Cron] Demo sweep failed:', error)
    // Surface the failure to the scheduler instead of reporting a false success.
    throw createError({
      statusCode: 500,
      message: 'Cron sweep failed'
    })
  }

  console.log('[Cron] Workspace maintenance completed:', results)

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    results
  }
})
