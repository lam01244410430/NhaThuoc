import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/services/api'

type User = {
  id: number
  username: string
  name: string
  email: string
  role: 'customer' | 'admin' | 'shop'
  status: 'pending' | 'active' | 'blocked' | 'deleted'
  avatar: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  async function login(identity: string, password: string, remember: boolean = false,) {
    const response = await apiClient.post('/auth/login', { identity, password})
    const data = response.data.data

    token.value = data.token
    user.value = data.user

    localStorage.removeItem('token')
    sessionStorage.removeItem('token')

    localStorage.setItem('token', data.token)
    sessionStorage.setItem('token', data.token)

    return data.user
  }

  async function fetchMe() {
    if (!token.value){
      user.value = null
      return 
    }
      try {
        const response = await apiClient.get('/auth/me')
        const currentUser = response.data?.data?.user

        if(!currentUser) {
          throw new Error('Không đọc đuợc tài khoản')
        }

        user.value = currentUser

      } catch {
        logout()
      } 
  }

  async function register(data: {
    username: string
    name: string
    email: string
    phone?: string
    password: string
  }) {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
  }

  function oauthUrl (provider: 'google' | 'facebook') {
    const baseURL = String (
      apiClient.defaults.baseURL || ''
    ).replace(/\/+$/, '')

    return `${baseURL}/auth/${provider}`
  }

  return { token, user, isLoggedIn, login, register, fetchMe, logout, oauthUrl}
})