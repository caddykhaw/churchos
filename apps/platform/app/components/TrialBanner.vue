<template>
  <div class="trial-banner" role="status">
    <div>
      <strong>You're on a free trial.</strong>
      {{ daysLeft }} day{{ daysLeft === 1 ? '' : 's' }} remaining.
    </div>
    <NuxtLink to="/account/billing" class="btn btn-sm">Manage billing</NuxtLink>
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
