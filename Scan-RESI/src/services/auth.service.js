/**
 * auth.service.js — Service Layer Autentikasi
 *
 * Semua operasi autentikasi dan manajemen user ada di sini.
 *
 * MODE LOCAL (VITE_USE_LOCAL_DATA=true):
 *   Menggunakan data dummy array lokal.
 *
 * MODE API (VITE_USE_LOCAL_DATA=false):
 *   Menggunakan HTTP calls ke backend Perl via axios.
 *   Endpoint yang dituju:
 *     POST   /api/auth/login
 *     POST   /api/auth/logout
 *     GET    /api/users
 *     POST   /api/users
 *     PATCH  /api/users/:id/status
 */

import api, { USE_LOCAL_DATA } from './api.js'
import { addAuditLog } from './audit.service.js'

// =====================================================================
// LOCAL DUMMY DATA — Digunakan saat USE_LOCAL_DATA=true
// =====================================================================
const LOCAL_USERS = [
  {
    id: 'USR-ADMIN-001',
    name: 'Admin System',
    username: 'admin',
    password: 'admin123',
    role: 'ADMIN',
    status: 'ONLINE',
    lastLogin: '28-08-2026 08:00:00'
  },
  {
    id: 'USR-001',
    name: 'Fadhil',
    username: 'fadhil',
    password: 'fadhil123',
    role: 'PETUGAS_SCAN',
    status: 'ONLINE',
    lastLogin: '28-08-2026 10:20:00'
  },
  {
    id: 'USR-002',
    name: 'Budi',
    username: 'budi',
    password: 'budi123',
    role: 'PETUGAS_SCAN',
    status: 'ONLINE',
    lastLogin: '28-08-2026 09:45:00'
  },
  {
    id: 'USR-003',
    name: 'Andi',
    username: 'andi',
    password: 'andi123',
    role: 'PETUGAS_SCAN',
    status: 'OFFLINE',
    lastLogin: '23-08-2026 17:30:00'
  },
  {
    id: 'USR-CUST-001',
    name: 'Customer Demo',
    username: 'customer',
    password: 'cust123',
    role: 'CUSTOMER',
    status: 'OFFLINE',
    lastLogin: '28-08-2026 09:00:00'
  }
]

// Helper: format datetime string
const nowString = () => {
  const now = new Date()
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const y = now.getFullYear()
  return `${d}-${m}-${y} ${now.toTimeString().split(' ')[0]}`
}

// =====================================================================
// SERVICE FUNCTIONS
// =====================================================================

/**
 * Login user dengan username & password.
 * @returns {Promise<{success, user, role, message}>}
 */
export async function login(username, password) {
  if (USE_LOCAL_DATA) {
    // --- LOCAL MODE ---
    const user = LOCAL_USERS.find(
      (u) =>
        u.username.toLowerCase() === (username || '').trim().toLowerCase() &&
        u.password === password
    )

    if (!user) {
      return { success: false, message: 'Username atau password salah.' }
    }

    if (user.status === 'DISABLED') {
      return { success: false, message: 'Akun Anda telah dinonaktifkan.' }
    }

    user.status = 'ONLINE'
    user.lastLogin = nowString()

    await addAuditLog({
      user_id: user.id,
      user_name: user.name,
      action: 'LOGIN_SUCCESS',
      details: 'Login berhasil via form.'
    })

    return {
      success: true,
      user: { ...user },
      role: user.role,
      message: `Selamat datang, ${user.name}!`
    }
  }

  // --- API MODE ---
  // POST /api/auth/login
  try {
    const data = await api.post('/api/auth/login', { username, password })
    if (!data.success) {
      return { success: false, message: data.message || 'Login gagal.' }
    }
    if (data.requires_otp) {
      return {
        success: true,
        requires_otp: true,
        preauth_token: data.preauth_token,
        masked_email: data.masked_email,
        message: data.message
      }
    }
    if (data.token) localStorage.setItem('wahana_token', data.token)
    return { success: true, user: data.user, role: data.user?.role, message: data.message }
  } catch (err) {
    return { success: false, message: err.message || 'Login gagal.' }
  }
}

