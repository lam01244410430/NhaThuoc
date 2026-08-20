<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faBoxOpen,
  faComments,
  faHeart,
  faMagnifyingGlass,
  faPeopleGroup,
  faShieldHeart,
  faStar,
  faStore,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons'
import {
  shopService,
  type ProductPagination,
  type PublicShop,
  type PublicShopProduct,
} from '@/services/shop.service'
import ProductCard from '@/components/product/ProductCard.vue'

const route = useRoute()
const router = useRouter()
const shop = ref<PublicShop | null>(null)
const products = ref<PublicShopProduct[]>([])
const pagination = ref<ProductPagination>({ page: 1, limit: 24, total: 0, totalPages: 0 })
const loading = ref(true)
const productLoading = ref(false)
const errorMessage = ref('')

const routeShopId = computed(() => {
  const value = Number(route.params.shopId)
  return Number.isInteger(value) && value > 0 ? value : null
})


const initials = computed(() => {
  const name = shop.value?.shop_name?.trim() || 'Shop'
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')
})

const levelLabel = computed(() => {
  if (shop.value?.level === 'premium') return 'Premium'
  if (shop.value?.level === 'verified') return 'Đã xác minh'
  return 'Cửa hàng'
})

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const joinedText = computed(() => {
  if (!shop.value?.created_at) return 'Chưa cập nhật'
  const created = new Date(shop.value.created_at)
  if (Number.isNaN(created.getTime())) return 'Chưa cập nhật'
  const months = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
  if (months < 1) return 'Trong tháng này'
  if (months < 12) return `${months} tháng trước`
  const years = Math.floor(months / 12)
  return `${years} năm trước`
})

const loadProducts = async (page = 1) => {
  if (!shop.value) return
  productLoading.value = true
  try {
    const result = await shopService.getProducts(shop.value.id, {
      page,
      limit: pagination.value.limit,
    })
    products.value = result.products
    pagination.value = result.pagination
  } finally {
    productLoading.value = false
  }
}


const changePage = async (page: number) => {
  if (page < 1 || page > pagination.value.totalPages || page === pagination.value.page) return
  await loadProducts(page)
  window.scrollTo({ top: 300, behavior: 'smooth' })
}

const openProduct = (productId: number) => {
  void router.push({ name: 'product', params: { productId } })
}

const loadStorefront = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    if (!routeShopId.value) throw new Error('Không xác định được cửa hàng')

    shop.value = await shopService.getShop(routeShopId.value)
    await loadProducts(1)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    errorMessage.value = message || 'Không thể tải gian hàng'
  } finally {
    loading.value = false
  }
}

onMounted(loadStorefront)
watch(() => route.params.shopId, () => void loadStorefront())
</script>

<template>
  <main class="shop-storefront">
    <div v-if="loading" class="store-state">
      <FontAwesomeIcon :icon="faStore" />
      <span>Đang tải gian hàng...</span>
    </div>

    <div v-else-if="errorMessage" class="store-state error">
      <FontAwesomeIcon :icon="faBoxOpen" />
      <strong>{{ errorMessage }}</strong>
      <button type="button" @click="loadStorefront">Thử lại</button>
    </div>

    <template v-else-if="shop">
      <section class="store-info-section">
        <div class="store-hero">
          <div class="store-identity">
          <div class="store-identity__overlay"></div>
          <div class="store-profile">
            <div class="store-avatar">
              <img v-if="shop.avatar" :src="shop.avatar" :alt="shop.shop_name" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="store-name">
              <h1>{{ shop.shop_name }}</h1>
              <p>{{ shop.description || 'Gian hàng chính thức trên NhaThuoc' }}</p>
              <span class="level-badge"><FontAwesomeIcon :icon="faShieldHeart" /> {{ levelLabel }}</span>
            </div>
          </div>

          <div class="store-actions">
              <button type="button" class="outline-light" disabled title="Tính năng theo dõi đang được phát triển">
                <FontAwesomeIcon :icon="faUserPlus" /> Theo dõi
              </button>
              <button type="button" class="outline-light" disabled title="Tính năng chat đang được phát triển">
                <FontAwesomeIcon :icon="faComments" /> Chat
              </button>
          </div>
        </div>

        <div class="store-metrics">
          <div class="metric-item">
            <FontAwesomeIcon :icon="faBoxOpen" />
            <span>Sản phẩm</span>
            <strong>{{ formatNumber(shop.total_products) }}</strong>
          </div>
          <div class="metric-item">
            <FontAwesomeIcon :icon="faPeopleGroup" />
            <span>Người theo dõi</span>
            <strong>{{ formatNumber(shop.followers) }}</strong>
          </div>
          <div class="metric-item">
            <FontAwesomeIcon :icon="faStar" />
            <span>Đánh giá</span>
            <strong>{{ Number(shop.rating || 0).toFixed(1) }} ({{ formatNumber(shop.rating_count) }})</strong>
          </div>
          <div class="metric-item">
            <FontAwesomeIcon :icon="faHeart" />
            <span>Tham gia</span>
            <strong>{{ joinedText }}</strong>
          </div>
          </div>
        </div>
      </section>

      <section class="store-products-section">
        <div class="store-products">
          <header class="products-heading">
            <h2>Sản phẩm</h2>
            <span>{{ formatNumber(pagination.total) }} sản phẩm</span>
          </header>

        <div v-if="productLoading" class="product-loading">
          <FontAwesomeIcon :icon="faMagnifyingGlass" /> Đang tải sản phẩm...
        </div>

        <div v-else-if="products.length" class="product-grid">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            :disabled="product.stock_quantity <= 0"
            :add-to-cart-label="product.stock_quantity <= 0 ? 'Hết hàng' : 'Thêm vào giỏ'"
            @view="openProduct"
          />
        </div>

        <div v-else class="product-empty">
          <FontAwesomeIcon :icon="faBoxOpen" />
          <strong>Gian hàng chưa có sản phẩm đang bán</strong>
        </div>

          <div v-if="pagination.totalPages > 1" class="pagination">
            <button type="button" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">Trước</button>
            <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
            <button type="button" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">Sau</button>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.shop-storefront {
  min-height: 100vh;
  color: #1d2920;
  background: #f5f6f5;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}

