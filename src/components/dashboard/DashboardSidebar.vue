<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faAddressCard,
  faBoxOpen,
  faBoxesStacked,
  faChartColumn,
  faChartLine,
  faChartPie,
  faChevronRight,
  faClipboardList,
  faGear,
  faLayerGroup,
  faReceipt,
  faStar,
  faStore,
  faUsers,
  faWarehouse,
} from '@fortawesome/free-solid-svg-icons'
import logoUrl from '@/assets/images/logo.png'

type DashboardRole = 'shop' | 'admin'

interface DashboardMenuItem {
  key: string
  label: string
  icon: IconDefinition
  badge?: string | number
  group?: string
}

const props = withDefaults(
  defineProps<{
    variant: DashboardRole
    userName: string
    avatarUrl?: string | null
    activeItem?: string
    websiteName?: string
    menuItems?: DashboardMenuItem[]
    collapsed?: boolean
  }>(),
  {
    avatarUrl: null,
    activeItem: 'overview',
    websiteName: 'Nhà Thuốc của Lâm',
    menuItems: undefined,
    collapsed: false,
  },
)

const emit = defineEmits<{
  select: [item: DashboardMenuItem]
  logout: []
}>()

const collapsedGroups = ref(new Set<string>())

const defaultMenuItems = computed<DashboardMenuItem[]>(() => {
  if (props.variant === 'admin') {
    return [
      { key: 'overview', label: 'Tổng quan', icon: faChartPie },
      { key: 'users', label: 'Quản lý người dùng', icon: faUsers },
      { key: 'shops', label: 'Kiểm duyệt cửa hàng', icon: faStore },
      { key: 'products', label: 'Kiểm tra sản phẩm', icon: faBoxOpen },
      { key: 'categories', label: 'Quản lý danh mục', icon: faLayerGroup },
      { key: 'orders', label: 'Theo dõi đơn hàng', icon: faReceipt },
    ]
  }

  return [
    { key: 'overview', label: 'Trang chủ', icon: faChartLine, group: 'TỔNG QUAN' },
    { key: 'orders', label: 'Đơn hàng', icon: faClipboardList, group: 'VẬN HÀNH' },
    { key: 'products', label: 'Sản phẩm', icon: faBoxesStacked, group: 'VẬN HÀNH' },
    { key: 'inventory', label: 'Kho & hàng tồn', icon: faWarehouse, group: 'VẬN HÀNH' },
    { key: 'analytics', label: 'Phân tích kinh doanh', icon: faChartColumn, group: 'PHÁT TRIỂN' },
    { key: 'reviews', label: 'Đánh giá sản phẩm', icon: faStar, group: 'PHÁT TRIỂN' },
    { key: 'profile', label: 'Thông tin cửa hàng', icon: faAddressCard, group: 'CỬA HÀNG' },
    { key: 'settings', label: 'Cài đặt', icon: faGear, group: 'CỬA HÀNG' },
  ]
})

