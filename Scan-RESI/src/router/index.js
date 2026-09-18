import { route } from 'quasar/wrappers'
import { Notify } from 'quasar'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import routes from './routes.js'
import { useAuthStore } from '../stores/authStore.js'

let appRouter = null

export const getAppRouter = () => appRouter

export default route((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : (import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })

  appRouter = Router

  // Role Protection Guard (Strict Multi-Layer RBAC)
  Router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    // 1. Jika belum login dan mengakses rute berproteksi -> arahkan ke login
    if (to.meta.requiresAuth && !authStore.isLoggedIn) {
      return next({ name: 'login' })
    }

    // 2. Sesi terdeteksi login tetapi role tidak valid / null -> reset sesi ke login
    if (authStore.isLoggedIn && !authStore.role) {
      authStore.logout()
      return next({ name: 'login' })
    }

    // 3. Jika sudah login dan membuka halaman login -> arahkan ke dashboard masing-masing
    if ((to.path === '/login' || to.path === '/') && authStore.isLoggedIn) {
      if (authStore.isAdmin) return next({ name: 'admin-dashboard' })
      if (authStore.isCustomer) return next({ name: 'customer-dashboard' })
      if (authStore.isPetugas) return next({ name: 'petugas-dashboard' })
      return next({ name: 'login' })
    }

    // 4. Pembatasan Akses Role Ketat:
    if (authStore.isLoggedIn) {
      const requiredRole = to.matched.find((r) => r.meta && r.meta.role)?.meta?.role
      if (requiredRole && requiredRole !== authStore.role) {
        Notify.create({
          type: 'negative',
          icon: 'gpp_bad',
          message: 'Akses Ditolak!',
          caption: `Halaman ini khusus untuk ${requiredRole}. Akun Anda adalah ${authStore.role}.`,
          position: 'top',
          timeout: 3000
        })

        if (authStore.isAdmin) return next({ name: 'admin-dashboard' })
        if (authStore.isCustomer) return next({ name: 'customer-dashboard' })
        if (authStore.isPetugas) return next({ name: 'petugas-dashboard' })
        return next({ name: 'login' })
      }
    }

    next()
  })

  return Router
})
