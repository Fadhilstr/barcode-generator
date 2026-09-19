<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Paket Saya</h4>
        <div class="text-subtitle2 text-grey-7">Daftar paket & nomor resi yang pernah Anda buat</div>
      </div>

      <q-btn color="primary" icon="add_box" label="Buat Paket Baru" no-caps unelevated to="/customer/buat-paket" class="text-weight-bold" />
    </div>

    <q-separator class="q-mb-lg" />

    <q-card class="scan-card">
      <q-card-section>
        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col-12 col-sm-6 col-md-5">
            <q-input v-model="searchQuery" dense outlined placeholder="Cari resi / nama barang..." bg-color="white">
              <template v-slot:append><q-icon name="search" /></template>
            </q-input>
          </div>

          <div class="col-6 col-sm-3 col-md-3">
            <q-select
              v-model="selectedStatus"
              :options="statusOptions"
              emit-value
              map-options
              dense
              outlined
              label="Status"
              bg-color="white"
            />
          </div>

          <div class="col-6 col-sm-3 col-md-3">
            <q-input v-model="resiLookup" dense outlined placeholder="Cari data paket by resi..." bg-color="white" @keyup.enter="handleLookup">
              <template v-slot:append>
                <q-btn flat round dense icon="search" color="primary" :disable="!resiLookup.trim()" @click="handleLookup" />
              </template>
            </q-input>
          </div>
        </div>

        <q-table
          :rows="filteredRows"
          :columns="columns"
          row-key="nomor_resi"
          flat
          bordered
          :pagination="{ rowsPerPage: 10 }"
          no-data-label="Belum ada paket. Buat paket pertama Anda!"
        >
          <template v-slot:body-cell-nomor_resi="props">
            <q-td :props="props" class="font-mono text-weight-bolder text-subtitle2 text-slate-900">
              {{ props.row.nomor_resi }}
            </q-td>
          </template>

          <template v-slot:body-cell-nama_barang="props">
            <q-td :props="props" class="text-weight-medium">
              {{ props.row.nama_barang || '(draft — belum diisi)' }}
            </q-td>
          </template>

          <template v-slot:body-cell-jenis_layanan="props">
            <q-td :props="props" class="text-center">
              <q-badge color="blue-1" text-color="primary" class="font-mono text-weight-bold">
                {{ props.row.jenis_layanan }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props" class="text-center">
              <StatusBadge :status="props.row.status" size="xs" />
            </q-td>
          </template>

          <template v-slot:body-cell-created_at="props">
            <q-td :props="props" class="font-mono text-caption text-grey-7 text-center">
              {{ getFormattedCreatedAt(props.row.created_at) }}
            </q-td>
          </template>

          <template v-slot:body-cell-aksi="props">
            <q-td :props="props" class="text-center">
              <q-btn flat round dense icon="qr_code_2" color="primary" @click="openLabel(props.row)">
                <q-tooltip>Cetak label barcode</q-tooltip>
              </q-btn>
              <q-btn flat round dense icon="info" color="grey-8" @click="openDetail(props.row)">
                <q-tooltip>Detail paket</q-tooltip>
              </q-btn>
              <q-btn
                v-if="props.row.status === 'DRAFT'"
                flat
                round
                dense
                icon="edit"
                color="amber-9"
                @click="continueDraft(props.row)"
              >
                <q-tooltip>Lengkapi data barang</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- Detail Paket Dialog -->
    <q-dialog v-model="showDetail">
      <q-card style="min-width: 340px; max-width: 92vw; border-radius: 16px">
        <q-card-section class="row items-center justify-between q-pb-none">
          <div class="text-h6 text-weight-bold row items-center">
            <q-icon name="inventory_2" color="primary" class="q-mr-xs" />
            DATA PAKET
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator class="q-mt-sm" />
        <q-card-section v-if="detailRow">
          <div class="text-center q-mb-md">
            <div class="kpi-value text-slate-900 font-mono">{{ detailRow.nomor_resi }}</div>
            <StatusBadge :status="detailRow.status" size="sm" />
          </div>
          <div class="column q-gutter-y-xs font-mono text-body2">
            <div><span class="text-grey-7">Nama Barang:</span> <b>{{ detailRow.nama_barang || '-' }}</b></div>
            <div><span class="text-grey-7">Pengirim:</span> {{ detailRow.pengirim || '-' }}</div>
            <div><span class="text-grey-7">Penerima:</span> {{ detailRow.penerima || '-' }}</div>
            <div><span class="text-grey-7">Alamat:</span> {{ detailRow.alamat_tujuan || '-' }}</div>
            <div><span class="text-grey-7">Berat:</span> {{ detailRow.berat_kg }} kg • Layanan: {{ detailRow.jenis_layanan }}</div>
            <div><span class="text-grey-7">Dibuat:</span> {{ getFormattedCreatedAt(detailRow.created_at) }}</div>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Tutup" no-caps color="grey-7" v-close-popup />
          <q-btn unelevated color="primary" icon="print" label="Cetak Label" no-caps @click="openLabel(detailRow)" class="text-weight-bold" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <BarcodeLabel v-model="showLabel" :resi="labelResi" :paket-data="selectedPaket" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/authStore'
import { usePaketStore } from '../../stores/paketStore'
import StatusBadge from '../../components/StatusBadge.vue'
import BarcodeLabel from '../../components/BarcodeLabel.vue'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const paketStore = usePaketStore()

const searchQuery = ref('')
const selectedStatus = ref('ALL')
const resiLookup = ref('')
const selectedPaket = ref(null)

const showLabel = ref(false)
const labelResi = ref('')
const showDetail = ref(false)
const detailRow = ref(null)

// Real-time ticker state untuk WIB
const nowTick = ref(Date.now())
let timerId = null

const statusOptions = [
  { label: 'Semua Status', value: 'ALL' },
  { label: 'TERDAFTAR', value: 'TERDAFTAR' },
  { label: 'DRAFT', value: 'DRAFT' }
]

const columns = [
  { name: 'nomor_resi', label: 'Nomor Resi', field: 'nomor_resi', align: 'left' },
  { name: 'nama_barang', label: 'Nama Barang', field: 'nama_barang', align: 'left' },
  { name: 'penerima', label: 'Penerima', field: 'penerima', align: 'left' },
  { name: 'jenis_layanan', label: 'Layanan', field: 'jenis_layanan', align: 'center' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'created_at', label: 'Dibuat', field: 'created_at', align: 'center' },
  { name: 'aksi', label: 'Aksi', field: () => '', align: 'center' }
]

const parseDateToTime = (dateStr) => {
  if (!dateStr) return 0
  const str = String(dateStr).trim()
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    const [dPart, tPart = '00:00:00'] = str.split(' ')
    const [d, m, y] = dPart.split('-')
    const t = tPart.replace(/\./g, ':')
    const timeNum = new Date(`${y}-${m}-${d}T${t}`).getTime()
    return isNaN(timeNum) ? 0 : timeNum
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const formattedStr = str.replace(' ', 'T').replace(/\./g, ':')
    const timeNum = new Date(formattedStr).getTime()
    return isNaN(timeNum) ? 0 : timeNum
  }
  const parsed = Date.parse(str)
  return isNaN(parsed) ? 0 : parsed
}

