import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'shop-sidebar-collapsed'

const getInitialCollapsed = () => {
  if (typeof window === 'undefined') return false
  if (window.innerWidth < 992) return true
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

export const useDashboardUiStore = defineStore('dashboard-ui', () => {
  const sidebarCollapsed = ref(getInitialCollapsed())

  const setSidebarCollapsed = (value: boolean) => {
    sidebarCollapsed.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    }
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed.value)
  }

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
  }
})
