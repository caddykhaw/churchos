<template>
  <div class="trial-banner" role="status">
    <div>
      <strong>You&apos;re on a free trial.</strong>
      {{ daysLeft }} day{{ daysLeft === 1 ? '' : 's' }} remaining.
    </div>
    <NuxtLink to="/account/billing" class="cta">Manage billing</NuxtLink>
  </div>
</template>

<script setup lang="ts">
const { currentOrg } = useOrg()

const daysLeft = computed(() => {
  const trialEndsAt = currentOrg.value?.trial_ends_at
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
})
</script>

<style scoped>
.trial-banner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; margin-bottom: 1.5rem; background: #fef3c7; border: 1px solid #fbbf24; border-radius: .375rem; color: #78350f; }
.cta { padding: .375rem .75rem; background: #d97706; border-radius: .375rem; color: white; font-size: .875rem; font-weight: 600; text-decoration: none; white-space: nowrap; }
</style>
