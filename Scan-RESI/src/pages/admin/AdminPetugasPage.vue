<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Detail & Monitoring Petugas</h4>
        <div class="text-subtitle2 text-grey-7">Inspeksi aktivitas, task aktif, dan log scan per petugas operasional</div>
      </div>
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Empty State jika belum ada petugas -->
    <div v-if="petugasList.length === 0" class="text-center text-grey-6 q-pa-xl bg-white rounded-borders shadow-1">
      <q-icon name="group_off" size="56px" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 text-weight-bold text-slate-800">Belum Ada Akun Petugas Scan</div>
      <div class="text-body2 text-grey-6 q-mb-md">Tambahkan pengguna dengan role "Petugas Scan" di menu User Management untuk mulai memonitor kinerja mereka.</div>
      <q-btn color="primary" icon="person_add" label="Buka User Management" no-caps unelevated to="/admin/users" />
    </div>

    <div v-else>
      <!-- Petugas Selector Chips -->
      <div class="row items-center q-gutter-sm q-mb-lg">
        <span class="text-weight-bold text-slate-800 q-mr-xs">PILIH PETUGAS:</span>
        <q-chip
          v-for="p in petugasList"
          :key="p.id"
          clickable
          :color="activePetugas?.id === p.id ? 'wahana-navy' : 'white'"
          :text-color="activePetugas?.id === p.id ? 'amber-4' : 'slate-900'"
          class="font-mono text-weight-bold shadow-1"
          @click="selectUser(p)"
        >
          <q-icon name="person" size="16px" class="q-mr-xs" />
          {{ p.name }} ({{ p.id }})
        </q-chip>
      </div>

      <!-- Inspector Details Section (Requirement M) -->
      <div v-if="activePetugas" class="q-mb-xl">
        <q-card class="scan-card q-pa-md q-mb-lg border-left-yellow">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="row items-center">
                <q-avatar color="wahana-navy" text-color="amber-4" size="48px" class="q-mr-md font-mono text-h6 text-weight-bolder shadow-2">
                  {{ activePetugas.name.slice(0, 1) }}
                </q-avatar>
                <div>
                  <div class="text-h5 text-weight-bolder text-slate-900">{{ activePetugas.name }}</div>
                  <div class="text-caption text-grey-7 font-mono">User ID: {{ activePetugas.id }} • Role: {{ activePetugas.role }}</div>
                </div>
              </div>

              <StatusBadge :status="activePetugas.status" size="md" />
            </div>

            <q-separator class="q-my-md" />

            <!-- Summary Metric Boxes for Selected Petugas -->
            <div class="row q-col-gutter-sm text-center">
              <div class="col-6 col-sm-3">
                <div class="bg-blue-1 q-pa-sm rounded-borders">
                  <div class="overline-label">Task Aktif</div>
                  <div class="text-h6 text-weight-bolder text-primary font-mono q-mt-xs">
                    {{ activeTask?.task_id || 'Tidak Ada' }}
                  </div>
                </div>
              </div>

              <div class="col-6 col-sm-3">
                <div class="bg-slate-100 q-pa-sm rounded-borders">
                  <div class="overline-label">Total Scan</div>
                  <div class="text-h6 text-weight-bolder text-slate-900 font-mono q-mt-xs">
                    {{ userStats.total }}
                  </div>
                </div>
              </div>

              <div class="col-6 col-sm-3">
                <div class="bg-green-1 q-pa-sm rounded-borders">
                  <div class="overline-label">Success</div>
                  <div class="text-h6 text-weight-bolder text-positive font-mono q-mt-xs">
                    {{ userStats.success }}
                  </div>
                </div>
              </div>

              <div class="col-6 col-sm-3">
                <div class="bg-amber-1 q-pa-sm rounded-borders">
                  <div class="overline-label">Duplicate</div>
                  <div class="kpi-value text-amber-8 font-mono q-mt-xs">
                    {{ userStats.duplicate }}
                  </div>
                </div>
              </div>
            </div>

            <div class="text-caption text-grey-7 q-mt-md font-mono">
              Terakhir Scan: <span class="text-weight-bold text-slate-900">{{ userStats.lastScan }}</span>
            </div>
          </q-card-section>
        </q-card>

        <!-- Scan Events Table of Selected Petugas -->
        <ScanEventTable :scans="userScans" :show-petugas-filter="false" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import { useScanStore } from '../../stores/scanStore'
import StatusBadge from '../../components/StatusBadge.vue'
import ScanEventTable from '../../components/ScanEventTable.vue'

const authStore = useAuthStore()
const taskStore = useTaskStore()
const scanStore = useScanStore()

const petugasList = computed(() => authStore.allPetugas)
const selectedUserId = ref(null)

const activePetugas = computed(() => {
  if (selectedUserId.value) {
    const found = petugasList.value.find((p) => p.id === selectedUserId.value)
    if (found) return found
  }
  return petugasList.value[0] || null
})

const selectUser = (u) => {
  selectedUserId.value = u.id
}

const activeTask = computed(() => {
  if (!activePetugas.value) return null
  return taskStore.getActiveTaskForUser(activePetugas.value.id)
})

const userStats = computed(() => {
  if (!activePetugas.value) return { total: 0, success: 0, duplicate: 0, lastScan: '-' }
  return scanStore.getUserScanStats(activePetugas.value.id)
})

const userScans = computed(() => {
  if (!activePetugas.value) return []
  return scanStore.scanEvents.filter((s) => s.user_id === activePetugas.value.id)
})
</script>
