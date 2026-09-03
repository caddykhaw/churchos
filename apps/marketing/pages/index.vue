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

const stats = [
  { num: '3', label: 'Modules — People, Journey, Pages' },
  { num: '4', label: 'Languages — EN, 中文, BM, தமிழ்' },
  { num: '1', label: 'Church per workspace, zero data mixing' },
  { num: '14', label: 'Day free trial, no card required' }
]

const tiers = [
  { name: 'Starter', price: 'RM 236', per: '/month', note: 'Up to 100 members', members: '100' },
  { name: 'Growth', price: 'RM 474', per: '/month', note: 'Up to 300 members', members: '300' },
  { name: 'Pro', price: 'RM 746', per: '/month', note: 'Unlimited members', members: 'unlimited' }
]

const mobileMenuOpen = ref(false)
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
          <a href="https://app.churchos.my/auth/login" class="btn btn-ghost btn-sm">Sign in</a>
          <a href="https://app.churchos.my/auth/signup" class="btn btn-primary btn-sm">Start free trial</a>
          <button class="nav-mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Toggle menu">
            {{ mobileMenuOpen ? '✕' : '☰' }}
          </button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <span class="hero-tick"><span class="dot"></span> Built for Malaysian churches</span>
        <h1 class="display">
          Church administration,<br />quietly in order.
        </h1>
        <p class="lead">
          ChurchOS keeps your people, your teaching tracks, and your church website
          in one system — so the admin gets done and you get back to ministry.
        </p>
        <div class="hero-actions">
          <a href="https://app.churchos.my/auth/signup" class="btn btn-primary">Start your 14-day trial</a>
          <a href="#modules" class="btn btn-ghost">See the modules</a>
        </div>
        <p class="hero-note">No credit card during trial · Full access to all modules</p>
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
    <section id="pricing" class="section">
      <div class="container">
        <span class="eyebrow">Pricing</span>
        <h2 class="display">Simple per-member pricing.</h2>
        <p class="lead" style="margin-top: 18px;">
          One price per plan — all three modules included. No per-feature upsells.
        </p>

        <table class="pricing-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Members</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.name">
              <td class="pricing-name">{{ t.name }}</td>
              <td>
                <span class="pricing-price">{{ t.price }}</span>
                <span class="pricing-per">{{ t.per }}</span>
              </td>
              <td class="muted">{{ t.note }}</td>
              <td style="text-align: right;">
                <a href="https://app.churchos.my/auth/signup" class="btn btn-ghost btn-sm">Choose {{ t.name }}</a>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="pricing-note">
          14-day free trial. Annual billing available at 30% off.
          After the trial, accounts switch to read-only until reactivated.
        </p>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-band">
      <div class="container">
        <h2 class="display">Bring the admin back into order.</h2>
        <p class="lead" style="margin: 24px auto 0;">
          Set up your church in minutes. No credit card, no sales call, no friction.
        </p>
        <div style="margin-top: 40px;">
          <a href="https://app.churchos.my/auth/signup" class="btn btn-primary">Start your free trial</a>
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
              <li><a href="https://app.churchos.my/auth/login">Sign in</a></li>
              <li><a href="https://app.churchos.my/auth/signup">Start free trial</a></li>
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
