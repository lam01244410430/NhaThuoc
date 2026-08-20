<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowLeft,
  faBars,
  faBell,
  faChevronDown,
  faHouse,
  faMagnifyingGlass,
  faStore,
  faUser,
} from '@fortawesome/free-solid-svg-icons'

withDefaults(defineProps<{
  title: string
  eyebrow?: string
  subtitle?: string
  shopName?: string
  approvalLabel?: string
  collapsed?: boolean
  userName?: string
  showBack?: boolean
  backLabel?: string
  showSearch?: boolean
  searchPlaceholder?: string
  showHome?: boolean
  showShop?: boolean
  showNotifications?: boolean
  unreadCount?: number
}>(), {
  eyebrow: 'KÊNH NGƯỜI BÁN',
  subtitle: '',
  shopName: 'Cửa hàng',
  approvalLabel: '',
  collapsed: false,
  userName: 'Chủ cửa hàng',
  showBack: false,
  backLabel: 'Quay lại',
  showSearch: false,
  searchPlaceholder: 'Tìm kiếm...',
  showHome: true,
  showShop: true,
  showNotifications: true,
  unreadCount: 0,
})

const emit = defineEmits<{
  toggleSidebar: []
  back: []
  home: []
  shop: []
  notifications: []
  account: []
}>()
</script>

<template>
  <header class="dashboard-header">
    <div class="dashboard-header__primary">
      <button
        type="button"
        class="header-icon-button"
        :aria-label="collapsed ? 'Mở menu Seller Center' : 'Thu gọn menu Seller Center'"
        :aria-expanded="!collapsed"
        @click="emit('toggleSidebar')"
      >
        <FontAwesomeIcon :icon="faBars" />
      </button>

      <button v-if="showBack" type="button" class="header-back" @click="emit('back')">
        <FontAwesomeIcon :icon="faArrowLeft" />
        <span>{{ backLabel }}</span>
      </button>

      <div class="dashboard-header__title">
        <p>{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <span v-if="subtitle">{{ subtitle }}</span>
      </div>
    </div>

    <div class="dashboard-header__actions">
      <label v-if="showSearch" class="header-search">
        <FontAwesomeIcon :icon="faMagnifyingGlass" />
        <input :placeholder="searchPlaceholder" />
      </label>

      <button v-if="showHome" type="button" class="header-action" @click="emit('home')">
        <FontAwesomeIcon :icon="faHouse" />
        <span>Trang chủ</span>
      </button>

      <button v-if="showShop" type="button" class="header-action" @click="emit('shop')">
        <FontAwesomeIcon :icon="faStore" />
        <span>Gian hàng</span>
      </button>

      <div v-if="showNotifications" class="header-popover-anchor">
        <button type="button" class="header-icon-button" aria-label="Thông báo" @click="emit('notifications')">
          <FontAwesomeIcon :icon="faBell" />
          <b v-if="unreadCount" class="header-notification-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</b>
        </button>
        <slot name="notification-panel" />
      </div>

      <div class="header-popover-anchor">
        <slot name="account-trigger">
          <button type="button" class="header-account" aria-label="Mở menu tài khoản" @click="emit('account')">
            <span><FontAwesomeIcon :icon="faUser" /></span>
            <strong>{{ userName }}</strong>
            <FontAwesomeIcon class="header-account__chevron" :icon="faChevronDown" />
          </button>
        </slot>
        <slot name="account-panel" />
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.dashboard-header {
  position: sticky;
  top: 0;
  z-index: 35;
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px 12px calc(var(--sidebar-layout-width, 0px) + 24px);
  color: #fff;
  background: linear-gradient(120deg, #32c779 0%, #39b54a 60%, #2fac66 100%);
  box-shadow: 0 8px 24px rgba(30, 117, 67, .12);
  font-family: 'Segoe UI', Tahoma, sans-serif;
  transition: padding-left .18s ease;
}

.dashboard-header__primary,
.dashboard-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dashboard-header__title { min-width: 0; margin-left: 4px; }
.dashboard-header__title p { margin: 0 0 2px; font-size: 10px; font-weight: 800; letter-spacing: .13em; opacity: .82; }
.dashboard-header__title h1 { margin: 0; max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 20px; line-height: 1.25; font-weight: 700; }
.dashboard-header__title span { display: block; margin-top: 2px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; opacity: .86; }

.header-icon-button,
.header-action,
.header-back,
.header-account {
  min-height: 40px;
  border: 1px solid rgba(255,255,255,.28);
  background: rgba(255,255,255,.13);
  color: #fff;
  border-radius: 9px;
  font: inherit;
}

.header-icon-button,
.header-action,
.header-back { cursor: pointer; }
.header-icon-button:hover,
.header-action:hover,
.header-back:hover { background: rgba(255,255,255,.22); }
.header-icon-button { position: relative; width: 40px; display: inline-grid; place-items: center; }
.header-action,
.header-back { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 12px; font-size: 12px; font-weight: 700; }
.header-back { padding-inline: 11px 13px; }

.header-search {
  width: min(260px, 24vw);
  height: 40px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  color: #73827a;
  background: #fff;
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(34, 93, 57, .08);
}
.header-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: #26342c; background: transparent; font: inherit; font-size: 13px; }
.header-search input::placeholder { color: #9ba8a1; }

.header-notification-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  border: 2px solid #39b54a;
  border-radius: 999px;
  background: #e24949;
  color: #fff;
  font-size: 9px;
  line-height: 1;
}

.header-popover-anchor { position: relative; }
.header-account { display: flex; align-items: center; gap: 8px; padding: 0 10px 0 7px; cursor: pointer; }
.header-account > span { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; background: #fff; color: #39b54a; }
.header-account strong { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.header-account__chevron { margin-left: 1px; font-size: 10px; opacity: .82; }

@media (max-width: 1050px) {
  .header-search { display: none; }
  .header-action span { display: none; }
  .header-action { width: 40px; padding: 0; }
}

@media (max-width: 720px) {
  .dashboard-header { min-height: 64px; padding: 9px 10px; gap: 8px; }
  .dashboard-header__title p, .dashboard-header__title span { display: none; }
  .dashboard-header__title h1 { max-width: 42vw; font-size: 16px; }
  .header-account strong { display: none; }
  .header-account { width: 40px; padding: 0; justify-content: center; }
  .header-back span { display: none; }
  .header-back { width: 40px; padding: 0; }
}
</style>

@media (max-width: 991.98px) {
  .dashboard-header { padding-left: 12px; }
}
