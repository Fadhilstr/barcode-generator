<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <!-- Header Page Section (Requirement T) -->
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="row items-center">
          <h4 class="page-title q-mr-sm">Scan Paket</h4>
          <StatusBadge :status="activeTask?.status || 'SELESAI'" size="md" />
          <q-chip
            :color="scanStore.isOnline ? 'positive' : 'warning'"
            text-color="white"
            size="sm"
            class="q-ml-sm text-weight-bold"
            :icon="scanStore.isOnline ? 'wifi' : 'wifi_off'"
          >
            {{ scanStore.isOnline ? 'ONLINE' : 'OFFLINE MODE' }}
          </q-chip>
        </div>
        <div class="page-subtitle">
          Petugas <span class="text-weight-medium text-slate-800">{{ authStore.currentUser?.name }}</span> &middot;
          Task <span class="font-mono text-weight-medium text-slate-800">{{ activeTask?.task_id || '-' }}</span> &middot;
          Shift {{ activeTask?.shift || '-' }}
        </div>
      </div>

      <div class="row items-center q-gutter-xs">
        <q-btn
          v-if="scanStore.pendingCount > 0"
          color="warning"
          text-color="dark"
          icon="cloud_upload"
          :label="`Sync (${scanStore.pendingCount})`"
          no-caps
          unelevated
          :loading="scanStore.isSyncing"
          @click="scanStore.triggerOfflineSync"
        />
        <q-btn
          v-if="isTaskFinished"
          color="primary"
          icon="analytics"
          label="Hasil Scan Saya"
          no-caps
          unelevated
          to="/petugas/hasil"
        />
      </div>
    </div>

    <!-- Offline Network Notification Banner -->
    <div v-if="!scanStore.isOnline" class="q-mb-md bg-amber-1 text-amber-10 q-pa-sm rounded-borders row items-center justify-between" style="border: 1px solid #fef3c7;">
      <div class="row items-center">
        <q-icon name="wifi_off" size="20px" class="q-mr-sm" />
        <div>
          <strong class="text-weight-bold">Mode Pemindaian Offline Aktif</strong> &bull;
          <span>{{ scanStore.pendingCount }} scan tersimpan lokal di HP. Scan tetap berjalan lancar tanpa internet.</span>
        </div>
      </div>
    </div>
    <div v-else-if="scanStore.pendingCount > 0" class="q-mb-md bg-blue-1 text-primary q-pa-sm rounded-borders row items-center justify-between" style="border: 1px solid var(--q-primary);">
      <div class="row items-center">
        <q-icon name="cloud_sync" size="20px" class="q-mr-sm" />
        <div>
          <span>Koneksi internet terhubung kembali! Ada <strong>{{ scanStore.pendingCount }}</strong> data scan offline yang belum diunggah ke server.</span>
        </div>
      </div>
      <q-btn color="primary" label="Unggah Ke Server" size="sm" unelevated no-caps icon="cloud_upload" :loading="scanStore.isSyncing" @click="scanStore.triggerOfflineSync" />
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Barcode Input Component (Requirement T & U) -->
    <BarcodeInput :disabled="isTaskFinished" :feedback="scanFeedback" @scan="handleBarcodeScan" />

    <!-- Active Task Progress Summary -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-md-5">
        <q-card class="scan-card full-height q-pa-sm">
          <q-card-section>
            <div class="row items-center justify-between q-mb-xs">
              <span class="overline-label">Total Scan Hari Ini</span>
              <span class="font-mono text-weight-bold text-primary bg-blue-1 q-px-sm" style="border-radius: 6px;">
                {{ userScans.length }} paket
              </span>
            </div>

            <q-separator class="q-my-sm" />

            <div class="row items-center justify-between q-pt-xs">
              <div>
                <div class="overline-label">Capaian Target Task</div>
                <div class="kpi-value text-slate-900 font-mono q-my-xs">
                  {{ activeTask?.progress || 0 }} / {{ activeTask?.target || 0 }}
                </div>
                <div class="text-caption text-grey-6">Lokasi: {{ activeTask?.lokasi || 'CIPUTAT' }}</div>
              </div>

              <div class="q-pa-md bg-grey-1 text-center" style="border-radius: 12px; border: 1px solid var(--dj-border);">
                <q-icon name="inventory_2" size="40px" color="grey-7" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Last Scanned Event Card -->
      <div class="col-12 col-md-7">
        <q-card class="scan-card full-height q-pa-sm">
          <q-card-section>
            <div class="section-title q-mb-xs">
              <q-icon name="history" size="20px" color="primary" class="q-mr-sm" /> Resi Terakhir Discan
            </div>

            <q-separator class="q-my-sm" />

            <div v-if="lastScannedEvent" class="row items-center justify-between q-pt-xs">
              <div>
                <div class="text-h5 text-weight-bold text-slate-900 font-mono">
                  {{ lastScannedEvent.nomor_resi }}
                </div>
                <div class="row items-center q-mt-xs">
                  <StatusBadge :status="lastScannedEvent.status_scan" size="xs" />
                </div>
              </div>

              <div class="text-right">
                <span class="text-caption font-mono text-grey-6 bg-grey-1 q-px-sm q-py-xs" style="border-radius: 6px;">
                  {{ lastScannedEvent.waktu_scan.split(' ')[1] }}
                </span>
              </div>
            </div>

            <div v-else class="text-center q-pa-md text-grey-6">
              <q-icon name="qr_code_scanner" size="32px" class="q-mb-xs" />
              <div>Belum ada paket yang discan pada task ini.</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Data Paket Terakhir (hasil lookup by nomor resi) -->
    <q-card v-if="lastPaket" class="scan-card q-pa-sm q-mb-lg">
      <q-card-section>
        <div class="section-title q-mb-xs">
          <q-icon name="inventory_2" size="20px" color="primary" class="q-mr-sm" /> Data Paket
          <span class="font-mono text-caption text-grey-6 q-ml-sm">{{ lastPaket.nomor_resi }}</span>
        </div>
        <q-separator class="q-my-sm" />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-4">
            <div class="text-caption text-grey-7">Nama Barang</div>
            <div class="text-weight-bolder text-slate-900">{{ lastPaket.nama_barang || '-' }}</div>
            <div class="text-caption text-grey-6 q-mt-xs">Layanan: {{ lastPaket.jenis_layanan }} • {{ lastPaket.berat_kg }} kg</div>
          </div>
          <div class="col-12 col-md-4">
            <div class="text-caption text-grey-7">Pengirim</div>
            <div class="text-weight-bold text-slate-800">{{ lastPaket.pengirim || '-' }}</div>
          </div>
          <div class="col-12 col-md-4">
            <div class="text-caption text-grey-7">Penerima / Tujuan</div>
            <div class="text-weight-bold text-slate-800">{{ lastPaket.penerima || '-' }}</div>
            <div class="text-caption text-grey-6">{{ lastPaket.alamat_tujuan || '' }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Scanned Items Table View -->
    <div class="q-mb-xl">
      <ScanEventTable :scans="userScans" :show-petugas-filter="false" show-label-action @label="openLabel" />
    </div>

    <!-- Finish Task Action Button (Requirement Z) -->
    <div class="row justify-end q-mt-lg">
      <q-btn
        v-if="!isTaskFinished"
        color="primary"
        size="lg"
        icon="check_circle"
        label="Selesaikan Task"
        no-caps
        class="q-px-xl"
        unelevated
        @click="confirmFinishTask"
      >
        <q-tooltip>Selesaikan task dan kunci proses pemindaian</q-tooltip>
      </q-btn>
    </div>

    <!-- Selesaikan Task Confirmation Dialog (Requirement Z) -->
    <q-dialog v-model="showFinishModal" persistent>
      <q-card style="min-width: 360px; border-radius: 16px;">
        <q-card-section class="row items-center q-pb-none">
          <q-avatar icon="task_alt" color="blue-1" text-color="primary" />
          <span class="q-ml-sm text-h6 text-weight-bold">Selesaikan task?</span>
        </q-card-section>

        <q-card-section class="q-pt-md">
          <div class="text-body2 text-grey-7">
            Pastikan seluruh paket telah discan. Setelah dikonfirmasi, input barcode akan terkunci dan status task menjadi Selesai.
          </div>

          <div class="q-mt-md bg-grey-1 q-pa-md text-center" style="border-radius: 12px; border: 1px solid var(--dj-border);">
            <div class="overline-label">Capaian Scan Task</div>
            <div class="kpi-value text-primary font-mono">
              {{ activeTask?.progress }} / {{ activeTask?.target }}
            </div>
            <div class="text-caption text-grey-6 font-mono">Task ID: {{ activeTask?.task_id }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Batal" no-caps color="grey-7" v-close-popup />
          <q-btn label="Selesaikan" no-caps color="primary" unelevated @click="executeFinishTask" />
        </q-card-actions>
      </q-card>
    </q-dialog>



    <!-- Dialog Generate Barcode Label -->
    <BarcodeLabel v-model="showLabel" :resi="labelResi" :paket-data="labelPaketData" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import { useScanStore } from '../../stores/scanStore'
import { usePaketStore } from '../../stores/paketStore'
import StatusBadge from '../../components/StatusBadge.vue'
import BarcodeInput from '../../components/BarcodeInput.vue'
import ScanEventTable from '../../components/ScanEventTable.vue'
import BarcodeLabel from '../../components/BarcodeLabel.vue'
import { normalizeScannedBarcode } from '../../utils/barcodeGenerator'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const taskStore = useTaskStore()
const scanStore = useScanStore()
const paketStore = usePaketStore()

onMounted(() => {
  scanStore.initOfflineSupport()
})

const showFinishModal = ref(false)
const isProcessingScan = ref(false)
const lastPaket = ref(null)
const showLabel = ref(false)
const labelResi = ref('')
const labelPaketData = ref(null)

// Umpan balik hasil validasi scan terakhir → ditampilkan di dialog kamera
// dan komponen input. { seq, resi, level, label, message, detail }
let feedbackSeq = 0
const scanFeedback = ref(null)

const setFeedback = (resi, level, label, message, detail = '') => {
  scanFeedback.value = { seq: ++feedbackSeq, resi, level, label, message, detail }
}

const openLabel = async (row) => {
  const resi = row?.nomor_resi || ''
  labelResi.value = resi
  let p = paketStore.findPaketByResi(resi)
  if (!p && resi) {
    const res = await paketStore.lookupByResi(resi)
    if (res.success) p = res.paket
  }
  labelPaketData.value = p ? { ...p, barcode_format: p.barcode_format || 'CODE_128' } : null
  showLabel.value = true
}

const activeTask = computed(() => {
  if (!authStore.currentUser) return null
  return taskStore.getActiveTaskForUser(authStore.currentUser.id)
})

const isTaskFinished = computed(() => {
  return !activeTask.value || activeTask.value.status === 'SELESAI'
})

const userScans = computed(() => {
  if (!authStore.currentUser) return []
  return scanStore.getFilteredScans(authStore.currentUser)
})

const lastScannedEvent = computed(() => {
  return userScans.value.length > 0 ? userScans.value[0] : null
})

const handleBarcodeScan = async (resiInput, format = null, duration = null) => {
  if (isTaskFinished.value) {
    const msg = activeTask.value
      ? `Task ${activeTask.value.task_id} sudah selesai — tidak dapat melakukan scan.`
      : 'Tidak ada task aktif — minta admin membuat task terlebih dahulu.'

    setFeedback(resiInput, 'danger', 'DITOLAK', msg)
    $q.notify({
      group: 'scan-feedback',
      type: 'negative',
      icon: 'error',
      message: msg,
      position: 'top',
      timeout: 3000
    })
    return
  }

  const cleanResi = normalizeScannedBarcode((resiInput || '').trim())
  if (!cleanResi) return

  // Cegah trigger ganda jika request sebelumnya masih berjalan
  if (isProcessingScan.value) {
    return
  }

  isProcessingScan.value = true
  try {
    const result = await scanStore.addScanEvent({
      resi: cleanResi,
      currentUser: authStore.currentUser,
      activeTask: activeTask.value,
      lokasi: activeTask.value?.lokasi || 'CIPUTAT',
      device_id: 'SCAN-DEVICE-01',
      jenis_scan: 'INBOUND',
      barcode_format: format,
      decode_duration: duration
    })

    // Lookup paket selalu dijalankan — untuk kartu data paket
    const lookup = await paketStore.lookupByResi(cleanResi)
    lastPaket.value = lookup.success ? lookup.paket : null

    if (result.success) {
      const msg = result.message || `Scan berhasil, resi ${cleanResi} sudah terdaftar.`
      setFeedback(cleanResi, 'success', 'BERHASIL', msg)
      $q.notify({
        group: 'scan-feedback',
        type: 'positive',
        icon: 'check_circle',
        message: msg,
        position: 'top',
        timeout: 2000
      })
      return
    }

    if (result.reason === 'DUPLICATE') {
      const dupMsg = result.message || `Resi ${cleanResi} sudah terdaftar.`
      setFeedback(cleanResi, 'danger', 'DUPLIKAT', dupMsg)
      $q.notify({
        group: 'scan-feedback',
        type: 'negative',
        icon: 'warning',
        message: dupMsg,
        position: 'top',
        timeout: 3000
      })
      return
    }

    if (result.reason === 'DRAFT') {
      const draft = lookup.success ? lookup.paket : null
      const detail = draft
        ? `${draft.nama_barang || '(nama barang kosong)'} • ${draft.pengirim || '-'} → ${draft.penerima || '-'}`
        : ''
      const msg = draft
        ? `Resi masih DRAFT — customer belum menyelesaikan data barang.`
        : result.message

      setFeedback(cleanResi, 'danger', 'MASIH DRAFT', msg, detail)
      $q.notify({
        group: 'scan-feedback',
        type: 'negative',
        icon: 'gpp_bad',
        message: detail ? `${msg} (${detail})` : msg,
        position: 'top',
        timeout: 4000
      })
      return
    }

    if (result.reason === 'UNKNOWN_RESI') {
      setFeedback(cleanResi, 'danger', 'TAK DIKENAL', result.message)
      $q.notify({
        group: 'scan-feedback',
        type: 'negative',
        icon: 'gpp_bad',
        message: result.message,
        position: 'top',
        timeout: 3000
      })
      return
    }

    // FINISHED / EMPTY / ERROR / lainnya
    setFeedback(cleanResi, 'danger', 'GAGAL', result.message)
    $q.notify({
      group: 'scan-feedback',
      type: 'negative',
      icon: 'error',
      message: result.message,
      position: 'top',
      timeout: 2500
    })
  } finally {
    isProcessingScan.value = false
  }
}

const confirmFinishTask = () => {
  showFinishModal.value = true
}

const executeFinishTask = async () => {
  if (!activeTask.value) return
  const taskId = activeTask.value.task_id
  const result = await taskStore.completeTask(taskId)
  showFinishModal.value = false

  if (result?.success === false) {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: result.message || `Gagal menyelesaikan task ${taskId}.`,
      position: 'top',
      timeout: 2500
    })
    return
  }

  $q.notify({
    type: 'positive',
    icon: 'task_alt',
    message: `Task ${taskId} telah diselesaikan!`,
    position: 'top',
    timeout: 2000
  })

  router.push('/petugas/hasil')
}
</script>
