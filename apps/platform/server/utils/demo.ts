import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { useSupabaseAdmin } from './supabase'

const DEMO_ORG_TTL_MS = 24 * 60 * 60 * 1000 // abandoned sandbox sweep

export interface DemoCredentials {
  email: string
  password: string
}

export function getDemoCredentials(): DemoCredentials {
  const config = useRuntimeConfig()
  return {
    email: String(config.public.demoEmail || 'demo@churchos.my'),
    password: String(config.public.demoPassword || 'demo-pass-2026')
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Returns the demo sandbox the current request is already pointed at, if that
 * org exists, is a demo org, and the shared demo user is a member of it.
 * This lets a visitor whose session cookie is still valid continue their
 * sandbox instead of stacking a new org on every visit.
 */
export async function getCurrentSandbox(event: H3Event) {
  const orgId = getCookie(event, '__org_id')
  if (!orgId) return null

  const admin = useSupabaseAdmin()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .eq('is_demo', true)
    .maybeSingle()

  if (!org) return null

  const demoUserId = await ensureDemoAuthUser()
  const { data: membership } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', demoUserId)
    .eq('status', 'active')
    .maybeSingle()

  return membership ? org : null
}

/**
 * Makes sure the shared demo auth user exists in Supabase (idempotent).
 * The credentials are public by design — the demo sandbox is open to anyone
 * who visits the demo login page.
 */
export async function ensureDemoAuthUser(): Promise<string> {
  const admin = useSupabaseAdmin()
  const { email } = getDemoCredentials()

  const { data: existing } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  const found = existing?.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
  if (found?.id) {
    // Profile may be missing if the user predates the platform schema.
    const { data: profile } = await admin.from('profiles').select('id').eq('id', found.id).maybeSingle()
    if (!profile) {
      await admin.from('profiles').insert({
        id: found.id,
        email,
        display_name: 'ChurchOS Demo',
        preferred_language: 'en'
      }).maybeSingle()
    }
    return found.id
  }

  const { email: demoEmail, password } = getDemoCredentials()
  // Note: named createUserError so it never shadows the createError() helper.
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: demoEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'ChurchOS Demo' }
  })

  if (createUserError || !created.user) {
    throw createError({
      statusCode: 500,
      message: `Demo account could not be prepared: ${createUserError?.message || 'unknown error'}`
    })
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    email: demoEmail,
    display_name: 'ChurchOS Demo',
    preferred_language: 'en'
  })

  if (profileError) {
    throw createError({ statusCode: 500, message: 'Demo account could not be prepared' })
  }

  return created.user.id
}

/** Signs the demo auth user in and returns a fresh access token. */
export async function signInDemoUser(): Promise<string> {
  const { email, password } = getDemoCredentials()
  const config = useRuntimeConfig()
  const supabase = createClient(
    String(config.public.supabaseUrl),
    String(config.public.supabaseAnonKey)
  )
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    throw createError({
      statusCode: 500,
      message: 'Demo sign-in failed. Contact the ChurchOS team.'
    })
  }

  return data.session.access_token
}

/**
 * Removes abandoned sandbox orgs of the shared demo user (sessions that were
 * never signed out of). Keeps the database from accumulating demo rows.
 */
export async function sweepStaleDemoOrgs() {
  const admin = useSupabaseAdmin()
  const demoUserId = await ensureDemoAuthUser()

  const { data: memberships } = await admin
    .from('organization_members')
    .select('organization_id, organizations(id, is_demo, created_at)')
    .eq('user_id', demoUserId)
    .eq('status', 'active')

  const staleCutoff = new Date(Date.now() - DEMO_ORG_TTL_MS).toISOString()

  for (const membership of memberships || []) {
    const org = membership.organizations as unknown as { id: string, is_demo: boolean, created_at: string } | null
    if (org?.is_demo && org.created_at < staleCutoff) {
      // Cascade deletes module data + the membership.
      await admin.from('organizations').delete().eq('id', org.id)
    }
  }
}

