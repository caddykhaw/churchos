<template>
  <div class="org-switcher">
    <button
      v-if="currentOrg"
      type="button"
      class="trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span class="org-icon" aria-hidden="true">{{ initial(currentOrg.name) }}</span>
      <span class="org-info">
        <span class="org-name">{{ currentOrg.name }}</span>
        <span class="org-slug">{{ currentOrg.slug }}.churchos.my</span>
      </span>
      <span aria-hidden="true">⌄</span>
    </button>

    <NuxtLink v-else to="/organizations/new" class="create-org">Create organization</NuxtLink>

    <div v-if="open" class="dropdown" role="menu">
      <button
        v-for="org in userOrgs"
        :key="org.id"
        type="button"
        class="org-item"
        role="menuitem"
        @click="switchOrg(org.slug)"
      >
        <span class="org-icon" aria-hidden="true">{{ initial(org.name) }}</span>
        <span class="org-info">
          <span class="org-name">{{ org.name }}</span>
          <span class="org-slug">{{ org.slug }}.churchos.my</span>
        </span>
        <span v-if="org.id === currentOrg?.id" aria-label="Current organization">✓</span>
      </button>
      <NuxtLink to="/organizations/new" class="new-org" role="menuitem">+ Create new organization</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const open = ref(false)
const { currentOrg, userOrgs, loadUserOrgs, switchOrg } = useOrg()

function initial(name: string) {
  return name.charAt(0).toUpperCase()
}

onMounted(() => {
  void loadUserOrgs()
})
</script>

<style scoped>
.org-switcher { position: relative; }
.trigger, .org-item { display: flex; align-items: center; gap: .5rem; width: 100%; padding: .5rem; background: transparent; border: 1px solid #e5e7eb; border-radius: .375rem; color: #111827; cursor: pointer; text-align: left; }
.org-icon { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: .375rem; background: #2563eb; color: white; font-weight: 600; }
.org-info { display: grid; flex: 1; min-width: 0; }
.org-name { overflow: hidden; font-size: .875rem; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.org-slug { color: #6b7280; font-size: .75rem; }
.dropdown { position: absolute; z-index: 10; top: calc(100% + .25rem); right: 0; left: 0; overflow: hidden; background: white; border: 1px solid #e5e7eb; border-radius: .375rem; box-shadow: 0 4px 6px rgb(0 0 0 / 10%); }
.org-item { border: 0; border-radius: 0; }
.org-item:hover { background: #f9fafb; }
.new-org, .create-org { display: block; padding: .75rem; color: #2563eb; font-size: .875rem; text-decoration: none; }
.new-org { border-top: 1px solid #e5e7eb; }
.create-org { border: 1px solid #e5e7eb; border-radius: .375rem; }
</style>
