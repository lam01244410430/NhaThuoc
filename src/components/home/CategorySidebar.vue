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
              v-for="(item,index) in categories"
              :key="index"
              class="category-item"
              :class="{ active: activeIndex === index }"
              @mouseenter="activeIndex=index"
            >
              <span>{{ item.name }}</span>
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
              :key="activeCategory.name"
              class="submenu-content"
            >
              <h5> {{ activeCategory.name }} </h5>
              <div class="submenu-grid">
                <router-link
                  v-for="(sub,index) in activeCategory.subCategories"
                  :key="index"
                  :to="sub.link || '/'"
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
import { computed, ref } from 'vue'

interface SubCategory {
  name: string
  link?: string
}

interface Category {
  name: string
  subCategories: SubCategory[]
}

const defaultCategory: Category = {
  name: '',
  subCategories: []
}

const showMenu = ref(false)
const activeIndex = ref(0)
const categories = ref<Category[]>([
  {
    name: 'Ưu đãi',
    subCategories: [
      { name: 'Mỹ phẩm giá sốc', link: '/Category/my-pham-gia-soc'},
      { name: 'Buy 1 Get 1 Free', link: '/Category/offers/buy-1-get-1-free'},
      { name: 'Seasonal Offers', link: '/Category/offers/seasonal-offers'}
    ]
  },
  {
    name: 'Thuốc',
    subCategories: [
      { name: 'Xem tất cả', link: '/Category/thuoc'},
      { name: 'Mắt, tai mũi họng', link: '/Category/mat-tai-mui-hong'},
      { name: 'Tiêu hoá, gan mật', link: '/Category/tieu-hoa-gan-mat'},
      { name: 'Tim mạch', link: '/Category/tim-mach'},
      { name: 'Kháng sinh', link: '/Category/khang-sinh'},
      { name: 'Cơ xương khớp, gút', link: '/Category/co-xuong-khop-gut'},
      { name: 'Da liễu, dị ứng', link: '/Category/da-lieu-di-ung'},
      { name: 'Giảm đau, hạ sốt, kháng viêm', link: '/Category/giam-dau-ha-sot-khang-viem'}
    ]
  },
{
    name: 'Thực phẩm chức năng',
    subCategories: [
      { name: 'Xem tất cả', link: '/Category/thuc-pham-chuc-nang'},
      { name: 'Bổ gan, thanh nhiệt', link: '/Category/bo-gan-thanh-nhiet'},
      { name: 'Bổ não', link: '/Category/bo-nao'},
      { name: 'Bổ phế, hô hấp', link: '/Category/bo-phe-ho-hap'},
      { name: 'Bổ trợ xương khớp', link: '/Category/bo-tro-xuong-khop'},
      { name: 'Hỗ trợ tiêu hoá', link: '/Category/ho-tro-tieu-hoa'},
      { name: 'Làm đẹp, giảm cân', link: '/Category/lam-dep-giam-can'}
    ]
  },
  {
    name: 'Dược mỹ phẩm',
    subCategories: [
      { name: 'Xem tất cả', link: '/Category/duoc-my-pham'},
      { name: 'Dưỡng da, dưỡng môi', link: '/Category/duong-da-duong-moi'},
      { name: 'Kem, sữa rửa mặt', link: '/Category/kem-sua-rua-mat'},
      { name: 'Trị mụn, ngừa sẹo, mờ thâm', link: '/Category/tri-mun-ngua-seo-mo-tham'},
      { name: 'Tẩy trang', link: '/Category/tay-trang'},
      { name: 'Tẩy tế bào chết', link: '/Category/tay-te-bao-chet'},
      { name: 'Toner và xịt khoáng', link: '/Category/toner-va-xit-khoang'}
    ]
  },
  {
    name: 'Thực phẩm dinh dưỡng',
    subCategories: [
      { name: 'Xem tất cả', link: '/Category/thuc-pham-dinh-duong'},
      { name: 'Mật ong', link: '/Category/mat-ong'},
      { name: 'Nghệ', link: '/Category/nghe'},
      { name: 'Đường ăn kiêng', link: '/Category/duong-an-kieng'}
    ]
  }
])

const activeCategory = computed<Category>(() => {
  return categories.value[activeIndex.value] ?? defaultCategory
})
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