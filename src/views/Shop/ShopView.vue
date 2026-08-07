<template>
  <div class="shop-view-wrapper min-vh-100 bg-light py-4">
    <div class="container">
      <div class="card border-0 shadow-sm p-4 mb-4 bg-white rounded-3">
        <div class="row align-items-center">
          <div class="col-md-auto text-center mb-3 mb-md-0">
            <img :src="shopAvatar" :alt="shopInfo.name" class="shop-avatar rounded-circle border" />
          </div>

          <div class="col-md">
            <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
              <h3 class="fw-bold mb-0 text-success">{{ shopInfo.name }}</h3>
              
              <span class="badge text-uppercase" :class="levelBadgeClass">
                {{ shopInfo.level }}
              </span>
            </div>

            <div class="text-muted small mb-1">@{{ shopInfo.username }}</div>
            <p class="text-secondary mb-2 small">{{ shopInfo.description || 'Chưa có mô tả shop.' }}</p>

            <div class="d-flex flex-wrap gap-3 text-muted small mb-3">
              <div>
                <font-awesome-icon icon="fa-solid fa-phone" class="me-1 text-success" />
                {{ shopInfo.phone }}
              </div>
              <div>
                <font-awesome-icon icon="fa-solid fa-envelope" class="me-1 text-success" />
                {{ shopInfo.email }}
              </div>
            </div>

            <div class="d-flex flex-wrap gap-4 text-secondary small pt-2 border-top">
              <div>
                <font-awesome-icon icon="fa-solid fa-star" class="text-warning me-1" />
                <strong>{{ Number(shopInfo.rating).toFixed(1) }}</strong> 
                <span class="text-muted">({{ formatNumber(shopInfo.rating_count) }} đánh giá)</span>
              </div>
              <div>
                <font-awesome-icon icon="fa-solid fa-box" class="me-1" />
                <strong>{{ formatNumber(shopInfo.totalProducts) }}</strong> Sản phẩm
              </div>
              <div>
                <font-awesome-icon icon="fa-solid fa-user-group" class="me-1" />
                <strong>{{ formatNumber(shopInfo.followers) }}</strong> Người theo dõi
              </div>
            </div>
          </div>

          <div class="col-md-auto mt-3 mt-md-0 text-end align-self-start">
            <button 
              class="btn me-2" 
              :class="activeTab === 'manage' ? 'btn-success' : 'btn-outline-success'"
              @click="activeTab = 'manage'"
            >
              <font-awesome-icon icon="fa-solid fa-sliders" class="me-1" />
              Quản lý (Manage)
            </button>
            <button 
              class="btn" 
              :class="activeTab === 'preview' ? 'btn-success' : 'btn-outline-secondary'"
              @click="activeTab = 'preview'"
            >
              <font-awesome-icon icon="fa-solid fa-store" class="me-1" />
              Xem giao diện Khách
            </button>
          </div>
        </div>
      </div>

      <div>
        <div v-if="activeTab === 'manage'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="fw-bold text-dark mb-0">Quản lý kho hàng sản phẩm</h4>
          </div>
          <ProductManagement />
        </div>

        <div v-else class="text-center py-5 bg-white rounded shadow-sm">
          <font-awesome-icon icon="fa-solid fa-store" class="display-1 text-success mb-3" />
          <h5>Giao diện xem shop cho Khách hàng</h5>
          <p class="text-muted">Bấm "Quản lý (Manage)" ở trên để chỉnh sửa danh sách sản phẩm.</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import ProductManagement from '../components/ProductManagement.vue'

export interface Shop {
  shop_id: number
  username: string
  name: string
  phone: string
  email: string
  description: string
  rating: number
  rating_count: number
  followers: number
  totalProducts: number
  level: string
  deleted_at?: string | null
}

const activeTab = ref<'manage' | 'preview'>('manage')

const shopInfo = reactive<Shop>({
  shop_id: 1,
  username: 'nhathuoc_thanthien',
  name: 'Nhà Thuốc Thân Thiện & Sức Khỏe',
  phone: '0987654321',
  email: 'contact@thanthienpharmacy.com',
  description: 'Chuyên cung cấp thực phẩm chức năng, dược mỹ phẩm chính hãng 100%',
  rating: 4.9,
  rating_count: 1240,
  followers: 10500,
  totalProducts: 120,
  level: 'official' // 'basic' | 'official' | 'vip'
})

const shopAvatar = ref('https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=150')

// Đổi màu Badge theo Cấp độ Shop (level)
const levelBadgeClass = computed(() => {
  switch (shopInfo.level.toLowerCase()) {
    case 'official':
      return 'bg-success'
    case 'vip':
      return 'bg-warning text-dark'
    default:
      return 'bg-secondary'
  }
})

const formatNumber = (num: number): string => {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}
</script>

<style lang="scss" scoped>
.shop-avatar {
  width: 90px;
  height: 90px;
  object-fit: cover;
}
</style>