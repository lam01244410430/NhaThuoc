<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  faArrowLeft,
  faBoxOpen,
  faCartShopping,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faHouse,
  faMinus,
  faPlus,
  faShieldHalved,
  faStore,
  faTruckFast,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import apiClient from '@/services/api'
import { useAuthStore } from '@/stores/auth'

type ProductStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'out_of_stock'

type MediaItem = {
  id: number
  url: string
  type: 'image' | 'video'
  is_thumbnail: number | boolean
  priority: number
}

type ProductVariant = {
  id: number
  price: number
  sale_price: number | null
  stock_quantity: number
  sku: string
  status: 'active' | 'inactive' | 'out_of_stock'
  variant_name: string | null
}

type ProductDetail = {
  id: number
  shop_id: number
  category_id: number
  name: string
  slug: string
  price: number
  sale_price: number | null
  description: string | null
  usage_guide: string | null
  stock_quantity: number
  status: ProductStatus
  thumbnail: string | null
  shop_name: string
  category_name: string
  created_at: string
  updated_at: string
  media: MediaItem[]
  variants: ProductVariant[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const product = ref<ProductDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const selectedMediaIndex = ref(0)
const selectedVariantId = ref<number | null>(null)
const quantity = ref(1)

const imageMedia = computed(() => {
  if (!product.value) return []

  const images = product.value.media.filter(
    (item) => item.type === 'image',
  )

  if (
    product.value.thumbnail &&
    !images.some(
      (item) => item.url === product.value?.thumbnail,
    )
  ) {
    return [
      {
        id: -1,
        url: product.value.thumbnail,
        type: 'image' as const,
        is_thumbnail: true,
        priority: -1,
      },
      ...images,
    ]
  }

  return images
})

const currentImage = computed(() => {
  return (
    imageMedia.value[selectedMediaIndex.value]?.url ||
    product.value?.thumbnail ||
    ''
  )
})

const availableVariants = computed(() => {
  return (
    product.value?.variants.filter(
      (variant) => variant.status === 'active',
    ) ?? []
  )
})

const selectedVariant = computed(() => {
  if (selectedVariantId.value === null) return null

  return (
    availableVariants.value.find(
      (variant) => variant.id === selectedVariantId.value,
    ) ?? null
  )
})

const currentPrice = computed(() => {
  if (!product.value) return 0

  return (
    selectedVariant.value?.sale_price ??
    selectedVariant.value?.price ??
    product.value.sale_price ??
    product.value.price
  )
})

const originalPrice = computed(() => {
  if (!product.value) return 0

  return (
    selectedVariant.value?.price ??
    product.value.price
  )
})

const hasDiscount = computed(() => {
  return currentPrice.value < originalPrice.value
})

const discountPercent = computed(() => {
  if (!hasDiscount.value || originalPrice.value <= 0) {
    return 0
  }

  return Math.round(
    (1 - currentPrice.value / originalPrice.value) * 100,
  )
})

const currentStock = computed(() => {
  if (!product.value) return 0

  return (
    selectedVariant.value?.stock_quantity ??
    product.value.stock_quantity
  )
})

const isInStock = computed(() => {
  return (
    product.value?.status === 'active' &&
    currentStock.value > 0
  )
})

const productCode = computed(() => {
  if (!product.value) return '—'

  return selectedVariant.value?.sku || `SP${product.value.id}`
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value)
}

const loadProduct = async () => {
  const productId = Number(route.params.productId)

  if (
    !Number.isInteger(productId) ||
    productId <= 0
  ) {
    errorMessage.value = 'Mã sản phẩm không hợp lệ'
    product.value = null
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await apiClient.get(
      `/product/${productId}`,
    )

    product.value = response.data.data
    selectedMediaIndex.value = 0
    quantity.value = 1

    const firstVariant =
      product.value?.variants.find(
        (variant) =>
          variant.status === 'active' &&
          variant.stock_quantity > 0,
      ) ??
      product.value?.variants.find(
        (variant) => variant.status === 'active',
      )

    selectedVariantId.value =
      firstVariant?.id ?? null
  } catch (error: any) {
    product.value = null
    errorMessage.value =
      error.response?.data?.message ??
      'Không thể tải thông tin sản phẩm'
  } finally {
    loading.value = false
  }
}

const selectMedia = (index: number) => {
  selectedMediaIndex.value = index
}

const previousImage = () => {
  if (imageMedia.value.length <= 1) return

  selectedMediaIndex.value =
    selectedMediaIndex.value <= 0
      ? imageMedia.value.length - 1
      : selectedMediaIndex.value - 1
}

const nextImage = () => {
  if (imageMedia.value.length <= 1) return

  selectedMediaIndex.value =
    selectedMediaIndex.value >=
    imageMedia.value.length - 1
      ? 0
      : selectedMediaIndex.value + 1
}

const decreaseQuantity = () => {
  quantity.value = Math.max(1, quantity.value - 1)
}

const increaseQuantity = () => {
  quantity.value = Math.min(
    Math.max(currentStock.value, 1),
    quantity.value + 1,
  )
}

const selectVariant = (variant: ProductVariant) => {
  selectedVariantId.value = variant.id
  quantity.value = 1
}

const handleBuy = async () => {
  if (!product.value || !isInStock.value) return

  if (!authStore.isLoggedIn) {
    await router.push({
      name: 'login',
      query: {
        redirect: route.fullPath,
      },
    })
    return
  }

  window.alert(
    'Trang chi tiết đã sẵn sàng. Bước tiếp theo là nối nút này với API giỏ hàng của dự án.',
  )
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'home' })
}

