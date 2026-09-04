<script setup lang="ts">
useHead({
  title: 'ChurchOS — Church management for Malaysia',
  meta: [
    { name: 'description', content: 'People, discipleship, and a church website — one quiet, dependable system. Built for Malaysian churches of every size.' }
  ]
})

const features = [
  {
    id: '01',
    label: 'People',
    title: 'Know your congregation',
    copy: 'A member directory that stays current, so pastoral care doesn\u2019t depend on someone\u2019s memory or a spreadsheet nobody updates.',
    points: [
      'Profiles, families, and small groups in one place',
      'Donations tracked against giving records',
      'Events, serving rosters, and volunteer scheduling',
      'Every record isolated per church — nothing leaks between orgs'
    ]
  },
  {
    id: '02',
    label: 'Journey',
    title: 'Discipleship with structure',
    copy: 'Run teaching tracks that people actually finish. Enrolment, mentors, progress — visible to the people who need to see it.',
    points: [
      'Tracks with milestones and mentor assignments',
      'Certificate completion that carries across churches',
      'Progress visible to leaders, private to members',
      'Designed for small churches, scales to large ones'
    ]
  },
  {
    id: '03',
    label: 'Pages',
    title: 'A website your church can edit',
    copy: 'A people-centric church website builder with multilingual content — no developer required, no third-party page builder lock-in.',
    points: [
      'English, Chinese, Bahasa Melayu, and Tamil content',
      'Block-based editor for sermons, events, and pages',
      'Your domain, your content — exportable anytime',
      'Served fast through Cloudflare'
    ]
  }
]

const DEMO_URL = 'https://app.churchos.my/auth/demo'
const SIGNUP_URL = 'https://app.churchos.my/auth/signup'
const LOGIN_URL = 'https://app.churchos.my/auth/login'

const stats = [
  { num: '3', label: 'Modules — People, Journey, Pages' },
  { num: '4', label: 'Languages — EN, 中文, BM, தமிழ்' },
  { num: '1', label: 'Church per workspace, zero data mixing' },
  { num: '100%', label: 'Of the product, open in the live demo' }
]

/* Pricing data (MYR, matches docs + Stripe checkout). Annual = monthly × 12 × 0.7. */
const billing = ref<'monthly' | 'annual'>('monthly')
const modulePlans = [
  {
    id: 'people',
    accent: 'people',
    code: 'PEOPLE',
    name: 'People',
    tag: 'Church management',
    blurb: 'Member directory, donations, events, groups and volunteer scheduling — everything a growing congregation needs in one place.',
    icon: 'users',
    tiers: [
      { name: 'Starter', cap: '≤ 100 members', price: 79 },
      { name: 'Growth', cap: '≤ 300 members', price: 159 },
      { name: 'Pro', cap: 'Unlimited members', price: 319 }
    ],
    features: [
      'Member profiles, families & small groups',
      'Donations tracked against giving records',
      'Events, serving rosters & volunteer scheduling',
      'Records isolated per church — nothing leaks between orgs'
    ]
  },
  {
    id: 'journey',
    accent: 'journey',
    code: 'JOURNEY',
    name: 'Journey',
    tag: 'Discipleship LMS',
    blurb: 'Run teaching tracks that people actually finish — enrolment, mentors, progress and certificates, all visible to the people who need to see it.',
    icon: 'route',
    tiers: [
      { name: 'Starter', cap: '3 tracks · 50 enrollments', price: 119 },
      { name: 'Growth', cap: '10 tracks · 200 enrollments', price: 239 },
      { name: 'Pro', cap: 'Unlimited tracks', price: 479 }
    ],
    features: [
      'Tracks with milestones & mentor assignments',
      'Certificates that carry across churches',
      'Progress visible to leaders, private to members',
      'Designed for small churches, scales to large ones'
    ]
  },
  {
    id: 'pages',
    accent: 'pages',
    code: 'PAGES',
    name: 'Pages',
    tag: 'Church website builder',
    blurb: 'A people-centric church website you can edit yourself — multilingual content, no developer required, no page-builder lock-in.',
    icon: 'globe',
    tiers: [
      { name: 'Standard', cap: 'EN · 中文', price: 79 },
      { name: 'Pro languages', cap: 'EN · 中文 · BM · தமிழ்', price: 79, note: 'All 4 languages · All-in-One Pro' }
    ],
    features: [
      'English, 中文, Bahasa Melayu & தமிழ் content',
      'Block editor for sermons, events & pages',
      'Your domain, your content — exportable anytime',
      'Served fast through Cloudflare'
    ]
  }
]