/**
 * Quick login 1-click untuk demo (PRD FR-1.2).
 * MODE LOCAL : bypass password dari data dummy.
 * MODE API   : POST /api/auth/quick-login (endpoint demo backend).
 * @returns {Promise<{success, user, role, message}>}
 */
export async function quickLogin(userId) {
  if (USE_LOCAL_DATA) {
    const user = LOCAL_USERS.find((u) => u.id === userId)
    if (!user) return { success: false, message: 'User tidak ditemukan.' }
    user.status = 'ONLINE'
    user.lastLogin = nowString()

    await addAuditLog({
      user_id: user.id,
      user_name: user.name,
      action: 'LOGIN_SUCCESS',
      details: '1-Click Quick Login Demo.'
    })

    return {
      success: true,
      user: { ...user },
      role: user.role,
      message: `Login instan sebagai ${user.name} (${user.role})`
    }
  }

  // --- API MODE ---
  try {
    const data = await api.post('/api/auth/quick-login', { user_id: userId })
    if (!data.success) {
      return { success: false, message: data.message || 'Quick login gagal.' }
    }
    if (data.requires_otp) {
      return {
        success: true,
        requires_otp: true,
        preauth_token: data.preauth_token,
        masked_email: data.masked_email,
        message: data.message
      }
    }
    if (data.token) localStorage.setItem('wahana_token', data.token)
    return {
      success: true,
      user: data.user,
      role: data.user?.role,
      message: data.message
    }
  } catch (err) {
    return { success: false, message: err.message || 'Quick login gagal.' }
  }
}

/**
 * Verifikasi 6-digit OTP
 */
export async function verifyOtp(preauth_token, otp) {
  if (USE_LOCAL_DATA) {
    let matchedUser = null
    if (preauth_token) {
      const tokenStr = String(preauth_token).trim()

      // 1. Coba decode jika format JSON
      if (tokenStr.startsWith('{')) {
        try {
          const parsed = JSON.parse(tokenStr)
          const uid = parsed.user_id || parsed.id || parsed.username
          if (uid) {
            matchedUser = LOCAL_USERS.find(
              (u) => u.id === uid || u.username.toLowerCase() === String(uid).toLowerCase()
            )
          }
        } catch (_) {}
      }

      // 2. Coba decode jika format JWT (header.payload.signature)
      if (!matchedUser && tokenStr.split('.').length === 3) {
        try {
          const payloadBase64 = tokenStr.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
          const payloadStr = atob(payloadBase64)
          const payload = JSON.parse(payloadStr)
          const uid = payload.user_id || payload.sub || payload.username
          if (uid) {
            matchedUser = LOCAL_USERS.find(
              (u) => u.id === uid || u.username.toLowerCase() === String(uid).toLowerCase()
            )
          }
        } catch (_) {}
      }

      // 3. Coba cocokkan langsung sebagai id atau username
      if (!matchedUser) {
        matchedUser = LOCAL_USERS.find(
          (u) => u.id === tokenStr || u.username.toLowerCase() === tokenStr.toLowerCase()
        )
      }
    }

    const user = matchedUser || LOCAL_USERS[0]
    user.status = 'ONLINE'
    user.lastLogin = nowString()

    await addAuditLog({
      user_id: user.id,
      user_name: user.name,
      action: 'LOGIN_SUCCESS',
      details: 'Verifikasi OTP berhasil (mode simulasi).'
    })

    return {
      success: true,
      user: { ...user },
      role: user.role,
      message: 'Verifikasi OTP berhasil.'
    }
  }

  try {
    const data = await api.post('/api/auth/verify-otp', { preauth_token, otp })
    if (!data.success) {
      return { success: false, message: data.message || 'Kode OTP salah atau kedaluwarsa.' }
    }
    if (data.token) localStorage.setItem('wahana_token', data.token)
    return {
      success: true,
      user: data.user,
      role: data.user?.role,
      token: data.token,
      message: data.message
    }
  } catch (err) {
    return { success: false, message: err.message || 'Verifikasi OTP gagal.' }
  }
}

