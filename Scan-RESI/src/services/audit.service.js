/**
 * audit.service.js — Service Layer Audit Log
 *
 * MODE LOCAL (VITE_USE_LOCAL_DATA=true):
 *   Event audit dicatat ke array lokal (in-memory) dan dibaca dari sana.
 *
 * MODE API (VITE_USE_LOCAL_DATA=false):
 *   Pencatatan dilakukan SERVER-SIDE oleh backend Perl
 *   (login, scan, complete task → otomatis insert ke tabel AUDIT_LOGS).
 *   Frontend hanya MEMBACA via GET /api/audit-logs.
 */

import api, { USE_LOCAL_DATA } from './api.js'

// =====================================================================
// LOCAL DUMMY DATA — seed awal agar halaman Audit Log tidak kosong
// =====================================================================
let LOCAL_AUDIT_LOGS = [
  {
    log_id: 3,
    user_id: 'USR-002',
    user_name: 'Budi',
    action: 'LOGIN_SUCCESS',
    details: 'Login berhasil.',
    ip_address: '192.168.3.102 (demo)',
    created_at: '28-08-2026 09:45:00'
  },
  {
    log_id: 2,
    user_id: 'USR-001',
    user_name: 'Fadhil',
    action: 'SCAN_EVENT_CREATED',
    details: 'Resi: GJXL8FLB, Status: SUCCESS',
    ip_address: '192.168.3.189 (demo)',
    created_at: '28-08-2026 10:21:32'
  },
  {
    log_id: 1,
    user_id: 'USR-001',
    user_name: 'Fadhil',
    action: 'LOGIN_SUCCESS',
    details: 'Login berhasil.',
    ip_address: '192.168.3.189 (demo)',
    created_at: '28-08-2026 10:20:00'
  }
]

// Helper: format datetime string lokal (dd-mm-yyyy HH:MM:SS)
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
 * Ambil daftar audit log (terbaru lebih dulu).
 * @param {Object} filters - optional: { user_id, action }
 * @returns {Promise<AuditLog[]>}
 */
export async function getAuditLogs(filters = {}) {
  if (USE_LOCAL_DATA) {
    let result = [...LOCAL_AUDIT_LOGS]
    if (filters.user_id) result = result.filter((l) => l.user_id === filters.user_id)
    if (filters.action) result = result.filter((l) => l.action === filters.action)
    return result.sort((a, b) => b.log_id - a.log_id)
  }

  // --- API MODE ---
  // GET /api/audit-logs
  const data = await api.get('/api/audit-logs', { params: filters })
  return data.logs || []
}

/**
 * Catat satu event audit baru.
 * Hanya berfungsi di MODE LOCAL. Di MODE API pencatatan dilakukan server-side.
 *
 * @param {Object} event
 * @param {string} event.user_id
 * @param {string} event.user_name
 * @param {string} event.action   — LOGIN_SUCCESS | LOGOUT | SCAN_EVENT_CREATED |
 *                                  SCAN_DUPLICATE | TASK_COMPLETED
 * @param {string} event.details
 * @returns {Promise<{success, log}>}
 */
export async function addAuditLog(event) {
  if (!USE_LOCAL_DATA) {
    // Server mencatat otomatis; frontend tidak perlu melakukan apa pun.
    return { success: true, log: null }
  }

  const entry = {
    log_id: Math.max(0, ...LOCAL_AUDIT_LOGS.map((l) => l.log_id)) + 1,
    user_id: event.user_id || '-',
    user_name: event.user_name || '-',
    action: event.action,
    details: event.details || '',
    ip_address: '127.0.0.1 (local)',
    created_at: nowString()
  }

  LOCAL_AUDIT_LOGS.unshift(entry)
  return { success: true, log: { ...entry } }
}
