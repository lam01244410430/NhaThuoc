import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '../components/layout/DefaultLayout.vue'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from './auth.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView
        }
      ]
    },
    {
      path: '/shop',
      name: 'shop',
      component: () => import('../views/Shop/ShopView.vue'),
      meta: { requiresAuth: true, role: 'shop'}
    },
    {
      path: '/admin/dashboard',
      name: 'admin',
      component: () => import('../views/admin/AdminDashboard.vue'),
      meta: { requiresAuth: true, role: 'admin'}
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../components/FormRegister.vue')
    },
    {
      path: '/recover',
      name: 'recover',
      component: () => import('../components/FormRecover.vue')
    },
    {
      path: '/Category/:parentCategory/:childCategory?',
      name: 'category',
      component: () => import('../views/CategoryView.vue')
    },
    {
      path: '/product/:productId',
      name: 'product',
      component: () => import('../views/ProductDetail.vue')
    }
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next('/login')
  }

  if (to.meta.role && authStore.user?.role !== to.meta.role) {
    return next('/')
  }

  next();
})

export default router