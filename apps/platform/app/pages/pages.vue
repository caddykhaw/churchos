<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Module · Pages</span>
      <h1 class="display">Church website</h1>
      <p class="lead muted">A people-centric website builder with multilingual content — publish pages your church can be proud of.</p>
    </header>

    <div v-if="locked" class="empty-state">
      <h2 class="display">Pages isn't available yet</h2>
      <p class="muted">
        {{ lockedMessage }}
      </p>
      <div class="actions">
        <NuxtLink to="/account/billing" class="btn btn-primary">Plan &amp; workspace</NuxtLink>
      </div>
    </div>

    <template v-else>
      <div class="toolbar">
        <p v-if="!loading && !error" class="muted small">
          {{ pages.filter((p) => p.published).length }} of {{ pages.length }} pages published
        </p>
        <button class="btn btn-primary" @click="showForm = !showForm">
          {{ showForm ? 'Close form' : '+ New page' }}
        </button>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <form v-if="showForm" class="card form-card" @submit.prevent="handleCreate">
        <h2 class="display" style="font-size: 1.2rem; margin-bottom: 16px;">Create a page</h2>
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="page-title">Title (English) *</label>
            <input id="page-title" v-model="form.title_en" class="input" required placeholder="Sunday Service">
          </div>
          <div class="field">
            <label class="field-label" for="page-slug">Slug *</label>
            <input
              id="page-slug"
              v-model="form.slug"
              class="input"
              required
              spellcheck="false"
              placeholder="sunday-service"
            >
            <p class="field-hint">Lowercase letters, numbers, and hyphens. This becomes the page's URL.</p>
          </div>
          <div class="field">
            <label class="field-label" for="page-title-zh">Title (中文)</label>
            <input id="page-title-zh" v-model="form.title_zh" class="input" placeholder="主日崇拜">
          </div>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create page' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>

      <div v-if="loading" class="muted small" style="padding: 24px 4px;">Loading pages…</div>

      <div v-else-if="pages.length === 0" class="empty-state">
        <h2 class="display">No pages yet</h2>
        <p class="muted">Create your first page — welcome, about us, service times, or anything else.</p>
        <div class="actions">
          <button class="btn btn-primary" @click="showForm = true">+ Create first page</button>
        </div>
      </div>

      <div v-else class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Slug</th>
                <th>Status</th>
                <th class="col-right">Published</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in pages" :key="page.id">
                <td>
                  <div class="cell-primary">{{ page.title_en }}</div>
                  <div v-if="page.title_zh" class="cell-sub">{{ page.title_zh }}</div>
                </td>
                <td>
                  <code class="cell-code">{{ page.slug }}</code>
                </td>
                <td>
                  <span class="badge" :class="page.published ? 'badge-emerald' : 'badge-neutral'">
                    {{ page.published ? 'published' : 'draft' }}
                  </span>
                </td>
                <td class="col-right">
                  <button
                    class="toggle"
                    role="switch"
                    :aria-checked="page.published"
                    :aria-label="`${page.published ? 'Unpublish' : 'Publish'} ${page.title_en}`"
                    :class="{ 'toggle--on': page.published }"
                    :disabled="updatingId === page.id"
                    @click="togglePublish(page)"
                  >
                    <span class="toggle__thumb" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Page } from '@churchos/database'

definePageMeta({ middleware: 'auth' })

const loading = ref(true)
const error = ref('')
const locked = ref(false)
const lockedMessage = ref("Your workspace isn't active yet. Activate your plan to use this module.")
const pages = ref<Page[]>([])
const showForm = ref(false)
const creating = ref(false)
const updatingId = ref<string | null>(null)
const formError = ref('')
const form = ref({ title_en: '', title_zh: '', slug: '' })

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    const data = value.data
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

async function loadPages() {
  loading.value = true
  error.value = ''
  try {
    pages.value = await $fetch<Page[]>('/api/pages')
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 403) {
      locked.value = true
      const message = errorMessage(err, '')
      if (message) lockedMessage.value = message
    } else {
      error.value = errorMessage(err, 'Failed to load pages')
    }
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  creating.value = true
  formError.value = ''
  try {
    const page = await $fetch<Page>('/api/pages', {
      method: 'POST',
      body: {
        title_en: form.value.title_en,
        title_zh: form.value.title_zh,
        slug: form.value.slug
      }
    })
    pages.value = [page, ...pages.value]
    showForm.value = false
    form.value = { title_en: '', title_zh: '', slug: '' }
  } catch (err: unknown) {
    formError.value = errorMessage(err, 'Failed to create page')
  } finally {
    creating.value = false
  }
}

async function togglePublish(page: Page) {
  updatingId.value = page.id
  try {
    const updated = await $fetch<Page>(`/api/pages/${page.id}`, {
      method: 'PATCH',
      body: { published: !page.published }
    })
    const index = pages.value.findIndex((candidate) => candidate.id === page.id)
    if (index !== -1) pages.value[index] = updated
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Failed to update page')
  } finally {
    updatingId.value = null
  }
}

onMounted(() => {
  void loadPages()
})
</script>