watch(
  () => route.params.productId,
  () => {
    loadProduct()
  },
)

watch(currentStock, (stock) => {
  if (quantity.value > stock && stock > 0) {
    quantity.value = stock
  }
})

onMounted(loadProduct)
</script>

<template>
  <div class="product-detail-page">
    <div class="product-container">
      <nav class="breadcrumb">
        <RouterLink
          :to="{ name: 'home' }"
          class="breadcrumb-home"
        >
          <FontAwesomeIcon :icon="faHouse" />
          Trang chủ
        </RouterLink>

        <FontAwesomeIcon
          :icon="faChevronRight"
          class="breadcrumb-separator"
        />

        <span v-if="product">
          {{ product.category_name }}
        </span>

        <FontAwesomeIcon
          v-if="product"
          :icon="faChevronRight"
          class="breadcrumb-separator"
        />

        <strong v-if="product">
          {{ product.name }}
        </strong>
      </nav>

      <button
        type="button"
        class="back-button"
        @click="goBack"
      >
        <FontAwesomeIcon :icon="faArrowLeft" />
        Quay lại
      </button>

      <div
        v-if="loading"
        class="state-card loading-state"
      >
        <div class="loading-spinner"></div>
        <p>Đang tải thông tin sản phẩm...</p>
      </div>

      <div
        v-else-if="errorMessage"
        class="state-card error-state"
      >
        <FontAwesomeIcon :icon="faBoxOpen" />
        <h2>Không tìm thấy sản phẩm</h2>
        <p>{{ errorMessage }}</p>

        <button
          type="button"
          @click="router.push({ name: 'home' })"
        >
          Về trang chủ
        </button>
      </div>

      <template v-else-if="product">
        <section class="product-main-grid">
          <article class="product-gallery-card">
            <div class="main-image-wrap">
              <div class="genuine-badge">
                <FontAwesomeIcon :icon="faShieldHalved" />
                <span>
                  Hàng chính hãng
                </span>
              </div>

              <img
                v-if="currentImage"
                :src="currentImage"
                :alt="product.name"
                class="main-image"
              />

              <div
                v-else
                class="image-placeholder"
              >
                <FontAwesomeIcon :icon="faBoxOpen" />
                <span>Chưa có hình ảnh</span>
              </div>

              <button
                v-if="imageMedia.length > 1"
                type="button"
                class="gallery-arrow gallery-arrow-left"
                aria-label="Ảnh trước"
                @click="previousImage"
              >
                <FontAwesomeIcon :icon="faChevronLeft" />
              </button>

              <button
                v-if="imageMedia.length > 1"
                type="button"
                class="gallery-arrow gallery-arrow-right"
                aria-label="Ảnh tiếp theo"
                @click="nextImage"
              >
                <FontAwesomeIcon :icon="faChevronRight" />
              </button>

              <span
                v-if="imageMedia.length"
                class="image-counter"
              >
                {{ selectedMediaIndex + 1 }}
                /
                {{ imageMedia.length }}
              </span>
            </div>

            <div
              v-if="imageMedia.length > 1"
              class="thumbnail-list"
            >
              <button
                v-for="(media, index) in imageMedia"
                :key="media.id"
                type="button"
                class="thumbnail-item"
                :class="{
                  active: selectedMediaIndex === index,
                }"
                @click="selectMedia(index)"
              >
                <img
                  :src="media.url"
                  :alt="`${product.name} ${index + 1}`"
                />
              </button>
            </div>
          </article>

          <aside class="purchase-column">
            <article class="purchase-card">
              <div class="product-heading">
                <span class="category-label">
                  {{ product.category_name }}
                </span>

                <h1>
                  {{ product.name }}
                </h1>

                <div class="product-meta">
                  <span
                    class="stock-status"
                    :class="{
                      unavailable: !isInStock,
                    }"
                  >
                    {{
                      isInStock
                        ? 'Còn hàng'
                        : 'Hết hàng'
                    }}
                  </span>

                  <span class="meta-divider"></span>

                  <span>
                    Mã: {{ productCode }}
                  </span>
                </div>
              </div>

              <div class="price-block">
                <div class="current-price-row">
                  <strong class="current-price">
                    {{ formatCurrency(currentPrice) }}
                  </strong>

                  <span
                    v-if="hasDiscount"
                    class="discount-badge"
                  >
                    -{{ discountPercent }}%
                  </span>
                </div>

                <span
                  v-if="hasDiscount"
                  class="original-price"
                >
                  {{ formatCurrency(originalPrice) }}
                </span>
              </div>

              <div
                v-if="availableVariants.length"
                class="variant-section"
              >
                <span class="section-label">
                  Lựa chọn
                </span>

                <div class="variant-list">
                  <button
                    v-for="variant in availableVariants"
                    :key="variant.id"
                    type="button"
                    class="variant-button"
                    :class="{
                      active:
                        selectedVariantId === variant.id,
                      disabled:
                        variant.stock_quantity <= 0,
                    }"
                    :disabled="variant.stock_quantity <= 0"
                    @click="selectVariant(variant)"
                  >
                    <strong>
                      {{
                        variant.variant_name ||
                        variant.sku
                      }}
                    </strong>

                    <small>
                      {{
                        variant.stock_quantity > 0
                          ? `Còn ${variant.stock_quantity}`
                          : 'Hết hàng'
                      }}
                    </small>
                  </button>
                </div>
              </div>

              <div class="quantity-row">
                <div>
                  <span class="section-label">
                    Số lượng
                  </span>

                  <small>
                    Còn {{ currentStock }} sản phẩm
                  </small>
                </div>

                <div class="quantity-control">
                  <button
                    type="button"
                    :disabled="quantity <= 1"
                    @click="decreaseQuantity"
                  >
                    <FontAwesomeIcon :icon="faMinus" />
                  </button>

                  <span>{{ quantity }}</span>

                  <button
                    type="button"
                    :disabled="
                      !isInStock ||
                      quantity >= currentStock
                    "
                    @click="increaseQuantity"
                  >
                    <FontAwesomeIcon :icon="faPlus" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                class="buy-button"
                :disabled="!isInStock"
                @click="handleBuy"
              >
                <FontAwesomeIcon :icon="faCartShopping" />

                <span>
                  {{
                    isInStock
                      ? 'Chọn mua'
                      : 'Sản phẩm tạm hết hàng'
                  }}
                </span>
              </button>

              <div class="purchase-benefits">
                <div>
                  <FontAwesomeIcon :icon="faCircleCheck" />

                  <span>
                    Sản phẩm từ nhà bán đã được duyệt
                  </span>
                </div>

                <div>
                  <FontAwesomeIcon :icon="faTruckFast" />

                  <span>
                    Hỗ trợ giao hàng theo đơn đặt mua
                  </span>
                </div>

                <div>
                  <FontAwesomeIcon :icon="faShieldHalved" />

                  <span>
                    Thông tin sản phẩm minh bạch
                  </span>
                </div>
              </div>
            </article>

            <article class="shop-summary-card">
              <div class="shop-avatar">
                <FontAwesomeIcon :icon="faStore" />
              </div>

              <div class="shop-summary-info">
                <small>Nhà bán</small>
                <strong>{{ product.shop_name }}</strong>
              </div>
            </article>
          </aside>
        </section>

        <section class="detail-content-grid">
          <div class="detail-left-column">
            <article class="content-card">
              <header class="content-card-header">
                <div>
                  <span class="eyebrow">
                    THÔNG TIN
                  </span>

                  <h2>Thông tin sản phẩm</h2>
                </div>
              </header>

              <div class="info-table">
                <div class="info-row">
                  <strong>Danh mục</strong>
                  <span>{{ product.category_name }}</span>
                </div>

                <div class="info-row">
                  <strong>Nhà bán</strong>
                  <span>{{ product.shop_name }}</span>
                </div>

                <div class="info-row">
                  <strong>Mã sản phẩm</strong>
                  <span>{{ productCode }}</span>
                </div>

                <div class="info-row">
                  <strong>Tình trạng</strong>
                  <span>
                    {{
                      isInStock
                        ? `Còn ${currentStock} sản phẩm`
                        : 'Hết hàng'
                    }}
                  </span>
                </div>

                <div
                  v-if="selectedVariant"
                  class="info-row"
                >
                  <strong>Phân loại</strong>

                  <span>
                    {{
                      selectedVariant.variant_name ||
                      selectedVariant.sku
                    }}
                  </span>
                </div>
              </div>
            </article>

            <article class="content-card">
              <header class="content-card-header">
                <div>
                  <span class="eyebrow">
                    MÔ TẢ
                  </span>

                  <h2>Mô tả sản phẩm</h2>
                </div>
              </header>

              <div class="content-text">
                <p v-if="product.description">
                  {{ product.description }}
                </p>

                <p
                  v-else
                  class="empty-content"
                >
                  Sản phẩm chưa có mô tả chi tiết.
                </p>
              </div>
            </article>

            <article class="content-card">
              <header class="content-card-header">
                <div>
                  <span class="eyebrow">
                    SỬ DỤNG
                  </span>

                  <h2>Hướng dẫn sử dụng</h2>
                </div>
              </header>

              <div class="content-text usage-guide">
                <p v-if="product.usage_guide">
                  {{ product.usage_guide }}
                </p>

                <p
                  v-else
                  class="empty-content"
                >
                  Chưa có hướng dẫn sử dụng cho sản phẩm này.
                </p>
              </div>

              <div class="medical-note">
                <FontAwesomeIcon :icon="faShieldHalved" />

                <p>
                  Thông tin trên trang được hiển thị theo dữ liệu
                  do nhà bán cung cấp. Với thuốc và sản phẩm liên
                  quan sức khỏe, người dùng nên đọc kỹ hướng dẫn
                  và tham khảo chuyên môn khi cần thiết.
                </p>
              </div>
            </article>
          </div>

          <aside class="detail-right-column">
            <article class="side-info-card">
              <h3>Thông tin nhanh</h3>

              <div>
                <span>Giá bán</span>

                <strong class="side-price">
                  {{ formatCurrency(currentPrice) }}
                </strong>
              </div>

              <div>
                <span>Tồn kho</span>
                <strong>{{ currentStock }}</strong>
              </div>

              <div>
                <span>Trạng thái</span>

                <strong
                  :class="{
                    green: isInStock,
                    red: !isInStock,
                  }"
                >
                  {{
                    isInStock
                      ? 'Đang bán'
                      : 'Hết hàng'
                  }}
                </strong>
              </div>
            </article>

            <article class="side-info-card safe-card">
              <FontAwesomeIcon :icon="faShieldHalved" />

              <div>
                <h3>Mua sắm an tâm</h3>

                <p>
                  Sản phẩm công khai chỉ được hiển thị khi đang
                  ở trạng thái hoạt động trong hệ thống.
                </p>
              </div>
            </article>
          </aside>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.product-detail-page {
  min-height: 100vh;
  padding: 20px 0 56px;
  color: #2f343b;
  background: #f3f5f7;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "Helvetica Neue",
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.product-container {
  width: min(1200px, calc(100% - 32px));
  margin: 0 auto;
}

.breadcrumb {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: #727a84;
  font-size: 13px;
}

.breadcrumb a {
  color: #4b5560;
  text-decoration: none;
}

.breadcrumb-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.breadcrumb strong,
.breadcrumb span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb strong {
  color: #333;
  font-weight: 600;
}

.breadcrumb-separator {
  flex: 0 0 auto;
  color: #b5bac1;
  font-size: 9px;
}

.back-button {
  display: none;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
  padding: 0;
  color: #4c545e;
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.product-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(420px, 1fr);
  gap: 20px;
  align-items: start;
  margin-top: 8px;
}

.product-gallery-card,
.purchase-card,
.shop-summary-card,
.content-card,
.side-info-card,
.state-card {
  background: #fff;
  border: 1px solid #e9edf0;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(30, 43, 55, 0.035);
}

.product-gallery-card {
  padding: 20px;
}

.main-image-wrap {
  position: relative;
  min-height: 510px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
}

.main-image {
  width: 100%;
  height: 510px;
  object-fit: contain;
}

.image-placeholder {
  min-height: 430px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #a5adb5;
}

.image-placeholder svg {
  font-size: 52px;
}

.genuine-badge {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  color: #23894c;
  background: #ecf8ef;
  border: 1px solid #d9efdf;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
}

.gallery-arrow {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: #4f5963;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e7eaee;
  border-radius: 50%;
  box-shadow: 0 5px 16px rgba(25, 36, 47, 0.08);
  transform: translateY(-50%);
  cursor: pointer;
}

.gallery-arrow-left {
  left: 8px;
}

.gallery-arrow-right {
  right: 8px;
}

.image-counter {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 5px 10px;
  color: #555e68;
  background: #f5f6f7;
  border-radius: 30px;
  font-size: 11px;
  font-weight: 600;
}

.thumbnail-list {
  display: flex;
  gap: 9px;
  margin-top: 16px;
  padding: 2px 1px 4px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.thumbnail-item {
  width: 68px;
  height: 68px;
  flex: 0 0 68px;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 3px;
  background: #fff;
  border: 2px solid #e2e5e8;
  border-radius: 11px;
  cursor: pointer;
}

.thumbnail-item.active {
  border-color: #39b54a;
}

.thumbnail-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.purchase-column {
  display: grid;
  gap: 16px;
}

.purchase-card {
  padding: 24px;
}

.category-label {
  display: inline-flex;
  margin-bottom: 9px;
  color: #258e4f;
  font-size: 12px;
  font-weight: 700;
}

.product-heading h1 {
  margin: 0;
  color: #25282d;
  font-size: 23px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.2px;
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 13px;
  color: #606871;
  font-size: 12px;
}

.stock-status {
  color: #2c9d57;
  font-weight: 700;
}

.stock-status.unavailable {
  color: #d74650;
}

.meta-divider {
  width: 1px;
  height: 15px;
  background: #dcdfe2;
}

.price-block {
  margin-top: 22px;
  padding: 18px;
  background: #fff7f7;
  border-radius: 15px;
}

.current-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-price {
  color: #df3845;
  font-size: 30px;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.4px;
}

.discount-badge {
  padding: 5px 9px;
  color: #fff;
  background: #e83a45;
  border-radius: 30px;
  font-size: 12px;
  font-weight: 700;
}

.original-price {
  display: inline-block;
  margin-top: 9px;
  color: #888f96;
  font-size: 15px;
  text-decoration: line-through;
}

.variant-section,
.quantity-row {
  margin-top: 22px;
}

.section-label {
  display: block;
  color: #333941;
  font-size: 13px;
  font-weight: 700;
}

.variant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 10px;
}

.variant-button {
  min-width: 120px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  text-align: left;
  color: #414850;
  background: #fff;
  border: 1.5px solid #dfe3e6;
  border-radius: 11px;
  font-family: inherit;
  cursor: pointer;
}

.variant-button strong {
  font-size: 12px;
}

.variant-button small {
  color: #8e959d;
  font-size: 10px;
}

.variant-button.active {
  color: #268e4e;
  background: #f3fbf5;
  border-color: #39b54a;
}

.variant-button.disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.quantity-row > div:first-child {
  display: grid;
  gap: 4px;
}

.quantity-row small {
  color: #969ca3;
  font-size: 10px;
}

.quantity-control {
  display: grid;
  grid-template-columns: 38px 46px 38px;
  align-items: center;
  overflow: hidden;
  border: 1px solid #dfe3e6;
  border-radius: 11px;
}

.quantity-control button {
  height: 38px;
  color: #4d565f;
  background: #fff;
  border: 0;
  cursor: pointer;
}

.quantity-control button:disabled {
  color: #c2c7cc;
  cursor: not-allowed;
}

.quantity-control span {
  display: grid;
  place-items: center;
  height: 38px;
  border-right: 1px solid #e3e6e8;
  border-left: 1px solid #e3e6e8;
  font-size: 13px;
  font-weight: 700;
}

.buy-button {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
  color: #fff;
  background: #39b54a;
  border: 1px solid #39b54a;
  border-radius: 13px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(57, 181, 74, 0.18);
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.buy-button:hover:not(:disabled) {
  background: #31a543;
  box-shadow: 0 10px 22px rgba(57, 181, 74, 0.24);
  transform: translateY(-1px);
}

.buy-button:disabled {
  color: #9fa5aa;
  background: #edf0f1;
  border-color: #edf0f1;
  box-shadow: none;
  cursor: not-allowed;
}

.purchase-benefits {
  display: grid;
  gap: 10px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid #eceff1;
}

.purchase-benefits div {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #616970;
  font-size: 11px;
}

.purchase-benefits svg {
  width: 16px;
  color: #39b54a;
}

.shop-summary-card {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 18px;
}

.shop-avatar {
  width: 50px;
  height: 50px;
  flex: 0 0 50px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(
    135deg,
    #39b54a,
    #66c774
  );
  border-radius: 14px;
  font-size: 18px;
}

.shop-summary-info {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.shop-summary-info small {
  color: #949ba2;
  font-size: 10px;
}

.shop-summary-info strong {
  overflow: hidden;
  color: #343a40;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-summary-info span {
  color: #92989f;
  font-size: 10px;
}

.detail-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 790px) minmax(300px, 1fr);
  gap: 20px;
  align-items: start;
  margin-top: 20px;
}

.detail-left-column,
.detail-right-column {
  display: grid;
  gap: 20px;
}

.content-card {
  padding: 22px 24px;
}

.content-card-header {
  margin-bottom: 17px;
}

.eyebrow {
  display: block;
  margin-bottom: 5px;
  color: #39b54a;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.content-card-header h2,
.side-info-card h3 {
  margin: 0;
  color: #272c31;
  font-size: 18px;
  font-weight: 700;
}

.info-table {
  border-top: 1px solid #eceff1;
}

.info-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid #eceff1;
  font-size: 13px;
}

.info-row strong {
  color: #4b5259;
  font-weight: 700;
}

.info-row span {
  color: #606870;
  line-height: 1.6;
}

.content-text {
  color: #505860;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-line;
}

.content-text p {
  margin: 0;
}

.empty-content {
  color: #9aa1a7;
}

.medical-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 20px;
  padding: 15px;
  color: #6f6329;
  background: #fffbea;
  border: 1px solid #f3e7aa;
  border-radius: 13px;
}