/** Creates one fresh, isolated demo sandbox org seeded with mock data. */
export async function provisionDemoSandbox() {
  await sweepStaleDemoOrgs()

  const admin = useSupabaseAdmin()
  const demoUserId = await ensureDemoAuthUser()

  const org = {
    name: 'Grace Community Church (Demo)',
    slug: `demo-${randomSuffix()}`,
    subscription_tier: 'growth',
    billing_cycle: 'annual',
    subscribed_modules: ['people', 'journey', 'pages'],
    trial_ends_at: null,
    subscription_status: 'active',
    is_demo: true,
    suspension_months: 0
  } as const

  const { data: createdOrg, error: orgError } = await admin
    .from('organizations')
    .insert(org)
    .select()
    .single()

  if (orgError || !createdOrg) {
    throw createError({ statusCode: 500, message: 'Could not provision the demo workspace' })
  }

  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: createdOrg.id,
      user_id: demoUserId,
      // All roles are granted so the in-app role switcher can preview each
      // view without logging the visitor out (which would reset the sandbox).
      roles: ['admin', 'member', 'mentor', 'volunteer'],
      status: 'active'
    })

  if (memberError) {
    await admin.from('organizations').delete().eq('id', createdOrg.id)
    throw createError({ statusCode: 500, message: 'Could not prepare the demo workspace' })
  }

  await seedDemoOrg(admin, createdOrg.id)

  return createdOrg as { id: string, slug: string, name: string }
}

type AdminClient = ReturnType<typeof useSupabaseAdmin>

/** Seeds realistic mock data into a demo org so every screen has content. */
async function seedDemoOrg(admin: AdminClient, organizationId: string) {
  const memberNames = [
    'John Tan', 'Sarah Lim', 'David Wong', 'Esther Ng',
    'Aaron Chong', 'Grace Lee', 'Samuel Raj', 'Hannah Ooi'
  ]

  const { data: insertedMembers, error: memberError } = await admin
    .from('members')
    .insert(memberNames.map((name, index) => ({
      organization_id: organizationId,
      full_name: name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: `+60 1${index + 2}-345 6789`,
      gender: index % 2 === 0 ? 'male' : 'female',
      member_status: index < 6 ? 'active' : index === 6 ? 'pending' : 'inactive',
      member_number: `M-${String(1001 + index)}`,
      membership_date: `2022-0${(index % 9) + 1}-15`
    })))
    .select('id, full_name')

  if (memberError || !insertedMembers) {
    throw createError({ statusCode: 500, message: 'Could not seed demo data' })
  }

  const memberId = (name: string) => insertedMembers.find((member) => member.full_name === name)?.id

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

  const { data: insertedTracks } = await admin
    .from('tracks')
    .insert(tracks.map((track) => ({ organization_id: organizationId, ...track })))
    .select('id, title_en')

  const trackId = (titleEn: string) => insertedTracks?.find((track) => track.title_en === titleEn)?.id

  const enrollments = [
    { mentee: 'Grace Lee', mentor: 'Sarah Lim', track: 'Foundations of Faith', status: 'active' },
    { mentee: 'Aaron Chong', mentor: 'John Tan', track: 'Baptism Preparation', status: 'active' },
    { mentee: 'Hannah Ooi', mentor: 'Esther Ng', track: 'Foundations of Faith', status: 'completed' }
  ]

  const rows = enrollments.flatMap((enrollment) => {
    const menteeId = memberId(enrollment.mentee)
    const mentorId = memberId(enrollment.mentor)
    const track = trackId(enrollment.track)
    if (!menteeId || !mentorId || !track) return []
    return [{
      organization_id: organizationId,
      track_id: track,
      mentee_id: menteeId,
      mentor_id: mentorId,
      status: enrollment.status,
      completed_at: enrollment.status === 'completed' ? new Date().toISOString() : null
    }]
  })

  if (rows.length) {
    await admin.from('enrollments').insert(rows)
  }

  await admin.from('pages').insert([
    {
      organization_id: organizationId,
      slug: 'welcome',
      title_en: 'Welcome to Grace',
      title_zh: '欢迎来到恩典堂',
      published: true
    },
    {
      organization_id: organizationId,
      slug: 'service-times',
      title_en: 'Service Times',
      title_zh: '聚会时间',
      published: true
    },
    {
      organization_id: organizationId,
      slug: 'about-us',
      title_en: 'About Us',
      title_zh: '关于我们',
      published: false
    }
  ])
}