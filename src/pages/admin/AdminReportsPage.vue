<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Laporan Operasional Scan</h4>
        <div class="text-subtitle2 text-grey-7">Rekapitulasi statistik volume scan, duplikasi, dan performa petugas</div>
      </div>

      <q-btn flat round dense icon="refresh" color="primary" @click="refresh">
        <q-tooltip>Muat ulang data laporan</q-tooltip>
      </q-btn>
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Metric Cards -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-md-4">
        <q-card class="scan-card q-pa-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold text-slate-800 q-mb-xs">Kualitas Pengindaian</div>
            <div class="kpi-value text-positive font-mono">{{ successRate }}%</div>
            <div class="text-caption text-grey-7">Tingkat Keberhasilan (Non-Duplicate)</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card class="scan-card q-pa-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold text-slate-800 q-mb-xs">Rasio Duplikasi</div>
            <div class="kpi-value font-mono" :class="duplicateRate > 5 ? 'text-negative' : 'text-amber-8'"> {{ duplicateRate }}%</div>
            <div class="text-caption text-grey-7">{{ stats.duplicate }} dari {{ stats.total }} scan event</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card class="scan-card q-pa-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold text-slate-800 q-mb-xs">Puncak Volume Shift</div>
            <div class="kpi-value text-slate-900 font-mono">{{ peakShift.name }}</div>
            <div class="text-caption text-grey-7">{{ peakShift.count }} paket tercatat</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Volume per Shift -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div v-for="shift in shiftBreakdown" :key="shift.name" class="col-12 col-sm-4">
        <q-card class="scan-card q-pa-sm">
          <q-card-section>
            <div class="row items-center justify-between">
              <span class="text-weight-bold text-slate-900">Shift {{ shift.name }}</span>
              <q-chip dense color="amber-2" text-color="amber-9" class="font-mono text-weight-bolder">
                {{ shift.success }} SUCCESS
              </q-chip>
            </div>
            <q-linear-progress :value="shift.ratio" size="10px" rounded color="primary" track-color="grey-3" class="q-mt-sm" />
            <div class="text-caption text-grey-7 q-mt-xs font-mono">{{ shift.total }} total event</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Performa Petugas -->
    <q-card class="scan-card">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold text-slate-800 q-mb-sm row items-center">
          <q-icon name="leaderboard" color="primary" class="q-mr-xs" />
          PERFORMA PETUGAS ({{ petugaRows.length }})
        </div>

        <q-table
          :rows="petugaRows"
          :columns="columns"
          row-key="user_id"
          flat
          bordered
          :pagination="{ rowsPerPage: 0 }"
          no-data-label="Belum ada data petugas"
        >
          <template v-slot:body-cell-name="props">
            <q-td :props="props">
              <div class="text-weight-bold text-slate-900">{{ props.row.name }}</div>
              <div class="text-caption text-grey-6 font-mono">{{ props.row.user_id }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-success_rate="props">
            <q-td :props="props" class="font-mono text-weight-bold" :class="props.row.success_rate >= 95 ? 'text-positive' : 'text-orange-9'">
              {{ props.row.success_rate }}%
            </q-td>
          </template>

          <template v-slot:body-cell-target_progress="props">
            <q-td :props="props" style="min-width: 180px">
              <div class="row items-center q-gutter-x-sm">
                <q-linear-progress :value="props.row.target_ratio" size="8px" rounded color="primary" track-color="grey-3" style="flex: 1" />
                <span class="font-mono text-caption text-weight-bold">{{ props.row.progress }}/{{ props.row.target }}</span>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import { useScanStore } from '../../stores/scanStore'

const authStore = useAuthStore()
const taskStore = useTaskStore()
const scanStore = useScanStore()

const refresh = () => {
  taskStore.fetchTasks()
  scanStore.fetchScans()
}

onMounted(refresh)

// ====== DATA GLOBAL (ADMIN = SEMUA USER) ======
const scans = computed(() => scanStore.scanEvents)
const tasks = computed(() => taskStore.tasks)
const petugasList = computed(() => authStore.allPetugas)

const stats = computed(() => {
  const success = scans.value.filter((s) => s.status_scan === 'SUCCESS').length
  const duplicate = scans.value.filter((s) => s.status_scan === 'DUPLICATE').length
  const total = scans.value.length
  return { success, duplicate, total }
})

const successRate = computed(() =>
  stats.value.total ? ((stats.value.success / stats.value.total) * 100).toFixed(1) : '0.0'
)

const duplicateRate = computed(() =>
  stats.value.total ? ((stats.value.duplicate / stats.value.total) * 100).toFixed(1) : '0.0'
)

const shiftNames = ['Pagi', 'Sore']

const shiftForScan = (scan) => {
  const task = tasks.value.find((t) => t.task_id === scan.task_id)
  return task?.shift || 'Lainnya'
}

const shiftBreakdown = computed(() => {
  return shiftNames.map((name) => {
    const shiftScans = scans.value.filter((s) => shiftForScan(s) === name)
    const success = shiftScans.filter((s) => s.status_scan === 'SUCCESS').length
    const total = shiftScans.length
    return { name, total, success, ratio: total ? success / total : 0 }
  })
})

const peakShift = computed(() => {
  if (!shiftBreakdown.value.length) return { name: '-', count: 0 }
  return [...shiftBreakdown.value].sort((a, b) => b.total - a.total)[0]
})

const petugaRows = computed(() => {
  return petugasList.value.map((u) => {
    const userScans = scans.value.filter((s) => s.user_id === u.id)
    const success = userScans.filter((s) => s.status_scan === 'SUCCESS').length
    const duplicate = userScans.filter((s) => s.status_scan === 'DUPLICATE').length
    const total = userScans.length

    const userTasks = tasks.value.filter((t) => t.user_id === u.id && t.status !== 'SELESAI')
    const target = userTasks.reduce((acc, t) => acc + Number(t.target || 0), 0)
    const progress = userTasks.reduce((acc, t) => acc + Number(t.progress || 0), 0)

    return {
      user_id: u.id,
      name: u.name,
      total,
      success,
      duplicate,
      success_rate: total ? ((success / total) * 100).toFixed(1) : '0.0',
      target,
      progress,
      target_ratio: target ? Math.min(progress / target, 1) : 0
    }
  })
})

const columns = [
  { name: 'name', label: 'Petugas', field: 'name', align: 'left', sortable: true },
  { name: 'success', label: 'SUCCESS', field: 'success', align: 'center', sortable: true },
  { name: 'duplicate', label: 'DUPLICATE', field: 'duplicate', align: 'center', sortable: true },
  { name: 'success_rate', label: 'Keberhasilan', field: 'success_rate', align: 'center', sortable: true },
  { name: 'target_progress', label: 'Capaian Target Aktif', field: 'target_progress', align: 'left' }
]
</script>
