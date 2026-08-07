<template>
  <div class="home-page bg-light min-vh-100">
    <div class="container my-3">
      <div class="row g-3">
        <div class="col-lg-3 d-none d-lg-block">
          <CategorySidebar />
        </div>
        <div class="col-lg-9 col-12">
          <MainBanner />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CategorySidebar from '../components/home/CategorySidebar.vue'
import MainBanner from '../components/home/MainBanner.vue'
</script>

<style lang="scss" scoped>
.home-page {
  background-color: #f4f6f8;
}
</style>