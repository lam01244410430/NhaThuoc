<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowUpRightFromSquare,
  faBoxOpen,
  faChartLine,
  faBell,
  faCircleInfo,
  faPen,
  faPlus,
  faRightFromBracket,
  faStar,
  faStore,
} from '@fortawesome/free-solid-svg-icons'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardUiStore } from '@/stores/dashboard-ui'
import { shopService, type PublicShop } from '@/services/shop.service'
import {
  shopDashboardService,
  type ShopProduct,
} from '@/services/shop-dashboard.service'

const router = useRouter()
const authStore = useAuthStore()
const dashboardUi = useDashboardUiStore()
const { sidebarCollapsed } = storeToRefs(dashboardUi)

const shop = ref<PublicShop | null>(null)
const products = ref<ShopProduct[]>([])
const loading = ref(true)
const errorMessage = ref('')
const showNotifications = ref(false)
const showAccountMenu = ref(false)

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const formatPrice = (value: number) => `${formatNumber(value)}₫`
const effectivePrice = (product: ShopProduct) =>
  product.sale_price !== null && product.sale_price < product.price ? product.sale_price : product.price

const selectMenu = (item: { key: string }) => {
  if (item.key === 'overview') return void router.push({ name: 'shop-dashboard' })
  if (item.key === 'products') return void router.push({ name: 'shop-dashboard', query: { section: 'products' } })
  if (item.key === 'profile') return void router.push({ name: 'shop-dashboard', query: { section: 'profile' } })
  void router.push({ name: 'shop-dashboard', query: { section: item.key } })
}

const openPublicShop = () => {
  if (!shop.value) return
  closeHeaderMenus()
  void router.push({ name: 'shop-public', params: { shopId: shop.value.id } })
}

const editProduct = (product: ShopProduct) => {
  void router.push({ name: 'shop-product-edit', params: { productId: product.id } })
}


const closeHeaderMenus = () => {
  showNotifications.value = false
  showAccountMenu.value = false
}

const openShopProfile = () => {
  closeHeaderMenus()
  void router.push({ name: 'shop-dashboard', query: { section: 'profile' } })
}

const logout = async () => {
  closeHeaderMenus()
  authStore.logout()
  await router.replace({ name: 'login' })
}

const onDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.dashboard-header')) closeHeaderMenus()
}

