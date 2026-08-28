<script setup lang="ts">
const features = [
  { title: 'Journey', desc: 'Plan sermons, events, and follow-up workflows' },
  { title: 'People', desc: 'Member directory, groups, and pastoral care' },
  { title: 'Pages', desc: 'Custom church website with multilingual support' }
]
</script>

<template>
  <div class="min-h-screen bg-[#171717] text-gray-200">
    <header class="container mx-auto px-6 py-8">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-white">ChurchOS</h1>
        <nav>
          <NuxtLink to="/login" class="text-gray-400 hover:text-white transition-colors">Sign In</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="container mx-auto px-6 py-16">
      <section class="text-center py-20">
        <h2 class="text-5xl font-bold text-white mb-6">All-in-one church platform</h2>
        <p class="text-xl text-gray-400 max-w-2xl mx-auto">
          Journey for sermon planning, People for member management, Pages for your church website.
        </p>
        <div class="mt-8">
          <NuxtLink to="/signup"
             class="inline-block bg-white text-black px-8 py-3 rounded font-medium hover:bg-gray-200 transition">
            Get Started
          </NuxtLink>
        </div>
      </section>

      <section class="grid md:grid-cols-3 gap-8 py-20">
        <div
          v-for="f in features"
          :key="f.title"
          class="border border-gray-800 p-6 rounded-lg"
        >
          <h3 class="text-xl font-bold text-white mb-2">{{ f.title }}</h3>
          <p class="text-gray-400">{{ f.desc }}</p>
        </div>
      </section>

      <section class="py-20 border-t border-gray-800">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p class="text-gray-400">14-day free trial • No credit card required</p>
        </div>
        <div class="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div class="border border-gray-800 p-8 rounded-lg text-center">
            <h3 class="text-xl font-bold text-white mb-2">Starter</h3>
            <p class="text-3xl font-bold text-white mb-4">RM 236<span class="text-sm text-gray-500">/mo</span></p>
            <p class="text-gray-400 mb-6">All modules. Up to 100 members.</p>
            <NuxtLink to="/signup" class="inline-block bg-white text-black px-6 py-2 rounded font-medium hover:bg-gray-200 transition">Get Started</NuxtLink>
          </div>
          <div class="border-2 border-white p-8 rounded-lg text-center">
            <h3 class="text-xl font-bold text-white mb-2">Growth</h3>
            <p class="text-3xl font-bold text-white mb-4">RM 474<span class="text-sm text-gray-500">/mo</span></p>
            <p class="text-gray-400 mb-6">All modules. Up to 300 members.</p>
            <NuxtLink to="/signup" class="inline-block bg-white text-black px-6 py-2 rounded font-medium hover:bg-gray-200 transition">Get Started</NuxtLink>
          </div>
          <div class="border border-gray-800 p-8 rounded-lg text-center">
            <h3 class="text-xl font-bold text-white mb-2">Pro</h3>
            <p class="text-3xl font-bold text-white mb-4">RM 746<span class="text-sm text-gray-500">/mo</span></p>
            <p class="text-gray-400 mb-6">All modules. Unlimited members.</p>
            <NuxtLink to="/signup" class="inline-block bg-white text-black px-6 py-2 rounded font-medium hover:bg-gray-200 transition">Get Started</NuxtLink>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-gray-800 py-8 text-center text-gray-500">
      <p>&copy; 2026 ChurchOS. Multi-tenant SaaS for churches.</p>
    </footer>
  </div>
</template>
