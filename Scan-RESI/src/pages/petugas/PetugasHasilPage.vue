<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Hasil Scan Saya</h4>
        <div class="text-subtitle2 text-grey-7">Rekapitulasi log scan event khusus milik {{ authStore.currentUser?.name }}</div>
      </div>

      <div class="row q-gutter-sm">
        <q-btn
          color="primary"
          icon="qr_code_scanner"
          label="Scan Paket" no-caps
          to="/petugas/scan"
          unelevated
          class="text-weight-bold"
        />
        <q-btn
          outline
          color="grey-8"
          icon="dashboard"
          label="Dashboard" no-caps
          to="/petugas"
          class="text-weight-bold"
        />
      </div>
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Total Scan Summary Box (Requirement Y) -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Total Scan Saya</div>
            <div class="kpi-value text-slate-900 font-mono">
              {{ myScans.length }}
            </div>
            <div class="text-caption text-grey-6">Scan Event Recorded</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Scan Success</div>
            <div class="kpi-value text-slate-900 font-mono">
              {{ userStats.success }}
            </div>
            <div class="text-caption text-grey-6">Resi Unik Berhasil</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-12 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Duplicate Ditolak</div>
            <div class="kpi-value text-amber-8 font-mono q-my-xs">
              {{ userStats.duplicate }}
            </div>
            <div class="text-caption text-grey-6">Terdeteksi Duplikat</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Scanned Items Table filtered for Logged-In User (Requirement Y) -->
    <ScanEventTable
      :scans="myScans"
      :show-petugas-filter="false"
      show-label-action
      show-paket-action
      @label="openLabel"
      @paket="openPaket"
    />

    <!-- Dialog Generate Barcode Label -->
    <BarcodeLabel v-model="showLabel" :resi="labelResi" :paket-data="labelPaketData" />

    <!-- Dialog Cari Data Paket by Nomor Resi -->
    <q-dialog v-model="showPaket">
      <q-card style="min-width: 340px; max-width: 92vw; border-radius: 16px">
        <q-card-section class="row items-center justify-between q-pb-none">
          <div class="text-h6 text-weight-bold row items-center">
            <q-icon name="inventory_2" color="primary" class="q-mr-xs" />
            DATA PAKET
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator class="q-mt-sm" />
        <q-card-section v-if="paketDetail">
          <div class="text-center q-mb-md">
            <div class="kpi-value text-slate-900 font-mono">{{ paketDetail.nomor_resi }}</div>
            <div class="text-caption text-grey-7">{{ paketDetail.nama_barang || '-' }} • {{ paketDetail.jenis_layanan }}</div>
          </div>
          <div class="column q-gutter-y-xs font-mono text-body2">
            <div><span class="text-grey-7">Pengirim:</span> {{ paketDetail.pengirim || '-' }}</div>
            <div><span class="text-grey-7">Penerima:</span> {{ paketDetail.penerima || '-' }}</div>
            <div><span class="text-grey-7">Alamat:</span> {{ paketDetail.alamat_tujuan || '-' }}</div>
            <div><span class="text-grey-7">Berat:</span> {{ paketDetail.berat_kg }} kg</div>
            <div><span class="text-grey-7">Dibuat oleh:</span> {{ paketDetail.creator_name || '-' }} ({{ paketDetail.created_at }})</div>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Tutup" no-caps color="grey-7" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useScanStore } from '../../stores/scanStore'
import { usePaketStore } from '../../stores/paketStore'
import ScanEventTable from '../../components/ScanEventTable.vue'
import BarcodeLabel from '../../components/BarcodeLabel.vue'

const authStore = useAuthStore()
const scanStore = useScanStore()
const paketStore = usePaketStore()

const showLabel = ref(false)
const labelResi = ref('')
const labelPaketData = ref(null)
const showPaket = ref(false)
const paketDetail = ref(null)

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

// "Cari Data Paket": fetch detail by nomor resi dari baris scan
const openPaket = async (row) => {
  const resi = row?.nomor_resi || ''
  const result = await paketStore.lookupByResi(resi)
  if (result.success) {
    paketDetail.value = result.paket
    showPaket.value = true
  }
}

const myScans = computed(() => {
  if (!authStore.currentUser) return []
  return scanStore.getFilteredScans(authStore.currentUser)
})

const userStats = computed(() => {
  if (!authStore.currentUser) return { total: 0, success: 0, duplicate: 0 }
  return scanStore.getUserScanStats(authStore.currentUser.id)
})
</script>