const loadOwnerView = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [shopData, productData] = await Promise.all([
      shopService.getOwnShop(),
      shopDashboardService.getProducts({ page: 1, limit: 8, sort_by: 'updated_at', sort_order: 'desc' }),
    ])
    shop.value = shopData
    products.value = productData.products
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error && error.message ? error.message : 'Không thể tải gian hàng của bạn'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOwnerView()
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div class="seller-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <DashboardSidebar
      variant="shop"
      :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
      :avatar-url="authStore.user?.avatar || shop?.avatar"
      active-item="profile"
      :collapsed="sidebarCollapsed"
      @select="selectMenu"
    />

    <div class="seller-workspace">
      <DashboardHeader
        title="Gian hàng của tôi"
        :subtitle="shop?.shop_name || 'Quản lý gian hàng'"
        :collapsed="sidebarCollapsed"
        :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
        :show-search="false"
        :show-notifications="true"
        :unread-count="0"
        @toggle-sidebar="dashboardUi.toggleSidebar()"
        @home="router.push('/')"
        @shop="router.push({ name: 'shop' })"
        @notifications="showNotifications = !showNotifications; showAccountMenu = false"
        @account="showAccountMenu = !showAccountMenu; showNotifications = false"
      >
        <template #notification-panel>
          <aside v-if="showNotifications" class="owner-popover owner-notifications">
            <div class="owner-popover__head">
              <strong>Thông báo</strong>
              <span>Cập nhật hoạt động gian hàng</span>
            </div>
            <div class="owner-notifications__empty">
              <FontAwesomeIcon :icon="faBell" />
              <strong>Chưa có thông báo mới</strong>
              <span>Các cập nhật quan trọng về gian hàng sẽ xuất hiện tại đây.</span>
            </div>
          </aside>
        </template>

        <template #account-panel>
          <aside v-if="showAccountMenu" class="owner-popover owner-account-menu">
            <div class="owner-account-menu__shop">
              <div class="owner-account-menu__avatar">
                <img v-if="shop?.avatar" :src="shop.avatar" :alt="shop.shop_name" />
                <FontAwesomeIcon v-else :icon="faStore" />
              </div>
              <div>
                <strong>{{ shop?.shop_name || 'Cửa hàng' }}</strong>
                <span>{{ authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng' }}</span>
              </div>
            </div>
            <button type="button" @click="openShopProfile">
              <FontAwesomeIcon :icon="faCircleInfo" />
              <span>Thông tin cửa hàng</span>
            </button> 
            <button type="button" class="owner-account-menu__logout" @click="logout">
              <FontAwesomeIcon :icon="faRightFromBracket" />
              <span>Đăng xuất</span>
            </button>
          </aside>
        </template>
      </DashboardHeader>

      <main class="owner-page">
        <div v-if="loading" class="state-card">Đang tải gian hàng...</div>
        <div v-else-if="errorMessage" class="state-card state-card--error">
          <strong>{{ errorMessage }}</strong>
          <button type="button" @click="loadOwnerView">Thử lại</button>
        </div>

        <template v-else-if="shop">
          <section class="owner-hero">
            <div class="owner-shop">
              <div class="owner-avatar">
                <img v-if="shop.avatar" :src="shop.avatar" :alt="shop.shop_name" />
                <FontAwesomeIcon v-else :icon="faStore" />
              </div>
              <div>
                <p>GIAN HÀNG</p>
                <h1>{{ shop.shop_name }}</h1>
                <span>{{ shop.description || 'Chưa có mô tả gian hàng' }}</span>
              </div>
            </div>

            <div class="hero-actions">
              <button type="button" class="preview-button" @click="openPublicShop">
                <FontAwesomeIcon :icon="faArrowUpRightFromSquare" />
                Xem trước
              </button>
              <button type="button" class="secondary-button" @click="router.push({ name: 'shop-dashboard' })">
                <FontAwesomeIcon :icon="faChartLine" /> Seller Center
              </button>
              <button type="button" class="primary-button" @click="router.push({ name: 'shop-product-create' })">
                <FontAwesomeIcon :icon="faPlus" /> Thêm sản phẩm
              </button>
            </div>
          </section>

          <section class="stats-grid">
            <article><span>Tổng sản phẩm</span><strong>{{ formatNumber(shop.total_products) }}</strong><FontAwesomeIcon :icon="faBoxOpen" /></article>
            <article><span>Người theo dõi</span><strong>{{ formatNumber(shop.followers) }}</strong><FontAwesomeIcon :icon="faStore" /></article>
            <article><span>Đánh giá</span><strong>{{ Number(shop.rating || 0).toFixed(1) }}</strong><FontAwesomeIcon :icon="faStar" /></article>
            <article><span>Lượt đánh giá</span><strong>{{ formatNumber(shop.rating_count) }}</strong><FontAwesomeIcon :icon="faStar" /></article>
          </section>

          <section class="recent-products">
            <div class="section-title">
              <div><p>QUẢN LÝ NHANH</p><h2>Sản phẩm gần đây</h2></div>
              <button type="button" @click="router.push({ name: 'shop-dashboard', query: { section: 'products' } })">Xem tất cả</button>
            </div>

            <div v-if="products.length" class="product-list">
              <article v-for="product in products" :key="product.id" class="product-row">
                <div class="product-thumb">
                  <img v-if="product.thumbnail" :src="product.thumbnail" :alt="product.name" />
                  <FontAwesomeIcon v-else :icon="faBoxOpen" />
                </div>
                <div class="product-copy">
                  <strong>{{ product.name }}</strong>
                  <small>{{ product.category_name }}</small>
                </div>
                <span class="status-pill" :class="`status-${product.status}`">{{ product.status }}</span>
                <strong class="price">{{ formatPrice(effectivePrice(product)) }}</strong>
                <button type="button" class="edit-button" @click="editProduct(product)"><FontAwesomeIcon :icon="faPen" /> Sửa</button>
              </article>
            </div>
            <div v-else class="empty-products">Chưa có sản phẩm.</div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.seller-shell {
  --sidebar-layout-width: 276px;
  min-height: 100vh;
  background: #f5f7f6;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}
.seller-shell.sidebar-collapsed { --sidebar-layout-width: 100px; }
.seller-workspace { min-width: 0; }
.owner-page {
  padding: 24px 26px 48px var(--sidebar-layout-width);
  transition: padding-left .18s ease;
}
.state-card,
.owner-hero,
.recent-products { background: #fff; border: 1px solid #e4e9e5; border-radius: 12px; }
.state-card { min-height: 220px; display: grid; place-items: center; gap: 10px; }
.state-card--error strong { color: #b42318; }
.state-card button { border: 0; background: #39b54a; color: #fff; padding: 8px 14px; border-radius: 7px; }
.owner-hero { display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 22px; }
.owner-shop { display: flex; align-items: center; gap: 16px; min-width: 0; }
.owner-avatar { width: 76px; height: 76px; border-radius: 50%; overflow: hidden; background: #edf8ef; color: #39b54a; display: grid; place-items: center; font-size: 26px; flex: 0 0 76px; }
.owner-avatar img { width: 100%; height: 100%; object-fit: cover; }
.owner-shop p,.section-title p { margin: 0 0 3px; color: #7f8a82; font-size: 11px; letter-spacing: .08em; }
.owner-shop h1 { margin: 0; font-size: 23px; }
.owner-shop span { display: block; margin-top: 6px; color: #718077; font-size: 13px; max-width: 520px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hero-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }
.hero-actions button,.section-title button,.edit-button { min-height: 36px; padding: 0 13px; border-radius: 7px; font-weight: 600; cursor: pointer; }
.preview-button { border: 1px solid #39b54a; background: #eef9f1; color: #278d38; }
.secondary-button { border: 1px solid #dce4de; background: #fff; color: #36433a; }
.primary-button { border: 1px solid #39b54a; background: #39b54a; color: #fff; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin: 16px 0; }
.stats-grid article { position: relative; min-height: 105px; padding: 18px; background: #fff; border: 1px solid #e4e9e5; border-radius: 12px; overflow: hidden; }
.stats-grid article span { color: #718077; font-size: 12px; }
.stats-grid article strong { display: block; margin-top: 8px; font-size: 24px; color: #1f2c23; }
.stats-grid article svg { position: absolute; right: 16px; top: 18px; color: #39b54a; opacity: .85; }
.recent-products { padding: 20px; }
.section-title { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.section-title h2 { margin: 0; font-size: 19px; }
.section-title button { border: 1px solid #dce4de; background: #fff; color: #278d38; }
.product-list { border-top: 1px solid #edf1ee; }
.product-row { display: grid; grid-template-columns: 52px minmax(0,1fr) 110px 120px 74px; align-items: center; gap: 12px; min-height: 72px; border-bottom: 1px solid #edf1ee; }
.product-thumb { width: 48px; height: 48px; background: #f2f5f3; display: grid; place-items: center; overflow: hidden; color: #9aa49d; }
.product-thumb img { width: 100%; height: 100%; object-fit: cover; }
.product-copy { min-width: 0; }
.product-copy strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.product-copy small { color: #8a948d; }
.status-pill { justify-self: start; padding: 4px 7px; border-radius: 999px; font-size: 11px; background: #f0f2f0; color: #606a63; }
.status-active { background: #eaf7ed; color: #278d38; }
.status-draft { background: #fff7e6; color: #9a6700; }
.status-out_of_stock { background: #fff0ed; color: #b42318; }
.price { font-size: 13px; color: #e34d28; }
.edit-button { min-height: 32px; border: 1px solid #dce4de; background: #fff; color: #334239; padding: 0 10px; }
.empty-products { min-height: 130px; display: grid; place-items: center; color: #7f8a82; }

.owner-popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 60;
  background: #fff;
  border: 1px solid #e0e6e1;
  border-radius: 10px;
  box-shadow: 0 14px 34px rgba(25, 43, 32, .14);
  color: #2f3c34;
}
.owner-notifications { width: 330px; }
.owner-popover__head { padding: 14px 16px 12px; border-bottom: 1px solid #edf1ee; }
.owner-popover__head strong { display: block; font-size: 14px; }
.owner-popover__head span { display: block; margin-top: 3px; color: #7a867e; font-size: 11px; }
.owner-notifications__empty { min-height: 150px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 7px; padding: 22px; text-align: center; color: #7b867f; }
.owner-notifications__empty > svg { font-size: 22px; color: #39b54a; }
.owner-notifications__empty strong { color: #344138; font-size: 13px; }
.owner-notifications__empty span { max-width: 245px; font-size: 11px; line-height: 1.45; }
.owner-account-menu { width: 230px; padding: 6px; }
.owner-account-menu__shop { display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 4px; border-bottom: 1px solid #edf1ee; }
.owner-account-menu__avatar { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; overflow: hidden; border-radius: 50%; background: #edf8ef; color: #39b54a; }
.owner-account-menu__avatar img { width: 100%; height: 100%; object-fit: cover; }
.owner-account-menu__shop > div:last-child { min-width: 0; }
.owner-account-menu__shop strong, .owner-account-menu__shop span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.owner-account-menu__shop strong { color: #27342c; font-size: 12px; }
.owner-account-menu__shop span { margin-top: 2px; color: #7b867f; font-size: 10px; }
.owner-account-menu > button { width: 100%; min-height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 10px; color: #334139; background: #fff; border: 0; border-radius: 6px; text-align: left; cursor: pointer; }
.owner-account-menu > button:hover { background: #f3f6f4; }
.owner-account-menu > button svg { width: 15px; color: #6f7d74; }
.owner-account-menu__logout { margin-top: 4px; padding-top: 1px !important; border-top: 1px solid #edf1ee !important; color: #9b3c32 !important; }
.owner-account-menu__logout svg { color: #9b3c32 !important; }

@media (max-width: 1050px) {
  .owner-page { padding-left: 20px; padding-right: 20px; }
  .owner-hero { align-items: flex-start; flex-direction: column; }
  .hero-actions { justify-content: flex-start; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 700px) {
  .owner-page { padding: 16px 12px 40px; }
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
  .product-row { grid-template-columns: 48px minmax(0,1fr) auto; }
  .product-row .status-pill,.product-row .price { display: none; }
}
</style>
