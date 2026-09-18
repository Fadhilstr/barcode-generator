/**
 * scan.service.js — Service Layer Scan Event
 *
 * Semua operasi scan event (pengindaian barcode resi) ada di sini.
 *
 * MODE LOCAL (VITE_USE_LOCAL_DATA=true):
 *   Menggunakan data dummy array lokal + validasi duplikasi lokal.
 *
 * MODE API (VITE_USE_LOCAL_DATA=false):
 *   Menggunakan HTTP calls ke backend Perl via axios.
 *   Endpoint yang dituju:
 *     GET    /api/scans                   — Ambil scan events (dengan filter)
 *     GET    /api/scans?user_id=:id       — Scan milik petugas tertentu
 *     GET    /api/scans?task_id=:id       — Scan pada task tertentu
 *     POST   /api/scans                   — Tambah scan event baru (termasuk validasi duplikat di backend)
 *     GET    /api/scans/stats/:user_id    — Statistik scan per user
 */

import api, { USE_LOCAL_DATA } from './api.js'
import { incrementTaskProgress } from './task.service.js'
import { addAuditLog } from './audit.service.js'
import { LOCAL_PAKETS } from './paket.service.js'

// =====================================================================
// LOCAL DUMMY DATA — Digunakan saat USE_LOCAL_DATA=true
// =====================================================================
export const LOCAL_SCANS = [
  // Fadhil (USR-001, TASK-001)
  {
    scan_id: 'SCN-00001',
    nomor_resi: 'GJXL8FLB',
    user_id: 'USR-001',
    user_name: 'Fadhil',
    task_id: 'TASK-001',
    waktu_scan: '28-08-2026 10:21:32',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-01',
    jenis_scan: 'INBOUND'
  },
  {
    scan_id: 'SCN-00002',
    nomor_resi: 'AB123456',
    user_id: 'USR-001',
    user_name: 'Fadhil',
    task_id: 'TASK-001',
    waktu_scan: '28-08-2026 10:22:10',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-01',
    jenis_scan: 'INBOUND'
  },
  {
    scan_id: 'SCN-00003',
    nomor_resi: 'WHN555555',
    user_id: 'USR-001',
    user_name: 'Fadhil',
    task_id: 'TASK-001',
    waktu_scan: '28-08-2026 10:23:45',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-01',
    jenis_scan: 'INBOUND'
  },

  // Budi (USR-002, TASK-002)
  {
    scan_id: 'SCN-00004',
    nomor_resi: 'XYZ123456',
    user_id: 'USR-002',
    user_name: 'Budi',
    task_id: 'TASK-002',
    waktu_scan: '28-08-2026 10:22:10',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-02',
    jenis_scan: 'INBOUND'
  },
  {
    scan_id: 'SCN-00005',
    nomor_resi: 'WHN777777',
    user_id: 'USR-002',
    user_name: 'Budi',
    task_id: 'TASK-002',
    waktu_scan: '28-08-2026 10:24:12',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-02',
    jenis_scan: 'INBOUND'
  },

  // Andi (USR-003, TASK-003)
  {
    scan_id: 'SCN-00006',
    nomor_resi: 'ABC111111',
    user_id: 'USR-003',
    user_name: 'Andi',
    task_id: 'TASK-003',
    waktu_scan: '28-08-2026 10:15:00',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-03',
    jenis_scan: 'INBOUND'
  },
  {
    scan_id: 'SCN-00007',
    nomor_resi: 'ABC222222',
    user_id: 'USR-003',
    user_name: 'Andi',
    task_id: 'TASK-003',
    waktu_scan: '28-08-2026 10:18:30',
    lokasi: 'CIPUTAT',
    status_scan: 'SUCCESS',
    device_id: 'SCAN-DEVICE-03',
    jenis_scan: 'INBOUND'
  }
]

// Helper: format datetime string lokal
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
 * Ambil daftar scan events.
 * Filter berdasarkan role user dilakukan di store (getFilteredScans getter).
 * @param {Object} filters - optional: { user_id, task_id, status_scan }
 * @returns {Promise<ScanEvent[]>}
 */
export async function getScans(filters = {}) {
  if (USE_LOCAL_DATA) {
    let result = [...LOCAL_SCANS]
    if (filters.user_id) result = result.filter((s) => s.user_id === filters.user_id)
    if (filters.task_id) result = result.filter((s) => s.task_id === filters.task_id)
    if (filters.status_scan) result = result.filter((s) => s.status_scan === filters.status_scan)
    return result
  }

  // --- API MODE ---
  // GET /api/scans?user_id=&task_id=&status_scan=
  const data = await api.get('/api/scans', { params: filters })
  return data.scans || []
}

