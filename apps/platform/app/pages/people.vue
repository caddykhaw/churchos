<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Module · People</span>
      <h1 class="display">People directory</h1>
      <p class="lead muted">Members, families, donations, events, and volunteer scheduling — all in one place.</p>
    </header>

    <div v-if="locked" class="empty-state">
      <h2 class="display">People isn't in your plan</h2>
      <p class="muted">
        Your subscription doesn't include the PEOPLE module. Add it to start managing members.
      </p>
      <div class="actions">
        <NuxtLink to="/account/billing" class="btn btn-primary">Manage modules</NuxtLink>
      </div>
    </div>

    <template v-else>
      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            v-model="search"
            class="input"
            placeholder="Search by name or email…"
            aria-label="Search members"
            @input="debouncedSearch"
          >
        </div>
        <button class="btn btn-primary" @click="showForm = !showForm">
          {{ showForm ? 'Close form' : '+ Add member' }}
        </button>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <form v-if="showForm" class="card form-card" @submit.prevent="handleCreate">
        <h2 class="display" style="font-size: 1.2rem; margin-bottom: 16px;">Add a member</h2>
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="member-name">Full name *</label>
            <input id="member-name" v-model="form.full_name" class="input" required placeholder="John Lim">
          </div>
          <div class="field">
            <label class="field-label" for="member-number">Member number</label>
            <input id="member-number" v-model="form.member_number" class="input" placeholder="M-0001">
          </div>
          <div class="field">
            <label class="field-label" for="member-email">Email</label>
            <input id="member-email" v-model="form.email" class="input" type="email" placeholder="john@example.com">
          </div>
          <div class="field">
            <label class="field-label" for="member-phone">Phone</label>
            <input id="member-phone" v-model="form.phone" class="input" placeholder="+60 12-345 6789">
          </div>
          <div class="field">
            <label class="field-label" for="member-gender">Gender</label>
            <select id="member-gender" v-model="form.gender" class="input">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="member-status">Status</label>
            <select id="member-status" v-model="form.member_status" class="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="creating">
            {{ creating ? 'Adding…' : 'Add member' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>

      <div v-if="loading" class="muted small" style="padding: 24px 4px;">Loading members…</div>

      <div v-else-if="members.length === 0" class="empty-state">
        <h2 class="display">{{ search ? 'No matches' : 'No members yet' }}</h2>
        <p class="muted">
          <template v-if="search">Nothing matches “{{ search }}” — try a different search.</template>
          <template v-else>Add your first member to start building your church directory.</template>
        </p>
        <div v-if="!search" class="actions">
          <button class="btn btn-primary" @click="showForm = true">+ Add first member</button>
        </div>
      </div>

      <div v-else class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Gender</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member.id">
                <td>
                  <div class="cell-primary">{{ member.full_name }}</div>
                  <div v-if="member.member_number" class="cell-sub">{{ member.member_number }}</div>
                </td>
                <td>{{ member.email || '—' }}</td>
                <td>{{ member.phone || '—' }}</td>
                <td>{{ member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : '—' }}</td>
                <td><span class="badge" :class="statusBadge(member.member_status)">{{ member.member_status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Member } from '@churchos/database'

definePageMeta({ middleware: 'auth' })

const loading = ref(true)
const error = ref('')
const locked = ref(false)
const members = ref<Member[]>([])
const search = ref('')
const showForm = ref(false)
const creating = ref(false)
const formError = ref('')
const form = ref({
  full_name: '',
  member_number: '',
  email: '',
  phone: '',
  gender: '',
  member_status: 'active'
})

let searchTimer: ReturnType<typeof setTimeout> | null = null

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    const data = value.data
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

function statusBadge(status: string): string {
  if (status === 'active') return 'badge-emerald'
  if (status === 'pending') return 'badge-amber'
  return 'badge-neutral'
}

async function loadMembers() {
  loading.value = true
  error.value = ''
  try {
    const params = search.value.trim() ? { search: search.value.trim() } : {}
    members.value = await $fetch<Member[]>('/api/people', { query: params })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 403) {
      locked.value = true
    } else {
      error.value = errorMessage(err, 'Failed to load members')
    }
  } finally {
    loading.value = false
  }
}

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadMembers, 300)
}

async function handleCreate() {
  creating.value = true
  formError.value = ''
  try {
    const member = await $fetch<Member>('/api/people', {
      method: 'POST',
      body: { ...form.value }
    })
    members.value = [member, ...members.value]
    showForm.value = false
    form.value = { full_name: '', member_number: '', email: '', phone: '', gender: '', member_status: 'active' }
  } catch (err: unknown) {
    formError.value = errorMessage(err, 'Failed to add member')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void loadMembers()
})
</script>