.medical-note svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #c99b28;
}

.medical-note p {
  margin: 0;
  font-size: 11px;
  line-height: 1.65;
}

.side-info-card {
  padding: 19px;
}

.side-info-card > div:not(.safe-card) {
  display: flex;
}

.side-info-card h3 {
  margin-bottom: 14px;
  font-size: 14px;
}

.side-info-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 11px 0;
  border-bottom: 1px solid #edf0f1;
  font-size: 11px;
}

.side-info-card > div:last-child {
  border-bottom: 0;
}

.side-info-card span {
  color: #8b9298;
}

.side-info-card strong {
  color: #3c434a;
  text-align: right;
}

.side-info-card .side-price {
  color: #df3845;
}

.side-info-card .green {
  color: #299451;
}

.side-info-card .red {
  color: #d74650;
}

.safe-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #2f8d4e;
  background: #f4fbf5;
  border-color: #ddefe1;
}

.safe-card > svg {
  margin-top: 2px;
  font-size: 18px;
}

.safe-card > div {
  display: block;
  padding: 0;
  border: 0;
}

.safe-card h3 {
  margin: 0;
}

.safe-card p {
  margin: 6px 0 0;
  color: #6f7a72;
  font-size: 10px;
  line-height: 1.6;
}

.state-card {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  margin-top: 12px;
  padding: 40px;
  text-align: center;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e1e6e3;
  border-top-color: #39b54a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.state-card p {
  margin: 0;
  color: #8d949b;
  font-size: 13px;
}

