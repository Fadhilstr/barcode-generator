<template>
  <div>
    <q-card class="scan-card">
      <q-card-section class="q-pb-sm">
        <div class="row items-center justify-between q-mb-md">
          <div class="section-title">
            <q-icon name="list_alt" size="20px" color="primary" class="q-mr-sm" />
            Daftar Scan Event
            <span class="text-caption text-grey-6 q-ml-xs">({{ filteredRows.length }})</span>
          </div>

          <div class="row items-center q-gutter-xs">
            <q-btn
              v-if="hasActiveFilter"
              flat
              dense
              no-caps
              color="grey-8"
              icon="restart_alt"
              label="Reset Filter"
              @click="resetFilters"
              class="text-caption"
            />
          </div>
        </div>

        <!-- Multi-column Filters (Requirement L) -->
        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col-12 col-sm-6 col-md-3">
            <q-input
              v-model="searchQuery"
              dense
              outlined
              placeholder="Cari resi / ID scan..."
              bg-color="white"
            >
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <div class="col-6 col-sm-3 col-md-2" v-if="showPetugasFilter">
            <q-select
              v-model="selectedPetugas"
              :options="petugasOptions"
              dense
              outlined
              emit-value
              map-options
              label="Petugas"
              bg-color="white"
            />
          </div>

          <div class="col-6 col-sm-3 col-md-2">
            <q-select
              v-model="selectedTask"
              :options="taskOptions"
              dense
              outlined
              emit-value
              map-options
              label="Task ID"
              bg-color="white"
            />
          </div>

          <div class="col-6 col-sm-3 col-md-2">
            <q-select
              v-model="selectedStatus"
              :options="statusOptions"
              dense
              outlined
              emit-value
              map-options
              label="Status Scan"
              bg-color="white"
            />
          </div>

          <div class="col-6 col-sm-3 col-md-3">
            <q-input
              v-model="filterLocation"
              dense
              outlined
              placeholder="Filter lokasi..."
            />
          </div>
        </div>
      </q-card-section>

      <!-- Desktop View: QTable -->
      <q-card-section v-if="$q.screen.gt.xs">
        <q-table
          :rows="filteredRows"
          :columns="columns"
          row-key="scan_id"
          flat
          bordered
          :pagination="pagination"
          no-data-label="Tidak ada data scan event"
          class="no-shadow"
        >
          <template v-slot:body-cell-scan_id="props">
            <q-td :props="props" class="font-mono text-weight-bold text-primary">
              {{ props.row.scan_id }}
            </q-td>
          </template>

          <template v-slot:body-cell-nomor_resi="props">
            <q-td :props="props">
              <span class="font-mono text-weight-bolder text-subtitle2 text-slate-900">
                {{ props.row.nomor_resi }}
              </span>
            </q-td>
          </template>

          <template v-slot:body-cell-user_name="props">
            <q-td :props="props" class="text-weight-bold text-slate-800">
              <q-icon name="person" size="14px" color="primary" class="q-mr-xs" />
              {{ props.row.user_name }}
            </q-td>
          </template>

          <template v-slot:body-cell-task_id="props">
            <q-td :props="props">
              <q-badge color="blue-1" text-color="primary" class="font-mono text-weight-bold">
                {{ props.row.task_id }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-waktu_scan="props">
            <q-td :props="props" class="font-mono text-grey-8">
              {{ props.row.waktu_scan }}
            </q-td>
          </template>

          <template v-slot:body-cell-status_scan="props">
            <q-td :props="props" class="text-center">
              <StatusBadge :status="props.row.status_scan" size="xs" />
            </q-td>
          </template>

          <template v-slot:body-cell-lokasi="props">
            <q-td :props="props" class="text-weight-medium text-grey-9">
              <q-icon name="place" size="14px" color="amber-9" class="q-mr-xs" />
              {{ props.row.lokasi }}
            </q-td>
          </template>

          <template v-if="showLabelAction" v-slot:body-cell-aksi="props">
            <q-td :props="props" class="text-center">
              <q-btn
                flat
                dense
                round
                icon="qr_code_2"
                color="primary"
                @click="$emit('label', props.row)"
              >
                <q-tooltip>Lihat / cetak barcode resi</q-tooltip>
              </q-btn>
              <q-btn
                v-if="showPaketAction"
                flat
                dense
                round
                icon="inventory_2"
                color="grey-8"
                @click="$emit('paket', props.row)"
              >
                <q-tooltip>Lihat data paket</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>

      <!-- Mobile View: Card List -->
      <q-card-section v-else class="q-pt-none">
        <div v-if="filteredRows.length === 0" class="text-center q-pa-lg text-grey-6">
          Tidak ada data scan event.
        </div>

        <div v-else class="column q-gutter-y-sm">
          <q-card
            v-for="item in filteredRows"
            :key="item.scan_id"
            flat
            bordered
            class="bg-white rounded-borders q-pa-sm shadow-1"
          >
            <div class="row items-center justify-between q-mb-xs">
              <span class="font-mono text-caption text-weight-bold text-primary">{{ item.scan_id }}</span>
              <StatusBadge :status="item.status_scan" size="xs" />
            </div>

            <div class="row items-center justify-between">
              <div>
                <div class="font-mono text-weight-bolder text-subtitle1 text-slate-900">
                  {{ item.nomor_resi }}
                </div>
                <div class="text-caption text-grey-7 row items-center">
                  <q-icon name="person" size="12px" class="q-mr-xs" /> {{ item.user_name }}
                  <span class="q-mx-xs">•</span>
                  <q-icon name="assignment" size="12px" class="q-mr-xs" /> {{ item.task_id }}
                </div>
              </div>

              <div class="text-right text-caption font-mono text-grey-6">
                <div>{{ item.waktu_scan.split(' ')[1] }}</div>
                <div class="text-weight-bold text-slate-800">{{ item.lokasi }}</div>
              </div>
            </div>

            <div v-if="showLabelAction" class="row justify-end q-gutter-x-xs q-mt-xs">
              <q-btn
                flat
                dense
                no-caps
                icon="qr_code_2"
                label="Label"
                color="primary"
                class="text-caption"
                @click="$emit('label', item)"
              />
              <q-btn
                v-if="showPaketAction"
                flat
                dense
                no-caps
                icon="inventory_2"
                label="Paket"
                color="grey-8"
                class="text-caption"
                @click="$emit('paket', item)"
              />
            </div>
          </q-card>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  scans: {
    type: Array,
    required: true,
    default: () => []
  },
  showPetugasFilter: {
    type: Boolean,
    default: true
  },
  showLabelAction: {
    type: Boolean,
    default: false
  },
  showPaketAction: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['label', 'paket'])

