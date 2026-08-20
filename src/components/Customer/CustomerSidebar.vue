<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faBell,
  faChevronDown,
  faChevronUp,
  faClipboardList,
  faPen,
  faUser,
  faUserCircle,
} from '@fortawesome/free-solid-svg-icons'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const accountExpanded = ref(false)
const username = computed(() => {
    return (
      authStore.user?.username ||
      authStore.user?.name ||
      'Khách hàng'
    )
})

const avatarUrl = computed(() => {
    return authStore.user?.avatar ?? ''
  })

const isAccountRoute = computed(() => {
    return route.path.startsWith(
      '/user/account',
    )
  })

const toggleAccount = () => {
   accountExpanded.value = !accountExpanded.value
}

watch( () => route.path,
  (path) => {
    accountExpanded.value =
      path.startsWith(
        '/user/account',
      )
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <aside class="customer-sidebar">
    <div class="sidebar-user">
      <div class="user-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="username">
        <FontAwesomeIcon v-else :icon="faUserCircle"/>
      </div>

      <div class="user-info">
        <strong> {{ username }} </strong>

        <RouterLink to="/user/account/profile" class="edit-link" >
          <FontAwesomeIcon :icon="faPen"/>
          <span>
            Sửa hồ sơ
          </span>
        </RouterLink>
      </div>
    </div>

    <div class="sidebar-divider" />

    <nav class="sidebar-menu">
      <RouterLink to="/user/notifications" class="sidebar-item" active-class="active" >
        <span class="item-icon notification-icon">
          <FontAwesomeIcon :icon="faBell"/>
        </span>
        <span>
          Thông Báo
        </span>
      </RouterLink>

      <div class="sidebar-group">
        <button
          type="button"
          class="sidebar-item sidebar-item-button"
          :class="{
            active: isAccountRoute,
          }"
          @click="toggleAccount"
        >
          <span class="item-icon account-icon">
            <FontAwesomeIcon :icon="faUser"/>
          </span>

          <span class="item-label">
            Tài Khoản Của Tôi
          </span>

          <FontAwesomeIcon
            :icon="
              accountExpanded
                ? faChevronUp
                : faChevronDown
            "
            class="chevron"
          />
        </button>

        <div v-if="accountExpanded" class="submenu">
          <RouterLink
            to="/user/account/profile"
            class="submenu-item"
            active-class="active"
          >
            Hồ Sơ
          </RouterLink>

          <RouterLink
            to="/user/account/address"
            class="submenu-item"
            active-class="active"
          >
            Địa Chỉ
          </RouterLink>

          <RouterLink
            to="/user/account/password"
            class="submenu-item"
            active-class="active"
          >
            Đổi Mật Khẩu
          </RouterLink>
        </div>
      </div>

      <RouterLink
        to="/user/orders"
        class="sidebar-item"
        active-class="active"
      >
        <span class="item-icon order-icon">
          <FontAwesomeIcon :icon="faClipboardList"/>
        </span>
        <span>
          Đơn Mua
        </span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.customer-sidebar {
  width: 230px;
  flex-shrink: 0;
  font-family:
    Inter,
    Arial,
    sans-serif;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 6px 20px;
}

.user-avatar {
  display: flex;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #ffffff;
  color: #c5c9ce;
  font-size: 48px;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  min-width: 0;
}

.user-info strong {
  display: block;
  overflow: hidden;
  margin-bottom: 6px;
  color: #222222;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #888888;
  font-size: 13px;
  text-decoration: none;
}

.edit-link:hover {
  color: #39b54a;
}

.sidebar-divider {
  height: 1px;
  margin-bottom: 18px;
  background: #e8e8e8;
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 12px;
  padding: 8px 6px;
  border: 0;
  background: transparent;
  color: #333333;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.sidebar-item:hover,
.sidebar-item.active {
  color: #39b54a;
}

.sidebar-item-button {
  appearance: none;
}

.item-icon {
  display: flex;
  width: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  font-size: 17px;
}

.notification-icon {
  color: #ef4444;
}

.account-icon {
  color: #2563eb;
}

.order-icon {
  color: #2563eb;
}

.item-label {
  flex: 1;
}

.chevron {
  margin-left: auto;
  color: #999999;
  font-size: 11px;
}

.submenu {
  display: flex;
  flex-direction: column;
  padding: 0 0 6px 40px;
}

.submenu-item {
  padding: 7px 6px;
  color: #555555;
  font-size: 13.5px;
  text-decoration: none;
}

.submenu-item:hover,
.submenu-item.active {
  color: #39b54a;
}
</style>