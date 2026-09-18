/**
 * authStore.js — Pinia Store Autentikasi
 *
 * Store ini hanya mengelola STATE (data reaktif).
 * Semua logika I/O (local data / HTTP API) didelegasikan ke auth.service.js.
 *
 * Untuk switch ke backend Perl:
 *   → Ubah VITE_USE_LOCAL_DATA=false di file .env
 *   → Tidak ada perubahan di file ini maupun di komponen UI.
 */

import { defineStore } from 'pinia'
import {
  login as svcLogin,
  quickLogin as svcQuickLogin,
  logout as svcLogout,
  verifyOtp as svcVerifyOtp,
  resendOtp as svcResendOtp,
  forgotPasswordRequest as svcForgotPasswordRequest,
  verifyForgotOtp as svcVerifyForgotOtp,
  resetPassword as svcResetPassword,
  getUsers as svcGetUsers,
  addUser as svcAddUser,
  updateUser as svcUpdateUser,
  deleteUser as svcDeleteUser,
  toggleUserStatus as svcToggleUserStatus
} from '../services/auth.service.js'
import { useTaskStore } from './taskStore.js'
import { useScanStore } from './scanStore.js'
import { usePaketStore } from './paketStore.js'

const getSavedUser = () => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('wahana_user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.id && parsed.role) {
      return parsed
    }
    localStorage.removeItem('wahana_user')
    localStorage.removeItem('wahana_token')
    return null
  } catch {
    localStorage.removeItem('wahana_user')
    localStorage.removeItem('wahana_token')
    return null
  }
}

const savedUser = getSavedUser()

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: savedUser,
    isLoggedIn: !!savedUser && (import.meta.env.VITE_USE_LOCAL_DATA === 'true' || !!localStorage.getItem('wahana_token')),

    // Daftar user (diisi via fetchUsers)
    users: [],

    // Loading & error state — digunakan UI untuk menampilkan spinner / pesan
    isLoading: false,
    error: null
  }),

  getters: {
    role: (state) => state.currentUser?.role || null,
    isAdmin: (state) => state.currentUser?.role === 'ADMIN',
    isPetugas: (state) => state.currentUser?.role === 'PETUGAS_SCAN',
    isCustomer: (state) => state.currentUser?.role === 'CUSTOMER',

    allPetugas: (state) => state.users.filter((u) => u.role === 'PETUGAS_SCAN')
  },

  actions: {
    /**
     * Prefetch semua data operasional SETELAH sesi aktif.
     * Wajib di MODE API karena boot tidak melakukan fetch saat belum login.
     */
    async prefetchOperationalData() {
      const taskStore = useTaskStore()
      const scanStore = useScanStore()
      const paketStore = usePaketStore()

      const promises = []

      // Hanya ADMIN yang boleh mengambil seluruh daftar user
      if (this.isAdmin) {
        promises.push(this.fetchUsers().catch((err) => console.warn('[FETCH_USERS]', err)))
      }

      // Task & Scan untuk ADMIN dan PETUGAS_SCAN
      if (this.isAdmin || this.isPetugas) {
        promises.push(taskStore.fetchTasks().catch((err) => console.warn('[FETCH_TASKS]', err)))
        promises.push(scanStore.fetchScans().catch((err) => console.warn('[FETCH_SCANS]', err)))
      }

      // Paket untuk semua role
      promises.push(paketStore.fetchPakets().catch((err) => console.warn('[FETCH_PAKETS]', err)))

      await Promise.allSettled(promises)
    },

    /**
     * Login dengan username & password.
     * Memanggil auth.service.js → local dummy atau POST /api/auth/login
     */
    async login(username, password) {
      this.isLoading = true
      this.error = null
      try {
        const result = await svcLogin(username, password)
        if (result.success && !result.requires_otp) {
          this.currentUser = result.user
          this.isLoggedIn = true
          localStorage.setItem('wahana_user', JSON.stringify(result.user))
          await this.prefetchOperationalData()
        }
        return result
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Quick login bypass password (hanya untuk prototype/demo).
     */
    async quickLogin(userId) {
      this.isLoading = true
      this.error = null
      try {
        const result = await svcQuickLogin(userId)
        if (result.success && !result.requires_otp) {
          this.currentUser = result.user
          this.isLoggedIn = true
          localStorage.setItem('wahana_user', JSON.stringify(result.user))
          await this.prefetchOperationalData()
        }
        return result
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Verifikasi 6-digit OTP
     */
    async verifyOtp(preauth_token, otp) {
      this.isLoading = true
      this.error = null
      try {
        const result = await svcVerifyOtp(preauth_token, otp)
        if (result.success) {
          this.currentUser = result.user
          this.isLoggedIn = true
          localStorage.setItem('wahana_user', JSON.stringify(result.user))
          await this.prefetchOperationalData()
        }
        return result
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Kirim ulang OTP
     */
    async resendOtp(preauth_token) {
      try {
        return await svcResendOtp(preauth_token)
      } catch (err) {
        return { success: false, message: err.message }
      }
    },

    /**
     * Minta OTP Reset Password (Lupa Password)
     */
    async forgotPasswordRequest(identity) {
      this.isLoading = true
      this.error = null
      try {
        return await svcForgotPasswordRequest(identity)
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Verifikasi OTP 6-Digit Reset Password
     */
    async verifyForgotOtp(reset_token, otp) {
      this.isLoading = true
      this.error = null
      try {
        return await svcVerifyForgotOtp(reset_token, otp)
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Simpan / Reset Password Baru
     */
    async resetPassword(reset_verified_token, new_password, confirm_password) {
      this.isLoading = true
      this.error = null
      try {
        return await svcResetPassword(reset_verified_token, new_password, confirm_password)
      } catch (err) {
        this.error = err.message
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Logout user aktif.
     */
    async logout() {
      if (this.currentUser) {
        await svcLogout(this.currentUser.id)
      }
      this.currentUser = null
      this.isLoggedIn = false
      localStorage.removeItem('wahana_user')
      localStorage.removeItem('wahana_token')
    },

    /**
     * Ambil daftar semua user dari service (local/API).
     */
    async fetchUsers() {
      try {
        this.users = await svcGetUsers()
      } catch (err) {
        this.error = err.message
      }
    },

    /**
     * Tambah user baru.
     */
    async addUser(newUserData) {
      this.isLoading = true
      try {
        const result = await svcAddUser(newUserData)
        if (result.success) {
          await this.fetchUsers()
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Update data user.
     */
    async updateUser(userId, userData) {
      this.isLoading = true
      try {
        const result = await svcUpdateUser(userId, userData)
        if (result.success) {
          await this.fetchUsers()
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Hapus user.
     */
    async deleteUser(userId) {
      this.isLoading = true
      try {
        const result = await svcDeleteUser(userId)
        if (result.success) {
          await this.fetchUsers()
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Toggle status user (ACTIVE <-> DISABLED).
     */
    async toggleUserStatus(userId) {
      try {
        const result = await svcToggleUserStatus(userId)
        if (result.success) {
          await this.fetchUsers()
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      }
    }
  }
})
