<script setup lang="ts">
useHead({ title: 'Privacy Policy — ChurchOS' })
const lastUpdated = 'September 2026'
</script>

<template>
  <div>
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
        <div class="nav-actions">
          <NuxtLink to="/" class="btn btn-ghost btn-sm">← Back to home</NuxtLink>
        </div>
      </div>
    </header>

    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Legal</span>
        <h1 class="display">Privacy Policy</h1>
        <p class="lead" style="margin-top: 16px;">
          Effective {{ lastUpdated }}
        </p>
      </div>
    </section>

    <section style="padding-bottom: 100px;">
      <div class="container" style="max-width: 720px;">
        <div class="stack gap-md">

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">1. Information We Collect</h3>
            <p class="muted">
              When you create an account, we collect your name, email address, and the church
              or organisation you represent. As a church leader, you may enter member and
              congregant data into the People directory — this includes names, contact details,
              small group memberships, and giving records.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">2. How We Use Your Data</h3>
            <p class="muted">
              We use data to provide the Service, authenticate your access, generate reports,
              and communicate service-related updates (e.g., trial expiring, password resets).
              We do not use member contact details for marketing.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">3. Data Storage & Security</h3>
            <p class="muted">
              Data is stored on self-hosted PostgreSQL infrastructure in Malaysia. Each
              church receives an isolated workspace, and row-level security (RLS) policies
              enforce that your congregation’s data is never visible to other organisations.
              We retain data only for as long as your account is active, unless retention is
              required by law.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">4. Sharing & Disclosure</h3>
            <p class="muted">
              We do not sell, license, or otherwise share your data with third parties for
              their marketing purposes. We never publish or disclose member information
              belonging to one church to any other church or organisation. Payment processing
              is handled by Stripe — see Stripe’s own privacy documentation for data they
              collect at checkout.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">5. Cookies</h3>
            <p class="muted">
              ChurchOS uses essential cookies only — to keep you signed in during your session
              and to preserve your interface preferences. We do not use tracking or analytics
              cookies.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">6. Your Rights</h3>
            <p class="muted">
              You may request a copy of, correction to, or deletion of your congregation’s
              data at any time by contacting us at support@churchos.my. Where legally
              required, you also have the right to lodge a complaint with the Malaysian
              Department of Personal Data Protection (JPDP).
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">7. Updates to This Policy</h3>
            <p class="muted">
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email or through the Service.
            </p>
          </div>

          <div class="small muted" style="margin-top: 40px;">
            Questions? Contact us at <a href="mailto:support@churchos.my" style="text-decoration: underline;">support@churchos.my</a>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container footer-bottom" style="border-top: 0; margin-top: 0; padding-top: 0;">
        <span>© 2026 ChurchOS</span>
        <span>churchos.my</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
</script>