const bundlePlan = {
  id: 'bundle',
  accent: 'bundle',
  code: 'ALL-IN-ONE',
  name: 'All-in-One',
  tag: 'Everything · best value',
  blurb: 'All three modules with every language, a free custom domain for the first year, and 15% off subscribing separately.',
  icon: 'sparkles',
  tiers: [
    { name: 'Starter', cap: '≤ 100 members', price: 236 },
    { name: 'Growth', cap: '≤ 300 members', price: 474 },
    { name: 'Pro', cap: 'Unlimited members', price: 746 }
  ],
  features: [
    'Everything in PEOPLE + JOURNEY + PAGES',
    'All four languages included',
    'Free custom domain for year one',
    '15% off vs separate modules'
  ]
}

function fmtPrice(tier: { price: number }, annual: boolean) {
  if (!annual) return `RM ${tier.price}`
  return `RM ${Math.round(tier.price * 12 * 0.7).toLocaleString('en-MY')}`
}
function fmtPer(annual: boolean) {
  return annual ? '/yr' : '/mo'
}

const mobileMenuOpen = ref(false)

/* Shutter hero */
const heroLines = ['Church administration,', 'quietly in order.']
const heroChars = computed(() => heroLines.map(line => Array.from(line).map((ch, i) => ({ ch, i }))))
const replay = ref(0)
function replayShutter() {
  replay.value++
}
function charDelay(i: number) {
  return {
    '--d-top': `${i * 45}ms`,
    '--d-mid': `${i * 45 + 90}ms`,
    '--d-bot': `${i * 45 + 180}ms`,
    '--d-base': `${i * 45 + 280}ms`
  }
}
</script>

