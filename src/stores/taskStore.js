/**
 * taskStore.js — Pinia Store Task / Batch
 *
 * Store ini hanya mengelola STATE (data reaktif).
 * Semua logika I/O (local data / HTTP API) didelegasikan ke task.service.js.
 *
 * Untuk switch ke backend Perl:
 *   → Ubah VITE_USE_LOCAL_DATA=false di file .env
 *   → Tidak ada perubahan di file ini maupun di komponen UI.
 */

import { defineStore } from 'pinia'
import {
  getTasks as svcGetTasks,
  createTask as svcCreateTask,
  incrementTaskProgress as svcIncrementProgress,
  completeTask as svcCompleteTask,
  LOCAL_TASKS
} from '../services/task.service.js'
import { USE_LOCAL_DATA } from '../services/api.js'

export const useTaskStore = defineStore('task', {
  state: () => ({
    // Task list (diisi via fetchTasks)
    tasks: [],

    // Loading & error state
    isLoading: false,
    error: null
  }),

  getters: {
    allTasks: (state) => state.tasks,

    // Ambil task aktif untuk petugas tertentu.
    // Hanya task berstatus PROSES_SCAN yang dianggap aktif —
    // task SELESAI tidak boleh diam-diam dipakai sebagai task aktif.
    getActiveTaskForUser: (state) => (userId) => {
      return (
        state.tasks.find((t) => t.user_id === userId && t.status === 'PROSES_SCAN') ||
        null
      )
    }
  },

  actions: {
    /**
     * Ambil semua task dari service (local/API).
     */
    async fetchTasks(filters = {}) {
      this.isLoading = true
      try {
        this.tasks = await svcGetTasks(filters)
      } catch (err) {
        this.error = err.message
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Increment progress task aktif (+1 saat scan berhasil).
     * Dipanggil oleh scan.service.js (local mode) atau otomatis oleh backend (API mode).
     * Di store ini, kita sync ulang state lokal agar UI reaktif.
     */
    async incrementTaskProgress(taskId) {
      if (USE_LOCAL_DATA) {
        // Update langsung di state (sudah diupdate di LOCAL_TASKS oleh service)
        const task = this.tasks.find((t) => t.task_id === taskId)
        if (task) task.progress += 1
      } else {
        // Setelah API call, refresh tasks dari server
        await this.fetchTasks()
      }
    },

    /**
     * Selesaikan task.
     */
    async completeTask(taskId) {
      try {
        const result = await svcCompleteTask(taskId)
        if (result.success) {
          if (USE_LOCAL_DATA) {
            // Sync dari LOCAL_TASKS (sudah diupdate oleh service)
            const taskInState = this.tasks.find((t) => t.task_id === taskId)
            if (taskInState) taskInState.status = 'SELESAI'
          } else {
            await this.fetchTasks()
          }
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      }
    },

    /**
     * Buat task baru.
     */
    async createNewTask(newTaskData) {
      this.isLoading = true
      try {
        const result = await svcCreateTask(newTaskData)
        if (result.success) {
          if (USE_LOCAL_DATA) {
            this.tasks.unshift(result.task)
          } else {
            await this.fetchTasks()
          }
        }
        return result
      } catch (err) {
        return { success: false, message: err.message }
      } finally {
        this.isLoading = false
      }
    }
  }
})