.error-state > svg {
  color: #a8afb5;
  font-size: 42px;
}

.error-state h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

.error-state button {
  margin-top: 6px;
  padding: 10px 16px;
  color: #fff;
  background: #39b54a;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1050px) {
  .product-main-grid,
  .detail-content-grid {
    grid-template-columns: 1fr;
  }

  .purchase-column {
    grid-template-columns: 1fr;
  }

  .detail-right-column {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 767.98px) {
  .product-detail-page {
    padding-top: 12px;
  }

  .product-container {
    width: min(100% - 20px, 1200px);
  }

  .breadcrumb {
    display: none;
  }

  .back-button {
    display: inline-flex;
  }

  .product-main-grid {
    margin-top: 0;
  }

  .product-gallery-card,
  .purchase-card,
  .shop-summary-card,
  .content-card,
  .side-info-card {
    border-radius: 16px;
  }

  .product-gallery-card {
    padding: 12px;
  }

  .main-image-wrap {
    min-height: 340px;
  }

  .main-image {
    height: 340px;
  }

  .genuine-badge {
    top: 6px;
    left: 6px;
  }

  .purchase-card {
    padding: 18px;
  }

  .product-heading h1 {
    font-size: 20px;
  }

  .current-price {
    font-size: 26px;
  }

  .detail-right-column {
    grid-template-columns: 1fr;
  }

  .info-row {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}

@media (max-width: 480px) {
  .main-image-wrap {
    min-height: 290px;
  }

  .main-image {
    height: 290px;
  }

  .gallery-arrow {
    width: 34px;
    height: 34px;
  }

  .thumbnail-item {
    width: 60px;
    height: 60px;
    flex-basis: 60px;
  }

  .purchase-card,
  .content-card {
    padding: 16px;
  }

  .product-meta {
    flex-wrap: wrap;
  }

  .price-block {
    padding: 15px;
  }

  .current-price-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .quantity-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
