<template>
  <div 
    id="loginWrapper" 
    class="min-vh-100 d-flex align-items-center justify-content-center py-4"
    :style="backgroundStyle"
  >
    <div class="container">
      <div class="row align-items-center g-4">

        <div class="col-md-6 col-12">
          <FormLogin />
        </div>

        <div class="col-md-6 col-12 text-center">
          <img
            :src="businessImg"
            alt="Business Illustration"
            class="img-fluid businessImg scale-in-bottom"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FormLogin from '../components/FormLogin.vue'
import businessImg from '@/assets/images/business.png'
import bgPharmacy from '@/assets/images/background.jpg'

const backgroundStyle = computed(() => ({
  backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url(${bgPharmacy})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat'
}))
</script>

<style lang="scss" scoped>
#loginWrapper {
  width: 100%;
  position: relative;

  .businessImg {
    max-height: 550px;
    object-fit: contain;
    filter: drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.1));
  }
}
</style>