<template>
  <div>
    <!-- Nav -->
    <header class="nav">
      <div class="container nav-inner">
        <NuxtLink to="/" class="nav-brand" aria-label="ChurchOS home">
          <span class="mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M7 1 L13 13 H1 Z" />
              <line x1="4" y1="8.5" x2="10" y2="8.5" />
            </svg>
          </span>
          ChurchOS
        </NuxtLink>

        <nav class="nav-links" :class="{ open: mobileMenuOpen }" aria-label="Main">
          <a href="#modules">Modules</a>
          <a href="#why">Why ChurchOS</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div class="nav-actions">
          <a :href="LOGIN_URL" class="btn btn-ghost btn-sm">Sign in</a>
          <a :href="DEMO_URL" class="btn btn-primary btn-sm">Try the demo</a>
          <button class="nav-mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Toggle menu">
            {{ mobileMenuOpen ? '✕' : '☰' }}
          </button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="container hero-inner">
        <span class="hero-tick"><span class="dot"></span> Built for Malaysian churches</span>
        <h1 class="display hero-title" :key="replay">
          <span v-for="(line, li) in heroChars" :key="li" class="hero-line">
            <template v-for="c in line" :key="c.i">
              <span v-if="c.ch !== ' '" class="shutter-char" :style="charDelay(c.i)">
                <span class="shutter-base">{{ c.ch }}</span>
                <span class="shutter-slice shutter-slice--top" aria-hidden="true">{{ c.ch }}</span>
                <span class="shutter-slice shutter-slice--mid" aria-hidden="true">{{ c.ch }}</span>
                <span class="shutter-slice shutter-slice--bot" aria-hidden="true">{{ c.ch }}</span>
              </span>
              <template v-else>{{ ' ' }}</template>
            </template>
          </span>
        </h1>
        <p class="lead">
          ChurchOS keeps your people, your teaching tracks, and your church website
          in one system — so the admin gets done and you get back to ministry.
        </p>
        <div class="hero-actions">
          <a :href="DEMO_URL" class="btn btn-primary">Try the live demo</a>
          <a href="#modules" class="btn btn-ghost">See the modules</a>
          <button class="btn btn-icon" @click="replayShutter" aria-label="Replay headline animation" title="Replay">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
          </button>
        </div>
        <p class="hero-note">Free demo sandbox · Full access · Changes reset when you leave</p>
      </div>
    </section>

    <!-- Stats -->
    <section class="container">
      <div class="stats">
        <div v-for="s in stats" :key="s.num">
          <div class="stat-num">{{ s.num }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <!-- Modules -->
    <section id="modules" class="section">
      <div class="container">
        <span class="eyebrow">The modules</span>
        <h2 class="display">Three modules. One church.</h2>
        <p class="lead" style="margin-top: 18px;">
          Each module solves one real problem. Together they remove the
          patchwork of spreadsheets, group chats, and forgotten logins.
        </p>

        <div class="feature-rows" style="margin-top: 56px;">
          <article v-for="f in features" :key="f.id" class="feature-row">
            <div>
              <div class="feature-label">{{ f.id }} — {{ f.label }}</div>
              <h3 class="feature-title">{{ f.title }}</h3>
            </div>
            <div>
              <p class="feature-copy">{{ f.copy }}</p>
              <ul class="feature-list">
                <li v-for="p in f.points" :key="p">{{ p }}</li>
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Why -->
    <section id="why" class="section">
      <div class="container">
        <span class="eyebrow">Why ChurchOS</span>
        <h2 class="display">Built like software should be.</h2>

        <div class="grid-2" style="margin-top: 56px;">
          <div class="stack gap-sm">
            <h3 class="feature-title" style="font-size: 1.25rem;">Your data, truly yours</h3>
            <p class="muted" style="max-width: 46ch;">
              Every church gets an isolated workspace. Row-level security keeps
              each congregation\u2019s records separate — not by convention, but enforced
              at the database.
            </p>
          </div>
          <div class="stack gap-sm">
            <h3 class="feature-title" style="font-size: 1.25rem;">Serious about privacy</h3>
            <p class="muted" style="max-width: 46ch;">
              Member records are sensitive. ChurchOS treats them that way —
              access is scoped, auditable, and never shared across organisations.
            </p>
          </div>
          <div class="stack gap-sm">
            <h3 class="feature-title" style="font-size: 1.25rem;">Multilingual by default</h3>
            <p class="muted" style="max-width: 46ch;">
              Malaysian churches serve multiple languages. Pages ships with
              English, Chinese, Bahasa Melayu, and Tamil content from day one.
            </p>
          </div>
          <div class="stack gap-sm">
            <h3 class="feature-title" style="font-size: 1.25rem;">No lock-in</h3>
            <p class="muted" style="max-width: 46ch;">
              Your content is exportable, your domain is yours, and the system
              runs on standard infrastructure. Leave whenever you need to.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="section pricing-section">
      <div class="container">
        <span class="eyebrow">Pricing</span>
        <h2 class="display">Pick your modules. Pay for what you use.</h2>
        <p class="lead" style="margin-top: 18px;">
          Start with one module and add more as you grow. Every plan includes all the
          core tools that module needs — no per-feature upsells.
        </p>

        <div class="billing-row">
          <span class="billing-label">Billing cycle</span>
          <div class="billing-toggle" role="group" aria-label="Billing cycle">
            <button :class="{ on: billing === 'monthly' }" @click="billing = 'monthly'">Monthly</button>
            <button :class="{ on: billing === 'annual' }" @click="billing = 'annual'">Annual <em>−30%</em></button>
          </div>
        </div>

        <div class="price-grid">
          <article v-for="(m, mi) in modulePlans" :key="m.id" class="price-card" :class="`price-card--${m.accent}`" :style="{ '--delay': (0.12 + mi * 0.1).toFixed(2) + 's' }">
            <div class="price-card__glow" aria-hidden="true"></div>
            <div class="price-card__inner">
              <header class="price-card__head">
                <span class="price-card__icon" aria-hidden="true">
                  <svg v-if="m.icon === 'users'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <svg v-else-if="m.icon === 'route'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>
                  <svg v-else-if="m.icon === 'globe'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </span>
                <div>
                  <h3 class="price-card__name">{{ m.name }}</h3>
                  <p class="price-card__code">{{ m.code }} · {{ m.tag }}</p>
                </div>
              </header>

              <p class="price-card__blurb">{{ m.blurb }}</p>

              <div class="price-rows">
                <div v-for="t in m.tiers" :key="t.name" class="price-row">
                  <div class="price-row__label">
                    <span>{{ t.name }}</span>
                    <em>{{ t.cap }}</em>
                  </div>
                  <div class="price-row__amount">
                    {{ fmtPrice(t, billing === 'annual') }}<span class="price-row__per">{{ fmtPer(billing === 'annual') }}</span>
                  </div>
                </div>
              </div>

              <ul class="price-feats">
                <li v-for="f in m.features" :key="f">
                  <span class="price-check" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                  {{ f }}
                </li>
              </ul>

              <a :href="DEMO_URL" class="price-cta">Try {{ m.name }} in the demo →</a>
            </div>
          </article>

          <!-- Bundle card (highlighted) -->
          <article class="price-card price-card--bundle price-card--featured" style="--delay: 0.5s">
            <div class="price-card__glow" aria-hidden="true"></div>
            <div class="price-card__inner">
              <span class="price-badge">Best value</span>
              <header class="price-card__head">
                <span class="price-card__icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></svg>
                </span>
                <div>
                  <h3 class="price-card__name">{{ bundlePlan.name }}</h3>
                  <p class="price-card__code">{{ bundlePlan.code }} · {{ bundlePlan.tag }}</p>
                </div>
              </header>

              <p class="price-card__blurb">{{ bundlePlan.blurb }}</p>

              <div class="price-rows">
                <div v-for="t in bundlePlan.tiers" :key="t.name" class="price-row">
                  <div class="price-row__label">
                    <span>{{ t.name }}</span>
                    <em>{{ t.cap }}</em>
                  </div>
                  <div class="price-row__amount">
                    {{ fmtPrice(t, billing === 'annual') }}<span class="price-row__per">{{ fmtPer(billing === 'annual') }}</span>
                  </div>
                </div>
              </div>

              <ul class="price-feats">
                <li v-for="f in bundlePlan.features" :key="f">
                  <span class="price-check" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                  {{ f }}
                </li>
              </ul>

              <a :href="DEMO_URL" class="price-cta">Try the demo →</a>
            </div>
          </article>
        </div>

        <p class="pricing-note">
          Try every plan in the live demo sandbox. Annual billing is 30% off the
          monthly total. Workspaces are activated once a plan is arranged.
        </p>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-band">
      <div class="container">
        <h2 class="display">Bring the admin back into order.</h2>
        <p class="lead" style="margin: 24px auto 0;">
          Explore a fully working workspace in the demo, or register your church
          when you're ready to go live.
        </p>
        <div style="margin-top: 40px; display:flex; gap:14px; justify-content:center; flex-wrap:wrap;">
          <a :href="DEMO_URL" class="btn btn-primary">Try the live demo</a>
          <a :href="SIGNUP_URL" class="btn btn-ghost">Register your church</a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <NuxtLink to="/" class="nav-brand">
              <span class="mark" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
                  <path d="M7 1 L13 13 H1 Z" />
                  <line x1="4" y1="8.5" x2="10" y2="8.5" />
                </svg>
              </span>
              ChurchOS
            </NuxtLink>
            <p>Church management for Malaysia. People, discipleship, and a website — in one quiet, dependable system.</p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><a href="#modules">Modules</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a :href="DEMO_URL">Try the demo</a></li>
              <li><a :href="LOGIN_URL">Sign in</a></li>
              <li><a :href="SIGNUP_URL">Register</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="https://nikkohosting.com" rel="noopener">NikkoHosting</a></li>
              <li><a href="https://churchos.my" aria-disabled="true">Status</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><a href="/terms">Terms</a></li>
              <li><a href="/privacy">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 ChurchOS</span>
          <span>churchos.my</span>
        </div>
      </div>
    </footer>
  </div>
</template>
