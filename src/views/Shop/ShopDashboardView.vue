<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faBoxOpen,
  faBoxesStacked,
  faChartLine,
  faCamera,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faDownload,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faReceipt,
  faRightFromBracket,
  faStar,
  faTriangleExclamation,
  faWarehouse,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { utils, writeFileXLSX } from 'xlsx'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardUiStore } from '@/stores/dashboard-ui'
import { storeToRefs } from 'pinia'
import {
  shopDashboardService,
  type ProductPagination,
  type ProductSortField,
  type ProductStatus,
  type SellerNotification,
  type ShopDashboardSummary,
  type ShopOrder,
  type OrderSortField,
  type SortDirection,
  type ShopProduct,
  type ShopProfile,
} from '@/services/shop-dashboard.service'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const dashboardUiStore = useDashboardUiStore()
const { sidebarCollapsed } = storeToRefs(dashboardUiStore)

const sections = new Set([
  'overview',
  'orders',
  'products',
  'inventory',
  'analytics',
  'reviews',
  'profile',
  'settings',
])

const activeItem = ref('overview')
const shop = ref<ShopProfile | null>(null)
const summary = ref<ShopDashboardSummary | null>(null)
const products = ref<ShopProduct[]>([])
const dashboardProducts = ref<ShopProduct[]>([])
const orders = ref<ShopOrder[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showNotifications = ref(false)
const showAccountMenu = ref(false)
const readNotificationIds = ref<string[]>([])

const search = ref('')
const statusFilter = ref('')
const orderSearch = ref('')
const orderStatusFilter = ref('')
const paymentStatusFilter = ref('')
const productSortBy = ref<ProductSortField>('id')
const productSortOrder = ref<SortDirection>('desc')
const orderSortBy = ref<OrderSortField>('id')
const orderSortOrder = ref<SortDirection>('desc')

const pagination = reactive<ProductPagination>({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
})

const orderPagination = reactive<ProductPagination>({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
})

const shopForm = reactive({
  shop_name: '',
  phone: '',
  description: '',
  avatar: '',
})

const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const avatarPreview = ref<string | null>(null)

const pageTitle = computed(() => ({
  overview: 'Trang chủ Seller Center',
  orders: 'Quản lý đơn hàng',
  products: 'Quản lý sản phẩm',
  inventory: 'Kho & hàng tồn',
  analytics: 'Phân tích kinh doanh',
  reviews: 'Đánh giá sản phẩm',
  profile: 'Thông tin cửa hàng',
  settings: 'Cài đặt cửa hàng',
}[activeItem.value] ?? 'Kênh người bán'))

const firstName = computed<string>(() => {
  const value = authStore.user?.name ?? shop.value?.owner_name ?? 'Chủ shop'
  const lastName = value.trim().split(/\s+/).filter(Boolean).at(-1) ?? 'Chủ shop'
  return lastName
})

const firstInitial = computed(() => firstName.value.charAt(0).toUpperCase())

const canCreateProduct = computed(() => shop.value?.approval_status === 'approved')

const approvalLabel = computed(() => {
  const statusMap: Record<string, string> = {
    approved: 'Đã phê duyệt',
    pending: 'Chờ phê duyệt',
    rejected: 'Bị từ chối',
    suspended: 'Đã đình chỉ',
  }
  return statusMap[shop.value?.approval_status ?? ''] ?? 'Chưa xác định'
})

const productSummary = computed(() => ({
  total: dashboardProducts.value.length,
  active: dashboardProducts.value.filter((item) => item.status === 'active').length,
  draft: dashboardProducts.value.filter((item) => item.status === 'draft').length,
  inactive: dashboardProducts.value.filter((item) => item.status === 'inactive').length,
  lowStock: dashboardProducts.value.filter(
    (item) => item.stock_quantity > 0 && item.stock_quantity <= 10,
  ).length,
  outOfStock: dashboardProducts.value.filter(
    (item) => item.status === 'out_of_stock' || item.stock_quantity === 0,
  ).length,
}))

const lowStockProducts = computed(() => dashboardProducts.value
  .filter((item) => item.stock_quantity <= 10)
  .sort((a, b) => a.stock_quantity - b.stock_quantity)
  .slice(0, 6))

const recentOrders = computed(() => orders.value.slice(0, 6))
const notifications = computed(() => summary.value?.notifications ?? [])
const unreadCount = computed(() => notifications.value.filter(
  (item) => !readNotificationIds.value.includes(item.id),
).length)

const revenueChange = computed(() => calculateChange(
  summary.value?.sales.current_revenue ?? 0,
  summary.value?.sales.previous_revenue ?? 0,
))

const orderChange = computed(() => calculateChange(
  summary.value?.sales.current_orders ?? 0,
  summary.value?.sales.previous_orders ?? 0,
))

const maxRevenue = computed(() => Math.max(
  1,
  ...(summary.value?.sales.daily.map((item) => item.revenue) ?? [0]),
))

const maxOrders = computed(() => Math.max(
  1,
  ...(summary.value?.sales.daily.map((item) => item.orders) ?? [0]),
))

const orderLinePoints = computed(() => {
  const daily = summary.value?.sales.daily ?? []
  if (!daily.length) return ''
  const step = 700 / daily.length
  return daily.map((item, index) => {
    const x = step * index + step / 2
    const y = 190 - item.orders / maxOrders.value * 150
    return `${x},${y}`
  }).join(' ')
})

const taskCards = computed(() => {
  const tasks = summary.value?.tasks
  return [
    { key: 'pending', label: 'Đơn chờ xác nhận', value: tasks?.pending_orders ?? 0, section: 'orders', tone: 'warning' },
    { key: 'processing', label: 'Đơn đang xử lý', value: tasks?.processing_orders ?? 0, section: 'orders', tone: 'info' },
    { key: 'draft', label: 'Sản phẩm nháp', value: tasks?.draft_products ?? 0, section: 'products', tone: 'neutral' },
    { key: 'low', label: 'Sắp hết hàng', value: tasks?.low_stock_products ?? 0, section: 'inventory', tone: 'warning' },
    { key: 'out', label: 'Đã hết hàng', value: tasks?.out_of_stock_products ?? 0, section: 'inventory', tone: 'danger' },
    { key: 'review', label: 'Đánh giá chờ xem', value: tasks?.pending_reviews ?? 0, section: 'reviews', tone: 'info' },
  ]
})

const operationRows = computed(() => {
  const operations = summary.value?.operations
  return [
    {
      label: 'Tỷ lệ đơn hủy',
      note: 'Đơn bị hủy / tổng đơn trong 28 ngày',
      value: operations?.cancellation_rate ?? 0,
      target: 'Mục tiêu ≤ 2%',
      good: (operations?.cancellation_rate ?? 0) <= 2,
    },
    {
      label: 'Tỷ lệ hoàn tất',
      note: 'Đơn đã giao hoặc hoàn tất / tổng đơn trong 28 ngày',
      value: operations?.completion_rate ?? 0,
      target: 'Mục tiêu ≥ 90%',
      good: (operations?.completion_rate ?? 0) >= 90,
    },
    {
      label: 'Tỷ lệ đổi trả',
      note: 'Số lượng đổi trả / số lượng đã bán trong 28 ngày',
      value: operations?.return_rate ?? 0,
      target: 'Mục tiêu ≤ 2%',
      good: (operations?.return_rate ?? 0) <= 2,
    },
  ]
})

function calculateChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return (current - previous) / previous * 100
}

const formatCurrency = (value: number | null) => value === null
  ? '—'
  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

const formatShortCurrency = (value: number) => new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value)

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value)

const formatDate = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : [
        `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`,
        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      ].join(' ')
}

const formatDay = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
}).format(new Date(`${value}T00:00:00`))

const statusLabel = (status: ProductStatus) => ({
  draft: 'Bản nháp',
  active: 'Đang bán',
  inactive: 'Ngừng bán',
  out_of_stock: 'Hết hàng',
}[status])

const orderStatusLabel = (status: ShopOrder['order_status']) => ({
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  completed: 'Hoàn tất',
}[status])

const paymentStatusLabel = (status: ShopOrder['payment_status']) => ({
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  refunded: 'Đã hoàn tiền',
  partially_refunded: 'Hoàn một phần',
}[status])

const clearMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const loadShop = async () => {
  shop.value = await shopDashboardService.getShop()
  shopForm.shop_name = shop.value.shop_name
  shopForm.phone = shop.value.phone
  shopForm.description = shop.value.description ?? ''
  avatarPreview.value = shop.value.avatar
}

const loadSummary = async () => {
  summary.value = await shopDashboardService.getDashboardSummary(7)
}

