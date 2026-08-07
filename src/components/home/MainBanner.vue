<template>
  <div class="main-banner-section container-xl my-3">
    <div class="row g-3 align-items-stretch">
      
      <!-- 1. BANNER CHÍNH -->
      <div class="col-lg-8 col-12">
        <swiper
          :modules="modules"
          :slides-per-view="1"
          :space-between="0"
          :loop="true"
          :autoplay="{ delay: 4000, disableOnInteraction: false }"
          :pagination="{ clickable: true }"
          :navigation="true"
          class="main-slider rounded-3 overflow-hidden shadow-sm"
        >
          <swiper-slide v-for="(banner, index) in mainBanners" :key="index">
            <img 
              :src="banner" 
              alt="Main Promotion Banner" 
              class="img-fluid w-100 main-banner-img"
              @error="handleMainImageError"
            />
          </swiper-slide>
        </swiper>
      </div>

      <!-- 2. BANNER PHỤ -->
      <div class="col-lg-4 col-12 d-flex flex-column gap-3 justify-content-between">
        
        <!-- Sub Banner 1 -->
        <router-link to="/combo" class="sub-banner-item rounded-3 overflow-hidden shadow-sm d-block">
          <img 
            src="https://cdn.upharma.vn/unsafe/3840x0/filters:quality(90)/banner/he-nay-den-upharma-mua-la-co-qua-hlvcey8j.png" 
            alt="Combo siêu giảm giá" 
            class="img-fluid w-100 sub-banner-img"
            @error="handleSubImageError"
          />
        </router-link>

        <!-- Sub Banner 2 -->
        <a href="#chat" class="sub-banner-item rounded-3 overflow-hidden shadow-sm d-block">
          <img 
            src="https://cdn.upharma.vn/unsafe/3840x0/filters:quality(90)/banner/chat-voi-duoc-si-pik76jex.png" 
            alt="Chat với dược sĩ" 
            class="img-fluid w-100 sub-banner-img"
            @error="handleSubImageError"
          />
        </a>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, Navigation } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

import banner1 from '@/assets/images/MainBanner.jpg'

const modules = [Autoplay, Pagination, Navigation]

const mainBanners = ref<string[]>([banner1])

const handleMainImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.src = 'https://via.placeholder.com/800x380/00823d/ffffff?text=Upharma+Main+Banner'
}

const handleSubImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.src = 'https://via.placeholder.com/400x180/e8f5e9/00823d?text=Sub+Banner'
}
</script>

<style lang="scss" scoped>
.main-banner-section {
  .main-slider {
    width: 100%;
    background-color: transparent;

    :deep(.swiper-button-next),
    :deep(.swiper-button-prev) {
      color: #ffffff;
      background: rgba(0, 0, 0, 0.3);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      opacity: 0;
      transition: all 0.2s ease;

      &::after {
        font-size: 14px;
        font-weight: bold;
      }

      &:hover {
        background: rgba(0, 0, 0, 0.6);
      }
    }

    &:hover {
      :deep(.swiper-button-next),
      :deep(.swiper-button-prev) {
        opacity: 1;
      }
    }

    :deep(.swiper-pagination-bullet) {
      background: rgba(255, 255, 255, 0.6);
      opacity: 1;
      transition: all 0.3s;
    }

    :deep(.swiper-pagination-bullet-active) {
      background: #ffffff;
      width: 22px;
      border-radius: 10px;
    }
  }

  .sub-banner-item {
    width: 100%;
    
    .sub-banner-img {
      width: 100%;
      display: block;
      transition: transform 0.3s ease;
    }

    &:hover .sub-banner-img {
      transform: scale(1.02);
    }
  }

  @media (min-width: 992px) {
    .main-slider {
      height: 100%;

      :deep(.swiper),
      :deep(.swiper-wrapper),
      :deep(.swiper-slide) {
        height: 100%;
      }

      .main-banner-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .sub-banner-item {
      height: calc(50% - 0.5rem);

      .sub-banner-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

  @media (max-width: 991.98px) {
    .main-banner-img,
    .sub-banner-img {
      height: auto;
      object-fit: contain;
    }
  }
}
</style>