const visibleMenuItems = computed(() => props.menuItems ?? defaultMenuItems.value)
const menuGroups = computed(() => {
  const groups = new Map<string, DashboardMenuItem[]>()

  for (const item of visibleMenuItems.value) {
    const key = item.group ?? 'QUẢN LÝ'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return Array.from(groups, ([label, items]) => ({ label, items }))
})
const isGroupOpen = (label: string) => !collapsedGroups.value.has(label)

const toggleGroup = (label: string) => {
  const next = new Set(collapsedGroups.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  collapsedGroups.value = next
}

const selectItem = (item: DashboardMenuItem) => {
  emit('select', item)
}
</script>

<template>
  <aside
    class="dashboard-sidebar"
    :class="[
      `dashboard-sidebar--${variant}`,
      { 'dashboard-sidebar--collapsed': collapsed },
    ]"
    :aria-label="variant === 'admin' ? 'Điều hướng quản trị' : 'Điều hướng cửa hàng'"
  >
    <RouterLink to="/" class="brand-panel">
      <span class="brand-logo">
        <img :src="logoUrl" alt="" />
      </span>
      <span class="brand-copy">
        <strong>{{ websiteName }}</strong>
        <small>{{ variant === 'admin' ? 'TRUNG TÂM QUẢN TRỊ' : 'KÊNH NGƯỜI BÁN' }}</small>
      </span>
    </RouterLink>

    <nav class="menu-panel" aria-label="Chức năng dashboard">
      <section v-for="group in menuGroups" :key="group.label" class="menu-group">
        <button
          type="button"
          class="menu-title"
          :aria-expanded="isGroupOpen(group.label)"
          @click="toggleGroup(group.label)"
        >
          <span>{{ group.label }}</span>
          <FontAwesomeIcon
            :icon="faChevronRight"
            :class="{ 'menu-title-arrow--open': isGroupOpen(group.label) }"
          />
        </button>

        <div v-show="isGroupOpen(group.label)" class="menu-group-items">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="menu-item"
            :class="{ 'menu-item--active': item.key === activeItem }"
            :aria-current="item.key === activeItem ? 'page' : undefined"
            :title="collapsed ? item.label : undefined"
            @click="selectItem(item)"
          >
            <span class="menu-icon">
              <FontAwesomeIcon :icon="item.icon" />
            </span>
            <span class="menu-label">{{ item.label }}</span>
            <span v-if="item.badge !== undefined" class="menu-badge">{{ item.badge }}</span>
            <FontAwesomeIcon :icon="faChevronRight" class="menu-arrow" />
          </button>
        </div>
      </section>
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.dashboard-sidebar {
  --sidebar-primary: #39b54a;
  --sidebar-primary-soft: #eef9f1;
  --sidebar-surface: #ffffff;
  --sidebar-text: #34443b;
  --sidebar-muted: #8b9891;
  --sidebar-border: #e7ece9;

  position: fixed;
  top: 14px;
  bottom: 14px;
  left: 14px;
  z-index: 45;
  width: 248px;
  height: calc(100vh - 28px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--sidebar-surface);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(31, 56, 39, .08), 0 2px 8px rgba(31, 56, 39, .05);
  font-family: 'Segoe UI', Tahoma, sans-serif;
  transition: width .18s ease, transform .18s ease, opacity .18s ease;
}
.dashboard-sidebar--admin { --sidebar-primary: #68717d; --sidebar-primary-soft: #f1f3f5; }
.dashboard-sidebar--collapsed { width: 72px; }
.dashboard-sidebar--collapsed .brand-copy,
.dashboard-sidebar--collapsed .menu-title,
.dashboard-sidebar--collapsed .menu-label,
.dashboard-sidebar--collapsed .menu-badge,
.dashboard-sidebar--collapsed .menu-arrow { display: none; }
.dashboard-sidebar--collapsed .menu-group-items { display: block !important; }
.dashboard-sidebar--collapsed .brand-panel,
.dashboard-sidebar--collapsed .menu-item { justify-content: center; padding-inline: 10px; }
.dashboard-sidebar--collapsed .brand-logo,
.dashboard-sidebar--collapsed .menu-icon { margin-right: 0; }

.brand-panel {
  min-height: 78px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 17px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--sidebar-border);
}
.brand-panel:hover { background: #fbfdfc; color: inherit; }
.brand-logo { width: 39px; height: 39px; flex: 0 0 39px; display: grid; place-items: center; overflow: hidden; border: 1px solid #e5ece7; border-radius: 9px; background: #fff; }
.brand-logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
.brand-copy { min-width: 0; display: grid; gap: 2px; }
.brand-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #25332b; font-size: 13px; font-weight: 700; }
.brand-copy small { color: var(--sidebar-primary); font-size: 9px; font-weight: 800; letter-spacing: .1em; }

.menu-panel { flex: 1; overflow-y: auto; padding: 14px 10px 20px; scrollbar-width: thin; scrollbar-color: #dce5df transparent; }
.menu-group + .menu-group { margin-top: 10px; }
.menu-title { width: 100%; height: 27px; display: flex; align-items: center; justify-content: space-between; padding: 0 9px; border: 0; background: transparent; color: #9aa49e; cursor: pointer; font: inherit; font-size: 9px; font-weight: 800; letter-spacing: .09em; }
.menu-title svg { font-size: 9px; transition: transform .16s ease; }
.menu-title-arrow--open { transform: rotate(90deg); }
.menu-group-items { display: grid; gap: 4px; }
.menu-item {
  position: relative;
  width: 100%;
  min-height: 43px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #627169;
  cursor: pointer;
  text-align: left;
  font: inherit;
  font-size: 13px;
  transition: background .15s ease, color .15s ease, transform .15s ease;
}
.menu-item:hover { background: #f5f8f6; color: #2f4939; }
.menu-item--active { background: var(--sidebar-primary-soft); color: #278f3b; font-weight: 700; }
.menu-item--active::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 0 4px 4px 0; background: var(--sidebar-primary); }
.menu-icon { width: 30px; height: 30px; flex: 0 0 30px; display: grid; place-items: center; border-radius: 8px; background: #f3f6f4; color: #7d8982; font-size: 13px; }
.menu-item--active .menu-icon { background: #fff; color: var(--sidebar-primary); box-shadow: 0 2px 7px rgba(57,181,74,.12); }
.menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-badge { min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; border-radius: 999px; background: #f0f3f1; color: #68746d; font-size: 10px; font-weight: 700; }
.menu-arrow { color: #b5bdb8; font-size: 9px; }

@media (max-width: 991px) {
  .dashboard-sidebar {
    top: 10px;
    bottom: 10px;
    left: 10px;
    height: calc(100vh - 20px);
    box-shadow: 0 12px 32px rgba(28,55,39,.16);
  }
  .dashboard-sidebar--collapsed {
    width: 248px;
    transform: translateX(calc(-100% - 24px));
    opacity: 0;
    pointer-events: none;
  }
}
</style>