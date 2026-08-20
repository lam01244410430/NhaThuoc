<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth' 
import logoUrl from '@/assets/images/logo.png'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import apiClient from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()

const searchQuery = ref('')

type HeaderCartItem = {
  id: number
  product_id: number
  variant_id: number | null
  quantity: number
  name: string
  price: number
  thumbnail: string | null
}

type HeaderCartResponse = {
  success: true
  data: {
    items: HeaderCartItem[]
    total_items: number
    total_lines: number
  }
}

const cartItems = ref<HeaderCartItem[]>([])
const cartTotal = ref(0)
const cartLoading = ref(false)
let cartLoaded = false

const formatPrice = (value: number) =>
  `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`

const loadCartPreview = async (force = false) => {
  if (!authStore.isLoggedIn || authStore.user?.role !== 'customer') {
    cartItems.value = []
    cartTotal.value = 0
    cartLoaded = true
    return
  }

  if (cartLoading.value || (cartLoaded && !force)) return
  cartLoading.value = true

  try {
    const response = await apiClient.get<HeaderCartResponse>('/cart')
    cartItems.value = response.data.data.items.slice(0, 5)
    cartTotal.value = response.data.data.total_items
    cartLoaded = true
  } catch {
    cartItems.value = []
    cartTotal.value = 0
  } finally {
    cartLoading.value = false
  }
}

const handleCartEnter = () => {
  void loadCartPreview(true)
}

const handleSearch = () => {
  if (searchQuery.value.trim() !== '') {
    console.log('Tìm kiếm: ', searchQuery.value)
  }
}

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}

const handleImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.src = 'https://via.placeholder.com/35x35/007338/ffffff?text=U'
}

const handleCartUpdated = () => {
  void loadCartPreview(true)
}

