<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Module · Journey</span>
      <h1 class="display">Discipleship tracks</h1>
      <p class="lead muted">Teaching tracks with mentors, progress, and certificates — guide people through their journey.</p>
    </header>

    <div v-if="locked" class="empty-state">
      <h2 class="display">Journey isn't in your plan</h2>
      <p class="muted">
        Your subscription doesn't include the JOURNEY module. Add it to start building discipleship tracks.
      </p>
      <div class="actions">
        <NuxtLink to="/account/billing" class="btn btn-primary">Manage modules</NuxtLink>
      </div>
    </div>

    <template v-else>
      <section v-if="!loading && !error" class="stat-grid" style="margin-bottom: 30px;">
        <article class="card stat-card">
          <div class="stat-label">Tracks</div>
          <div class="stat-value">{{ tracks.length }}</div>
          <p class="stat-sub">draft & published</p>
        </article>
        <article class="card stat-card">
          <div class="stat-label">Active enrollments</div>
          <div class="stat-value">{{ activeEnrollments }}</div>
          <p class="stat-sub">people currently on a track</p>
        </article>
        <article class="card stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value">{{ completedEnrollments }}</div>
          <p class="stat-sub">certificates issued</p>
        </article>
      </section>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="section-head">
        <h2 class="display" style="font-size: 1.35rem;">Tracks</h2>
        <button class="btn btn-primary btn-sm" @click="showForm = !showForm">
          {{ showForm ? 'Close' : '+ New track' }}
        </button>
      </div>

      <form v-if="showForm" class="card form-card" @submit.prevent="handleCreate">
        <h3 class="display" style="font-size: 1.1rem; margin-bottom: 16px;">Create a track</h3>
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="track-title">Title (English) *</label>
            <input id="track-title" v-model="form.title_en" class="input" required placeholder="Foundations of Faith">
          </div>
          <div class="field">
            <label class="field-label" for="track-title-zh">Title (中文)</label>
            <input id="track-title-zh" v-model="form.title_zh" class="input" placeholder="信仰根基">
          </div>
          <div class="field">
            <label class="field-label" for="track-desc">Description</label>
            <textarea id="track-desc" v-model="form.description" class="input" rows="3" placeholder="What will people learn on this track?" />
          </div>
          <div class="field">
            <label class="field-label" for="track-status">Status</label>
            <select id="track-status" v-model="form.status" class="input">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create track' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>

      <div v-if="loading" class="muted small" style="padding: 24px 4px;">Loading tracks…</div>

      <div v-else-if="tracks.length === 0" class="empty-state" style="margin-top: 24px;">
        <h2 class="display">No tracks yet</h2>
        <p class="muted">Create your first discipleship track — e.g. new believers, baptism prep, or leadership.</p>
        <div class="actions">
          <button class="btn btn-primary" @click="showForm = true">+ Create first track</button>
        </div>
      </div>

      <div v-else class="track-grid">
        <article
          v-for="track in tracks"
          :key="track.id"
          class="track-card"
          :class="`track-card--${track.status}`"
        >
          <header class="track-card__head">
            <h3 class="track-card__title">{{ track.title_en }}</h3>
            <span class="badge" :class="track.status === 'published' ? 'badge-emerald' : 'badge-neutral'">
              {{ track.status }}
            </span>
          </header>
          <p v-if="track.title_zh" class="track-card__zh">{{ track.title_zh }}</p>
          <p class="track-card__desc">{{ track.description || 'No description yet.' }}</p>
          <footer class="track-card__foot">
            <span class="track-card__count">
              {{ track.enrollments?.[0]?.count ?? 0 }} enrolled
            </span>
          </footer>
        </article>
      </div>

      <div class="section-head" style="margin-top: 44px;">
        <h2 class="display" style="font-size: 1.35rem;">Enrollments</h2>
      </div>
      <div v-if="enrollments.length" class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mentee</th>
                <th>Track</th>
                <th>Mentor</th>
                <th>Status</th>
                <th>Enrolled</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="enrollment in enrollments" :key="enrollment.id">
                <td>{{ enrollment.mentee?.full_name || '—' }}</td>
                <td>{{ enrollment.tracks?.title_en || '—' }}</td>
                <td>{{ enrollment.mentor?.full_name || '—' }}</td>
                <td><span class="badge" :class="enrollmentStatusBadge(enrollment.status)">{{ enrollment.status }}</span></td>
                <td>{{ formatDate(enrollment.enrolled_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p v-else-if="!loading" class="muted small" style="margin-top: 12px;">
        No enrollments yet — enrollments appear once mentees join a track.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Track } from '@churchos/database'

definePageMeta({ middleware: 'auth' })

type TrackWithEnrollments = Track & { enrollments?: Array<{ count: number }> | null }
type EnrollmentRow = {
  id: string
  status: string
  enrolled_at: string
  completed_at: string | null
  tracks: { title_en: string } | null
  mentee: { full_name: string } | null
  mentor: { full_name: string } | null
}

const loading = ref(true)
const error = ref('')
const locked = ref(false)
const tracks = ref<TrackWithEnrollments[]>([])
const enrollments = ref<EnrollmentRow[]>([])
const showForm = ref(false)
const creating = ref(false)
const formError = ref('')
const form = ref({ title_en: '', title_zh: '', description: '', status: 'draft' })

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    const data = value.data
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

function enrollmentStatusBadge(status: string): string {
  if (status === 'active') return 'badge-emerald'
  if (status === 'completed') return 'badge-violet'
  return 'badge-neutral'
}

const activeEnrollments = computed(() => enrollments.value.filter((e) => e.status === 'active').length)
const completedEnrollments = computed(() => enrollments.value.filter((e) => e.status === 'completed').length)

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function loadJourney() {
  loading.value = true
  error.value = ''
  try {
    const [trackData, enrollmentData] = await Promise.all([
      $fetch<TrackWithEnrollments[]>('/api/journey/tracks'),
      $fetch<EnrollmentRow[]>('/api/journey/enrollments')
    ])
    tracks.value = trackData
    enrollments.value = enrollmentData
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 403) {
      locked.value = true
    } else {
      error.value = errorMessage(err, 'Failed to load journey data')
    }
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  creating.value = true
  formError.value = ''
  try {
    const track = await $fetch<Track>('/api/journey/tracks', {
      method: 'POST',
      body: {
        title_en: form.value.title_en,
        title_zh: form.value.title_zh,
        description: form.value.description,
        status: form.value.status
      }
    })
    tracks.value = [{ ...track, enrollments: [{ count: 0 }] }, ...tracks.value]
    showForm.value = false
    form.value = { title_en: '', title_zh: '', description: '', status: 'draft' }
  } catch (err: unknown) {
    formError.value = errorMessage(err, 'Failed to create track')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void loadJourney()
})
</script>