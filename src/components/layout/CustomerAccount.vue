<script setup lang="ts">
import CustomerSidebar from '../Customer/CustomerSidebar.vue'
import TheHeader from './TheHeader.vue';
</script>

<template>  
    <div id="app">
        <TheHeader />
    </div>
    <main class="customer-layout">
        <div class="customer-container">
        <CustomerSidebar />
        <section class="customer-content">
            <RouterView />
        </section>
        </div>
    </main>
</template>

<style scoped>
.customer-layout {
  min-height: calc(100vh - 120px);
  padding: 32px 20px 56px;
  background: #f5f5f5;
  font-family:
    Inter,
    Arial,
    sans-serif;
}

.customer-container {
  display: flex;
  width: min(1200px, 100%);
  gap: 24px;
  margin: 0 auto;
}

.customer-content {
  min-width: 0;
  flex: 1;
}

@media (max-width: 768px) {
  .customer-container {
    flex-direction: column;
  }
}
</style>