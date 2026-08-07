<!-- src/layouts/DefaultLayout.vue -->
<template>
  <div class="default-layout">
    <TheHeader />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import TheHeader from '@/components/layout/TheHeader.vue'
</script>