/**
 * boot/init-stores.js — Inisialisasi awal semua Pinia Store
 *
 * Boot file ini dijalankan SEBELUM aplikasi Vue dimount.
 *
 * MODE LOCAL (VITE_USE_LOCAL_DATA=true):
 *   Semua store diisi dari data dummy agar UI langsung siap dipakai.
 *
 * MODE API (VITE_USE_LOCAL_DATA=false):
 *   Tidak ada prefetch saat boot (belum ada sesi).
 *   Data diambil otomatis SETELAH login sukses — lihat authStore.login()/quickLogin().
 */

import { useAuthStore } from 'src/stores/authStore'
import { useTaskStore } from 'src/stores/taskStore'
import { useScanStore } from 'src/stores/scanStore'
import { USE_LOCAL_DATA } from 'src/services/api'

export default async () => {
  const authStore = useAuthStore()
  const taskStore = useTaskStore()
  const scanStore = useScanStore()

  if (USE_LOCAL_DATA) {
    await Promise.all([
      authStore.fetchUsers(),
      taskStore.fetchTasks(),
      scanStore.fetchScans()
    ])
  } else if (authStore.isLoggedIn) {
    try {
      await authStore.prefetchOperationalData()
    } catch (e) {
      console.warn('[BOOT] Gagal sinkronisasi data sesi:', e)
    }
  }
}
