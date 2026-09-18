<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">System Audit Log</h4>
        <div class="text-subtitle2 text-grey-7">Log Jejak Aktivitas Keamanan & Perubahan Data Sistem</div>
      </div>

      <div class="row items-center q-gutter-sm">
        <q-select
          v-model="filterAction"
          :options="actionOptions"
          label="Filter Aksi"
          outlined
          dense
          clearable
          emit-value
          map-options
          style="min-width: 200px"
        />
        <q-btn flat round dense icon="refresh" color="primary" @click="loadLogs">
          <q-tooltip>Muat ulang log</q-tooltip>
        </q-btn>
      </div>
    </div>

  


    <q-separator class="q-mb-lg" />

    <q-card class="scan-card">
      <q-card-section>
        <q-table
          :rows="filteredLogs"
          :columns="columns"
          row-key="log_id"
          flat
          bordered
          :loading="auditStore.isLoading"
          no-data-label="Belum ada audit log"
        >
          <template v-slot:body-cell-created_at="props">
            <q-td :props="props" class="font-mono text-grey-8">
              {{ props.row.created_at }}
            </q-td>
          </template>

          <template v-slot:body-cell-user_name="props">
            <q-td :props="props" class="text-weight-bold text-slate-900">
              {{ props.row.user_name }} <span class="text-caption text-grey-6 font-mono">({{ props.row.user_id }})</span>
            </q-td>
          </template>

          <template v-slot:body-cell-action="props">
            <q-td :props="props">
              <q-badge :color="actionColor(props.row.action)" text-color="primary" class="font-mono text-weight-bold">
                {{ props.row.action }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-ip_address="props">
            <q-td :props="props" class="font-mono text-grey-7">
              {{ props.row.ip_address }}
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuditStore } from '../../stores/auditStore'

const auditStore = useAuditStore()
const filterAction = ref(null)

const actionOptions = [
  { label: 'Login Sukses', value: 'LOGIN_SUCCESS' },
  { label: 'Logout', value: 'LOGOUT' },
  { label: 'Scan Dibuat', value: 'SCAN_EVENT_CREATED' },
  { label: 'Scan Duplikat', value: 'SCAN_DUPLICATE' },
  { label: 'Task Selesai', value: 'TASK_COMPLETED' }
]

const columns = [
  { name: 'created_at', label: 'Waktu', field: 'created_at', align: 'left', sortable: true },
  { name: 'user_name', label: 'Pengguna', field: 'user_name', align: 'left', sortable: true },
  { name: 'action', label: 'Aksi System', field: 'action', align: 'center', sortable: true },
  { name: 'details', label: 'Detail Aktivitas', field: 'details', align: 'left' },
  { name: 'ip_address', label: 'IP Address', field: 'ip_address', align: 'left' }
]

const filteredLogs = computed(() => {
  if (!filterAction.value) return auditStore.logs
  return auditStore.logs.filter((l) => l.action === filterAction.value)
})

const actionColor = (action) => {
  switch (action) {
    case 'SCAN_DUPLICATE': return 'amber-2'
    case 'TASK_COMPLETED': return 'green-2'
    case 'LOGOUT': return 'grey-3'
    default: return 'blue-1'
  }
}

const loadLogs = () => {
  auditStore.fetchLogs()
}

onMounted(loadLogs)
</script>