/**
 * Tambah scan event baru (proses utama pengindaian barcode).
 * Validasi duplikasi dilakukan:
 *   - LOCAL MODE: di sini secara langsung
 *   - API MODE: di backend Perl (response status_scan: 'DUPLICATE' jika duplikat)
 *
 * @param {Object} params
 * @param {string} params.resi - Nomor resi / barcode yang discan
 * @param {Object} params.currentUser - User yang sedang login
 * @param {Object} params.activeTask - Task aktif saat ini
 * @param {string} params.lokasi - Lokasi gerai
 * @param {string} params.device_id - ID device scanner
 * @param {string} params.jenis_scan - INBOUND | OUTBOUND | SORTING
 * @returns {Promise<{success, reason, message, scan}>}
 */
export async function addScan({ resi, currentUser, activeTask, lokasi = 'CIPUTAT', device_id = 'SCAN-DEVICE-01', jenis_scan = 'INBOUND', barcode_format = null, decode_duration = null }) {
  let sanitizedResi = (resi || '').trim().toUpperCase()

  // Normalisasi reverse mapping jika ada
  const mapped = typeof localStorage !== 'undefined' ? (localStorage.getItem(`barcode_mapping_${sanitizedResi}`) || localStorage.getItem(`barcode_mapping_${resi}`)) : null
  if (mapped) {
    sanitizedResi = mapped.toUpperCase()
  } else {
    // Normalisasi format GS1 jika decoder menyisipkan (01)
    if (sanitizedResi.startsWith('(01)')) {
      sanitizedResi = sanitizedResi.replace(/^\(01\)/, '')
    } else if (sanitizedResi.startsWith('01') && sanitizedResi.length >= 16) {
      sanitizedResi = sanitizedResi.slice(2)
    }
  }

  // Validasi: Barcode kosong
  if (!sanitizedResi) {
    return { success: false, reason: 'EMPTY', message: 'Nomor resi tidak boleh kosong.' }
  }

  // Validasi: Task harus aktif
  if (!activeTask || activeTask.status === 'SELESAI') {
    return { success: false, reason: 'FINISHED', message: 'Task sudah selesai dan tidak dapat melakukan scan.' }
  }

  // --- DETEKSI KONEKSI OFFLINE HARDWARE/BROWSER ---
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

  if (isOffline) {
    try {
      const { savePendingScan, getCachedPaketByResi } = await import('../utils/offlineDb.js')

      // Cek cache resi jika ada
      const cachedPaket = await getCachedPaketByResi(sanitizedResi)
      if (cachedPaket && cachedPaket.status === 'DRAFT') {
        return {
          success: false,
          reason: 'DRAFT',
          message: `[OFFLINE] Nomor resi ${sanitizedResi} masih DRAFT (data barang belum diisi).`
        }
      }

      await savePendingScan({
        nomor_resi: sanitizedResi,
        user_id: currentUser.id,
        user_name: currentUser.name,
        task_id: activeTask.task_id,
        lokasi,
        device_id,
        jenis_scan
      })

      return {
        success: true,
        offline: true,
        resi: sanitizedResi,
        status_scan: 'SUCCESS_OFFLINE',
        message: `[⚡ OFFLINE MODE] Resi ${sanitizedResi} berhasil disimpan di HP. Akan di-sync saat online.`,
        scan: {
          scan_id: `LOCAL-OFFLINE`,
          nomor_resi: sanitizedResi,
          user_id: currentUser.id,
          user_name: currentUser.name,
          task_id: activeTask.task_id,
          waktu_scan: new Date().toLocaleString(),
          lokasi,
          status_scan: 'SUCCESS',
          device_id,
          jenis_scan
        }
      }
    } catch (dbErr) {
      console.error('[OFFLINE_DB_ERROR]', dbErr)
    }
  }

  if (USE_LOCAL_DATA) {
    // --- LOCAL MODE ---
    // Validasi ketat (paritas dengan backend): hanya resi TERDAFTAR di
    // tabel paket yang boleh discan — resi asing / DRAFT ditolak & tidak dicatat.
    const paketTerdaftar = LOCAL_PAKETS.find((p) => p.nomor_resi.toUpperCase() === sanitizedResi)
    if (!paketTerdaftar) {
      await addAuditLog({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: 'SCAN_REJECTED',
        details: `Resi: ${sanitizedResi}, Status: UNKNOWN_RESI`
      })
      return {
        success: false,
        reason: 'UNKNOWN_RESI',
        message: `Nomor resi ${sanitizedResi} tidak terdaftar. Pastikan customer sudah membuat resi.`
      }
    }
    if (paketTerdaftar.status !== 'TERDAFTAR') {
      await addAuditLog({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: 'SCAN_REJECTED',
        details: `Resi: ${sanitizedResi}, Status: DRAFT`
      })
      return {
        success: false,
        reason: 'DRAFT',
        message: `Nomor resi ${sanitizedResi} masih DRAFT — data barang belum disimpan customer.`
      }
    }

    // --- validasi duplikasi ---
    const isDuplicate = LOCAL_SCANS.some(
      (evt) =>
        evt.task_id === activeTask.task_id &&
        evt.nomor_resi.toUpperCase() === sanitizedResi &&
        evt.status_scan === 'SUCCESS'
    )

    if (isDuplicate) {
      await addAuditLog({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: 'SCAN_DUPLICATE',
        details: `Resi: ${sanitizedResi}, Status: DUPLICATE`
      })

      return {
        success: false,
        reason: 'DUPLICATE',
        message: `Nomor resi ${sanitizedResi} sudah pernah discan.`
      }
    }

    const newScan = {
      scan_id: `SCN-${String(LOCAL_SCANS.length + 1).padStart(5, '0')}`,
      nomor_resi: sanitizedResi,
      user_id: currentUser.id,
      user_name: currentUser.name,
      task_id: activeTask.task_id,
      waktu_scan: nowString(),
      lokasi,
      status_scan: 'SUCCESS',
      device_id,
      jenis_scan
    }

    LOCAL_SCANS.unshift(newScan)

    await addAuditLog({
      user_id: currentUser.id,
      user_name: currentUser.name,
      action: 'SCAN_EVENT_CREATED',
      details: `Resi: ${sanitizedResi}, Status: SUCCESS`
    })

    // Increment task progress
    await incrementTaskProgress(activeTask.task_id)

    return {
      success: true,
      resi: sanitizedResi,
      message: `Nomor resi ${sanitizedResi} berhasil discan.`,
      scan: { ...newScan }
    }
  }

  // --- API MODE ---
  // POST /api/scans
  // Backend Perl menangani validasi resi terdaftar, duplikasi,
  // dan increment progress secara transaksional di database.
  // Response: { success, status_scan, reason?, scan?, message }
  try {
    const data = await api.post('/api/scans', {
      nomor_resi: sanitizedResi,
      user_id: currentUser.id,
      user_name: currentUser.name,
      task_id: activeTask.task_id,
      lokasi,
      device_id,
      jenis_scan,
      barcode_format,
      decode_duration
    })

    // Resi tidak terdaftar / masih DRAFT — ditolak backend sebelum dicatat
    if (data.reason === 'UNKNOWN_RESI' || data.reason === 'DRAFT') {
      return {
        success: false,
        reason: data.reason,
        message: data.message || `Nomor resi ${sanitizedResi} tidak dapat discan.`
      }
    }

    if (data.status_scan === 'DUPLICATE') {
      return {
        success: false,
        reason: 'DUPLICATE',
        message: data.message || `Nomor resi ${sanitizedResi} sudah pernah discan.`,
        scan: data.scan
      }
    }

    return {
      success: true,
      resi: sanitizedResi,
      message: data.message || `Nomor resi ${sanitizedResi} berhasil discan.`,
      scan: data.scan
    }
  } catch (err) {
    // FALLBACK NETWORK ERROR (Koneksi putus saat request berjalan): Simpan ke IndexedDB!
    if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      try {
        const { savePendingScan } = await import('../utils/offlineDb')
        await savePendingScan({
          nomor_resi: sanitizedResi,
          user_id: currentUser.id,
          user_name: currentUser.name,
          task_id: activeTask.task_id,
          lokasi,
          device_id,
          jenis_scan
        })

        return {
          success: true,
          offline: true,
          resi: sanitizedResi,
          status_scan: 'SUCCESS_OFFLINE',
          message: `[⚡ OFFLINE MODE] Koneksi ke server terputus. Resi ${sanitizedResi} tersimpan di HP.`,
          scan: {
            scan_id: `LOCAL-OFFLINE`,
            nomor_resi: sanitizedResi,
            user_id: currentUser.id,
            user_name: currentUser.name,
            task_id: activeTask.task_id,
            waktu_scan: new Date().toLocaleString(),
            lokasi,
            status_scan: 'SUCCESS',
            device_id,
            jenis_scan
          }
        }
      } catch (dbErr) {
        console.error('[OFFLINE_DB_FALLBACK_ERROR]', dbErr)
      }
    }

    return { success: false, reason: 'ERROR', message: err.message || 'Gagal mengirim scan event.' }
  }
}

/**
 * Ambil statistik scan per user (total, success, duplicate, lastScan).
 * @param {string} userId
 * @returns {Promise<{total, success, duplicate, lastScan}>}
 */
export async function getUserScanStats(userId) {
  if (USE_LOCAL_DATA) {
    const userScans = LOCAL_SCANS.filter((s) => s.user_id === userId)
    const success = userScans.filter((s) => s.status_scan === 'SUCCESS').length
    const duplicate = userScans.filter((s) => s.status_scan === 'DUPLICATE').length
    const lastScan = userScans.length > 0 ? userScans[0].waktu_scan : '-'
    return { total: success, success, duplicate, lastScan }
  }

  // --- API MODE ---
  // GET /api/scans/stats/:user_id
  const data = await api.get(`/api/scans/stats/${userId}`)
  return data.stats || { total: 0, success: 0, duplicate: 0, lastScan: '-' }
}