/**
 * Kirim ulang OTP (cooldown 60 detik)
 */
export async function resendOtp(preauth_token) {
  if (USE_LOCAL_DATA) {
    return { success: true, message: 'Kode OTP baru telah dikirim (mode simulasi).' }
  }

  try {
    const data = await api.post('/api/auth/resend-otp', { preauth_token })
    if (!data.success) {
      return { success: false, message: data.message || 'Gagal mengirim ulang OTP.' }
    }
    return {
      success: true,
      masked_email: data.masked_email,
      message: data.message
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal mengirim ulang OTP.' }
  }
}

/**
 * Minta OTP Reset Password (Lupa Password)
 */
export async function forgotPasswordRequest(identity) {
  if (USE_LOCAL_DATA) {
    return {
      success: true,
      reset_token: 'local-reset-token-demo',
      masked_email: 'f***2@gmail.com',
      message: 'Kode OTP reset password dikirim (mode simulasi).'
    }
  }

  try {
    const data = await api.post('/api/auth/forgot-password', { identity })
    if (!data.success) {
      return {
        success: false,
        message: data.message || 'Akun tidak ditemukan.'
      }
    }

    return {
      success: true,
      reset_token: data.reset_token,
      masked_email: data.masked_email,
      message: data.message
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal meminta kode reset password.' }
  }
}

/**
 * Verifikasi OTP 6-Digit Reset Password
 */
export async function verifyForgotOtp(reset_token, otp) {
  if (USE_LOCAL_DATA) {
    return {
      success: true,
      reset_verified_token: 'local-verified-token-demo',
      message: 'OTP berhasil diverifikasi.'
    }
  }

  try {
    const data = await api.post('/api/auth/verify-forgot-otp', { reset_token, otp })
    if (!data.success) {
      return {
        success: false,
        message: data.message || 'OTP salah atau kadaluarsa.'
      }
    }
    return {
      success: true,
      reset_verified_token: data.reset_verified_token,
      message: data.message
    }
  } catch (err) {
    return { success: false, message: err.message || 'Verifikasi OTP gagal.' }
  }
}

/**
 * Reset / Buat Password Baru
 */
export async function resetPassword(reset_verified_token, new_password, confirm_password) {
  if (USE_LOCAL_DATA) {
    return { success: true, message: 'Password Anda berhasil diubah (mode simulasi).' }
  }

  try {
    const data = await api.post('/api/auth/reset-password', {
      reset_verified_token,
      new_password,
      confirm_password
    })
    if (!data.success) {
      return {
        success: false,
        message: data.message || 'Password tidak berhasil diubah.'
      }
    }
    return {
      success: true,
      message: data.message || 'Password berhasil diubah.'
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal mereset password.' }
  }
}

/**
 * Logout user.
 */
export async function logout(userId) {
  if (USE_LOCAL_DATA) {
    const user = LOCAL_USERS.find((u) => u.id === userId)
    if (user) {
      user.status = 'OFFLINE'
      await addAuditLog({
        user_id: user.id,
        user_name: user.name,
        action: 'LOGOUT',
        details: 'User keluar dari sistem.'
      })
    }
    return { success: true }
  }

  // --- API MODE ---
  // POST /api/auth/logout
  try {
    await api.post('/api/auth/logout', { user_id: userId })
    localStorage.removeItem('wahana_token')
    return { success: true }
  } catch {
    return { success: true } // logout local tetap berhasil
  }
}

/**
 * Ambil seluruh daftar user dari sistem.
 * @returns {Promise<User[]>}
 */
export async function getUsers() {
  if (USE_LOCAL_DATA) {
    return [...LOCAL_USERS]
  }

  // --- API MODE ---
  // GET /api/users
  // Response: { users: [...] }
  const data = await api.get('/api/users')
  return data.users || []
}

/**
 * Tambah user baru.
 * @returns {Promise<{success, user}>}
 */
export async function addUser(newUserData) {
  const role = typeof newUserData.role === 'object' && newUserData.role !== null
    ? (newUserData.role.value || newUserData.role.label || 'PETUGAS_SCAN')
    : (newUserData.role || 'PETUGAS_SCAN')

  if (USE_LOCAL_DATA) {
    const isCustomer = role === 'CUSTOMER'
    const newId = isCustomer
      ? `USR-CUST-${String(LOCAL_USERS.filter((u) => u.role === 'CUSTOMER').length + 1).padStart(3, '0')}`
      : `USR-${String(LOCAL_USERS.filter((u) => u.role !== 'CUSTOMER').length + 1).padStart(3, '0')}`

    const created = {
      id: newId,
      name: newUserData.name,
      username: newUserData.username,
      password: newUserData.password || '123456',
      role,
      status: 'OFFLINE',
      lastLogin: '-'
    }
    LOCAL_USERS.push(created)
    return { success: true, user: { ...created } }
  }

  // --- API MODE ---
  // POST /api/users
  const payload = {
    ...newUserData,
    role
  }
  const data = await api.post('/api/users', payload)
  return { success: true, user: data.user }
}

/**
 * Toggle status user (ACTIVE <-> DISABLED).
 * @returns {Promise<{success, newStatus}>}
 */
export async function toggleUserStatus(userId) {
  if (USE_LOCAL_DATA) {
    const target = LOCAL_USERS.find((u) => u.id === userId)
    if (!target) return { success: false }
    target.status = target.status === 'DISABLED' ? 'OFFLINE' : 'DISABLED'
    return { success: true, newStatus: target.status }
  }

  // --- API MODE ---
  // PATCH /api/users/:id/status
  const data = await api.patch(`/api/users/${userId}/status`)
  return { success: true, newStatus: data.newStatus }
}

/**
 * Update data user (ADMIN only).
 * @param {string} userId
 * @param {object} userData
 * @returns {Promise<{success, user, message}>}
 */
export async function updateUser(userId, userData) {
  const role = typeof userData.role === 'object' && userData.role !== null
    ? (userData.role.value || userData.role.label || 'PETUGAS_SCAN')
    : (userData.role || 'PETUGAS_SCAN')

  if (USE_LOCAL_DATA) {
    const idx = LOCAL_USERS.findIndex((u) => u.id === userId)
    if (idx === -1) return { success: false, message: 'User tidak ditemukan.' }
    LOCAL_USERS[idx] = {
      ...LOCAL_USERS[idx],
      name: userData.name || LOCAL_USERS[idx].name,
      username: userData.username || LOCAL_USERS[idx].username,
      role
    }
    if (userData.password) LOCAL_USERS[idx].password = userData.password
    return { success: true, user: { ...LOCAL_USERS[idx] } }
  }

  // --- API MODE ---
  // PUT /api/users/:id
  const payload = {
    ...userData,
    role
  }
  const data = await api.put(`/api/users/${userId}`, payload)
  return data
}

/**
 * Delete user (ADMIN only).
 * @param {string} userId
 * @returns {Promise<{success, message}>}
 */
export async function deleteUser(userId) {
  if (USE_LOCAL_DATA) {
    const idx = LOCAL_USERS.findIndex((u) => u.id === userId)
    if (idx === -1) return { success: false, message: 'User tidak ditemukan.' }
    LOCAL_USERS.splice(idx, 1)
    return { success: true, message: 'User berhasil dihapus.' }
  }

  // --- API MODE ---
  // DELETE /api/users/:id
  const data = await api.delete(`/api/users/${userId}`)
  return data
}
