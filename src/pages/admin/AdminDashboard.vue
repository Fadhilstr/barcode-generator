<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="page-title">Dashboard Admin</h4>
        <div class="page-subtitle">Monitoring operasional seluruh sistem scan Dijak Express</div>
      </div>

      <div class="row q-gutter-sm">
        <q-btn
          color="primary"
          icon="display_settings"
          label="Monitoring Scan"
          no-caps
          to="/admin/monitoring"
          unelevated
        />
        <q-btn
          outline
          color="primary"
          icon="manage_accounts"
          label="User Management"
          no-caps
          to="/admin/users"
        />
      </div>
    </div>

    <!-- Admin Metric Stat Cards (100% Real Database Dynamic Metrics) -->
    <div class="row q-col-gutter-md q-mb-xl">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card q-pa-md">
          <q-card-section class="q-pa-none">
            <div class="row items-center justify-between q-mb-sm">
              <span class="overline-label">Total Petugas</span>
              <q-avatar icon="badge" color="blue-1" text-color="primary" size="36px" style="border-radius: 10px;" />
            </div>
            <div class="kpi-value text-slate-900 font-mono">{{ totalPetugas }}</div>
            <div class="text-caption text-positive text-weight-medium q-mt-xs row items-center">
              <q-icon name="circle" size="7px" class="q-mr-xs" /> {{ onlinePetugas }} online &middot; {{ offlinePetugas }} offline
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card q-pa-md">
          <q-card-section class="q-pa-none">
            <div class="row items-center justify-between q-mb-sm">
              <span class="overline-label">Total Task</span>
              <q-avatar icon="assignment" color="amber-2" text-color="amber-9" size="36px" style="border-radius: 10px;" />
            </div>
            <div class="kpi-value text-slate-900 font-mono">{{ totalTasks }}</div>
            <div class="text-caption text-grey-6 q-mt-xs">{{ activeTasks }} aktif &middot; {{ completedTasks }} selesai</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card q-pa-md">
          <q-card-section class="q-pa-none">
            <div class="row items-center justify-between q-mb-sm">
              <span class="overline-label">Total Scan</span>
              <q-avatar icon="qr_code_scanner" color="green-1" text-color="positive" size="36px" style="border-radius: 10px;" />
            </div>
            <div class="kpi-value text-slate-900 font-mono">{{ totalScans.toLocaleString('id-ID') }}</div>
            <div class="text-caption text-grey-6 q-mt-xs">{{ todayScans }} scan hari ini</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card q-pa-md">
          <q-card-section class="q-pa-none">
            <div class="row items-center justify-between q-mb-sm">
              <span class="overline-label">Total Paket</span>
              <q-avatar icon="inventory_2" color="purple-1" text-color="purple-8" size="36px" style="border-radius: 10px;" />
            </div>
            <div class="kpi-value text-slate-900 font-mono">{{ totalPaket.toLocaleString('id-ID') }}</div>
            <div class="text-caption text-grey-6 q-mt-xs">{{ terdaftarPaket }} terdaftar &middot; {{ draftPaket }} draft</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Active Tasks Overview & System Live Scan -->
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card class="scan-card full-height">
          <q-card-section class="row items-center justify-between">
            <div class="section-title">
              <q-icon name="task" size="20px" color="primary" class="q-mr-sm" />
              Task Aktif Saat Ini
            </div>
            <q-btn flat dense no-caps label="Lihat semua" color="primary" to="/admin/tasks" />
          </q-card-section>

          <q-separator />

          <q-card-section class="column q-gutter-y-sm">
            <div v-if="taskStore.allTasks.length === 0" class="text-center text-grey-6 q-pa-lg">
              <q-icon name="task_alt" size="32px" class="q-mb-xs" />
              <div>Belum ada task yang dibuat</div>
            </div>
            <TaskCard v-for="t in taskStore.allTasks" :key="t.task_id" :task="t" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card class="scan-card full-height">
          <q-card-section class="row items-center justify-between">
            <div class="section-title">
              <q-icon name="history" size="20px" color="primary" class="q-mr-sm" />
              Aktivitas Scan Terakhir
            </div>
            <q-btn flat dense no-caps label="Monitoring" color="primary" to="/admin/monitoring" />
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div v-if="recentScans.length === 0" class="text-center text-grey-6 q-pa-lg">
              <q-icon name="qr_code_scanner" size="32px" class="q-mb-xs" />
              <div>Belum ada aktivitas scan</div>
            </div>
            <q-list v-else class="q-gutter-y-xs">
              <q-item v-for="scan in recentScans" :key="scan.scan_id" class="bg-slate-50 rounded-borders q-pa-xs">
                <q-item-section avatar>
                  <q-avatar color="wahana-navy" text-color="amber-4" size="32px" class="font-mono text-caption text-weight-bold">
                    {{ (scan.user_name || 'P').slice(0, 1) }}
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="font-mono text-weight-bolder text-slate-900">
                    {{ scan.nomor_resi }}
                  </q-item-label>
                  <q-item-label caption>
                    By {{ scan.user_name || scan.user_id }} &bull; {{ scan.task_id }} &bull; {{ scan.lokasi }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <StatusBadge :status="scan.status_scan" size="xs" />
                  <div class="text-caption font-mono text-grey-6 q-mt-xs">{{ (scan.waktu_scan || '').split(' ')[1] || '-' }}</div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import { useScanStore } from '../../stores/scanStore'
import { usePaketStore } from '../../stores/paketStore'
import StatusBadge from '../../components/StatusBadge.vue'
import TaskCard from '../../components/TaskCard.vue'

const authStore = useAuthStore()
const taskStore = useTaskStore()
const scanStore = useScanStore()
const paketStore = usePaketStore()

// 1. Metrik Petugas Dinamis
const totalPetugas = computed(() => {
  return authStore.users.filter((u) => u.role === 'PETUGAS_SCAN').length
})
const onlinePetugas = computed(() => {
  return authStore.users.filter((u) => u.role === 'PETUGAS_SCAN' && u.status === 'ONLINE').length
})
const offlinePetugas = computed(() => {
  return authStore.users.filter((u) => u.role === 'PETUGAS_SCAN' && u.status !== 'ONLINE').length
})

// 2. Metrik Task Dinamis
const totalTasks = computed(() => {
  return taskStore.allTasks.length
})
const activeTasks = computed(() => {
  return taskStore.allTasks.filter((t) => t.status === 'PROSES_SCAN' || t.status === 'DRAFT').length
})
const completedTasks = computed(() => {
  return taskStore.allTasks.filter((t) => t.status === 'SELESAI').length
})

// 3. Metrik Scan Dinamis
const totalScans = computed(() => {
  return scanStore.scanEvents.length
})
const todayScans = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return scanStore.scanEvents.filter((s) => s.waktu_scan && s.waktu_scan.startsWith(today)).length
})

// 4. Metrik Paket Dinamis
const totalPaket = computed(() => {
  return paketStore.pakets.length
})
const terdaftarPaket = computed(() => {
  return paketStore.pakets.filter((p) => p.status === 'TERDAFTAR').length
})
const draftPaket = computed(() => {
  return paketStore.pakets.filter((p) => p.status === 'DRAFT').length
})

// 5. Riwayat 5 scan terakhir
const recentScans = computed(() => {
  return scanStore.scanEvents.slice(0, 5)
})
</script>
