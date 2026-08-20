<template>
  <div class="home-page min-vh-100">
    <div class="container home-container">
      <div class="row g-3">
        <div class="col-lg-3 d-none d-lg-block">
          <CategorySidebar />
        </div>
        <div class="col-lg-9 col-12">
          <MainBanner />
        </div>
      </div>

      <div class="row g-3 recommend-row">
        <div class="offset-lg-3 col-lg-9 col-12">
          <section class="recommend-section" aria-labelledby="recommend-title">
            <div class="recommend-header">
          <div>
            <span>GỢI Ý HÔM NAY</span>
            <h2 id="recommend-title">Sản phẩm dành cho bạn</h2>
          </div>
          <button type="button" class="refresh-button" :disabled="loadingProducts" @click="loadRandomProducts">
            Đổi sản phẩm
          </button>
        </div>

        <div v-if="loadingProducts" class="product-grid" aria-label="Đang tải sản phẩm">
          <div v-for="index in 10" :key="index" class="product-skeleton" />
        </div>

        <div v-else-if="products.length" class="product-grid">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            :disabled="product.stock_quantity <= 0"
            :add-to-cart-label="product.stock_quantity <= 0 ? 'Hết hàng' : 'Thêm vào giỏ'"
            @view="openProduct"
            @add-to-cart="addToCart"
          />
        </div>

            <div v-else class="product-empty">
              {{ productError || 'Chưa có sản phẩm phù hợp để hiển thị.' }}
            </div>
          </section>
        </div>
      </div>
    </div>

    <Transition name="cart-toast">
      <div v-if="showCartSuccess" class="cart-success-toast" role="status" aria-live="polite">
        <span class="cart-success-toast__icon" aria-hidden="true">✓</span>
        <strong>Sản phẩm đã được thêm vào Giỏ hàng.</strong>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import apiClient from '@/services/api'
import CategorySidebar from '@/components/home/CategorySidebar.vue'
import MainBanner from '@/components/home/MainBanner.vue'
import ProductCard, { type ProductCardItem } from '@/components/product/ProductCard.vue'

interface HomeProduct extends ProductCardItem {
  stock_quantity: number
}

interface ProductListResponse {
  success: true
  data: Array<{
    id: number
    name: string
    price: number
    sale_price: number | null
    thumbnail: string | null
    stock_quantity: number
  }>
}

const router = useRouter()
const products = ref<HomeProduct[]>([])
const loadingProducts = ref(true)
const productError = ref('')
const showCartSuccess = ref(false)
let cartSuccessTimer: number | undefined

const apiOrigin = (() => {
  const baseURL = String(apiClient.defaults.baseURL || '').trim()
  if (!baseURL) return window.location.origin
  try {
    return new URL(baseURL, window.location.origin).origin
  } catch {
    return window.location.origin
  }
})()

const resolveMediaUrl = (value: string | null) => {
  if (!value) return null
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  const path = value.startsWith('/') ? value : `/${value}`
  return `${apiOrigin}${path}`
}

const loadRandomProducts = async () => {
  loadingProducts.value = true
  productError.value = ''

  try {
    const response = await apiClient.get<ProductListResponse>('/product', {
      params: {
        random: 1,
        limit: 10,
      },
    })

    products.value = (response.data.data || []).map((product) => ({
      ...product,
      price: Number(product.price || 0),
      sale_price: product.sale_price === null ? null : Number(product.sale_price),
      stock_quantity: Number(product.stock_quantity || 0),
      thumbnail: resolveMediaUrl(product.thumbnail),
    }))
  } catch (error: unknown) {
    console.error('Load random products error:', error)
    products.value = []
    productError.value = 'Không thể tải sản phẩm gợi ý'
  } finally {
    loadingProducts.value = false
  }
}


const addToCart = async (productId: number) => {
  try {
    await apiClient.post('/cart', {
      product_id: productId,
      quantity: 1,
    })

    window.dispatchEvent(new CustomEvent('cart:updated'))

    if (cartSuccessTimer) window.clearTimeout(cartSuccessTimer)
    showCartSuccess.value = true
    cartSuccessTimer = window.setTimeout(() => {
      showCartSuccess.value = false
      cartSuccessTimer = undefined
    }, 1800)
  } catch (error: unknown) {
    console.error('Add to cart error:', error)
  }
}

const openProduct = (productId: number) => {
  void router.push({ name: 'product', params: { productId } })
}

onMounted(loadRandomProducts)
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #f4f6f8;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}

.home-container {
  padding-top: 16px;
  padding-bottom: 48px;
}

.recommend-row {
  margin-top: 22px;
}

.recommend-section {
  min-width: 0;
}

.recommend-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.recommend-header span {
  display: block;
  margin-bottom: 3px;
  color: #39b54a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
}

.recommend-header h2 {
  margin: 0;
  color: #26342c;
  font-size: 21px;
  font-weight: 700;
}

.refresh-button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d8e1da;
  border-radius: 6px;
  background: #fff;
  color: #278d38;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-button:hover:not(:disabled) {
  border-color: #39b54a;
  background: #f3faf4;
}

.refresh-button:disabled {
  opacity: .55;
  cursor: default;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.product-skeleton {
  aspect-ratio: .67;
  border: 1px solid #e5e9e6;
  border-radius: 6px;
  background: linear-gradient(90deg, #f1f3f1 25%, #f8f9f8 37%, #f1f3f1 63%);
  background-size: 400% 100%;
  animation: skeleton 1.25s ease infinite;
}

.product-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  border: 1px solid #e2e7e3;
  border-radius: 6px;
  background: #fff;
  color: #7a867e;
  font-size: 14px;
}


.cart-success-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1400;
  width: min(425px, calc(100vw - 32px));
  min-height: 190px;
  padding: 28px 28px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  transform: translate(-50%, -50%);
  border-radius: 15px;
  background: rgba(28, 28, 28, .9);
  color: #fff;
  box-shadow: 0 14px 36px rgba(0, 0, 0, .2);
  text-align: center;
  pointer-events: none;
}

.cart-success-toast__icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #17c99a;
  color: #0d4135;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.cart-success-toast strong {
  max-width: 320px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}

.cart-toast-enter-active,
.cart-toast-leave-active {
  transition: opacity .16s ease, transform .16s ease;
}

.cart-toast-enter-from,
.cart-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 8px)) scale(.98);
}

@keyframes skeleton {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (max-width: 991.98px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .cart-success-toast {
    min-height: 160px;
    padding: 24px 20px;
  }

  .cart-success-toast strong {
    font-size: 18px;
  }

  .home-container {
    padding-top: 12px;
    padding-bottom: 32px;
  }

  .recommend-row {
    margin-top: 18px;
  }

  .recommend-header {
    align-items: center;
  }

  .recommend-header h2 {
    font-size: 18px;
  }

  .recommend-header span {
    display: none;
  }

  .refresh-button {
    min-height: 34px;
    padding: 0 10px;
    font-size: 12px;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
