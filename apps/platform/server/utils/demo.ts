import { parseJsonArray } from '@churchos/database'
import { dbAll, dbOne, dbRun } from './db'

const DEMO_ORG_TTL_MS = 24 * 60 * 60 * 1000 // abandoned sandbox sweep

export interface DemoCredentials {
  email: string
}

export function getDemoEmail(): string {
  const config = useRuntimeConfig()
  return String(config.public.demoEmail || 'demo@churchos.my')
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Makes sure the shared demo profile exists in Turso (idempotent).
 * Auth is owned by Clerk; the demo "user" is a local profile row keyed by the
 * demo email so sandbox orgs have a stable owner.
 */
export async function ensureDemoProfile(): Promise<string> {
  const email = getDemoEmail()

  const existing = await dbOne('SELECT id FROM profiles WHERE email = ?', [email])
  if (existing) return String(existing.id)

  const id = crypto.randomUUID()
  await dbRun(
    `INSERT INTO profiles (id, email, display_name) VALUES (?, ?, 'ChurchOS Demo')
     ON CONFLICT(id) DO NOTHING`,
    [id, email]
  )
  const created = await dbOne('SELECT id FROM profiles WHERE email = ?', [email])
  return String(created?.id || id)
}

/**
 * Returns the demo sandbox the current request is already pointed at, if that
 * org exists, is a demo org, and the demo profile is a member of it.
 */
export async function getCurrentSandbox(event: Parameters<typeof getCookie>[0]) {
  const orgId = getCookie(event, '__org_id')
  if (!orgId) return null

  const org = await dbOne(
    'SELECT id, name, slug FROM organizations WHERE id = ? AND is_demo = 1',
    [orgId]
  )
  if (!org) return null

  const demoProfileId = await ensureDemoProfile()
  const membership = await dbOne(
    `SELECT id FROM organization_members
      WHERE organization_id = ? AND user_id = ? AND status = 'active'`,
    [orgId, demoProfileId]
  )

  return membership ? org : null
}

/** Removes abandoned demo orgs (sessions that were never signed out of). */
export async function sweepStaleDemoOrgs() {
  const demoProfileId = await ensureDemoProfile()
  const staleCutoff = new Date(Date.now() - DEMO_ORG_TTL_MS).toISOString()

  const stale = await dbAll(
    `SELECT o.id FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ? AND om.status = 'active' AND o.is_demo = 1 AND o.created_at < ?`,
    [demoProfileId, staleCutoff]
  )

  for (const org of stale) {
    // Cascade deletes module data + the membership.
    await dbRun('DELETE FROM organizations WHERE id = ?', [org.id])
  }
}

/** Creates one fresh, isolated demo sandbox org seeded with mock data. */
export async function provisionDemoSandbox() {
  await sweepStaleDemoOrgs()

  const demoProfileId = await ensureDemoProfile()

  const org = {
    name: 'Grace Community Church (Demo)',
    slug: `demo-${randomSuffix()}`,
    subscription_tier: 'growth',
    billing_cycle: 'annual',
    subscribed_modules: JSON.stringify(['people', 'journey', 'pages']),
    trial_ends_at: null,
    subscription_status: 'active',
    is_demo: 1,
    suspension_months: 0
  } as const

  const orgId = crypto.randomUUID()
  await dbRun(
    `INSERT INTO organizations (id, slug, name, subscription_tier, billing_cycle, subscribed_modules,
                                trial_ends_at, subscription_status, is_demo, suspension_months)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orgId, org.slug, org.name, org.subscription_tier, org.billing_cycle, org.subscribed_modules,
      org.trial_ends_at, org.subscription_status, org.is_demo, org.suspension_months]
  )

  try {
    await dbRun(
      `INSERT INTO organization_members (id, organization_id, user_id, roles, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [crypto.randomUUID(), orgId, demoProfileId, JSON.stringify(['admin', 'member', 'mentor', 'volunteer'])]
    )
  } catch {
    await dbRun('DELETE FROM organizations WHERE id = ?', [orgId])
    throw createError({ statusCode: 500, message: 'Could not prepare the demo workspace' })
  }

  await seedDemoOrg(orgId)

  return { id: orgId, slug: org.slug, name: org.name }
}

/** Seeds realistic mock data into a demo org so every screen has content. */
async function seedDemoOrg(organizationId: string) {
  const memberNames = [
    'John Tan', 'Sarah Lim', 'David Wong', 'Esther Ng',
    'Aaron Chong', 'Grace Lee', 'Samuel Raj', 'Hannah Ooi'
  ]

  for (const [index, name] of memberNames.entries()) {
    await dbRun(
      `INSERT INTO members (id, organization_id, full_name, email, phone, gender, member_status, member_number, membership_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        organizationId,
        name,
        `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        `+60 1${index + 2}-345 6789`,
        index % 2 === 0 ? 'male' : 'female',
        index < 6 ? 'active' : 'inactive',
        `M-${String(1001 + index)}`,
        `2022-0${(index % 9) + 1}-15`
      ]
    )
  }

  const memberRows = await dbAll(
    'SELECT id, full_name FROM members WHERE organization_id = ?',
    [organizationId]
  )
  const memberId = (name: string) => memberRows.find((m) => m.full_name === name)?.id

  const tracks = [
    {
      title_en: 'Foundations of Faith',
      title_zh: '信仰根基',
      description: 'Six sessions covering the core beliefs of the Christian faith — ideal for new believers.',
      status: 'published'
    },
    {
      title_en: 'Baptism Preparation',
      title_zh: '洗礼预备',
      description: 'A short track preparing candidates for baptism and membership.',
      status: 'published'
    },
    {
      title_en: 'Leadership Essentials',
      title_zh: '领袖基础',
      description: 'For small-group leaders and ministry volunteers.',
      status: 'draft'
    }
  ]

  const trackIds = new Map<string, string>()
  for (const track of tracks) {
    const trackId = crypto.randomUUID()
    trackIds.set(track.title_en, trackId)
    await dbRun(
      `INSERT INTO tracks (id, organization_id, title_en, title_zh, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trackId, organizationId, track.title_en, track.title_zh, track.description, track.status]
    )
  }

  const enrollments = [
    { mentee: 'Grace Lee', mentor: 'Sarah Lim', track: 'Foundations of Faith', status: 'active' },
    { mentee: 'Aaron Chong', mentor: 'John Tan', track: 'Baptism Preparation', status: 'active' },
    { mentee: 'Hannah Ooi', mentor: 'Esther Ng', track: 'Foundations of Faith', status: 'completed' }
  ]

  for (const enrollment of enrollments) {
    const menteeId = memberId(enrollment.mentee)
    const mentorId = memberId(enrollment.mentor)
    const trackId = trackIds.get(enrollment.track)
    if (!menteeId || !mentorId || !trackId) continue
    await dbRun(
      `INSERT INTO enrollments (id, organization_id, track_id, mentee_id, mentor_id, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        organizationId,
        trackId,
        menteeId,
        mentorId,
        enrollment.status,
        enrollment.status === 'completed' ? new Date().toISOString() : null
      ]
    )
  }

  const pages = [
    { slug: 'welcome', title_en: 'Welcome to Grace', title_zh: '欢迎来到恩典堂', published: 1 },
    { slug: 'service-times', title_en: 'Service Times', title_zh: '聚会时间', published: 1 },
    { slug: 'about-us', title_en: 'About Us', title_zh: '关于我们', published: 0 }
  ]

  for (const page of pages) {
    await dbRun(
      `INSERT INTO pages (id, organization_id, slug, title_en, title_zh, published)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), organizationId, page.slug, page.title_en, page.title_zh, page.published]
    )
  }
}

export { parseJsonArray }
