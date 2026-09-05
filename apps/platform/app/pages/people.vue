<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Module · People</span>
      <h1 class="display">People directory</h1>
      <p class="lead muted">Members, families, donations, events, and volunteer scheduling — all in one place.</p>
    </header>

    <div v-if="locked" class="empty-state">
      <h2 class="display">People isn't available yet</h2>
      <p class="muted">
        {{ lockedMessage }}
      </p>
      <div class="actions">
        <NuxtLink to="/account/billing" class="btn btn-primary">Plan &amp; workspace</NuxtLink>
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
        <button class="btn btn-primary" @click="startCreate">{{ showForm ? 'Close form' : '+ Add member' }}</button>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <form v-if="showForm" class="card form-card" @submit.prevent="handleSave">
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
            {{ creating ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save changes' : 'Add member') }}
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
                <th>Actions</th>
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
                <td>
                  <button class="btn btn-ghost btn-sm" @click="openEdit(member)">Edit</button>
                  <button
                    v-if="member.member_status !== 'former'"
                    class="btn btn-ghost btn-sm"
                    @click="handleArchive(member)"
                  >
                    Archive
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
import type { Member } from '@churchos/database'

definePageMeta({ middleware: 'auth' })

const loading = ref(true)
const error = ref('')
const locked = ref(false)
const lockedMessage = ref("Your workspace isn't active yet. Activate your plan to use this module.")
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
    const res = await $fetch<{ data: Member[]; total: number }>('/api/people', { query: params })
    members.value = res.data
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 403) {
      locked.value = true
      const message = errorMessage(err, '')
      if (message) lockedMessage.value = message
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

const editingId = ref<string | null>(null)

function startCreate() {
  editingId.value = null
  form.value = { full_name: '', member_number: '', email: '', phone: '', gender: '', member_status: 'active' }
  formError.value = ''
  showForm.value = !showForm.value
}

function openEdit(member: Member) {
  editingId.value = member.id
  showForm.value = true
  formError.value = ''
  form.value = {
    full_name: member.full_name,
    member_number: member.member_number ?? '',
    email: member.email ?? '',
    phone: member.phone ?? '',
    gender: member.gender ?? '',
    member_status: member.member_status
  }
}

async function handleSave() {
  if (!editingId.value) {
    await handleCreate()
    return
  }
  creating.value = true
  formError.value = ''
  try {
    const updated = await $fetch<Member>(`/api/people/${editingId.value}`, {
      method: 'PATCH',
      body: {
        full_name: form.value.full_name,
        email: form.value.email || null,
        phone: form.value.phone || null,
        gender: form.value.gender || null,
        member_status: form.value.member_status
      }
    })
    const index = members.value.findIndex((candidate) => candidate.id === updated.id)
    if (index !== -1) members.value[index] = updated
    showForm.value = false
    editingId.value = null
    form.value = { full_name: '', member_number: '', email: '', phone: '', gender: '', member_status: 'active' }
  } catch (err: unknown) {
    formError.value = errorMessage(err, 'Failed to update member')
  } finally {
    creating.value = false
  }
}

async function handleArchive(member: Member) {
  if (!confirm(`Archive ${member.full_name}? Their record is kept but marked as a former member.`)) return
  error.value = ''
  try {
    const updated = await $fetch<Member>(`/api/people/${member.id}`, { method: 'DELETE' })
    const index = members.value.findIndex((candidate) => candidate.id === updated.id)
    if (index !== -1) members.value[index] = updated
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Failed to archive member')
  }
}

onMounted(() => {
  void loadMembers()
})
</script>