const searchQuery = ref('')
const selectedPetugas = ref('ALL')
const selectedTask = ref('ALL')
const selectedStatus = ref('ALL')
const filterLocation = ref('')

const pagination = ref({
  rowsPerPage: 10
})

const columns = computed(() => {
  const base = [
    { name: 'scan_id', label: 'ID Scan', field: 'scan_id', align: 'left', sortable: true },
    { name: 'nomor_resi', label: 'Nomor Resi', field: 'nomor_resi', align: 'left', sortable: true },
    { name: 'user_name', label: 'Petugas', field: 'user_name', align: 'left', sortable: true },
    { name: 'task_id', label: 'Task ID', field: 'task_id', align: 'center', sortable: true },
    { name: 'waktu_scan', label: 'Waktu Scan', field: 'waktu_scan', align: 'center', sortable: true },
    { name: 'lokasi', label: 'Lokasi', field: 'lokasi', align: 'center' },
    { name: 'status_scan', label: 'Status', field: 'status_scan', align: 'center', sortable: true },
    { name: 'device_id', label: 'Device', field: 'device_id', align: 'center' },
    { name: 'jenis_scan', label: 'Jenis Scan', field: 'jenis_scan', align: 'center' }
  ]

  if (props.showLabelAction) {
    base.push({ name: 'aksi', label: 'Barcode', field: () => '', align: 'center' })
  }

  return base
})

const petugasOptions = computed(() => {
  const names = Array.from(new Set(props.scans.map((s) => s.user_name)))
  return [
    { label: 'Semua Petugas', value: 'ALL' },
    ...names.map((n) => ({ label: n, value: n }))
  ]
})

const taskOptions = computed(() => {
  const tasks = Array.from(new Set(props.scans.map((s) => s.task_id)))
  return [
    { label: 'Semua Task', value: 'ALL' },
    ...tasks.map((t) => ({ label: t, value: t }))
  ]
})

const statusOptions = [
  { label: 'Semua Status', value: 'ALL' },
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'DUPLICATE', value: 'DUPLICATE' }
]

const hasActiveFilter = computed(() => {
  return searchQuery.value || selectedPetugas.value !== 'ALL' || selectedTask.value !== 'ALL' || selectedStatus.value !== 'ALL' || filterLocation.value
})

const resetFilters = () => {
  searchQuery.value = ''
  selectedPetugas.value = 'ALL'
  selectedTask.value = 'ALL'
  selectedStatus.value = 'ALL'
  filterLocation.value = ''
}

const filteredRows = computed(() => {
  return props.scans.filter((item) => {
    // Search query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchResi = item.nomor_resi.toLowerCase().includes(q)
      const matchId = item.scan_id.toLowerCase().includes(q)
      if (!matchResi && !matchId) return false
    }

    // Petugas filter
    if (selectedPetugas.value !== 'ALL' && item.user_name !== selectedPetugas.value) {
      return false
    }

    // Task filter
    if (selectedTask.value !== 'ALL' && item.task_id !== selectedTask.value) {
      return false
    }

    // Status filter
    if (selectedStatus.value !== 'ALL' && item.status_scan !== selectedStatus.value) {
      return false
    }

    // Location filter
    if (filterLocation.value) {
      if (!item.lokasi.toLowerCase().includes(filterLocation.value.toLowerCase())) {
        return false
      }
    }

    return true
  })
})
</script>