const filteredRows = computed(() => {
  const rows = paketStore.getScopedPakets(authStore.currentUser).filter((p) => {
    if (selectedStatus.value !== 'ALL' && p.status !== selectedStatus.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchResi = p.nomor_resi.toLowerCase().includes(q)
      const matchNama = (p.nama_barang || '').toLowerCase().includes(q)
      if (!matchResi && !matchNama) return false
    }
    return true
  })
  return rows.sort((a, b) => parseDateToTime(b.created_at) - parseDateToTime(a.created_at))
})

const getFormattedCreatedAt = (createdAtStr) => {
  // eslint-disable-next-line no-unused-expressions
  nowTick.value
  if (!createdAtStr) return '-'

  let str = String(createdAtStr).trim()
  // Format YYYY-MM-DD HH:mm:ss -> DD-MM-YYYY HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str)) {
    const parts = str.split(/[ T]/)
    const d = parts[0].split('-')
    return `${d[2]}-${d[1]}-${d[0]} ${parts[1]}`
  }
  return str
}

const openLabel = (row) => {
  const resi = (row?.nomor_resi || '').toUpperCase()
  const savedFmt = localStorage.getItem(`paket_barcode_format_${resi}`)
  selectedPaket.value = {
    ...row,
    barcode_format: row?.barcode_format || savedFmt || 'CODE_128'
  }
  labelResi.value = row?.nomor_resi || ''
  showLabel.value = true
}

const openDetail = (row) => {
  detailRow.value = row
  showDetail.value = true
}

// "Cari Data Paket" by nomor resi (selalu fetch terbaru dari service)
const handleLookup = async () => {
  const result = await paketStore.lookupByResi(resiLookup.value)
  if (result.success) {
    detailRow.value = result.paket
    showDetail.value = true
  } else {
    $q.notify({
      type: 'warning',
      icon: 'search_off',
      message: result.message || 'Paket tidak ditemukan.',
      position: 'top',
      timeout: 2200
    })
  }
}

const continueDraft = (row) => {
  router.push({ path: '/customer/buat-paket', query: { resi: row.nomor_resi } })
}

onMounted(() => {
  paketStore.fetchPakets()
  timerId = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})
</script>
