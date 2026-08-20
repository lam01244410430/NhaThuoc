import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '../components/layout/DefaultLayout.vue'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '@/stores/auth.ts'

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
        },
        {
          path: 'shop/:shopId(\\d+)',
          name: 'shop-public',
          component: () => import('../views/Shop/ShopView.vue')
        }
      ]
    },
    {
      path:'/user',
      component: () => import('../components/layout/CustomerAccount.vue'),
      children: [
        {
          path: '',
          redirect: '/user/account/profile'
        },
        {
          path: 'account/profile',
          name: 'customer-profile',
          component: () => import('../views/customer/CustomerProfile.vue')
        },
        {
          path: 'account/address',
          name: 'customer-address',
          component: () => import('../views/customer/CustomerAddress.vue')
        },
        {
          path: 'account/password',
          name: 'customer-password',
          component: () => import('../views/customer/CustomerPassword.vue')
        },
        {
          path: 'account/phone',
          name: 'customer-phone',
          component: () => import('../views/customer/CustomerPhone.vue')
        },
        {
          path: 'account/email',
          name: 'customer-email',
          component: () => import('../views/customer/CustomerEmail.vue')
        },
        {
          path: 'notifications',
          name: 'customer-notifications',
          component: () => import('../views/customer/CustomerNotification.vue')
        },
        {
          path: 'orders',
          name: 'customer-orders',
          component: () => import('../views/customer/CustomerOrders.vue')
        },
      ]
    },
    {
      path: '/shop',
      meta: {
        requiresAuth: true,
        roles: ['shop'],
      },
      children: [
        {
          path: '',
          name: 'shop',
          component: () => import('../views/Shop/ShopOwnerView.vue'),
        },
        {
          path: 'dashboard',
          name: 'shop-dashboard',
          component: () => import('../views/Shop/ShopDashboardView.vue'),
        },
        {
          path: 'product/new',
          name: 'shop-product-create',
          component: () => import('../views/Shop/ProductCreate.vue'),
        },
        {
          path: 'product/:productId/edit',
          name: 'shop-product-edit',
          component: () => import('../views/Shop/ProductCreate.vue'),
        },
      ],
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
      path: '/category/:parentCategory/:childCategory?',
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
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next('/login')
  }

  if (to.meta.role && authStore.user?.role !== to.meta.role) {
    return next('/')
  }
  next();
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const requiresAuth = Boolean(to.meta.requiresAuth)

  if (!requiresAuth) return true
  if ( authStore.token && !authStore.user) await authStore.fetchMe()
  if (!authStore.isLoggedIn) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  const roles = to.meta.roles as string[] | undefined

  if (roles && !roles.includes(authStore.user!.role,)) {
    return {
      name: 'home',
    }
  }
  return true
})

export default router