.store-state {
  width: min(1360px, calc(100% - 48px));
  min-height: 360px;
  margin: 28px auto 56px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e6ebe7;
  font-size: 15px;
}
.store-state svg { font-size: 34px; color: #39b54a; }
.store-state.error strong { color: #b42318; }
.store-state button { border: 0; background: #39b54a; color: #fff; padding: 9px 16px; border-radius: 6px; }

.store-info-section {
  width: 100%;
  padding: 28px 0 26px;
  background: #fff;
}

.store-hero {
  width: min(1200px, calc(100% - 48px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(390px, 440px) minmax(0, 1fr);
  gap: 42px;
  align-items: center;
}

.store-identity {
  position: relative;
  min-height: 168px;
  overflow: hidden;
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #fff;  
  background: #2e6540;
  border-radius: 2px;
}

.store-identity::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(17, 52, 29, .54), rgba(17, 52, 29, .14)),
    radial-gradient(circle at 86% 18%, rgba(255,255,255,.13), transparent 30%);
  pointer-events: none;
}

.store-identity__overlay { display: none; }
.store-profile,
.store-actions { position: relative; z-index: 1; }
.store-profile { display: flex; align-items: center; gap: 16px; }

.store-avatar {
  width: 82px;
  height: 82px;
  flex: 0 0 82px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #2d8f3c;
  background: #fff;
  border: 3px solid rgba(255,255,255,.9);
  border-radius: 50%;
  font-size: 24px;
  font-weight: 800;
}
.store-avatar img { width: 100%; height: 100%; object-fit: cover; }
.store-name { min-width: 0; }
.store-name h1 { margin: 0 0 5px; font-size: 23px; font-weight: 700; line-height: 1.2; }
.store-name p {
  max-width: 280px;
  margin: 0 0 8px;
  overflow: hidden;
  color: rgba(255,255,255,.82);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  color: #fff;
  background: rgba(255,255,255,.13);
  border-radius: 4px;
  font-size: 12px;
}
.store-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.outline-light {
  min-height: 34px;
  color: #fff;
  background: rgba(0,0,0,.08);
  border: 1px solid rgba(255,255,255,.65);
  font-weight: 600;
  cursor: pointer;
}
.outline-light:disabled { cursor: default; opacity: .78; }

.store-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 44px;
  row-gap: 4px;
  align-content: center;
}
.metric-item {
  min-height: 46px;
  display: grid;
  grid-template-columns: 22px auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border: 0;
}
.metric-item svg { color: #4d5a51; font-size: 15px; }
.metric-item span { color: #4f5b52; font-size: 14px; }
.metric-item strong { justify-self: start; color: #e44a3b; font-size: 14px; font-weight: 600; }

.store-products-section {
  width: 100%;
  padding: 28px 0 56px;
  background: #f5f6f5;
}
.store-products {
  width: min(1200px, calc(100% - 48px));
  margin: 0 auto;
}
.products-heading {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.products-heading h2 { margin: 0; color: #2d3931; font-size: 20px; font-weight: 650; }
.products-heading > span { color: #7a847d; font-size: 13px; }
.product-loading,
.product-empty {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #768078;
  background: #fff;
  border: 1px solid #e6ebe7;
}
.product-empty svg { font-size: 30px; color: #39b54a; }
.product-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }

.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px; }
.pagination button { min-width: 72px; min-height: 34px; border: 1px solid #d7ddd8; background: #fff; color: #344139; cursor: pointer; }
.pagination button:hover:not(:disabled) { border-color: #39b54a; color: #278d38; }
.pagination button:disabled { opacity: .45; cursor: default; }
.pagination span { color: #68736b; font-size: 13px; }

@media (max-width: 1280px) {
  .product-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (max-width: 1050px) {
  .store-hero { grid-template-columns: 1fr; gap: 22px; }
  .store-identity { max-width: 520px; }
  .store-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; }
  .product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .store-info-section { padding-top: 18px; }
  .store-hero, .store-products, .store-state { width: min(100% - 20px, 1360px); }
  .store-identity { padding: 18px; }
  .store-avatar { width: 70px; height: 70px; flex-basis: 70px; }
  .store-name h1 { font-size: 20px; }
  .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
}
@media (max-width: 520px) {
  .store-profile { align-items: flex-start; gap: 12px; }
  .store-actions { grid-template-columns: 1fr; }
  .store-metrics { grid-template-columns: 1fr; row-gap: 0; }
  .metric-item { min-height: 42px; }
  .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>