onMounted(() => {
  void loadCartPreview()
  window.addEventListener('cart:updated', handleCartUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener('cart:updated', handleCartUpdated)
})
</script>

<template>
  <header class="header-container">
    <!-- 1. TOP BAR -->
    <div class="top-bar py-1 px-3">
      <div class="container-xl d-flex justify-content-between align-items-center gap-3 fs-13">
        
        <!-- BÊN TRÁI: Hotline + Email -->
        <div class="d-flex align-items-center gap-4 top-left">
          <a href="tel:0944472195" class="top-link text-decoration-none">
            <font-awesome-icon icon="phone" class="me-1" />
            <span>Hotline: 0944.472.159</span>
          </a>
          <a href="mailto:lamvipboy777@gmail.com" class="top-link text-decoration-none">
            <font-awesome-icon icon="envelope" class="me-1" />
            <span>Email: lamvipboy777@gmail.com</span>
          </a>
        </div>

        <!-- BÊN PHẢI: TopHeader Nội dung (Thông báo, Hỗ trợ, User Menu) -->
        <div class="d-flex align-items-center gap-4 top-right">

          <!-- Yều cầu trở thành nhà bán hàng -->
          <router-link to="/become-shop" class="top-link text-decoration-none d-flex align-items-center gap-1">
            <font-awesome-icon icon="fa-solid fa-shop" />
            <span>Trở thành Nhà Bán Hàng</span>
          </router-link>

          <!-- Thông báo -->
          <a href="#" class="top-link text-decoration-none d-flex align-items-center gap-1">
            <font-awesome-icon icon="fa-solid fa-bell" />
            <span>Thông báo</span>
          </a>

          <!-- Hỗ trợ -->
          <a
            href="htttps://m.me/lampro783"
            target="blank"
            rel="noopener noreferrer"
            class="top-link text-decoration-none d-flex align-items-center gap-1">
            <font-awesome-icon icon="fa-solid fa-circle-question" />
            <span>Hỗ trợ</span>
          </a>

          <!-- Chưa đăng nhập -->
          <template v-if="!authStore.isLoggedIn">
            <div class="d-flex align-items-center gap-2 fw-semibold">
              <router-link to="/login" class="top-link text-decoration-none">Đăng Nhập</router-link>
              <span class="divider">|</span>
              <router-link to="/register" class="top-link text-decoration-none">Đăng Ký</router-link>
            </div>
          </template>

          <!-- Đã đăng nhập -->
          <template v-else>
            <div class="user-dropdown-wrapper">
              <div class="user-trigger d-flex align-items-center gap-2 cursor-pointer top-link">
                <img
                  src="https://via.placeholder.com/30"
                  :alt="authStore.user?.username ?? undefined"
                  class="user-avatar rounded-circle border border-success"
                />
                <span class="fw-semibold text-truncate" style="max-width: 120px;">
                  {{ authStore.user?.username }}
                </span>
              </div>

              <div class="user-dropdown-menu shadow">
                <router-link v-if="authStore.user?.role === 'shop'" to="/shop" class="dropdown-item">
                  Cửa hàng của tôi
                </router-link>

                <router-link 
                  v-if = "authStore.user?.role === 'shop'"
                  to="/shop/dashboard" class="dropdown-item">
                  Quản Lý Cửa Hàng
                </router-link>

                <router-link 
                  v-if = "authStore.user?.role === 'customer'"
                  to="/user/account/profile" class="dropdown-item">
                  Tài khoản của tôi
                </router-link>

                <router-link v-if="authStore.user?.role === 'customer'" to="/user/orders" class="dropdown-item">
                  Đơn mua
                </router-link>

                <div class="dropdown-divider my-1"></div>
                <button
                  class="dropdown-item text-danger border-0 bg-transparent w-100 text-start cursor-pointer"
                  @click="handleLogout"
                >
                  <font-awesome-icon icon="fa-solid fa-right-from-bracket" class="me-2"/>
                  Đăng Xuất
                </button>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>

    <!-- 2. MAIN BANNER (Logo + Search + Cart) -->
    <div class="main-header text-white pt-3 pb-3 px-3">
      <div class="container-xl d-flex justify-content-between align-items-center gap-4">
        
        <!-- Logo -->
        <router-link to="/" class="logo-wrapper d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
          <div class="logo-box bg-white rounded-3 p-1 d-flex align-items-center justify-content-center">
            <img :src="logoUrl" alt="Logo" class="logo-img" @error="handleImageError" />
          </div>
          <div class="logo-text text-white">
            <div class="brand-name fw-bold lh-1">Nhà Thuốc của Lâm</div>
            <div class="brand-slogan fs-11 text-white-50 mt-1">NHÀ THUỐC CỦA NGƯỜI LÀM THUỐC</div>
          </div>
        </router-link>

        <!-- Search Box -->
        <div class="search-box flex-grow-1 position-relative mx-2">
          <font-awesome-icon icon="magnifying-glass" class="search-icon position-absolute text-muted" />
          <input
            v-model="searchQuery"
            type="text"
            class="form-control search-input rounded-pill ps-5 pe-3"
            placeholder="Tìm kiếm sản phẩm, bài viết..."
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Giỏ hàng -->
        <div class="user-actions d-flex align-items-center gap-2 flex-shrink-0">
          <div class="cart-preview-wrapper" @mouseenter="handleCartEnter">
            <router-link to="/cart" class="cart-icon-link text-white text-decoration-none" aria-label="Giỏ hàng">
              <font-awesome-icon icon="fa-solid fa-cart-shopping" />
              <span v-if="cartTotal > 0" class="cart-badge">{{ cartTotal > 99 ? '99+' : cartTotal }}</span>
            </router-link>

            <div class="cart-preview shadow-sm">
              <div class="cart-preview__title">Sản phẩm mới thêm</div>

              <div v-if="cartLoading" class="cart-preview__state">Đang tải giỏ hàng...</div>
              <div v-else-if="!cartItems.length" class="cart-preview__state">Giỏ hàng chưa có sản phẩm</div>

              <div v-else class="cart-preview__list">
                <router-link
                  v-for="item in cartItems"
                  :key="item.id"
                  :to="`/product/${item.product_id}`"
                  class="cart-preview__item text-decoration-none"
                >
                  <div class="cart-preview__image">
                    <img v-if="item.thumbnail" :src="item.thumbnail" :alt="item.name" />
                    <font-awesome-icon v-else icon="fa-solid fa-box-open" />
                  </div>
                  <div class="cart-preview__name" :title="item.name">{{ item.name }}</div>
                  <strong class="cart-preview__price">{{ formatPrice(item.price) }}</strong>
                </router-link>
              </div>

              <div class="cart-preview__footer">
                <span>{{ cartTotal }} sản phẩm trong giỏ hàng</span>
                <router-link to="/cart" class="cart-preview__button text-decoration-none">Xem giỏ hàng</router-link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header-container {
  width: 100%;
  font-family: 'Segoe UI', Tahoma, sans-serif;

  .top-bar {
    background-color: #f0f7f3;
    border-bottom: 1px solid #e1ede5;

    .top-link {
      color: #0d5c31;
      transition: color 0.2s ease;

      &:hover { color: #008844; }
    }

    .divider { opacity: 0.5; }
  }

  .main-header {
    background: #39b54a;

    .logo-box {
      width: 42px;
      height: 42px;

      .logo-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    .brand-name {
      font-size: 17px;
      letter-spacing: 0.3px;
    }

    .brand-slogan {
      font-size: 10px;
      opacity: 0.85;
    }

    .search-box {
      max-width: 800px;

      .search-icon {
        left: 18px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 16px;
      }

      .search-input {
        height: 44px;
        font-size: 14px;
        border: none;
        box-shadow: none;

        &::placeholder { color: #888; }
        &:focus { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3); }
      }
    }
  }

  .fs-13 { font-size: 13px; }
  .fs-12 { font-size: 12px; }
  .fs-11 { font-size: 11px; }
  .cursor-pointer { cursor: pointer; }
}

.cart-preview-wrapper {
  position: relative;
  padding: 8px 0;

  .cart-icon-link {
    position: relative;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    font-size: 24px;
  }

  .cart-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    border: 1px solid #fff;
    border-radius: 999px;
    background: #f36b21;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .cart-preview {
    position: absolute;
    top: calc(100% + 2px);
    right: -8px;
    width: 440px;
    max-width: min(440px, calc(100vw - 24px));
    z-index: 1100;
    color: #333;
    background: #fff;
    border: 1px solid #ececec;
    border-radius: 10px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px);
    transition: opacity .16s ease, transform .16s ease, visibility .16s ease;

    &::before {
      content: '';
      position: absolute;
      top: -9px;
      right: 20px;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-bottom: 9px solid #fff;
    }
  }

  &:hover .cart-preview {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .cart-preview__title {
    padding: 15px 18px 10px;
    color: #666;
    font-size: 15px;
    font-weight: 600;
  }

  .cart-preview__state {
    min-height: 94px;
    display: grid;
    place-items: center;
    padding: 18px;
    color: #888;
    font-size: 13px;
  }

  .cart-preview__list {
    max-height: 320px;
    overflow-y: auto;
  }

  .cart-preview__item {
    min-height: 70px;
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 8px 18px;
    color: #333;

    &:hover { background: #f8faf9; }
  }

  .cart-preview__image {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid #e3e7e5;
    border-radius: 4px;
    background: #f8faf9;
    color: #9aa49e;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .cart-preview__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #333;
    font-size: 15px;
    font-weight: 400;
  }

  .cart-preview__price {
    white-space: nowrap;
    color: #075daa;
    font-size: 15px;
    font-weight: 700;
  }

  .cart-preview__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px 18px;
    border-top: 1px solid #f0f0f0;

    > span {
      color: #666;
      font-size: 13px;
    }
  }

  .cart-preview__button {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border-radius: 7px;
    background: #39b54a;
    color: #fff;
    font-size: 14px;
    font-weight: 700;

    &:hover { background: #39b54a; }
  }
}

.user-dropdown-wrapper {
  position: relative;
  padding: 2px 0;

  .user-avatar {
    width: 24px;
    height: 24px;
    object-fit: cover;
  }

  .user-dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    width: 210px;
    z-index: 1050;
    padding: 6px 0;
    background: #fff;
    border-radius: 6px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: all .25s cubic-bezier(.165, .84, .44, 1);

    &::before {
      content: '';
      position: absolute;
      top: -7px;
      right: 25px;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #fff;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      color: #333;
      font-size: 13px;
      text-decoration: none;
      transition: background-color .2s ease, color .2s ease;

      &:hover {
        background: #f8f9fa;
        color: #00823d;
      }
    }
  }

  &:hover .user-dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .cart-preview-wrapper .cart-preview {
    position: fixed;
    top: 112px;
    right: 10px;
    left: 10px;
    width: auto;
  }
}
</style>
