export type UserRole = 'customer' | 'shop' | 'admin'
export type UserStatus = 'pending' | 'active' | 'blocked' | 'deleted'

export interface PublicUser {
  id: number
  username: string | null
  name: string
  email: string
  role: UserRole
  status: UserStatus
  avatar: string | null
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface LoginPayload {
  identity: string
  password: string
}

export interface RegisterPayload {
  username: string
  name: string
  email: string
  phone?: string
  password: string
}

export interface LoginData {
  token: string
  token_type: 'Bearer'
  expires_in: number
  user: PublicUser
}

export interface RegisterData {
  user: PublicUser
}

interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[] | undefined>
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[] | undefined>

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787'
).replace(/\/+$/, '')

const request = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as ApiResponse<T>)
    : null

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message || `Yêu cầu thất bại (${response.status})`,
      response.status,
      payload?.errors ?? {},
    )
  }

  return payload
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginData> {
    const response = await request<LoginData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identity: payload.identity.trim().toLowerCase(),
        password: payload.password,
      }),
    })

    if (!response.data) {
      throw new ApiError('Backend không trả về dữ liệu đăng nhập', 500)
    }

    return response.data
  },

  async register(payload: RegisterPayload): Promise<RegisterData> {
    const response = await request<RegisterData>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: payload.username.trim().toLowerCase(),
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || undefined,
        password: payload.password,
      }),
    })

    if (!response.data) {
      throw new ApiError('Backend không trả về dữ liệu đăng ký', 500)
    }

    return response.data
  },

  async me(token: string): Promise<PublicUser> {
    const response = await request<{ user: PublicUser }>('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.data?.user) {
      throw new ApiError('Không đọc được thông tin tài khoản', 500)
    }

    return response.data.user
  },

  oauthUrl(provider: 'google' | 'facebook'): string {
    return `${API_BASE_URL}/auth/${provider}`
  },
}