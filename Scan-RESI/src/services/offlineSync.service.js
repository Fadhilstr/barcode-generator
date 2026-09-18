/**
 * offlineSync.service.js — Service Sinkronisasi Otomatis Mode Offline
 *
 * Mengelola deteksi status koneksi internet (online/offline) dan
 * mengunggah antrean scan yang tersimpan di IndexedDB ke backend.
 */

import { getPendingScans, removePendingScan, countPendingScans } from '../utils/offlineDb.js'
import api, { USE_LOCAL_DATA } from './api.js'
import { LOCAL_SCANS } from './scan.service.js'

let isSyncing = false

/**
 * Eksekusi sinkronisasi antrean scan offline ke backend Perl / MariaDB
 * @param {Function} onProgressCallback - optional callback (syncedCount, totalCount)
 * @returns {Promise<{success: boolean, synced: number, failed: number, message: string}>}
 */
export async function syncPendingScans(onProgressCallback = null) {
  if (isSyncing) {
    return { success: false, synced: 0, failed: 0, message: 'Proses sinkronisasi sedang berjalan.' }
  }

  const pending = await getPendingScans()
  if (!pending || pending.length === 0) {
    return { success: true, synced: 0, failed: 0, message: 'Tidak ada antrean scan offline.' }
  }

  isSyncing = true
  let synced = 0
  let failed = 0

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]

    try {
      if (USE_LOCAL_DATA) {
        // --- LOCAL DUMMY MODE ---
        const newScan = {
          scan_id: `SCN-OFFLINE-${String(item.local_id).padStart(4, '0')}`,
          nomor_resi: item.nomor_resi,
          user_id: item.user_id,
          user_name: item.user_name || 'Petugas Offline',
          task_id: item.task_id,
          waktu_scan: item.waktu_scan || new Date().toLocaleString(),
          lokasi: item.lokasi || 'CIPUTAT',
          status_scan: 'SUCCESS',
          device_id: item.device_id || 'SCAN-DEVICE-OFFLINE',
          jenis_scan: item.jenis_scan || 'INBOUND'
        }
        LOCAL_SCANS.unshift(newScan)
        await removePendingScan(item.local_id)
        synced++
      } else {
        // --- API MODE ---
        // POST /api/scans
        const response = await api.post('/api/scans', {
          nomor_resi: item.nomor_resi,
          user_id: item.user_id,
          user_name: item.user_name,
          task_id: item.task_id,
          lokasi: item.lokasi,
          device_id: item.device_id,
          jenis_scan: item.jenis_scan
        })

        if (response && (response.success || response.status_scan)) {
          // Berhasil terkirim (SUCCESS atau DUPLICATE sudah dicatat di backend)
          await removePendingScan(item.local_id)
          synced++
        } else {
          failed++
        }
      }

      if (onProgressCallback) {
        onProgressCallback(synced, pending.length)
      }
    } catch (err) {
      console.warn(`[OFFLINE_SYNC] Gagal mengunggah resi ${item.nomor_resi}:`, err.message)
      failed++
    }
  }

  isSyncing = false
  const remaining = await countPendingScans()

  return {
    success: synced > 0,
    synced,
    failed,
    remaining,
    message: `Berhasil mengunggah ${synced} data scan offline ke server.${failed > 0 ? ` (${failed} gagal)` : ''}`
  }
}

/**
 * Setup listener perubahan status jaringan browser
 * @param {Function} onStatusChange - callback (isOnline)
 */
export function setupNetworkListeners(onStatusChange) {
  const handleOnline = () => {
    console.log('[NETWORK] Internet terhubung kembali (Online).')
    if (onStatusChange) onStatusChange(true)
  }

  const handleOffline = () => {
    console.log('[NETWORK] Koneksi internet terputus (Offline Mode).')
    if (onStatusChange) onStatusChange(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
