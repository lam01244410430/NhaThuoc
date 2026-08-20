import apiClient from './api'

export type ProductStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'out_of_stock'

export type ShopOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'completed'

export type ShopPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export type ProductSortField =
  | 'id'
  | 'name'
  | 'category'
  | 'price'
  | 'stock'
  | 'status'
  | 'updated_at'

export type OrderSortField =
  | 'id'
  | 'order_code'
  | 'customer'
  | 'items'
  | 'shop_total'
  | 'payment_status'
  | 'order_status'
  | 'order_date'

export type SortDirection = 'asc' | 'desc'

export interface ShopProfile {
  id: number
  owner_name: string
  owner_email: string
  avatar: string | null
  shop_name: string
  phone: string
  description: string | null
  rating: number
  rating_count: number
  followers: number
  total_products: number
  level: 'basic' | 'verified' | 'premium'
  approval_status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'suspended'
  approved_by: number | null
  approved_at: string | null
  created_at: string
  updated_at: string
}


export interface UploadedShopAvatar {
  key: string
  avatar: string
}

export interface ShopProduct {
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
}

export interface ShopOrder {
  id: number
  order_code: string
  customer_id: number
  order_date: string
  recipient_name: string
  recipient_phone: string
  shipping_address: string
  note: string | null
  payment_method:
    | 'COD'
    | 'VNPay'
    | 'Momo'
    | 'BankTransfer'
  payment_status: ShopPaymentStatus
  order_status: ShopOrderStatus
  item_count: number
  total_quantity: number
  shop_total: number
  created_at: string
  updated_at: string
}

export interface DashboardDailyMetric {
  day: string
  revenue: number
  orders: number
}

export interface SellerNotification {
  id: string
  type: 'order' | 'inventory'
  title: string
  description: string
  created_at: string
  section: 'orders' | 'inventory'
}

export interface ShopReviewSummaryItem {
  id: number
  rating: number
  title: string
  comment: string
  status: 'pending' | 'published' | 'hidden'
  created_at: string
  product_name: string
}

export interface ShopDashboardSummary {
  period_days: number
  sales: {
    current_revenue: number
    previous_revenue: number
    current_orders: number
    previous_orders: number
    daily: DashboardDailyMetric[]
  }
  tasks: {
    pending_orders: number
    processing_orders: number
    draft_products: number
    low_stock_products: number
    out_of_stock_products: number
    pending_reviews: number
  }
  operations: {
    cancellation_rate: number
    completion_rate: number
    return_rate: number
    average_rating: number
    rating_count: number
  }
  notifications: SellerNotification[]
  reviews: ShopReviewSummaryItem[]
}

export interface CategoryOption {
  id: number
  name: string
  slug?: string
}

export interface CreateVariantOptionPayload {
  group_name: string
  value_name: string
}

export interface CreateProductVariantPayload {
  id?: number
  sku: string
  price: number
  sale_price: number | null
  status: 'active' | 'inactive' | 'out_of_stock'
  options: CreateVariantOptionPayload[]
}

export interface CreateProductMediaPayload {
  url: string
  type: 'image' | 'video'
  purpose: 'gallery' | 'description'
}

