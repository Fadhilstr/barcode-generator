/**
 * task.service.js — Service Layer Manajemen Task / Batch
 *
 * Semua operasi task/batch ada di sini.
 *
 * MODE LOCAL (VITE_USE_LOCAL_DATA=true):
 *   Menggunakan data dummy array lokal.
 *
 * MODE API (VITE_USE_LOCAL_DATA=false):
 *   Menggunakan HTTP calls ke backend Perl via axios.
 *   Endpoint yang dituju:
 *     GET    /api/tasks               — Semua task (dengan optional filter)
 *     GET    /api/tasks?user_id=:id   — Task milik petugas tertentu
 *     POST   /api/tasks               — Buat task baru
 *     PATCH  /api/tasks/:id/progress  — Increment progress (+1)
 *     PATCH  /api/tasks/:id/complete  — Selesaikan task
 */

import api, { USE_LOCAL_DATA } from './api.js'
import { addAuditLog } from './audit.service.js'

// =====================================================================
// LOCAL DUMMY DATA — Digunakan saat USE_LOCAL_DATA=true
// =====================================================================
export const LOCAL_TASKS = [
  {
    task_id: 'TASK-001',
    user_id: 'USR-001',
    user_name: 'Fadhil',
    shift: 'Pagi',
    tanggal: '28-08-2026',
    target: 100,
    progress: 3,
    status: 'PROSES_SCAN', // DRAFT | PROSES_SCAN | SELESAI
    lokasi: 'CIPUTAT'
  },
  {
    task_id: 'TASK-002',
    user_id: 'USR-002',
    user_name: 'Budi',
    shift: 'Pagi',
    tanggal: '28-08-2026',
    target: 80,
    progress: 2,
    status: 'PROSES_SCAN',
    lokasi: 'CIPUTAT'
  },
  {
    task_id: 'TASK-003',
    user_id: 'USR-003',
    user_name: 'Andi',
    shift: 'Pagi',
    tanggal: '28-08-2026',
    target: 120,
    progress: 2,
    status: 'PROSES_SCAN',
    lokasi: 'CIPUTAT'
  }
]

// =====================================================================
// SERVICE FUNCTIONS
// =====================================================================

/**
 * Ambil daftar task.
 * @param {Object} filters - optional: { user_id, status }
 * @returns {Promise<Task[]>}
 */
export async function getTasks(filters = {}) {
  if (USE_LOCAL_DATA) {
    let result = [...LOCAL_TASKS]
    if (filters.user_id) result = result.filter((t) => t.user_id === filters.user_id)
    if (filters.status) result = result.filter((t) => t.status === filters.status)
    return result
  }

  // --- API MODE ---
  // GET /api/tasks?user_id=&status=
  const params = {}
  if (filters.user_id) params.user_id = filters.user_id
  if (filters.status) params.status = filters.status
  const data = await api.get('/api/tasks', { params })
  return data.tasks || []
}

// Helper: format tanggal dd-mm-yyyy (konsisten dengan seluruh data dummy)
const todayString = () => {
  const now = new Date()
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${d}-${m}-${now.getFullYear()}`
}

/**
 * Buat task baru.
 * @returns {Promise<{success, task}>}
 */
export async function createTask(newTaskData) {
  if (USE_LOCAL_DATA) {
    const newId = `TASK-${String(LOCAL_TASKS.length + 1).padStart(3, '0')}`
    const taskObj = {
      task_id: newId,
      user_id: newTaskData.user_id,
      user_name: newTaskData.user_name,
      shift: newTaskData.shift || 'Pagi',
      tanggal: newTaskData.tanggal || todayString(),
      target: Number(newTaskData.target) || 100,
      progress: 0,
      status: 'PROSES_SCAN',
      lokasi: newTaskData.lokasi || 'CIPUTAT'
    }
    LOCAL_TASKS.unshift(taskObj)
    return { success: true, task: { ...taskObj } }
  }

  // --- API MODE ---
  // POST /api/tasks
  const data = await api.post('/api/tasks', newTaskData)
  return { success: true, task: data.task }
}

/**
 * Increment progress task sebanyak 1.
 * @param {string} taskId
 * @returns {Promise<{success}>}
 */
export async function incrementTaskProgress(taskId) {
  if (USE_LOCAL_DATA) {
    const task = LOCAL_TASKS.find((t) => t.task_id === taskId)
    if (task) task.progress += 1
    return { success: true }
  }

  // --- API MODE ---
  // PATCH /api/tasks/:id/progress
  await api.patch(`/api/tasks/${taskId}/progress`)
  return { success: true }
}

/**
 * Selesaikan task (ubah status menjadi SELESAI).
 * @param {string} taskId
 * @returns {Promise<{success, message}>}
 */
export async function completeTask(taskId) {
  if (USE_LOCAL_DATA) {
    const task = LOCAL_TASKS.find((t) => t.task_id === taskId)
    if (!task) return { success: false, message: 'Task tidak ditemukan.' }
    task.status = 'SELESAI'

    await addAuditLog({
      user_id: task.user_id,
      user_name: task.user_name,
      action: 'TASK_COMPLETED',
      details: `Task ${taskId} diselesaikan (${task.progress}/${task.target}).`
    })

    return { success: true, message: `Task ${taskId} berhasil diselesaikan.` }
  }

  // --- API MODE ---
  // PATCH /api/tasks/:id/complete
  const data = await api.patch(`/api/tasks/${taskId}/complete`)
  return { success: true, message: data.message }
}