const loadProducts = async () => {
  const result = await shopDashboardService.getProducts({
    page: pagination.page,
    limit: pagination.limit,
    search: search.value || undefined,
    status: statusFilter.value || undefined,
    sort_by: productSortBy.value,
    sort_order: productSortOrder.value,
  })
  products.value = result.products
  Object.assign(pagination, result.pagination)
}

const loadDashboardProducts = async () => {
  const allProducts: ShopProduct[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await shopDashboardService.getProducts({ page, limit: 100 })
    allProducts.push(...result.products)
    totalPages = result.pagination.totalPages
    page += 1
  } while (page <= totalPages)
  dashboardProducts.value = allProducts
}

const loadOrders = async () => {
  const result = await shopDashboardService.getOrders({
    page: orderPagination.page,
    limit: orderPagination.limit,
    search: orderSearch.value || undefined,
    order_status: orderStatusFilter.value || undefined,
    payment_status: paymentStatusFilter.value || undefined,
    sort_by: orderSortBy.value,
    sort_order: orderSortOrder.value,
  })
  orders.value = result.orders
  Object.assign(orderPagination, result.pagination)
}

const reloadAll = async () => {
  loading.value = true
  clearMessages()
  try {
    await loadShop()
    const results = await Promise.allSettled([
      loadSummary(),
      loadProducts(),
      loadDashboardProducts(),
      loadOrders(),
    ])
    if (results.some((result) => result.status === 'rejected')) {
      errorMessage.value = 'Một số số liệu chưa tải được. Bạn vẫn có thể sử dụng các mục đã tải thành công.'
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message ?? 'Không thể tải Seller Center'
  } finally {
    loading.value = false
  }
}

const selectMenu = async (item: { key: string }) => {
  if (!sections.has(item.key)) return
  activeItem.value = item.key
  showNotifications.value = false
  showAccountMenu.value = false
  if (window.innerWidth < 992) sidebarCollapsed.value = true
  clearMessages()
  await router.replace({ name: 'shop-dashboard', query: { section: item.key } })
}

const openTask = async (task: { key: string; section: string }) => {
  if (task.section === 'orders') {
    orderStatusFilter.value = task.key === 'pending' ? 'pending' : 'processing'
    orderPagination.page = 1
    await loadOrders()
  }
  if (task.section === 'products') statusFilter.value = 'draft'
  if (task.section === 'inventory') statusFilter.value = task.key === 'out' ? 'out_of_stock' : ''
  await selectMenu({ key: task.section })
}

const openNotification = async (item: SellerNotification) => {
  markNotificationRead(item.id)
  await selectMenu({ key: item.section })
}

const markNotificationRead = (id: string) => {
  if (!readNotificationIds.value.includes(id)) {
    readNotificationIds.value.push(id)
    localStorage.setItem('seller-read-notifications', JSON.stringify(readNotificationIds.value))
  }
}

const markAllRead = () => {
  readNotificationIds.value = notifications.value.map((item) => item.id)
  localStorage.setItem('seller-read-notifications', JSON.stringify(readNotificationIds.value))
}

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const openCreateProduct = () => {
  clearMessages()
  if (!canCreateProduct.value) {
    errorMessage.value = 'Cửa hàng phải được phê duyệt trước khi thêm sản phẩm.'
    return
  }
  void router.push({ name: 'shop-product-create' })
}

const openEditProduct = (product: ShopProduct) => {
  void router.push({
    name: 'shop-product-edit',
    params: { productId: product.id },
  })
}

const deleteProduct = async (product: ShopProduct) => {
  if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return
  clearMessages()
  try {
    await shopDashboardService.deleteProduct(product.id)
    successMessage.value = 'Đã xóa sản phẩm'
    await Promise.all([loadProducts(), loadDashboardProducts(), loadSummary(), loadShop()])
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message ?? 'Không thể xóa sản phẩm'
  }
}

const chooseAvatar = () => avatarInput.value?.click()

const changeAvatar = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    errorMessage.value = 'Avatar chỉ hỗ trợ JPG, PNG hoặc WebP'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Avatar phải có dung lượng tối đa 5MB'
    return
  }

  clearMessages()
  const localPreview = URL.createObjectURL(file)
  avatarPreview.value = localPreview
  avatarUploading.value = true
  try {
    const uploaded = await shopDashboardService.uploadShopAvatar(file)
    avatarPreview.value = uploaded.avatar
    await loadShop()
    successMessage.value = 'Đã cập nhật ảnh đại diện cửa hàng'
  } catch (error: unknown) {
    avatarPreview.value =
      shop.value?.avatar ?? null

    const apiError = error as {
      response?: {
        status?: number
        data?: {message?: string}
      }
      message?: string
    }

    console.error('Upload shop avatar failed:', {
        status: apiError.response?.status,
        message: apiError.response?.data?.message ?? apiError.message,
      },
    )

    errorMessage.value =
      apiError.response?.data?.message ??
      apiError.message ??
      'Không thể cập nhật ảnh đại diện cửa hàng'
  } finally {
    URL.revokeObjectURL(localPreview)
    avatarUploading.value = false
  }
}

const normalizeShopPhone = () => {
  shopForm.phone = shopForm.phone.replace(/\D/g, '').slice(0, 10)
}

const saveShop = async () => {
  clearMessages()
  normalizeShopPhone()

  if (!/^0\d{9}$/.test(shopForm.phone)) {
    errorMessage.value = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0'
    return
  }

  saving.value = true
  try {
    shop.value = await shopDashboardService.updateShop({
      shop_name: shopForm.shop_name.trim(),
      phone: shopForm.phone,
      description: shopForm.description.trim() || null,
    })
    successMessage.value = 'Đã cập nhật thông tin cửa hàng'
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message ?? 'Không thể cập nhật cửa hàng'
  } finally {
    saving.value = false
  }
}

const exportExcel = () => {
  const rows = dashboardProducts.value.map((product) => ({
    ID: product.id,
    'Tên sản phẩm': product.name,
    SKU: product.slug,
    'Danh mục': product.category_name,
    'Giá gốc': product.price,
    'Giá khuyến mãi': product.sale_price ?? '',
    'Tồn kho': product.stock_quantity,
    'Trạng thái': statusLabel(product.status),
    'Ngày tạo': product.created_at,
    'Cập nhật': product.updated_at,
  }))
  const worksheet = utils.json_to_sheet(rows)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'San pham')
  writeFileXLSX(workbook, `san-pham-${slugify(shop.value?.shop_name || 'shop')}.xlsx`)
}

const searchProducts = async () => {
  pagination.page = 1
  await loadProducts()
}

const searchOrders = async () => {
  orderPagination.page = 1
  await loadOrders()
}

const resetProductSearch = async () => {
  search.value = ''
  await searchProducts()
}

const resetOrderSearch = async () => {
  orderSearch.value = ''
  await searchOrders()
}

const sortMark = (
  current: string,
  field: string,
  direction: SortDirection,
) => current === field
  ? (direction === 'asc' ? '↑' : '↓')
  : '↕'

const toggleProductSort = async (field: ProductSortField) => {
  if (productSortBy.value === field) {
    productSortOrder.value = productSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    productSortBy.value = field
    productSortOrder.value = ['name', 'category', 'status'].includes(field)
      ? 'asc'
      : 'desc'
  }
  pagination.page = 1
  await loadProducts()
}

const toggleOrderSort = async (field: OrderSortField) => {
  if (orderSortBy.value === field) {
    orderSortOrder.value = orderSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    orderSortBy.value = field
    orderSortOrder.value = ['order_code', 'customer', 'payment_status', 'order_status'].includes(field)
      ? 'asc'
      : 'desc'
  }
  orderPagination.page = 1
  await loadOrders()
}

const goProductPage = async (page: number) => {
  if (page < 1 || page > pagination.totalPages) return
  pagination.page = page
  await loadProducts()
}

const goOrderPage = async (page: number) => {
  if (page < 1 || page > orderPagination.totalPages) return
  orderPagination.page = page
  await loadOrders()
}

const logout = async () => {
  authStore.logout()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  const section = Array.isArray(route.query.section)
    ? route.query.section[0]
    : route.query.section
  if (section && sections.has(section)) activeItem.value = section
  try {
    readNotificationIds.value = JSON.parse(
      localStorage.getItem('seller-read-notifications') || '[]',
    )
  } catch {
    readNotificationIds.value = []
  }
  await reloadAll()
  if (route.query.created === '1') successMessage.value = 'Đã thêm sản phẩm thành công'
  if (route.query.updated === '1') successMessage.value = 'Đã cập nhật sản phẩm thành công'
})
</script>