export interface UploadedProductMedia {
  key: string
  url: string
  type: 'image' | 'video'
  size: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ProductPagination = Pagination

export interface ProductPayload {
  category_id: number
  name: string
  slug: string
  price: number
  sale_price: number | null
  description: string | null
  usage_guide: string | null
  status: ProductStatus
  thumbnail_url: string | null
  variants?: CreateProductVariantPayload[]
  media?: CreateProductMediaPayload[]
}

export type CreateProductPayload = ProductPayload

export interface ManagedProductMedia {
  id: number
  url: string
  type: 'image' | 'video'
  is_thumbnail: boolean
  priority: number
  purpose: 'gallery' | 'description'
}

export interface ManagedProductVariant {
  id: number
  sku: string
  price: number
  sale_price: number | null
  status: 'active' | 'inactive' | 'out_of_stock'
  stock_quantity: number
  options: CreateVariantOptionPayload[]
}

export interface ManagedProductDetail extends ShopProduct {
  media: ManagedProductMedia[]
  variants: ManagedProductVariant[]
}

interface ProductListResponse {
  success: boolean
  data: ShopProduct[]
  pagination: Pagination
}

interface OrderListResponse {
  success: boolean
  data: ShopOrder[]
  pagination: Pagination
}

interface ShopResponse {
  success: boolean
  data: ShopProfile
}

interface DashboardResponse {
  success: boolean
  data: ShopDashboardSummary
}

interface CategoryResponse {
  success: boolean
  data: Array<{
    id?: number
    category_id?: number
    name?: string
    category_name?: string
    slug?: string
  }>
}

const resolveShopAvatar = (avatar: string | null): string | null => {
  if (!avatar) return null

  if (
    avatar.startsWith('http://') ||
    avatar.startsWith('https://') ||
    avatar.startsWith('blob:') ||
    avatar.startsWith('data:')
  ) {
    return avatar
  }

  const baseURL = String(apiClient.defaults.baseURL ?? '').replace(/\/+$/, '')

  if (avatar.startsWith('/shop/avatar/')) {
    return `${baseURL}${avatar}`
  }

  const normalizedKey = avatar.replace(/^\/+/, '')
  const legacyMatch = normalizedKey.match(/^shops\/avatars\/(\d+)\/([^/]+)$/)

  if (legacyMatch) {
    return `${baseURL}/shop/avatar/${legacyMatch[1]}/${legacyMatch[2]}`
  }

  return `${baseURL}/shop/avatar/${normalizedKey}`
}

const getShop =
  async (): Promise<ShopProfile> => {
    const response =
      await apiClient.get<ShopResponse>(
        '/shop/me',
      )

    const shop = response.data.data

    return {
      ...shop,
      avatar: resolveShopAvatar(shop.avatar)
    }
  }

const getDashboardSummary = async (
  days = 7,
): Promise<ShopDashboardSummary> => {
  const response = await apiClient.get<DashboardResponse>(
    '/shop/me/dashboard',
    { params: { days } },
  )

  return response.data.data
}

const getProducts = async (
  params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    sort_by?: ProductSortField
    sort_order?: SortDirection
  },
) => {
  const response =
    await apiClient.get<ProductListResponse>(
      '/product/manage/me',
      {
        params,
      },
    )

  return {
    products: response.data.data,
    pagination: response.data.pagination
  }
}

const getOrders = async (
  params: {
    page?: number
    limit?: number
    search?: string
    order_status?: string
    payment_status?: string
    sort_by?: OrderSortField
    sort_order?: SortDirection
  },
) => {
  const response =
    await apiClient.get<OrderListResponse>(
      '/orders/shop/me',
      {
        params,
      },
    )

  return {
    orders:
      response.data.data,
    pagination:
      response.data.pagination,
  }
}

const getCategories =
  async (): Promise<CategoryOption[]> => {
    const response =
      await apiClient.get<CategoryResponse>(
        '/category',
      )

    return response.data.data.map(
      (category) => ({
        id:
          category.id ??
          category.category_id ??
          0,
        name:
          category.name ??
          category.category_name ??
          'Danh mục',
        slug: category.slug,
      }),
    )
  }

const getManagedProduct = async (
  id: number,
): Promise<ManagedProductDetail> => {
  const response =
    await apiClient.get<{
      success: boolean
      data: ManagedProductDetail
    }>(`/product/manage/${id}`)

  return response.data.data
}

const createProduct = async (
  payload: CreateProductPayload,
): Promise<ShopProduct> => {
  const response =
    await apiClient.post(
      '/product',
      payload,
    )

  return response.data.data
}

const uploadProductMedia = async (
  file: File,
): Promise<UploadedProductMedia> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<{
    success: boolean
    data: UploadedProductMedia
  }>('/product/manage/media', formData)

  return response.data.data
}

const deleteUploadedProductMedia = async (key: string): Promise<void> => {
  await apiClient.delete('/product/manage/media', { params: { key } })
}

const updateProduct = async (
  id: number,
  payload: ProductPayload,
): Promise<ShopProduct> => {
  const response =
    await apiClient.put(
      `/product/${id}`,
      payload,
    )

  return response.data.data
}

const deleteProduct = async (
  id: number,
): Promise<void> => {
  await apiClient.delete(
    `/product/${id}`,
  )
}


const uploadShopAvatar = async (file: File): Promise<UploadedShopAvatar> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<{ success: true; data: UploadedShopAvatar }>(
    '/shop/me/avatar',
    formData,
    {
      headers: {
        'Content-Type': undefined,
      },
    },
  )

  const uploaded = response.data.data
  return {
    ...uploaded,
    avatar: resolveShopAvatar(uploaded.avatar) ?? uploaded.avatar
  }
}

const updateShop = async (
  payload: {
    shop_name: string
    phone: string
    description: string | null
  },
): Promise<ShopProfile> => {
  const response =
    await apiClient.put<ShopResponse>(
      '/shop/me',
      payload,
    )

  return response.data.data
}

export const shopDashboardService = {
  getShop,
  getDashboardSummary,
  getProducts,
  getOrders,
  getCategories,
  getManagedProduct,
  uploadProductMedia,
  deleteUploadedProductMedia,
  createProduct,
  updateProduct,
  deleteProduct,
  updateShop,
  uploadShopAvatar,
}
