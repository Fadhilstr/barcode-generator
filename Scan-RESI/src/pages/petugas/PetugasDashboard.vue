<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <!-- Greeting Header (Requirement Q) -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="page-title">Selamat datang, {{ authStore.currentUser?.name }}</h4>
        <div class="page-subtitle">Dashboard operasional petugas pemindaian paket</div>
      </div>

      <div>
        <q-btn
          color="primary"
          size="lg"
          icon="qr_code_scanner"
          label="Mulai Scan"
          no-caps
          to="/petugas/scan"
          unelevated
          :disabled="!activeTask || activeTask.status === 'SELESAI'"
        />
      </div>
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Active Task Card Overview (Requirement Q) -->
    <div class="row q-col-gutter-md q-mb-xl">
      <div class="col-12 col-md-8">
        <q-card class="scan-card q-pa-md">
          <q-card-section>
            <div class="row items-center justify-between q-mb-sm">
              <div class="section-title">
                <q-icon name="assignment" size="20px" color="primary" class="q-mr-sm" />
                Task Aktif
              </div>
              <StatusBadge :status="activeTask?.status || 'SELESAI'" size="md" />
            </div>

            <div v-if="activeTask" class="q-mt-md">
              <div class="text-h6 font-mono text-weight-bold text-slate-900 q-mb-md">
                {{ activeTask.task_id }}
              </div>

              <div class="row q-col-gutter-sm text-center q-mb-md">
                <div class="col-4 bg-grey-1 q-pa-sm" style="border-radius: 10px; border: 1px solid var(--dj-border);">
                  <div class="overline-label">Target</div>
                  <div class="kpi-value text-slate-900 font-mono">{{ activeTask.target }}</div>
                </div>

                <div class="col-4 bg-grey-1 q-pa-sm" style="border-radius: 10px; border: 1px solid var(--dj-border);">
                  <div class="overline-label">Progress</div>
                  <div class="kpi-value text-primary font-mono">{{ activeTask.progress }} / {{ activeTask.target }}</div>
                </div>

                <div class="col-4 bg-grey-1 q-pa-sm" style="border-radius: 10px; border: 1px solid var(--dj-border);">
                  <div class="overline-label">Total Scan</div>
                  <div class="kpi-value text-positive font-mono">{{ userStats.total }}</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <q-linear-progress
                :value="activeTask.progress / activeTask.target"
                color="primary"
                track-color="blue-grey-1"
                size="10px"
                style="border-radius: 5px;"
                class="q-mb-xs"
              />
              <div class="row justify-between text-caption text-grey-6">
                <span>Shift {{ activeTask.shift }} &middot; {{ activeTask.lokasi }}</span>
                <span>Capaian {{ Math.round((activeTask.progress / activeTask.target) * 100) }}%</span>
              </div>
            </div>

            <div v-else class="text-center q-pa-lg text-grey-6">
              Tidak ada task aktif saat ini.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Quick Stats Card -->
      <div class="col-12 col-md-4">
        <q-card class="scan-card full-height q-pa-md">
          <q-card-section>
            <div class="section-title q-mb-md">
              <q-icon name="insights" size="20px" color="primary" class="q-mr-sm" /> Statistik Saya
            </div>

            <div class="column q-gutter-y-sm">
              <div class="row justify-between items-center bg-grey-1 q-pa-sm" style="border-radius: 10px;">
                <span class="text-grey-7">Scan berhasil</span>
                <q-badge color="green-1" text-color="positive" class="text-weight-bold">{{ userStats.success }}</q-badge>
              </div>

              <div class="row justify-between items-center bg-grey-1 q-pa-sm" style="border-radius: 10px;">
                <span class="text-grey-7">Scan duplikat</span>
                <q-badge color="amber-2" text-color="amber-9" class="text-weight-bold">{{ userStats.duplicate }}</q-badge>
              </div>

              <div class="row justify-between items-center bg-grey-1 q-pa-sm" style="border-radius: 10px;">
                <span class="text-grey-7">Terakhir scan</span>
                <span class="font-mono text-weight-medium text-slate-900">{{ userStats.lastScan }}</span>
              </div>
            </div>
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
import StatusBadge from '../../components/StatusBadge.vue'

const authStore = useAuthStore()
const taskStore = useTaskStore()
const scanStore = useScanStore()

const activeTask = computed(() => {
  if (!authStore.currentUser) return null
  return taskStore.getActiveTaskForUser(authStore.currentUser.id)
})

const userStats = computed(() => {
  if (!authStore.currentUser) return { total: 0, success: 0, duplicate: 0, lastScan: '-' }
  return scanStore.getUserScanStats(authStore.currentUser.id)
})
</script>
