import apiClient from './api'

export type ShopLevel = 'basic' | 'verified' | 'premium'

export interface PublicShop {
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
  level: ShopLevel
  approval_status: 'approved'
  approved_by: number | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface PublicShopProduct {
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
  status: 'active'
  thumbnail: string | null
  shop_name: string
  category_name: string
  sold_quantity: number
  created_at: string
  updated_at: string
}

export interface ShopCategory {
  id: number
  name: string
  slug: string
  product_count: number
}

export interface ProductPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface DataResponse<T> {
  success: true
  data: T
}

interface ProductResponse extends DataResponse<PublicShopProduct[]> {
  pagination: ProductPagination
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

const getShop = async (shopId: number): Promise<PublicShop> => {
  const response = await apiClient.get<DataResponse<PublicShop>>(`/shop/${shopId}`)
  const shop = response.data.data

  return {
    ...shop,
    avatar: resolveShopAvatar(shop.avatar),
  }
}

const getOwnShop = async (): Promise<PublicShop> => {
  const response = await apiClient.get<DataResponse<PublicShop>>('/shop/me')
  const shop = response.data.data

  return {
    ...shop,
    avatar: resolveShopAvatar(shop.avatar),
  }
}

const getProducts = async (
  shopId: number,
  params: { page?: number; limit?: number } = {},
) => {
  const response = await apiClient.get<ProductResponse>(`/shop/${shopId}/products`, {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 24,
    },
  })

  return {
    products: response.data.data,
    pagination: response.data.pagination,
  }
}


export const shopService = {
  getShop,
  getOwnShop,
  getProducts,
}
