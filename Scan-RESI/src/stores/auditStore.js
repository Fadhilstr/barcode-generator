/**
 * auditStore.js — Pinia Store Audit Log
 *
 * State reaktif untuk halaman Admin → Audit Log.
 * I/O didelegasikan ke audit.service.js.
 */

import { defineStore } from 'pinia'
import {
  getAuditLogs as svcGetAuditLogs,
  addAuditLog as svcAddAuditLog
} from '../services/audit.service'

export const useAuditStore = defineStore('audit', {
  state: () => ({
    logs: [],
    isLoading: false,
    error: null
  }),

  getters: {
    logsByAction: (state) => (action) => state.logs.filter((l) => l.action === action)
  },

  actions: {
    /**
     * Muat daftar audit log dari service (local/API).
     */
    async fetchLogs(filters = {}) {
      this.isLoading = true
      try {
        this.logs = await svcGetAuditLogs(filters)
      } catch (err) {
        this.error = err.message
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Catat event baru (hanya efek nyata di mode local).
     * Dipakai service lain (auth/scan/task) untuk menjaga konsistensi state UI.
     */
    async logEvent(payload) {
      try {
        const result = await svcAddAuditLog(payload)
        if (result.success && result.log) {
          this.logs.unshift(result.log)
        }
        return result
      } catch (err) {
        // Pencatatan audit tidak boleh menggagalkan alur utama (login/scan/task).
        console.warn('[AUDIT] Gagal mencatat event:', err.message)
        return { success: false }
      }
    }
  }
})
