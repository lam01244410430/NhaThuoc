<template>
  <div
    class="category-container"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <!-- Overlay -->
    <transition name="fade">
      <div
        v-if="showMenu"
        class="menu-overlay"
        @mouseenter="showMenu = false"
      />
    </transition>

    <div
      class="category-sidebar bg-white rounded-3 shadow-sm"
      :class="{ active: showMenu }"
    >
      <div class="sidebar-header">
        <font-awesome-icon icon="bars" class="me-2" />
        <span>Danh mục</span>
      </div>

      <div class="menu-body">

        <div class="menu-left">
          <ul class="list-unstyled mb-0">
            <li
              v-for="(item, index) in categories"
              :key="item.id"
              class="category-item"
              :class="{active: activeIndex === index}
              "@mouseenter="activeIndex = index"
            >
              <span>
                {{ item.name }}
              </span>

              <font-awesome-icon
                icon="chevron-right"
                class="arrow"
              />
            </li>
          </ul>
        </div>

        <div class="menu-right">
          <transition
            name="submenu"
            mode="out-in"
          >
            <div
              v-if="activeCategory.id !== 0"
              :key="activeCategory.id"
              class="submenu-content"
            >
              <h5>
                {{ activeCategory.name }}
              </h5>

              <div class="submenu-grid">
                <router-link
                  :to="activeCategory.link"
                  class="submenu-item"
                >
                  Xem tất cả
                </router-link>

                <router-link
                  v-for="sub in activeCategory.subCategories"
                  :key="sub.id"
                  :to="sub.link"
                  class="submenu-item"
                >
                  {{ sub.name }}
                </router-link>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import apiClient from '@/services/api'

interface SubCategory {
  id: number
  name: string
  slug: string
  link: string
  subCategories?: SubCategory[]
}

interface Category {
  id: number
  name: string
  slug: string
  link: string
  subCategories: SubCategory[]
}

interface CategoryTreeResponse {
  success: boolean
  data: Category[]
}

const showMenu = ref(false)

const activeIndex = ref(0)

const categories =
  ref<Category[]>([])

const defaultCategory: Category = {
  id: 0,
  name: '',
  slug: '',
  link: '/',
  subCategories: [],
}

const activeCategory =
  computed<Category>(() => {
    return (
      categories.value?.[
        activeIndex.value
      ] ??
      defaultCategory
    )
  })

const loadCategories =
  async () => {
    try {
      const response =
        await apiClient.get<CategoryTreeResponse>(
          '/category/tree',
        )

      const data =
        response.data?.data

      if (!Array.isArray(data)) {
        categories.value = []
        activeIndex.value = 0
        return
      }

      categories.value = data

      activeIndex.value = 0

      console.log(
        'CATEGORY TREE:',
        categories.value,
      )
    } catch (error) {
      console.error(
        'Load categories error:',
        error,
      )

      categories.value = []
      activeIndex.value = 0
    }
  }

onMounted(loadCategories)
</script>

<style scoped lang="scss">
.category-container{
  position:relative;
  z-index:100;
}

.menu-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.35);
  z-index:998;
}

.category-sidebar{
  position:sticky;
  top:80px;
  width:720px;
  background:#fff;
  border-radius:18px;
  overflow:hidden;
  box-shadow:0 18px 40px rgba(0,0,0,.12);
  z-index:999;
  transition:.25s;
}

.category-sidebar:not(.active){
  width:260px;
  .menu-right{
    display:none;
  }
}

.category-sidebar.active{
  width:760px;
}

.sidebar-header{
  display:flex;
  align-items:center;
  padding:16px 18px;
  color:#009845;
  font-weight:700;
  border-bottom:1px solid #f1f1f1;

}

.menu-body{

  display:flex;

  align-items:stretch;

}

.menu-left{
  width:260px;
  border-right:1px solid #efefef;
  background:#fff;
}

.category-item{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:14px 18px;
  cursor:pointer;
  transition:.2s;
  font-size:14px;
}

.category-item:hover{
  background:#f4fff8;
}

.category-item.active{
  background:#e8f8ef;
  color:#009845;
  font-weight:600;
}

.arrow{
  font-size:12px;
  color:#999;
}

.menu-right{
  flex:1;
  background:white;
  padding:28px;
  min-height:420px;
}

.submenu-content h5{
  margin-bottom:24px;
  color:#009845;
  font-weight:700;
  font-size:20px;
}

.submenu-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}

.submenu-item{
  display:block;
  padding:12px 14px;
  border-radius:10px;
  text-decoration:none;
  color:#333;
  transition:.2s;
  font-size:14px;
}

.submenu-item:hover{
  background:#f4fff8;
  color:#009845;
  font-weight:600;
}

.fade-enter-active,
.fade-leave-active{
  transition:opacity .25s;
}

.fade-enter-from,
.fade-leave-to{
  opacity:0;
}

.submenu-enter-active,
.submenu-leave-active{
  transition:.18s;
}

.submenu-enter-from{
  opacity:0;
  transform:translateX(15px);
}

.submenu-leave-to{
  opacity:0;
  transform:translateX(-15px);
}

@media(max-width:992px){
  .category-sidebar{
    width:100% !important;
  }
  .menu-body{
    flex-direction:column;
  }
  .menu-left{
    width:100%;
    border-right:none;
    border-bottom:1px solid #eee;
  }
  .menu-right{
    min-height:auto;
  }
  .submenu-grid{
    grid-template-columns:1fr;
  }
}
</style>