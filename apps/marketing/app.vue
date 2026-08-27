<script setup>
const features = [
  { title: 'Journey', desc: 'Plan sermons, events, and follow-up workflows' },
  { title: 'People', desc: 'Member directory, groups, and pastoral care' },
  { title: 'Pages', desc: 'Custom pages for your church website' }
]
</script>

<template>
  <div class="min-h-screen bg-[#171717] text-gray-200">
    <header class="container mx-auto px-6 py-8">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-white">ChurchOS</h1>
        <nav>
          <a href="https://app.churchos.my" class="text-gray-400 hover:text-white transition-colors">Sign In</a>
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
          <a href="https://app.churchos.my" 
             class="inline-block bg-white text-black px-8 py-3 rounded font-medium hover:bg-gray-200 transition">
            Get Started
          </a>
        </div>
      </section>

      <section class="grid md:grid-cols-3 gap-8 py-20">
        <div v-for="f in features" :key="f.title" class="border border-gray-800 p-6 rounded-lg">
          <h3 class="text-xl font-bold text-white mb-2">{{ f.title }}</h3>
          <p class="text-gray-400">{{ f.desc }}</p>
        </div>
      </section>
    </main>

    <footer class="border-t border-gray-800 py-8 text-center text-gray-500">
      <p>© 2026 ChurchOS. Multi-tenant SaaS for churches.</p>
    </footer>
  </div>
</template>
