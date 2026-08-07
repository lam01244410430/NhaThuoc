import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<any>(null)

  const isLoggedIn = computed(() => !!token.value)

  async function login(identity: string, password: string) {
    const response = await apiClient.post('/auth/login', { identity, password })
    const data = response.data
    if (data.success) {
      token.value = data.data.token
      localStorage.setItem('token', data.data.token)
      user.value = data.data.user
      return data.data.user
    } else {
      throw new Error(data.message || 'Đăng nhập thất bại')
    }
  }

  async function register(formData: any) {
    const response = await apiClient.post('/auth/register', formData)
    return response.data
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const response = await apiClient.get('/auth/me')
      if (response.data.success) {
        user.value = response.data.data.user
      }
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  fetchMe()

  return { token, user, isLoggedIn, login, register, logout, fetchMe }
})