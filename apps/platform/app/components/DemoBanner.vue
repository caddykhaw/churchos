<template>
  <div class="demo-banner" role="status">
    <div class="demo-banner__main">
      <span class="demo-banner__badge">Demo sandbox</span>
      <span>
        Everything is editable — changes reset when you sign out or reset the sandbox.
      </span>
    </div>

    <div class="demo-banner__actions">
      <label class="demo-role-label" for="demo-role">View as</label>
      <select id="demo-role" v-model="role" class="input demo-role-select">
        <option v-for="candidate in DEMO_ROLES" :key="candidate" :value="candidate">
          {{ capitalize(candidate) }}
        </option>
      </select>

      <button class="btn btn-sm btn-ghost" :disabled="resetting" @click="resetDemo">
        {{ resetting ? 'Resetting…' : 'Reset demo' }}
      </button>
      <button class="btn btn-sm btn-ghost" @click="endDemo">
        End demo
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEMO_ROLES, useDemoRole } from '../composables/useOrg'

const { demoRole: role } = useDemoRole()
const resetting = ref(false)

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function resetDemo() {
  resetting.value = true
  try {
    await $fetch('/api/demo/reset', { method: 'POST' })
    await navigateTo('/dashboard')
  } finally {
    resetting.value = false
  }
}

async function endDemo() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  await navigateTo('/auth/demo')
}
</script>