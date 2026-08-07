<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/router/auth' 
import logoUrl from '@/assets/images/logo.png'

const router = useRouter()
const authStore = useAuthStore()

const searchQuery = ref('')

const handleSearch = () => {
  if (searchQuery.value.trim() !== '') {
    console.log('Tìm kiếm: ', searchQuery.value)
  }
}

const handleLogout = () => {
  if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
    authStore.logout()
    router.push('/login')
  }
}

const handleImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.src = 'https://via.placeholder.com/35x35/007338/ffffff?text=U'
}
</script>

<template>
  <header class="header-container">
    <!-- 1. TOP BAR (Bên trái: Hotline + Email | Bên phải: TopHeader) -->
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
          <!-- Thông báo -->
          <a href="#" class="top-link text-decoration-none d-flex align-items-center gap-1">
            <font-awesome-icon icon="bell" />
            <span>Thông báo</span>
          </a>

          <!-- Hỗ trợ -->
          <a href="#" class="top-link text-decoration-none d-flex align-items-center gap-1">
            <font-awesome-icon icon="circle-question" />
            <span>Hỗ trợ</span>
          </a>

          <!-- Chưa đăng nhập -->
          <template v-if="!authStore.isAuthenticated">
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
                  :alt="authStore.user?.username"
                  class="user-avatar rounded-circle border border-success"
                />
                <span class="fw-semibold text-truncate" style="max-width: 120px;">
                  {{ authStore.user?.username }}
                </span>
              </div>

              <div class="user-dropdown-menu shadow">
                <router-link to="/account" class="dropdown-item">
                  <font-awesome-icon icon="user" class="me-2 text-muted" />
                  Tài khoản của tôi
                </router-link>

                <router-link to="/shop" class="dropdown-item">
                  <font-awesome-icon icon="store" class="me-2 text-success" />
                  Quản Lý Shop & Sản Phẩm
                </router-link>

                <router-link to="/orders" class="dropdown-item">
                  <font-awesome-icon icon="box-archive" class="me-2 text-muted" />
                  Đơn mua
                </router-link>

                <div class="dropdown-divider my-1"></div>

                <button
                  class="dropdown-item text-danger border-0 bg-transparent w-100 text-start cursor-pointer"
                  @click="handleLogout"
                >
                  <font-awesome-icon icon="right-from-bracket" class="me-2" />
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
          <router-link to="/cart" class="cart-btn d-flex flex-column align-items-center text-white text-decoration-none">
            <font-awesome-icon icon="bag-shopping" class="cart-icon" />
            <span class="cart-text fw-medium">Giỏ hàng</span>
          </router-link>
        </div>

      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header-container {
  width: 100%;
  font-family: system-ui, -apple-system, sans-serif;

  .top-bar {
    background-color: #f0f7f3;
    border-bottom: 1px solid #e1ede5;

    .top-link {
      color: #0d5c31;
      transition: color 0.2s ease;

      &:hover {
        color: #008844;
      }
    }

    .divider {
      opacity: 0.5;
    }
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
      max-width: 600px;

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

        &::placeholder {
          color: #888;
        }

        &:focus {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
        }
      }
    }

    .btn-pill-action {
      background-color: #39b54a;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 8px 18px;
      font-size: 14px;
      transition: all 0.2s ease;

      &:hover {
        background-color: rgba(0, 0, 0, 0.35);
        transform: translateY(-1px);
      }
    }

    

    .action-icon {
      font-size: 16px;
    }
  }

  .fs-13 { font-size: 13px; }
  .fs-12 { font-size: 12px; }
  .fs-11 { font-size: 11px; }
  .cursor-pointer { cursor: pointer; }
}

/* Style Dropdown Menu người dùng */
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
    background-color: #ffffff;
    border-radius: 6px;
    padding: 6px 0;
    z-index: 1050;

    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: all 0.25s cubic-bezier(0.165, 0.84, 0.44, 1);

    &::before {
      content: '';
      position: absolute;
      top: -7px;
      right: 25px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #ffffff;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      font-size: 13px;
      color: #333333;
      text-decoration: none;
      transition: background-color 0.2s ease, color 0.2s ease;

      &:hover {
        background-color: #f8f9fa;
        color: #00823d;
      }
    }
  }

  &:hover {
    .user-dropdown-menu {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
  }
}
</style>