<template>
  <div class="seller-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <DashboardSidebar
      variant="shop"
      :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
      :avatar-url="shop?.avatar || authStore.user?.avatar"
      :active-item="activeItem"
      :collapsed="sidebarCollapsed"
      @select="selectMenu"
    />

    <div class="seller-workspace">
      <DashboardHeader
        :title="activeItem === 'overview' ? `Xin chào, ${firstName}` : pageTitle"
        :subtitle="activeItem === 'overview' ? 'Theo dõi các việc cần làm và hiệu quả cửa hàng.' : (shop?.shop_name || '')"
        :shop-name="shop?.shop_name || 'Cửa hàng'"
        :approval-label="approvalLabel"
        :collapsed="sidebarCollapsed"
        :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
        :unread-count="unreadCount"
        :show-search="activeItem === 'overview'"
        search-placeholder="Tìm nhanh trong Seller Center..."
        @toggle-sidebar="dashboardUiStore.toggleSidebar()"
        @home="router.push('/')"
        @shop="router.push({ name: 'shop' })"
        @notifications="showNotifications = !showNotifications; showAccountMenu = false"
      >
        <template #notification-panel>
          <aside v-if="showNotifications" class="notification-drawer">
            <div class="drawer-head">
              <div>
                <strong>Thông báo</strong>
                <small>{{ unreadCount }} thông báo chưa đọc</small>
              </div>
              <button type="button" @click="markAllRead">Đã đọc tất cả</button>
            </div>
            <div v-if="notifications.length" class="notification-list">
              <button
                v-for="item in notifications"
                :key="item.id"
                type="button"
                :class="{ unread: !readNotificationIds.includes(item.id) }"
                @click="openNotification(item)"
              >
                <span class="notification-icon" :class="item.type">
                  <FontAwesomeIcon :icon="item.type === 'order' ? faReceipt : faWarehouse" />
                </span>
                <span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.description }}</small>
                  <time>{{ formatDate(item.created_at) }}</time>
                </span>
                <i></i>
              </button>
            </div>
            <div v-else class="drawer-empty">Chưa có thông báo cần xử lý.</div>
          </aside>
        </template>

        <template #account-trigger>
          <button
            type="button"
            class="account-button"
            @click="showAccountMenu = !showAccountMenu; showNotifications = false"
          >
            <span>{{ firstName.charAt(0).toUpperCase() }}</span>
            <strong>{{ authStore.user?.name || shop?.owner_name }}</strong>
            <FontAwesomeIcon :icon="faChevronDown" />
          </button>
        </template>

        <template #account-panel>
          <div v-if="showAccountMenu" class="account-menu">
            <div class="account-menu__identity">
              <strong>{{ shop?.shop_name || 'Cửa hàng' }}</strong>
              <span>{{ authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng' }}</span>
            </div>
            <button type="button" @click="selectMenu({ key: 'profile' })">Thông tin cửa hàng</button>
            <button type="button" class="logout" @click="logout">
              <FontAwesomeIcon :icon="faRightFromBracket" /> Đăng xuất
            </button>
          </div>
        </template>
      </DashboardHeader>

      <main class="seller-content">

        <div v-if="shop && !canCreateProduct" class="alert warning">
          <FontAwesomeIcon :icon="faTriangleExclamation" />
          <div><strong>Cửa hàng chưa thể đăng sản phẩm</strong><span>Trạng thái: {{ approvalLabel }}.</span></div>
        </div>
        <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
        <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

        <div v-if="loading" class="loading-state">Đang tải dữ liệu Seller Center...</div>

        <template v-else-if="activeItem === 'overview'">
          <section class="section-block">
            <div class="section-heading">
              <div><h2>Những việc cần làm</h2><p>Các công việc cần ưu tiên xử lý hôm nay</p></div>
            </div>
            <div class="task-grid">
              <button v-for="task in taskCards" :key="task.key" type="button" class="task-card" @click="openTask(task)">
                <span :class="`task-dot ${task.tone}`"></span>
                <strong>{{ formatNumber(task.value) }}</strong>
                <span>{{ task.label }}</span>
                <FontAwesomeIcon :icon="faChevronRight" />
              </button>
            </div>
          </section>

          <section class="dashboard-two-columns">
            <article class="section-block business-card">
              <div class="section-heading">
                <div><h2>Hiệu quả kinh doanh</h2><p>Doanh thu và đơn hàng trong 7 ngày gần nhất</p></div>
                <button type="button" @click="selectMenu({ key: 'analytics' })">Xem chi tiết <FontAwesomeIcon :icon="faChevronRight" /></button>
              </div>
              <div class="business-layout">
                <div class="business-summary">
                  <div>
                    <span>Doanh thu</span>
                    <strong>{{ formatCurrency(summary?.sales.current_revenue ?? 0) }}</strong>
                    <small :class="revenueChange >= 0 ? 'positive' : 'negative'">{{ revenueChange >= 0 ? '▲' : '▼' }} {{ Math.abs(revenueChange).toFixed(1) }}%</small>
                  </div>
                  <div>
                    <span>Đơn hàng</span>
                    <strong>{{ formatNumber(summary?.sales.current_orders ?? 0) }}</strong>
                    <small :class="orderChange >= 0 ? 'positive' : 'negative'">{{ orderChange >= 0 ? '▲' : '▼' }} {{ Math.abs(orderChange).toFixed(1) }}%</small>
                  </div>
                </div>
                <div class="chart-wrap">
                  <div class="chart-grid"><i v-for="n in 5" :key="n"></i></div>
                  <div class="bar-chart">
                    <div v-for="item in summary?.sales.daily" :key="item.day" class="chart-column">
                      <span class="chart-value">{{ item.revenue ? formatShortCurrency(item.revenue) : '' }}</span>
                      <div class="bar" :style="{ height: `${Math.max(2, item.revenue / maxRevenue * 100)}%` }"></div>
                      <small>{{ formatDay(item.day) }}</small>
                    </div>
                  </div>
                  <svg class="order-line" viewBox="0 0 700 220" preserveAspectRatio="none" aria-hidden="true">
                    <polyline :points="orderLinePoints" fill="none" stroke="#f59e0b" stroke-width="4" vector-effect="non-scaling-stroke" />
                  </svg>
                  <div class="chart-legend"><span><i class="revenue"></i>Doanh thu</span><span><i class="orders"></i>Đơn hàng</span></div>
                </div>
              </div>
            </article>

            <article class="section-block rating-card">
              <div class="section-heading"><div><h2>Đánh giá sản phẩm</h2><p>Đánh giá đã được công khai</p></div></div>
              <strong class="rating-number">{{ (summary?.operations.average_rating ?? 0).toFixed(1) }}<small>/5</small></strong>
              <div class="stars">★★★★★</div>
              <span>{{ formatNumber(summary?.operations.rating_count ?? 0) }} lượt đánh giá</span>
              <button type="button" class="button secondary full" @click="selectMenu({ key: 'reviews' })">Xem đánh giá</button>
            </article>
          </section>

          <section class="section-block operations-card">
            <div class="section-heading">
              <div><h2>Hiệu quả vận hành</h2><p>Các chỉ số được tính từ dữ liệu 28 ngày gần nhất</p></div>
              <button type="button" @click="selectMenu({ key: 'analytics' })">Xem chi tiết <FontAwesomeIcon :icon="faChevronRight" /></button>
            </div>
            <div class="operations-table">
              <div class="operations-head"><span>Chỉ số</span><span>Điểm hiện tại</span><span>Trạng thái</span></div>
              <div v-for="row in operationRows" :key="row.label" class="operations-row">
                <div><strong>{{ row.label }}</strong><small>{{ row.note }}</small><em>{{ row.target }}</em></div>
                <strong :class="row.good ? 'good' : 'bad'">{{ row.value.toFixed(1) }}%</strong>
                <span :class="row.good ? 'status-good' : 'status-bad'">{{ row.good ? 'Tốt' : 'Cần cải thiện' }}</span>
              </div>
              <div class="operations-row rating-operation">
                <div><strong>Điểm đánh giá</strong><small>Trung bình đánh giá công khai của sản phẩm</small></div>
                <strong class="good">{{ (summary?.operations.average_rating ?? 0).toFixed(1) }}/5</strong>
                <span :class="(summary?.operations.average_rating ?? 0) >= 4 ? 'status-good' : 'status-bad'">{{ (summary?.operations.average_rating ?? 0) >= 4 ? 'Tốt' : 'Cần cải thiện' }}</span>
              </div>
            </div>
          </section>

          <section class="dashboard-two-columns bottom-grid">
            <article class="section-block">
              <div class="section-heading"><div><h2>Đơn hàng gần đây</h2><p>Cập nhật mới nhất từ khách hàng</p></div><button @click="selectMenu({ key: 'orders' })">Tất cả</button></div>
              <div v-if="recentOrders.length" class="compact-list">
                <button v-for="order in recentOrders" :key="order.id" type="button" @click="selectMenu({ key: 'orders' })">
                  <span class="list-icon"><FontAwesomeIcon :icon="faReceipt" /></span>
                  <span><strong>{{ order.order_code }}</strong><small>{{ order.recipient_name }} · {{ order.total_quantity }} sản phẩm</small></span>
                  <span><strong>{{ formatCurrency(order.shop_total) }}</strong><small>{{ orderStatusLabel(order.order_status) }}</small></span>
                </button>
              </div>
              <div v-else class="empty-state">Chưa có đơn hàng.</div>
            </article>
            <article class="section-block">
              <div class="section-heading"><div><h2>Cảnh báo tồn kho</h2><p>Các sản phẩm cần bổ sung</p></div><button @click="selectMenu({ key: 'inventory' })">Tất cả</button></div>
              <div v-if="lowStockProducts.length" class="compact-list stock-list">
                <button v-for="product in lowStockProducts" :key="product.id" type="button" @click="selectMenu({ key: 'inventory' })">
                  <span class="list-icon danger"><FontAwesomeIcon :icon="faTriangleExclamation" /></span>
                  <span><strong>{{ product.name }}</strong><small>{{ product.category_name }}</small></span>
                  <span class="stock-quantity">{{ product.stock_quantity }}</span>
                </button>
              </div>
              <div v-else class="empty-state"><FontAwesomeIcon :icon="faCircleCheck" /> Tồn kho đang ổn định.</div>
            </article>
          </section>
        </template>

        <template v-else-if="activeItem === 'analytics'">
          <section class="metric-grid">
            <article><span>Doanh thu 7 ngày</span><strong>{{ formatCurrency(summary?.sales.current_revenue ?? 0) }}</strong><small :class="revenueChange >= 0 ? 'positive' : 'negative'">{{ revenueChange.toFixed(1) }}% so với kỳ trước</small></article>
            <article><span>Đơn hàng 7 ngày</span><strong>{{ formatNumber(summary?.sales.current_orders ?? 0) }}</strong><small :class="orderChange >= 0 ? 'positive' : 'negative'">{{ orderChange.toFixed(1) }}% so với kỳ trước</small></article>
            <article><span>Tỷ lệ hoàn tất</span><strong>{{ (summary?.operations.completion_rate ?? 0).toFixed(1) }}%</strong><small>Trong 28 ngày</small></article>
            <article><span>Điểm đánh giá</span><strong>{{ (summary?.operations.average_rating ?? 0).toFixed(1) }}/5</strong><small>{{ summary?.operations.rating_count ?? 0 }} lượt đánh giá</small></article>
          </section>
          <section class="section-block business-card analytics-chart">
            <div class="section-heading"><div><h2>Doanh thu và đơn hàng</h2><p>Biểu đồ 7 ngày gần nhất</p></div></div>
            <div class="chart-wrap large">
              <div class="chart-grid"><i v-for="n in 5" :key="n"></i></div>
              <div class="bar-chart"><div v-for="item in summary?.sales.daily" :key="item.day" class="chart-column"><span class="chart-value">{{ formatShortCurrency(item.revenue) }}</span><div class="bar" :style="{ height: `${Math.max(2, item.revenue / maxRevenue * 100)}%` }"></div><small>{{ formatDay(item.day) }}</small></div></div>
              <svg class="order-line" viewBox="0 0 700 220" preserveAspectRatio="none"><polyline :points="orderLinePoints" fill="none" stroke="#f59e0b" stroke-width="4" vector-effect="non-scaling-stroke" /></svg>
              <div class="chart-legend"><span><i class="revenue"></i>Doanh thu</span><span><i class="orders"></i>Đơn hàng</span></div>
            </div>
          </section>
          <section class="section-block operations-card">
            <div class="section-heading">
              <div>
                <h2>Hiệu quả vận hành</h2>
                <p>Dữ liệu 28 ngày gần nhất</p>
              </div>
            </div>
            <div class="operations-table">
              <div class="operations-head">
                <span>Chỉ số</span>
                <span>Điểm hiện tại</span>
                <span>Trạng thái</span>
              </div>
              <div v-for="row in operationRows" :key="row.label" class="operations-row">
                <div>
                  <strong>{{ row.label }}</strong>
                  <small>{{ row.note }}</small>
                  <em>{{ row.target }}</em>
                </div>
                <strong :class="row.good ? 'good' : 'bad'">{{ row.value.toFixed(1) }}%</strong>
                <span :class="row.good ? 'status-good' : 'status-bad'">{{ row.good ? 'Tốt' : 'Cần cải thiện' }}</span>
              </div>
            </div>
          </section>
        </template>

        <section v-else-if="activeItem === 'products' || activeItem === 'inventory'" class="section-block management-card">
          <div class="section-heading">
            <div><h2>{{ activeItem === 'inventory' ? 'Kho & hàng tồn' : 'Danh sách sản phẩm' }}</h2><p>{{ pagination.total }} sản phẩm trong cửa hàng</p></div>
            <div class="page-actions"><button type="button" class="button secondary" @click="exportExcel"><FontAwesomeIcon :icon="faDownload" /> Xuất Excel</button><button type="button" class="button primary" @click="openCreateProduct"><FontAwesomeIcon :icon="faPlus" /> Thêm sản phẩm</button></div>
          </div>
          <form class="filter-bar" @submit.prevent="searchProducts">
            <div class="search-control">
              <FontAwesomeIcon :icon="faMagnifyingGlass" class="search-control__icon" />
              <input
                v-model="search"
                type="search"
                placeholder="Tìm theo tên hoặc SKU"
              />
              <button
                v-if="search"
                type="button"
                class="search-control__clear"
                aria-label="Xóa nội dung tìm kiếm"
                title="Xóa tìm kiếm"
                @click="resetProductSearch"
              >
                <FontAwesomeIcon :icon="faXmark" />
              </button>
            </div>

            <div class="search-select-wrap">
              <select v-model="statusFilter" class="search-select" @change="searchProducts">
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang bán</option>
                <option value="draft">Bản nháp</option>
                <option value="inactive">Ngừng bán</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
              <FontAwesomeIcon :icon="faChevronDown" class="search-select-wrap__arrow" />
            </div>

            <button type="submit" class="search-submit">
              <FontAwesomeIcon :icon="faMagnifyingGlass" />
              <span>Tìm kiếm</span>
            </button>
          </form>
          <div class="table-scroll">
            <table class="data-table product-table">
              <thead><tr>
                <th><button type="button" class="sort-button" @click="toggleProductSort('id')">ID <span>{{ sortMark(productSortBy, 'id', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('name')">Sản phẩm <span>{{ sortMark(productSortBy, 'name', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('category')">Danh mục <span>{{ sortMark(productSortBy, 'category', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('price')">Giá <span>{{ sortMark(productSortBy, 'price', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('stock')">Tồn kho <span>{{ sortMark(productSortBy, 'stock', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('status')">Trạng thái <span>{{ sortMark(productSortBy, 'status', productSortOrder) }}</span></button></th>
                <th><button type="button" class="sort-button" @click="toggleProductSort('updated_at')">Cập nhật <span>{{ sortMark(productSortBy, 'updated_at', productSortOrder) }}</span></button></th>
                <th aria-label="Thao tác"></th>
              </tr></thead>
              <tbody>
                <tr v-for="product in products" :key="product.id">
                  <td class="id-cell">#{{ product.id }}</td>
                  <td>
                    <div class="product-cell">
                      <span>
                        <img v-if="product.thumbnail" :src="product.thumbnail" :alt="product.name" />
                        <FontAwesomeIcon v-else :icon="faBoxOpen" />
                      </span>
                      <div>
                        <strong>{{ product.name }}</strong>
                        <small>{{ product.slug }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ product.category_name }}</td>
                  <td><strong>{{ formatCurrency(product.sale_price ?? product.price) }}</strong><small v-if="product.sale_price !== null" class="old-price">{{ formatCurrency(product.price) }}</small></td>
                  <td><strong :class="product.stock_quantity <= 10 ? 'stock-low' : ''">{{ product.stock_quantity }}</strong></td>
                  <td>
                    <span class="table-status plain-status" :class="`product-${product.status}`">
                      {{ statusLabel(product.status) }}
                    </span>
                  </td>
                  <td>{{ formatDate(product.updated_at) }}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" title="Chỉnh sửa" @click="openEditProduct(product)">
                        <FontAwesomeIcon :icon="faPen" />
                      </button>
                      <button type="button" class="delete" title="Xóa" @click="deleteProduct(product)">
                        <FontAwesomeIcon :icon="faXmark" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!products.length"><td colspan="8" class="empty-cell">Không tìm thấy sản phẩm.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="pagination"><button :disabled="pagination.page <= 1" @click="goProductPage(pagination.page - 1)">Trước</button><span>Trang {{ pagination.page }} / {{ Math.max(pagination.totalPages, 1) }}</span><button :disabled="pagination.page >= pagination.totalPages" @click="goProductPage(pagination.page + 1)">Sau</button></div>
        </section>

        <section v-else-if="activeItem === 'orders'" class="section-block management-card">
          <div class="section-heading"><div><h2>Danh sách đơn hàng</h2><p>{{ orderPagination.total }} đơn hàng của cửa hàng</p></div></div>
          <form class="filter-bar order-filter" @submit.prevent="searchOrders">
            <div class="search-control">
              <FontAwesomeIcon :icon="faMagnifyingGlass" class="search-control__icon" />
              <input
                v-model="orderSearch"
                type="search"
                placeholder="Mã đơn, người nhận, số điện thoại"
              />
              <button
                v-if="orderSearch"
                type="button"
                class="search-control__clear"
                aria-label="Xóa nội dung tìm kiếm đơn hàng"
                title="Xóa tìm kiếm"
                @click="resetOrderSearch"
              >
                <FontAwesomeIcon :icon="faXmark" />
              </button>
            </div>

            <div class="search-select-wrap">
              <select v-model="orderStatusFilter" class="search-select" @change="searchOrders">
                <option value="">Tất cả trạng thái đơn</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="processing">Đang xử lý</option>
                <option value="delivering">Đang giao</option>
                <option value="delivered">Đã giao</option>
                <option value="cancelled">Đã hủy</option>
                <option value="completed">Hoàn tất</option>
              </select>
              <FontAwesomeIcon :icon="faChevronDown" class="search-select-wrap__arrow" />
            </div>

            <div class="search-select-wrap">
              <select v-model="paymentStatusFilter" class="search-select" @change="searchOrders">
                <option value="">Tất cả thanh toán</option>
                <option value="pending">Chờ thanh toán</option>
                <option value="paid">Đã thanh toán</option>
                <option value="failed">Thanh toán lỗi</option>
                <option value="refunded">Đã hoàn tiền</option>
              </select>
              <FontAwesomeIcon :icon="faChevronDown" class="search-select-wrap__arrow" />
            </div>

            <button type="submit" class="search-submit">
              <FontAwesomeIcon :icon="faMagnifyingGlass" />
              <span>Tìm kiếm</span>
            </button>
          </form>
          <div class="table-scroll"><table class="data-table"><thead><tr>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('id')">ID <span>{{ sortMark(orderSortBy, 'id', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('order_code')">Đơn hàng <span>{{ sortMark(orderSortBy, 'order_code', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('customer')">Khách hàng <span>{{ sortMark(orderSortBy, 'customer', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('items')">Sản phẩm <span>{{ sortMark(orderSortBy, 'items', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('shop_total')">Doanh thu shop <span>{{ sortMark(orderSortBy, 'shop_total', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('payment_status')">Thanh toán <span>{{ sortMark(orderSortBy, 'payment_status', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('order_status')">Trạng thái <span>{{ sortMark(orderSortBy, 'order_status', orderSortOrder) }}</span></button></th>
            <th><button type="button" class="sort-button" @click="toggleOrderSort('order_date')">Ngày đặt <span>{{ sortMark(orderSortBy, 'order_date', orderSortOrder) }}</span></button></th>
          </tr></thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td class="id-cell">#{{ order.id }}</td>
                <td>
                  <strong>{{ order.order_code }}</strong>
                </td>
                <td>
                  <strong>{{ order.recipient_name }}</strong>
                  <small>{{ order.recipient_phone }}</small>
                </td>
                <td class="order-product-cell">
                  <strong class="order-product-name" :title="(order as any)?.first_product_name ?? ''">
                    {{ (order as any)?.first_product_name || 'Sản phẩm' }}
                  </strong>
                  <small v-if="order.item_count > 1">+{{ order.item_count - 1 }} sản phẩm khác</small>
                </td>
                <td><strong>{{ formatCurrency(order.shop_total) }}</strong></td>
                <td><span class="table-status plain-status" :class="`payment-${order.payment_status}`">{{ paymentStatusLabel(order.payment_status) }}</span></td>
                <td><span class="table-status plain-status" :class="`order-${order.order_status}`">{{ orderStatusLabel(order.order_status) }}</span></td>
                <td class="date-cell">{{ formatDate(order.order_date) }}</td>
              </tr>
              <tr v-if="!orders.length"><td colspan="8" class="empty-cell">Không tìm thấy đơn hàng.</td></tr>
            </tbody>
          </table></div>
          <div class="pagination"><button :disabled="orderPagination.page <= 1" @click="goOrderPage(orderPagination.page - 1)">Trước</button><span>Trang {{ orderPagination.page }} / {{ Math.max(orderPagination.totalPages, 1) }}</span><button :disabled="orderPagination.page >= orderPagination.totalPages" @click="goOrderPage(orderPagination.page + 1)">Sau</button></div>
        </section>

        <section v-else-if="activeItem === 'reviews'" class="section-block management-card">
          <div class="section-heading">
            <div>
              <h2>Đánh giá sản phẩm</h2>
              <p>Đánh giá mới nhất dành cho sản phẩm của cửa hàng</p>
            </div>
            <div class="review-summary-inline">
              <strong>{{ (summary?.operations.average_rating ?? 0).toFixed(1) }}/5</strong>
              <span>{{ summary?.operations.rating_count ?? 0 }} đánh giá</span>
            </div>
          </div>
          <div v-if="summary?.reviews.length" class="review-list">
            <article v-for="review in summary.reviews" :key="review.id">
              <div class="review-head"><div>
                <strong>{{ review.product_name }}</strong>
                <span class="review-stars">{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</span>
              </div>
              <span class="table-status" :class="`review-${review.status}`">
                {{ review.status === 'published' ? 'Đã hiển thị' : review.status === 'pending' ? 'Chờ duyệt' : 'Đã ẩn' }}
              </span>
            </div>
            <h3>{{ review.title }}</h3>
            <p>{{ review.comment }}</p>
            <time>{{ formatDate(review.created_at) }}</time>
          </article>
          </div>
          <div v-else class="empty-state">Cửa hàng chưa có đánh giá sản phẩm.</div>
        </section>

        <section v-else-if="activeItem === 'profile'" class="section-block profile-card">
          <div class="section-heading"><div><h2>Thông tin cửa hàng</h2><p>Thông tin hiển thị với khách hàng</p></div></div>
          <div class="shop-profile-layout">
            <aside class="shop-avatar-editor">
              <button type="button" class="shop-avatar-preview" :disabled="avatarUploading" @click="chooseAvatar">
                <img v-if="avatarPreview" :src="avatarPreview" alt="Ảnh đại diện cửa hàng" />
                <span v-else>{{ (shop?.shop_name || 'S').charAt(0).toUpperCase() }}</span>
                <i><FontAwesomeIcon :icon="faCamera" /></i>
              </button>
              <input ref="avatarInput" class="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="changeAvatar" />
              <button type="button" class="avatar-change-button" :disabled="avatarUploading" @click="chooseAvatar">
                {{ avatarUploading ? 'Đang tải...' : 'Thay ảnh' }}
              </button>
              <small>JPG, PNG hoặc WebP · tối đa 5MB</small>
            </aside>

            <form class="profile-form" @submit.prevent="saveShop">
              <label><span>Tên cửa hàng *</span><input v-model="shopForm.shop_name" required maxlength="150" /></label>
              <label><span>Số điện thoại *</span><input v-model="shopForm.phone" required inputmode="numeric" autocomplete="tel" maxlength="10" pattern="0[0-9]{9}" @input="normalizeShopPhone" /></label>
              <label class="full-field"><span>Mô tả cửa hàng</span><textarea v-model="shopForm.description" rows="7" maxlength="2000"></textarea><small>{{ shopForm.description.length }}/2000</small></label>
              <div class="form-actions"><button type="submit" class="button primary" :disabled="saving">{{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}</button></div>
            </form>
          </div>
        </section>

        <section v-else-if="activeItem === 'settings'" class="section-block settings-card">
          <div class="section-heading"><div><h2>Cài đặt cửa hàng</h2><p>Trạng thái và thông tin tài khoản bán hàng</p></div></div>
          <div class="settings-list"><div><span>Trạng thái phê duyệt</span><strong>{{ approvalLabel }}</strong></div><div><span>Cấp độ cửa hàng</span><strong>{{ shop?.level || 'basic' }}</strong></div><div><span>Email chủ cửa hàng</span><strong>{{ shop?.owner_email || '—' }}</strong></div><div><span>Ngày tham gia</span><strong>{{ shop?.created_at ? formatDate(shop.created_at) : '—' }}</strong></div></div>
        </section>
      </main>
    </div>

  </div>
</template>

<style lang="scss" scoped>
$green: #39b54a;
$green-dark: #278d38;
$border: #e2e8e4;
$muted: #6b7280;
$page: #f5f7f6;

* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }

.seller-shell { --sidebar-layout-width: 276px; display: flex; min-height: 100vh; color: #20242b; background: $page; font-family: "Segoe UI", Tahoma, sans-serif; }
.seller-shell.sidebar-collapsed { --sidebar-layout-width: 100px; }
.seller-workspace { width: 100%; min-width: 0; max-width: 100%; flex: 0 0 100%; }
.seller-topbar { position: sticky; top: 0; z-index: 30; display: flex; height: 64px; align-items: center; gap: 14px; padding: 0 28px; background: #fff; border-bottom: 1px solid $border; }
.sidebar-toggle { display: grid; width: 40px; height: 38px; flex: 0 0 40px; place-items: center; color: #252a32; background: #fff; border: 1px solid $border; border-radius: 2px; font-size: 17px; }
.sidebar-toggle:hover { background: #f1f2f4; border-color: #b8bec7; }
.sidebar-toggle:focus-visible { outline: 2px solid #9a7b45; outline-offset: 2px; }
.topbar-shop, .topbar-actions, .account-button { display: flex; align-items: center; }
.topbar-shop { gap: 10px; }
.topbar-shop-icon { display: grid; width: 34px; height: 34px; place-items: center; color: #f5f5f4; background: #20242b; border: 1px solid #20242b; border-radius: 2px; }
.topbar-shop div { display: flex; flex-direction: column; }
.topbar-shop strong { font-size: 14px; }
.topbar-shop small { margin-top: 2px; color: $muted; font-size: 11px; }
.topbar-actions { gap: 10px; margin-left: auto; }
.topbar-link, .icon-button, .account-button { height: 38px; color: #334139; background: #fff; border: 1px solid $border; border-radius: 3px; }
.topbar-link { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; white-space: nowrap; }
.icon-button { position: relative; width: 40px; }
.notification-count { position: absolute; top: -7px; right: -7px; min-width: 20px; padding: 2px 5px; color: #17191e; background: #d4b77d; border: 2px solid #fff; border-radius: 10px; font-size: 10px; font-weight: 700; }
.account-button { display: flex; height: 40px; align-items: center; gap: 8px; max-width: 220px; padding: 0 10px; color: #fff; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.28); border-radius: 9px; }
.account-button > span { display: grid; width: 27px; height: 27px; place-items: center; color: #39b54a; background: #fff; border-radius: 7px; font-size: 11px; font-weight: 700; }
.account-button strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.account-button svg { color: rgba(255,255,255,.8); font-size: 10px; }
.topbar-popover-wrap { position: relative; }
.notification-drawer, .account-menu { position: absolute; top: calc(100% + 12px); right: 0; z-index: 50; background: #fff; border: 1px solid $border; border-radius: 10px; box-shadow: 0 14px 34px rgba(25, 43, 32, .14); }
.notification-drawer { width: 410px; max-height: calc(100vh - 90px); overflow: auto; }
.drawer-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 18px; background: #fff; border-bottom: 1px solid $border; }
.drawer-head div { display: flex; flex-direction: column; }
.drawer-head strong { font-size: 16px; }
.drawer-head small { margin-top: 3px; color: $muted; font-size: 11px; }
.drawer-head button, .section-heading > button { color: $green-dark; background: transparent; border: 0; font-size: 12px; font-weight: 600; }
.notification-list > button { position: relative; display: grid; width: 100%; grid-template-columns: 42px 1fr 8px; gap: 12px; padding: 14px 18px; text-align: left; background: #fff; border: 0; border-bottom: 1px solid #edf0ee; }
.notification-list > button.unread { background: #f4f5f7; }
.notification-list > button > span:nth-child(2) { display: flex; min-width: 0; flex-direction: column; }
.notification-list strong { font-size: 13px; }
.notification-list small { margin-top: 3px; color: #536058; font-size: 12px; }
.notification-list time { margin-top: 5px; color: #89928c; font-size: 10px; }
.notification-list button > i { width: 7px; height: 7px; margin-top: 6px; background: transparent; border-radius: 50%; }
.notification-list button.unread > i { background: #b18a4d; }
.notification-icon { display: grid; width: 40px; height: 40px; place-items: center; color: #a86108; background: #fff4df; border-radius: 3px; }
.notification-icon.inventory { color: #76552e; background: #f4efe8; }
.drawer-empty, .empty-state { padding: 30px; color: $muted; text-align: center; }
.account-menu { width: 220px; padding: 6px; }
.account-menu__identity { padding: 9px 10px 10px; margin-bottom: 4px; border-bottom: 1px solid $border; }
.account-menu__identity strong, .account-menu__identity span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-menu__identity strong { color: #2d3a32; font-size: 12px; }
.account-menu__identity span { margin-top: 2px; color: $muted; font-size: 10px; }
.account-menu button { display: block; width: 100%; padding: 10px; color: #334139; text-align: left; background: #fff; border: 0; border-radius: 2px; }
.account-menu button:hover { background: #f2f3f5; }
.account-menu .logout { color: #6b4f2d; border-top: 1px solid $border; }

.seller-content { box-sizing: border-box; width: calc(100% - var(--sidebar-layout-width)); max-width: 1560px; margin: 0 auto 0 var(--sidebar-layout-width); padding: 26px 30px 50px; transition: width .18s ease, margin-left .18s ease; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
.page-header p { margin: 0 0 6px; color: $green-dark; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.page-header h1 { margin: 0; font-size: 25px; line-height: 1.25; }
.page-header > div > span { display: block; margin-top: 7px; color: $muted; font-size: 13px; }
.page-actions { display: flex; gap: 10px; }
.button { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px; padding: 0 15px; border: 1px solid transparent; border-radius: 2px; font-size: 13px; font-weight: 650; }
.button.primary { color: #fff; background: $green; border-color: $green; }
.button.primary:hover { background: $green-dark; }
.button.secondary { color: #334139; background: #fff; border-color: #d6dcd8; }
.button:disabled { cursor: not-allowed; opacity: .55; }
.button.full { width: 100%; margin-top: 22px; }
.alert { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding: 13px 15px; background: #fff; border: 1px solid $border; border-left-width: 3px; border-radius: 0; font-size: 13px; }
.alert div { display: flex; flex-direction: column; gap: 3px; }
.alert.warning { border-left-color: #b18a4d; }.alert.danger { color: #704c25; border-left-color: #a8793f; }.alert.success { color: #315a7d; border-left-color: #557b9a; }
.loading-state { padding: 70px 20px; color: $muted; text-align: center; background: #fff; border: 1px solid $border; }

.section-block { margin-bottom: 20px; padding: 22px; background: #fff; border: 1px solid $border; border-radius: 12px; box-shadow: 0 4px 16px rgba(43,75,56,.035); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.section-heading h2 { margin: 0; font-size: 17px; }
.section-heading p { margin: 5px 0 0; color: $muted; font-size: 12px; }
.task-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border: 1px solid $border; }
.task-card { position: relative; display: flex; min-height: 114px; flex-direction: column; align-items: flex-start; padding: 19px; color: #29352e; text-align: left; background: #fff; border: 0; border-right: 1px solid $border; }
.task-card:last-child { border-right: 0; }
.task-card:hover { background: #f7faf8; }
.task-card > strong { margin-top: 14px; font-size: 24px; }
.task-card > span:nth-of-type(2) { margin-top: 4px; color: $muted; font-size: 12px; }
.task-card svg { position: absolute; top: 50%; right: 14px; color: #a5aea8; font-size: 10px; }
.task-dot { width: 7px; height: 7px; background: #8b919a; }.task-dot.warning { background: #b18a4d; }.task-dot.danger { background: #80633f; }.task-dot.info { background: #557b9a; }
.dashboard-two-columns { display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(260px, .7fr); gap: 20px; }
.dashboard-two-columns.bottom-grid { grid-template-columns: 1fr 1fr; }
.business-layout { display: grid; grid-template-columns: 190px 1fr; min-height: 270px; }
.business-summary { padding-right: 24px; border-right: 1px solid $border; }
.business-summary > div { display: flex; flex-direction: column; padding: 15px 0 22px; border-bottom: 1px solid $border; }
.business-summary span, .metric-grid article > span { color: $muted; font-size: 12px; }
.business-summary strong { margin-top: 8px; font-size: 21px; }
.business-summary small, .metric-grid small { margin-top: 7px; font-size: 11px; }.positive { color: #315a7d !important; }.negative { color: #8a6437 !important; }
.chart-wrap { position: relative; min-width: 0; height: 270px; padding: 15px 12px 38px 28px; overflow: hidden; }
.chart-wrap.large { height: 390px; max-width: 1100px; margin: 0 auto; padding-top: 45px; }
.chart-grid { position: absolute; inset: 18px 12px 48px 28px; display: flex; flex-direction: column; justify-content: space-between; }
.chart-grid i { width: 100%; border-top: 1px dashed #dfe4e1; }
.bar-chart { position: absolute; inset: 35px 12px 48px 28px; display: flex; align-items: flex-end; justify-content: space-around; }
.chart-column { position: relative; display: flex; width: 11%; height: 100%; align-items: center; justify-content: flex-end; flex-direction: column; }
.chart-column .bar { width: 48%; min-width: 18px; max-width: 44px; background: #9aa7b5; border: 1px solid #7d8b9a; }
.chart-column:hover .bar { background: $green; }
.chart-column small { position: absolute; top: calc(100% + 11px); color: $muted; font-size: 10px; }
.chart-value { position: absolute; bottom: calc(var(--bar-height, 0%) + 4px); color: #617068; font-size: 9px; }
.order-line { position: absolute; inset: 20px 12px 42px 28px; width: calc(100% - 40px); height: calc(100% - 62px); pointer-events: none; }
.chart-legend { position: absolute; right: 12px; bottom: 2px; display: flex; gap: 15px; color: $muted; font-size: 10px; }
.chart-legend span { display: flex; align-items: center; gap: 5px; }.chart-legend i { width: 15px; height: 4px; }.chart-legend .revenue { background: #8c9aaa; }.chart-legend .orders { background: #b18a4d; }
.rating-card { display: flex; flex-direction: column; align-items: center; text-align: center; }
.rating-card .section-heading { width: 100%; text-align: left; }
.rating-number { margin-top: 20px; font-size: 45px; }.rating-number small { color: #7b857f; font-size: 20px; }
.stars, .review-stars { color: #f6b700; letter-spacing: 2px; }.rating-card > span { margin-top: 7px; color: $muted; font-size: 12px; }
.operations-table { border: 1px solid $border; }
.operations-head, .operations-row { display: grid; grid-template-columns: 1fr 190px 190px; align-items: center; }
.operations-head { min-height: 45px; color: #59645e; background: #f7f9f8; border-bottom: 1px solid $border; font-size: 11px; font-weight: 700; }
.operations-head span, .operations-row > * { padding: 0 16px; }
.operations-row { min-height: 82px; border-bottom: 1px solid $border; }.operations-row:last-child { border-bottom: 0; }
.operations-row > div { display: flex; flex-direction: column; }.operations-row div strong { font-size: 13px; }.operations-row div small { margin-top: 4px; color: $muted; font-size: 11px; }.operations-row div em { margin-top: 3px; color: #7e8982; font-size: 10px; font-style: normal; }
.operations-row > strong { font-size: 18px; }.good { color: #315a7d; }.bad { color: #8a6437; }
.status-good, .status-bad { justify-self: start; padding: 5px 9px !important; border: 1px solid; border-radius: 2px; font-size: 10px; font-weight: 700; }.status-good { color: #315a7d; background: #f1f5f8; border-color: #b8c9d6; }.status-bad { color: #76552e; background: #faf6ef; border-color: #d9c29d; }
.compact-list { border: 1px solid $border; }.compact-list > button { display: grid; width: 100%; grid-template-columns: 38px 1fr auto; gap: 12px; align-items: center; padding: 12px; text-align: left; background: #fff; border: 0; border-bottom: 1px solid $border; }.compact-list > button:last-child { border-bottom: 0; }.compact-list > button:hover { background: #f8faf9; }.compact-list button > span:not(.list-icon) { display: flex; min-width: 0; flex-direction: column; }.compact-list strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.compact-list small { margin-top: 3px; color: $muted; font-size: 10px; }.list-icon { display: grid; width: 36px; height: 36px; place-items: center; color: #98630c; background: #fff4df; border-radius: 2px; }.list-icon.danger { color: #c52d2d; background: #fff0ee; }.stock-quantity { min-width: 34px !important; color: #c52d2d; font-size: 18px; font-weight: 700; text-align: right; }

.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }.metric-grid article { display: flex; min-height: 126px; flex-direction: column; padding: 20px; background: #fff; border: 1px solid $border; border-top: 3px solid $green; }.metric-grid article > strong { margin-top: 11px; font-size: 24px; }.metric-grid article > small { margin-top: auto; }
.analytics-chart { padding-bottom: 30px; }
.filter-bar {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 220px auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
.filter-bar.order-filter {
  grid-template-columns: minmax(280px, 1fr) 190px 190px auto;
}
.search-control,
.search-select-wrap {
  position: relative;
  min-width: 0;
  height: 40px;
}
.search-control {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px 0 12px;
  color: #73827a;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(34, 93, 57, .08);
  transition: box-shadow .16s ease, border-color .16s ease;
}
.search-control:focus-within,
.search-select-wrap:focus-within {
  border-color: rgba(57, 181, 74, .42);
  box-shadow: 0 0 0 3px rgba(57, 181, 74, .08), 0 4px 12px rgba(34, 93, 57, .08);
}
.search-control__icon {
  flex: 0 0 auto;
  color: #748079;
  font-size: 13px;
}
.search-control input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0;
  color: #26342c;
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  font-size: 13px;
}
.search-control input::placeholder { color: #98a29b; }
.search-control input::-webkit-search-cancel-button { display: none; }
.search-control__clear {
  display: grid;
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
  padding: 0;
  place-items: center;
  color: #7d8981;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.search-control__clear:hover {
  color: #2f3a33;
  background: #f0f4f1;
}
.search-select-wrap {
  background: #fff;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(34, 93, 57, .08);
  transition: box-shadow .16s ease, border-color .16s ease;
}
.search-select {
  width: 100%;
  height: 40px;
  padding: 0 34px 0 13px;
  appearance: none;
  color: #354039;
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.search-select-wrap__arrow {
  position: absolute;
  top: 50%;
  right: 13px;
  color: #7b877f;
  font-size: 10px;
  pointer-events: none;
  transform: translateY(-50%);
}
.search-submit {
  display: inline-flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  color: #fff;
  background: #39b54a;
  border: 0;
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(34, 93, 57, .12);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .16s ease, transform .16s ease, box-shadow .16s ease;
}
.search-submit:hover {
  background: #33a744;
  box-shadow: 0 5px 14px rgba(34, 93, 57, .16);
  transform: translateY(-1px);
}
.search-submit:active { transform: translateY(0); }
.shop-profile-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 30px;
  align-items: start;
}
.shop-avatar-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}
.shop-avatar-preview {
  position: relative;
  width: 124px;
  height: 124px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #dfe5e0;
  border-radius: 50%;
  background: #f4f6f4;
  color: #647067;
  font-size: 36px;
  font-weight: 700;
}
.shop-avatar-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.shop-avatar-preview > span { display: grid; width: 100%; height: 100%; place-items: center; }
.shop-avatar-preview i {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #39b54a;
  color: #fff;
  font-size: 12px;
  font-style: normal;
}
.avatar-file-input { display: none; }
.avatar-change-button {
  min-height: 34px;
  padding: 6px 16px;
  border: 1px solid #ced7d0;
  border-radius: 7px;
  background: #fff;
  color: #344039;
  font-weight: 600;
}
.avatar-change-button:hover:not(:disabled) { border-color: #39b54a; color: #278d38; }
.shop-avatar-editor small { max-width: 160px; color: #7b837d; font-size: 11px; line-height: 1.45; text-align: center; }

.profile-form input, .profile-form textarea, .modal-grid input, .modal-grid select, .modal-grid textarea { width: 100%; min-height: 40px; padding: 9px 11px; color: #26312a; background: #fff; border: 1px solid #cfd6d2; border-radius: 2px; outline: 0; }.profile-form input:focus, .profile-form textarea:focus, .modal-grid input:focus, .modal-grid select:focus, .modal-grid textarea:focus { border-color: $green; box-shadow: 0 0 0 2px rgba(57, 181, 74, .12); }
.sort-button { display: inline-flex; align-items: center; gap: 7px; padding: 0; color: inherit; background: transparent; border: 0; font-weight: 700; white-space: nowrap; }
.sort-button:hover { color: #111827; }
.sort-button span { min-width: 11px; color: #9a7b45; text-align: center; }
.id-cell { color: #4b5563; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.table-scroll { overflow-x: auto; border: 1px solid $border; }.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }.data-table th { padding: 12px 14px; color: #57625c; text-align: left; white-space: nowrap; background: #f6f8f7; border-bottom: 1px solid $border; }.data-table td { padding: 13px 14px; vertical-align: middle; border-bottom: 1px solid #edf0ee; }.data-table tbody tr:last-child td { border-bottom: 0; }.data-table td > strong, .data-table td > small { display: block; }.data-table td > small { margin-top: 4px; color: $muted; font-size: 10px; }.product-cell { display: flex; min-width: 250px; align-items: center; gap: 11px; }.product-cell > span { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; overflow: hidden; color: #8c978f; background: #f2f5f3; border: 1px solid $border; }.product-cell img { width: 100%; height: 100%; object-fit: cover; }.product-cell div { display: flex; min-width: 0; flex-direction: column; }.product-cell strong { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.product-cell small { margin-top: 3px; color: $muted; }.old-price { color: #89928c; text-decoration: line-through; }.stock-low { color: #d22d2d; }.table-status { display: inline-flex; padding: 4px 7px; white-space: nowrap; background: #f2f4f3; border: 1px solid #d8ddda; border-radius: 2px; font-size: 10px; font-weight: 650; }.product-active, .order-completed, .order-delivered, .payment-paid, .review-published { color: #207d33; background: #f0faf2; border-color: #b8dfc0; }.product-out_of_stock, .order-cancelled, .payment-failed, .payment-refunded { color: #bf2929; background: #fff3f2; border-color: #efb8b4; }.order-pending, .payment-pending, .product-draft, .review-pending { color: #9a650d; background: #fff8e9; border-color: #ead19f; }.row-actions { display: flex; gap: 6px; }.row-actions button { width: 32px; height: 32px; color: #526058; background: #fff; border: 1px solid $border; border-radius: 2px; }.row-actions button.delete { color: #c52d2d; }.empty-cell { padding: 40px !important; color: $muted; text-align: center; }.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; color: $muted; font-size: 11px; }.pagination button { min-height: 34px; padding: 0 12px; background: #fff; border: 1px solid $border; border-radius: 2px; }.pagination button:disabled { opacity: .45; }
.order-product-cell { width: 240px; max-width: 240px; }
.order-product-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plain-status { padding: 0; background: transparent !important; border: 0 !important; border-radius: 0; font-size: 12px; }
.date-cell { white-space: nowrap; }
.review-summary-inline { display: flex; flex-direction: column; align-items: flex-end; }.review-summary-inline strong { font-size: 20px; }.review-summary-inline span { color: $muted; font-size: 10px; }.review-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }.review-list article { padding: 16px; border: 1px solid $border; }.review-head { display: flex; justify-content: space-between; gap: 12px; }.review-head > div { display: flex; flex-direction: column; }.review-head strong { font-size: 12px; }.review-head .review-stars { margin-top: 5px; font-size: 12px; }.review-list h3 { margin: 15px 0 5px; font-size: 14px; }.review-list p { margin: 0; color: #536058; font-size: 12px; line-height: 1.6; }.review-list time { display: block; margin-top: 12px; color: #89928c; font-size: 10px; }
.profile-form { display: grid; max-width: 900px; grid-template-columns: 1fr 1fr; gap: 18px; }.profile-form label, .modal-grid label { display: flex; flex-direction: column; gap: 7px; }.profile-form label > span, .modal-grid label > span { font-size: 12px; font-weight: 650; }.full-field { grid-column: 1 / -1; }.profile-form label > small { align-self: flex-end; color: $muted; font-size: 10px; }.form-actions { grid-column: 1 / -1; padding-top: 10px; border-top: 1px solid $border; }.settings-list { max-width: 780px; border: 1px solid $border; }.settings-list > div { display: grid; grid-template-columns: 220px 1fr; padding: 15px; border-bottom: 1px solid $border; }.settings-list > div:last-child { border-bottom: 0; }.settings-list span { color: $muted; font-size: 12px; }.settings-list strong { font-size: 12px; }

@media (max-width: 1250px) { .task-grid { grid-template-columns: repeat(3, 1fr); }.task-card:nth-child(3) { border-right: 0; }.task-card:nth-child(-n + 3) { border-bottom: 1px solid $border; }.dashboard-two-columns { grid-template-columns: 1fr; }.rating-card { align-items: flex-start; text-align: left; }.rating-card .button { width: auto; }.metric-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 991.98px) { .seller-shell { display: block; }.seller-topbar { position: relative; padding: 0 16px; }.seller-content { width: 100%; margin-left: 0; padding: 20px 16px 40px; }.topbar-shop { display: none; }.topbar-actions { width: 100%; justify-content: flex-end; }.notification-drawer { position: fixed; top: 64px; right: 12px; left: 12px; width: auto; }.business-layout { grid-template-columns: 1fr; }.business-summary { display: grid; grid-template-columns: 1fr 1fr; padding-right: 0; border-right: 0; border-bottom: 1px solid $border; }.business-summary > div { padding: 10px 15px; }.filter-bar, .filter-bar.order-filter { grid-template-columns: 1fr 1fr; }.task-grid { grid-template-columns: repeat(2, 1fr); }.task-card { border-bottom: 1px solid $border; }.task-card:nth-child(2n) { border-right: 0; }.operations-head, .operations-row { grid-template-columns: 1fr 135px 135px; } }
@media (max-width: 640px) { .seller-topbar { height: 58px; gap: 7px; padding-inline: 9px; }.topbar-actions { gap: 6px; }.topbar-link { width: 38px; padding: 0; }.topbar-link span, .account-button strong { display: none; }.account-button { width: 40px; padding: 0; justify-content: center; }.account-button svg { display: none; }.page-header { align-items: flex-start; flex-direction: column; gap: 14px; }.page-actions { width: 100%; }.page-actions .button { flex: 1; }.task-grid, .metric-grid, .review-list, .profile-form, .modal-grid, .dashboard-two-columns.bottom-grid { grid-template-columns: 1fr; }.task-card { border-right: 0; }.filter-bar, .filter-bar.order-filter { grid-template-columns: 1fr; }.operations-table { overflow-x: auto; }.operations-head, .operations-row { min-width: 650px; }.business-summary { grid-template-columns: 1fr; }.section-block { padding: 16px; }.seller-content { padding-inline: 10px; }.full-field { grid-column: auto; } }

.drawer-head button,
.section-heading > button { color: $green-dark; }
.alert.warning { border-left-color: #b18a4d; }
.alert.danger { color: #704c25; border-left-color: #a8793f; }
.alert.success { color: #315a7d; border-left-color: #557b9a; }
.task-card:hover,
.compact-list > button:hover { background: #f4f5f7; }
.task-dot.warning { background: #b18a4d; }
.task-dot.danger { background: #80633f; }
.task-dot.info { background: #557b9a; }
.positive { color: #315a7d !important; }
.negative { color: #8a6437 !important; }
.chart-column .bar { background: #9aa7b5; border-color: #7d8b9a; }
.chart-column:hover .bar { background: #303640; }
.chart-legend .revenue { background: #8c9aaa; }
.chart-legend .orders { background: #b18a4d; }
.good { color: #315a7d; }
.bad { color: #8a6437; }
.status-good { color: #315a7d; background: #f1f5f8; border-color: #b8c9d6; }
.status-bad { color: #76552e; background: #faf6ef; border-color: #d9c29d; }
.list-icon { color: #71572f; background: #f6f1e8; }
.list-icon.danger,
.stock-quantity,
.stock-low,
.row-actions button.delete { color: #76552e; }
.list-icon.danger { background: #f4efe8; }
.metric-grid article { border-top-color: #303640; }
.profile-form input:focus,
.profile-form textarea:focus,
.modal-grid input:focus,
.modal-grid select:focus,
.modal-grid textarea:focus { border-color: #525a66; box-shadow: 0 0 0 2px rgba(31, 41, 55, .12); }
.product-active,
.order-completed,
.order-delivered,
.payment-paid,
.review-published { color: #315a7d; background: #f1f5f8; border-color: #b8c9d6; }
.product-out_of_stock,
.order-cancelled,
.payment-failed,
.payment-refunded { color: #76552e; background: #faf6ef; border-color: #d9c29d; }

@media (max-width: 991.98px) {
  .seller-topbar { position: sticky; }
  .topbar-actions { width: auto; }
}

@media (max-width: 760px) {
  .shop-profile-layout { grid-template-columns: 1fr; gap: 18px; }
  .shop-avatar-editor { align-items: flex-start; }
  .shop-avatar-editor small { text-align: left; }
}

</style>
