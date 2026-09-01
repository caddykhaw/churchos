<script setup lang="ts">
useHead({ title: 'Terms of Service — ChurchOS' })
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
        <h1 class="display">Terms of Service</h1>
        <p class="lead" style="margin-top: 16px;">
          Effective {{ lastUpdated }}
        </p>
      </div>
    </section>

    <section style="padding-bottom: 100px;">
      <div class="container" style="max-width: 720px;">
        <div class="stack gap-md">

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">1. Agreement</h3>
            <p class="muted">
              These Terms of Service (“Terms”) govern your access to and use of ChurchOS
              (the “Service”), operated by NikkoHosting (we, us, our). By accessing or using
              the Service, you agree to be bound by these Terms. If you do not agree, do not
              use the Service.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">2. Services</h3>
            <p class="muted">
              ChurchOS provides a multi-tenant software platform for church management,
              including People (member directory), Journey (discipleship tracks), and Pages
              (church website builder). Each church receives an isolated workspace with
              row-level data isolation enforced at the database.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">3. Accounts</h3>
            <p class="muted">
              You are responsible for maintaining the confidentiality of your account
              credentials and for all activity that occurs under your account. You must
              be a church leader or authorised representative to create an organisation
              on ChurchOS.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">4. Trial & Billing</h3>
            <p class="muted">
              New accounts receive a 14-day free trial with full access to all modules.
              No credit card is required during the trial. After the trial, your account
              switches to read-only until a paid plan is selected. You may cancel your
              subscription at any time, which will take effect at the end of the current
              billing cycle.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">5. Data Ownership & Privacy</h3>
            <p class="muted">
              Your church retains all rights to the data entered into ChurchOS. We will
              not sell, license, or disclose member data except as described in our
              Privacy Policy. Each organisation’s data is isolated by row-level security
              policies and never shared with other organisations on the platform.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">6. Acceptable Use</h3>
            <p class="muted">
              You agree not to misuse the Service — no spam, no scraping, no attempting to
              bypass tenant isolation, and no uploading of data for which you lack the
              necessary consent (including member personal data under Malaysian PDPA).
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">7. Intellectual Property</h3>
            <p class="muted">
              ChurchOS, the ChurchOS logo, and all related branding are our property.
              These Terms do not grant you any right to use, reproduce, or distribute
              our trademarks without prior written consent.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">8. Modifications</h3>
            <p class="muted">
              We may update these Terms from time to time. Material changes will be
              communicated via email or through the Service. Your continued use of the
              Service after such changes constitutes acceptance of the revised Terms.
            </p>
          </div>

          <div>
            <h3 class="feature-title" style="font-size: 1.1rem; margin-bottom: 14px;">9. Governing Law</h3>
            <p class="muted">
              These Terms are governed by and construed in accordance with the laws of
              Malaysia, without regard to conflict of law principles.
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
