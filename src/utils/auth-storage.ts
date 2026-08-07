import type { LoginData, PublicUser } from '@/services/auth.service'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

const clearStorage = (storage: Storage): void => {
  storage.removeItem(TOKEN_KEY)
  storage.removeItem(USER_KEY)
}

export const saveAuthSession = (
  data: Pick<LoginData, 'token' | 'user'>,
  remember: boolean,
): void => {
  const target = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage

  clearStorage(other)
  target.setItem(TOKEN_KEY, data.token)
  target.setItem(USER_KEY, JSON.stringify(data.user))
}

export const saveOAuthSession = (
  token: string,
  user: PublicUser,
): void => {
  saveAuthSession({ token, user }, true)
}

export const getAuthToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)

export const getStoredUser = (): PublicUser | null => {
  const raw =
    localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw) as PublicUser
  } catch {
    clearAuthSession()
    return null
  }
}

export const clearAuthSession = (): void => {
  clearStorage(localStorage)
  clearStorage(sessionStorage)
}