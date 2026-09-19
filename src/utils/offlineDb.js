/**
 * offlineDb.js — IndexedDB Engine untuk Mode Offline Scan-RESI
 *
 * Menggunakan Web Native IndexedDB API tanpa dependensi eksternal.
 * Database Name: WahanaScanOfflineDB
 * Version: 1
 * Stores:
 *   - pending_scans : Antrean event scan yang belum ter-sync ke backend
 *   - cached_paket  : Snapshot list paket terdaftar untuk validasi offline
 *   - cached_tasks  : Snapshot task aktif milik petugas
 */

const DB_NAME = 'WahanaScanOfflineDB'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Browser ini tidak mendukung IndexedDB.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Store 1: pending_scans (Key: local_id autoIncrement)
      if (!db.objectStoreNames.contains('pending_scans')) {
        const scanStore = db.createObjectStore('pending_scans', {
          keyPath: 'local_id',
          autoIncrement: true
        })
        scanStore.createIndex('task_id', 'task_id', { unique: false })
        scanStore.createIndex('nomor_resi', 'nomor_resi', { unique: false })
        scanStore.createIndex('created_at', 'created_at', { unique: false })
      }

      // Store 2: cached_paket (Key: nomor_resi)
      if (!db.objectStoreNames.contains('cached_paket')) {
        db.createObjectStore('cached_paket', { keyPath: 'nomor_resi' })
      }

      // Store 3: cached_tasks (Key: task_id)
      if (!db.objectStoreNames.contains('cached_tasks')) {
        db.createObjectStore('cached_tasks', { keyPath: 'task_id' })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

// =====================================================================
// PENDING SCANS OPERATIONS
// =====================================================================

/**
 * Simpan event scan baru ke antrean offline IndexedDB
 */
export async function savePendingScan(scanData) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_scans', 'readwrite')
    const store = tx.objectStore('pending_scans')

    const item = {
      ...scanData,
      created_at: new Date().toISOString(),
      synced: 0
    }

    const req = store.add(item)
    req.onsuccess = () => resolve(req.result) // returns local_id
    req.onerror = (e) => reject(e.target.error)
  })
}

/**
 * Ambil semua antrean scan offline yang belum ter-sync
 */
export async function getPendingScans() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_scans', 'readonly')
    const store = tx.objectStore('pending_scans')
    const req = store.getAll()

    req.onsuccess = () => resolve(req.result || [])
    req.onerror = (e) => reject(e.target.error)
  })
}

/**
 * Hapus item scan offline dari antrean setelah berhasil di-sync ke backend
 */
export async function removePendingScan(localId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_scans', 'readwrite')
    const store = tx.objectStore('pending_scans')
    const req = store.delete(localId)

    req.onsuccess = () => resolve(true)
    req.onerror = (e) => reject(e.target.error)
  })
}

/**
 * Hitung jumlah antrean scan offline
 */
export async function countPendingScans() {
  const scans = await getPendingScans()
  return scans.length
}

// =====================================================================
// CACHED PAKET OPERATIONS
// =====================================================================

/**
 * Cache snapshot paket terdaftar untuk validasi offline
 */
export async function cachePaketList(paketList) {
  if (!Array.isArray(paketList) || paketList.length === 0) return
  const db = await openDB()
  const tx = db.transaction('cached_paket', 'readwrite')
  const store = tx.objectStore('cached_paket')

  for (const p of paketList) {
    if (p.nomor_resi) {
      store.put({
        nomor_resi: p.nomor_resi.toUpperCase(),
        nama_barang: p.nama_barang,
        status: p.status,
        updated_at: new Date().toISOString()
      })
    }
  }
}

/**
 * Cari paket di cache IndexedDB berdasarkan nomor resi
 */
export async function getCachedPaketByResi(resi) {
  if (!resi) return null
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('cached_paket', 'readonly')
    const store = tx.objectStore('cached_paket')
    const req = store.get(resi.toUpperCase())

    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

// =====================================================================
// CACHED TASKS OPERATIONS
// =====================================================================

/**
 * Cache list task aktif petugas
 */
export async function cacheTaskList(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return
  const db = await openDB()
  const tx = db.transaction('cached_tasks', 'readwrite')
  const store = tx.objectStore('cached_tasks')

  for (const t of tasks) {
    if (t.task_id) {
      store.put(t)
    }
  }
}
