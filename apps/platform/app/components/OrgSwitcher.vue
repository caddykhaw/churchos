<template>
  <div class="org-switcher">
    <button
      v-if="currentOrg"
      type="button"
      class="org-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span class="org-avatar" aria-hidden="true">{{ initial(currentOrg.name) }}</span>
      <span class="org-meta">
        <span class="org-name">{{ currentOrg.name }}</span>
        <span class="org-slug">{{ currentOrg.slug }}.churchos.my</span>
      </span>
      <span class="org-caret" aria-hidden="true">⌄</span>
    </button>

    <NuxtLink v-else to="/organizations/new" class="btn btn-ghost btn-block btn-sm">Create organization</NuxtLink>

    <div v-if="open" class="org-dropdown" role="menu">
      <button
        v-for="org in userOrgs"
        :key="org.id"
        type="button"
        class="org-item"
        :class="{ current: org.id === currentOrg?.id }"
        role="menuitem"
        @click="switchOrg(org.id)"
      >
        <span class="org-avatar" aria-hidden="true">{{ initial(org.name) }}</span>
        <span class="org-meta">
          <span class="org-name">{{ org.name }}</span>
          <span class="org-slug">{{ org.slug }}.churchos.my</span>
        </span>
        <span v-if="org.id === currentOrg?.id" class="check" aria-label="Current organization">✓</span>
      </button>
      <NuxtLink to="/organizations/new" class="org-create" role="menuitem">+ Create new organization</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const open = ref(false)
const { currentOrg, userOrgs, loadUserOrgs, selectOrg } = useOrg()

function initial(name: string) {
  return name.charAt(0).toUpperCase()
}

async function switchOrg(orgId: string) {
  if (orgId === currentOrg.value?.id) {
    open.value = false
    return
  }

  try {
    await selectOrg(orgId)
    await navigateTo('/dashboard')
  } catch {
    // Selection failed — keep the dropdown open so the user can retry.
  } finally {
    open.value = false
  }
}

onMounted(() => {
  void loadUserOrgs()
})
</script>
