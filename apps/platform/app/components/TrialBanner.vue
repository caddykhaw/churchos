<template>
  <section class="trial-banner" aria-live="polite">
    <div>
      <strong>Free trial</strong>
      <span class="trial-copy">
        {{ daysLeft }} day{{ daysLeft === 1 ? '' : 's' }} remaining.
      </span>
    </div>
    <NuxtLink to="/account/billing" class="btn btn-ghost btn-sm">
      Choose a plan
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
const { currentOrg } = useOrg()

const daysLeft = computed(() => {
  const trialEndsAt = currentOrg.value?.trial_ends_at
  if (!trialEndsAt) return 0

  const remainingMs = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))
})
</script>

<style scoped>
.trial-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--line, #343434);
  background: var(--surface, #202020);
  color: var(--text, #f5f5f5);
}

.trial-copy {
  margin-left: 0.5rem;
  color: var(--muted, #a0a0a0);
}

@media (max-width: 480px) {
  .trial-banner {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
