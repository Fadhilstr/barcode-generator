<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Generate Paket</h4>
        <div class="text-subtitle2 text-grey-7">
          Pilih format barcode → generate barcode & resi → isi data pengirim & penerima → simpan
        </div>
      </div>

      <q-btn outline color="grey-8" icon="list" label="Paket Saya" no-caps to="/customer/paket" class="text-weight-bold" />
    </div>

    <q-separator class="q-mb-lg" />

    <!-- LANGKAH 1: GENERATE NOMOR RESI & BARCODE -->
    <q-card class="scan-card q-pa-md q-mb-md">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-bold text-slate-800 row items-center">
            <q-icon name="pin" color="primary" size="22px" class="q-mr-sm" />
            LANGKAH 1 — GENERATE BARCODE & NOMOR RESI
          </div>
          <q-badge v-if="paket" :color="paket.status === 'TERDAFTAR' ? 'green-8' : 'amber-8'"
            text-color="white" class="text-weight-bold">
            {{ paket.status }}
          </q-badge>
        </div>

        <div class="q-pa-sm">
          <div class="row q-col-gutter-lg items-start">
            <!-- Kolom Kiri: Format Barcode, Tombol Generate Barcode & Display Nomor Resi -->
            <div class="col-12 col-md-5">
              <div class="text-subtitle1 text-weight-bolder text-slate-900 q-mb-md flex items-center">
                <q-icon name="qr_code_2" color="primary" size="22px" class="q-mr-xs" />
                PENETAPAN FORMAT & RESI
              </div>

              <!-- 1. Dropdown Format Barcode (Dipilih Terlebih Dahulu) -->
              <div class="q-mb-md">
                <div class="text-subtitle2 text-weight-bold text-slate-700 q-mb-xs">
                  Format Barcode
                </div>
                <q-select
                  v-model="selectedFormat"
                  :options="customerBarcodeFormatOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  bg-color="white"
                  class="text-weight-medium"
                  placeholder="Pilih format barcode..."
                  clearable
                  @update:model-value="handleFormatChange"
                >
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label class="text-weight-medium row items-center no-wrap">
                          <span>{{ scope.opt.value }}</span>
                          <q-badge
                            v-if="scope.opt.disable"
                            color="warning"
                            text-color="dark"
                            label="Non-Mandiri"
                            class="q-ml-sm text-caption text-weight-bold"
                          />
                        </q-item-label>
                        <q-item-label caption :class="scope.opt.disable ? 'text-negative text-weight-medium' : ''">
                          {{ scope.opt.warning || scope.opt.category }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <div class="text-caption text-grey-6 q-mt-xs">
                  Pilih format barcode yang diinginkan terlebih dahulu sebelum menekan tombol Generate Barcode.
                </div>
              </div>

              <!-- 2. Tombol Generate Barcode -->
              <div class="q-mb-lg">
                <q-btn
                  unelevated
                  color="primary"
                  icon="auto_awesome"
                  label="GENERATE BARCODE"
                  no-caps
                  class="full-width text-weight-bolder q-py-sm"
                  :loading="generating"
                  @click="handleGenerate()"
                />
              </div>

              <!-- 3. Display Nomor Resi (Hanya muncul setelah Generate Barcode ditekan) -->
              <div v-if="paket?.nomor_resi" class="q-mb-md">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="text-subtitle2 text-weight-bold text-slate-700">
                    Nomor Resi
                  </div>
                  <q-badge color="green-1" text-color="green-9" class="text-caption text-weight-bold q-pa-xs">
                    <q-icon name="lock" size="12px" class="q-mr-xs" /> Diterbitkan Backend
                  </q-badge>
                </div>
                <q-input
                  :model-value="paket?.nomor_resi || ''"
                  readonly
                  disable
                  outlined
                  dense
                  class="font-mono text-weight-bolder bg-grey-2"
                  style="cursor: not-allowed;"
                >
                  <template v-slot:prepend>
                    <q-icon name="lock" color="primary" />
                  </template>
                </q-input>
                <div class="text-caption text-grey-6 q-mt-xs">
                  <q-icon name="info" size="13px" class="q-mr-xs" />
                  Nomor resi telah diterbitkan dan terkunci untuk paket ini (Status: <b>{{ paket.status }}</b>).
                </div>
              </div>
            </div>

            <!-- Kolom Kanan: Preview Barcode -->
            <div class="col-12 col-md-7 flex flex-center">
              <div class="bg-white q-pa-lg rounded-borders shadow-2 full-width text-center" style="min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
                
                <!-- State Belum Memilih Format Barcode / Generate -->
                <div v-if="!selectedFormat" class="q-pa-md text-grey-6 full-width text-center">
                  <q-icon name="qr_code_2" size="48px" class="q-mb-xs text-grey-4" />
                  <div class="text-weight-bold text-slate-700">Format Barcode Belum Dipilih</div>
                  <div class="text-caption text-grey-6 q-mt-xs">
                    Silakan pilih format barcode di samping untuk melihat preview dan mencetak label barcode.
                  </div>
                </div>

                <div v-else-if="!paket" class="text-center text-grey-6 q-pa-md">
                  <q-icon name="qr_code_scanner" size="56px" color="grey-4" class="q-mb-sm" />
                  <div class="text-subtitle1 text-weight-bold text-slate-700">Belum Ada Barcode</div>
                  <div class="text-caption text-grey-6">
                    Pilih format barcode di sebelah kiri lalu tekan tombol <b>GENERATE BARCODE</b> untuk menerbitkan nomor resi dan barcode.
                  </div>
                </div>

                <!-- Pesan Error jika terjadi kegagalan -->
                <div v-else-if="barcodeError" class="q-pa-md bg-red-1 text-negative rounded-borders full-width text-center" style="border: 1px solid #fca5a5;">
                  <q-icon name="error_outline" size="32px" class="q-mb-xs" />
                  <div class="text-weight-bold text-subtitle2">{{ barcodeError }}</div>
                </div>

                <!-- Kontainer Barcode/QR/Matrix SVG -->
                <div v-else class="full-width flex flex-center column">
                  <div class="barcode-preview-container flex flex-center full-width">
                    <svg ref="svgRef" style="max-width: 100%; height: auto;"></svg>
                  </div>

                  <div class="q-mt-sm full-width text-center">
                    <div class="text-caption text-grey-8 text-weight-bold font-mono">
                      {{ paket?.barcode_format || selectedFormat }} &bull; Tracking: {{ paket?.nomor_resi }}
                    </div>

                    <!-- Keterangan Check Digits C & K khusus Code 93 -->
                    <div v-if="code93Info" class="q-mt-xs bg-blue-1 text-primary q-px-sm q-py-xs rounded-borders font-mono text-caption text-weight-bold" style="display: inline-block;">
                      Check Digits (C &amp; K): [ {{ code93Info.c }} ] [ {{ code93Info.k }} ] &bull; Disematkan otomatis di akhir bilah barcode
                    </div>
                    
                    <div class="q-mt-md">
                      <q-btn
                        outline
                        color="primary"
                        icon="print"
                        label="Print Barcode"
                        no-caps
                        class="text-weight-bold"
                        @click="showLabel = true"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- LANGKAH 2: INPUT DATA PAKET, PENGIRIM & PENERIMA -->
    <q-card class="scan-card q-pa-md">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold text-slate-800 row items-center q-mb-sm">
          <q-icon name="inventory_2" color="primary" size="22px" class="q-mr-sm" />
          LANGKAH 2 — DATA BARANG & ALAMAT TERSTRUKTUR
        </div>

        <div v-if="saved" class="text-center q-pa-md bg-green-1 rounded-borders">
          <q-icon name="check_circle" color="positive" size="42px" />
          <div class="text-subtitle1 text-weight-bold text-slate-900 q-mt-xs">
            Paket {{ paket?.nomor_resi }} TERDAFTAR!
          </div>
          <div class="text-caption text-grey-7 q-mb-md">
            Petugas cabang kini dapat memindai resi ini. Cetak label ekspedisi profesional berukuran 10 × 15 cm.
          </div>
          <div class="row justify-center q-gutter-sm">
            <q-btn outline color="primary" icon="print" label="Cetak Label Paket" no-caps @click="showLabel = true" class="text-weight-bold" />
            <q-btn unelevated color="primary" icon="add_box" label="Buat Paket Lagi" no-caps @click="resetForm" class="text-weight-bold" />
          </div>
        </div>

        <q-form v-else class="q-gutter-y-md" @submit.prevent="handleSave">
          <!-- SUBSECTION: DETAIL PAKET & BARANG -->
          <div class="bg-blue-1/30 q-pa-md rounded-borders" style="border: 1px solid #e2e8f0">
            <div class="text-subtitle2 text-weight-bold text-slate-900 q-mb-sm row items-center">
              <q-icon name="box" color="primary" class="q-mr-xs" /> Informasi Barang & Layanan
            </div>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-md-5">
                <q-input v-model="form.nama_barang" outlined dense label="Nama Barang *" bg-color="white" required />
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <q-select
                  v-model="form.jenis_layanan"
                  :options="layananOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Jenis Layanan"
                  bg-color="white"
                />
              </div>
              <div class="col-6 col-sm-3 col-md-2">
                <q-input
                  v-model.number="form.berat_kg"
                  outlined
                  dense
                  type="number"
                  step="0.1"
                  min="0"
                  suffix="kg"
                  label="Berat *"
                  bg-color="white"
                  required
                />
              </div>
              <div class="col-6 col-sm-3 col-md-2">
                <q-input
                  v-model.number="form.cod_amount"
                  outlined
                  dense
                  type="number"
                  prefix="Rp"
                  label="COD (Opsional)"
                  bg-color="white"
                />
              </div>
            </div>
          </div>

          <div class="row q-col-gutter-md">
            <!-- SUBSECTION: DATA PENGIRIM (9 FIELD) -->
            <div class="col-12 col-md-6">
              <div class="bg-grey-1 q-pa-md rounded-borders full-height" style="border: 1px solid #e2e8f0">
                <div class="text-subtitle2 text-weight-bold text-slate-900 q-mb-sm row items-center">
                  <q-icon name="person" color="primary" class="q-mr-xs" /> DATA PENGIRIM
                </div>
                <div class="column q-gutter-y-xs">
                  <q-input v-model="form.pengirim_nama" outlined dense label="1. Nama Lengkap *" bg-color="white" required />
                  <q-input
                    v-model="form.pengirim_telepon"
                    outlined
                    dense
                    label="2. Nomor Telepon *"
                    bg-color="white"
                    required
                    :rules="[val => val && /^\d{8,15}$/.test(val) || 'Nomor telepon 8-15 digit angka']"
                    type="tel"
                    inputmode="numeric"
                  />
                  <q-input v-model="form.pengirim_alamat" outlined dense label="3. Alamat / Nama Jalan *" bg-color="white" required />
                  
                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.pengirim_no_rumah" outlined dense label="4. Nomor Rumah" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.pengirim_kelurahan" outlined dense label="5. Kelurahan/Desa" bg-color="white" />
                    </div>
                  </div>

                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.pengirim_kecamatan" outlined dense label="6. Kecamatan" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.pengirim_kota" outlined dense label="7. Kota/Kabupaten *" bg-color="white" placeholder="Contoh: Jakarta" required />
                    </div>
                  </div>

                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.pengirim_provinsi" outlined dense label="8. Provinsi" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.pengirim_kode_pos" outlined dense label="9. Kode Pos" bg-color="white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SUBSECTION: DATA PENERIMA (9 FIELD) -->
            <div class="col-12 col-md-6">
              <div class="bg-grey-1 q-pa-md rounded-borders full-height" style="border: 1px solid #e2e8f0">
                <div class="text-subtitle2 text-weight-bold text-slate-900 q-mb-sm row items-center">
                  <q-icon name="location_on" color="primary" class="q-mr-xs" /> DATA PENERIMA
                </div>
                <div class="column q-gutter-y-xs">
                  <q-input v-model="form.penerima_nama" outlined dense label="1. Nama Lengkap *" bg-color="white" required />
                  <q-input
                    v-model="form.penerima_telepon"
                    outlined
                    dense
                    label="2. Nomor Telepon *"
                    bg-color="white"
                    required
                    :rules="[val => val && /^\d{8,15}$/.test(val) || 'Nomor telepon 8-15 digit angka']"
                    type="tel"
                    inputmode="numeric"
                  />
                  <q-input v-model="form.penerima_alamat" outlined dense label="3. Alamat / Nama Jalan *" bg-color="white" required />

                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.penerima_no_rumah" outlined dense label="4. Nomor Rumah" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.penerima_kelurahan" outlined dense label="5. Kelurahan/Desa" bg-color="white" />
                    </div>
                  </div>

                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.penerima_kecamatan" outlined dense label="6. Kecamatan" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.penerima_kota" outlined dense label="7. Kota/Kabupaten *" bg-color="white" placeholder="Contoh: Bandung" required />
                    </div>
                  </div>

                  <div class="row q-col-gutter-xs">
                    <div class="col-6">
                      <q-input v-model="form.penerima_provinsi" outlined dense label="8. Provinsi" bg-color="white" />
                    </div>
                    <div class="col-6">
                      <q-input v-model="form.penerima_kode_pos" outlined dense label="9. Kode Pos" bg-color="white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="row items-center justify-end q-gutter-sm q-mt-md">
            <q-btn
              outline
              color="grey-8"
              icon="bookmark_border"
              label="Simpan Draft"
              no-caps
              class="text-weight-bold"
              @click="handleSaveDraftManual"
            />
            <q-btn
              type="submit"
              color="primary"
              size="lg"
              unelevated
              icon="save"
              label="Simpan Paket & Terbitkan Label" no-caps
              class="text-weight-bolder q-px-xl"
              :loading="saving"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Dialog cetak label (komponen barcode terintegrasi) -->
    <BarcodeLabel v-model="showLabel" :resi="paket?.nomor_resi || ''" :paket-data="paket" :initial-format="paket?.barcode_format || selectedFormat || 'CODE_128'" />
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { BARCODE_FORMAT_OPTIONS, renderBarcode as utilRenderBarcode, calculateCode93CheckDigits, generateClientResi } from '../../utils/barcodeGenerator'
import { useAuthStore } from '../../stores/authStore'
import { usePaketStore } from '../../stores/paketStore'
import { buildSingleLineAddress } from '../../utils/addressFormatter'
import BarcodeLabel from '../../components/BarcodeLabel.vue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const paketStore = usePaketStore()

const generating = ref(false)
const saving = ref(false)
const saved = ref(false)
const paket = ref(null)
const draftId = ref(null)

const svgRef = ref(null)
const showLabel = ref(false)

const selectedFormat = ref(null)
const customerBarcodeFormatOptions = computed(() => BARCODE_FORMAT_OPTIONS)
const generatingBarcode = ref(false)
const barcodeError = ref('')
const currentPayload = ref(null)

const code93Info = computed(() => {
  if (selectedFormat.value !== 'CODE_93' || !paket.value?.nomor_resi) return null
  return calculateCode93CheckDigits(paket.value.nomor_resi)
})

const layananOptions = [
  { label: 'REG (REGULER)', value: 'REG' },
  { label: 'EXPRESS', value: 'EXPRESS' },
  { label: 'SAME_DAY', value: 'SAME_DAY' }
]

const emptyForm = () => ({
  nama_barang: '',
  jenis_layanan: 'REG',
  berat_kg: 1.0,
  cod_amount: 0,

  pengirim_nama: '',
  pengirim_telepon: '',
  pengirim_alamat: '',
  pengirim_no_rumah: '',
  pengirim_kelurahan: '',
  pengirim_kecamatan: '',
  pengirim_kota: '',
  pengirim_provinsi: '',
  pengirim_kode_pos: '',

  penerima_nama: '',
  penerima_telepon: '',
  penerima_alamat: '',
  penerima_no_rumah: '',
  penerima_kelurahan: '',
  penerima_kecamatan: '',
  penerima_kota: '',
  penerima_provinsi: '',
  penerima_kode_pos: ''
})

const form = reactive(emptyForm())

const renderCurrentBarcode = async () => {
  const resi = (paket.value?.nomor_resi || '').trim()
  if (!resi) return

  const fmt = paket.value?.barcode_format || selectedFormat.value
  if (!fmt) {
    if (svgRef.value) svgRef.value.innerHTML = ''
    barcodeError.value = ''
    currentPayload.value = null
    return
  }

  await nextTick()
  if (!svgRef.value) return

  localStorage.setItem(`paket_barcode_format_${resi.toUpperCase()}`, fmt)

  barcodeError.value = ''

  generatingBarcode.value = true
  try {
    const is2D = ['QR_CODE', 'AZTEC', 'DATA_MATRIX'].includes(fmt)
    const isStacked = fmt === 'PDF_417'

    // Perbesar 45-60% untuk kenyamanan tampilan dan pemindaian di layar customer
    const res = await utilRenderBarcode(svgRef.value, resi, fmt, {
      scale: 4,
      height: 25,
      qrSize: is2D ? 210 : 185,
      width: isStacked ? 370 : undefined,
      maxWidth: is2D ? '210px' : (isStacked ? '370px' : '430px'),
      maxHeight: is2D ? '210px' : (isStacked ? '125px' : '132px'),
      background: '#ffffff',
      lineColor: '#000000'
    })

    if (!res.success) {
      barcodeError.value = res.error
      currentPayload.value = null
    } else {
      currentPayload.value = res.payload
    }
  } finally {
    generatingBarcode.value = false
  }
}

watch(
  () => paket.value?.nomor_resi,
  async (resi) => {
    if (!resi) return
    await nextTick()
    renderCurrentBarcode()
  }
)

const UNASSIGNED_DRAFT_KEY = 'draft_paket_unassigned_form'

/**
 * Handle penekanan tombol "GENERATE BARCODE"
 * Barcode & nomor resi digenerate secara lokal untuk pratinjau.
 * TIDAK MEMBUAT RECORD DRAFT DI BACKEND ATAU DAFTAR PAKET!
 */
const handleGenerate = async () => {
  if (generating.value) return

  if (!selectedFormat.value) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Silakan pilih format barcode terlebih dahulu.',
      position: 'top',
      timeout: 2500
    })
    return
  }

  // Double-click protection
  generating.value = true
  try {
    const clientResi = generateClientResi(selectedFormat.value)
    saved.value = false
    paket.value = {
      nomor_resi: clientResi,
      barcode_format: selectedFormat.value,
      status: 'UNSAVED'
    }

    if (authStore.currentUser?.name && !form.pengirim_nama) {
      form.pengirim_nama = authStore.currentUser.name
    }

    $q.notify({
      type: 'positive',
      icon: 'verified',
      message: `Pratinjau barcode ${clientResi} berhasil dibuat (Format: ${selectedFormat.value})!`,
      position: 'top',
      timeout: 2200
    })

    await nextTick()
    await renderCurrentBarcode()
  } catch (err) {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: err.message || 'Terjadi kesalahan sistem saat membuat nomor resi.',
      position: 'top',
      timeout: 2500
    })
  } finally {
    generating.value = false
  }
}

/**
 * Handle perubahan format barcode di dropdown.
 * PENTING: Perubahan format barcode TIDAK PERNAH membuat nomor resi ataupun draft baru di backend!
 * Nomor resi lama tetap berada di state sampai user menekan tombol "Generate Barcode".
 */
const handleFormatChange = (newFormat) => {
  selectedFormat.value = newFormat
  // TIDAK memanggil backend sampai tombol "Generate Barcode" ditekan.
}

const handleSave = async () => {
  if (!selectedFormat.value) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Silakan pilih format barcode terlebih dahulu di Langkah 1.',
      position: 'top',
      timeout: 2500
    })
    return
  }

  // Wajib generate barcode terlebih dahulu agar nomor resi berasal dari backend
  if (!paket.value?.nomor_resi) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Silakan klik tombol "GENERATE BARCODE" terlebih dahulu untuk menerbitkan nomor resi sebelum menyimpan paket.',
      position: 'top',
      timeout: 3000
    })
    return
  }

  saving.value = true

  const pengirim_detail = {
    nama: form.pengirim_nama,
    telepon: form.pengirim_telepon,
    alamat: form.pengirim_alamat,
    no_rumah: form.pengirim_no_rumah,
    kelurahan: form.pengirim_kelurahan,
    kecamatan: form.pengirim_kecamatan,
    kota: form.pengirim_kota,
    provinsi: form.pengirim_provinsi,
    kode_pos: form.pengirim_kode_pos
  }

  const penerima_detail = {
    nama: form.penerima_nama,
    telepon: form.penerima_telepon,
    alamat: form.penerima_alamat,
    no_rumah: form.penerima_no_rumah,
    kelurahan: form.penerima_kelurahan,
    kecamatan: form.penerima_kecamatan,
    kota: form.penerima_kota,
    provinsi: form.penerima_provinsi,
    kode_pos: form.penerima_kode_pos
  }

  const payload = {
    nama_barang: form.nama_barang,
    jenis_layanan: form.jenis_layanan,
    berat_kg: form.berat_kg,
    pengirim: form.pengirim_nama,
    alamat_pengirim: buildSingleLineAddress(pengirim_detail),
    telepon_pengirim: form.pengirim_telepon,
    penerima: form.penerima_nama,
    alamat_tujuan: buildSingleLineAddress(penerima_detail),
    telepon_penerima: form.penerima_telepon,
    pengirim_detail,
    penerima_detail,
    hub_asal: form.pengirim_kota || 'Jakarta',
    hub_tujuan: form.penerima_kota || 'Bandung',
    cod_amount: Number(form.cod_amount) || 0,
    barcode_format: selectedFormat.value
  }

  const result = await paketStore.saveData(paket.value.nomor_resi, payload, authStore.currentUser)
  saving.value = false

  if (result.success) {
    localStorage.removeItem(UNASSIGNED_DRAFT_KEY)
    localStorage.setItem(`paket_barcode_format_${paket.value.nomor_resi.toUpperCase()}`, selectedFormat.value)
    paket.value = { ...payload, ...(result.paket || {}), barcode_format: selectedFormat.value, pengirim_detail, penerima_detail, status: 'TERDAFTAR' }
    saved.value = true
    $q.notify({
      type: 'positive',
      icon: 'task_alt',
      message: result.message || 'Paket berhasil disimpan!',
      position: 'top',
      timeout: 1500
    })
    await paketStore.fetchPakets()
    setTimeout(() => {
      router.push('/customer/paket')
    }, 800)
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: result.message || 'Gagal menyimpan data paket.',
      position: 'top',
      timeout: 2500
    })
  }
}

const manualDraftSaved = ref(false)

const handleSaveDraftManual = () => {
  const hasData = form.nama_barang || form.pengirim_nama || form.penerima_nama || form.pengirim_alamat || form.penerima_alamat
  if (!hasData && !paket.value?.nomor_resi) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Isi data paket atau pengirim/penerima terlebih dahulu sebelum menyimpan draft.',
      position: 'top',
      timeout: 2500
    })
    return
  }

  manualDraftSaved.value = true
  saveDraftToStorage()
  $q.notify({
    type: 'positive',
    icon: 'bookmark',
    message: 'Draft paket berhasil disimpan secara lokal.',
    position: 'top',
    timeout: 2000
  })
}

const resetForm = () => {
  paket.value = null
  draftId.value = null
  saved.value = false
  manualDraftSaved.value = false
  selectedFormat.value = null
  barcodeError.value = ''
  currentPayload.value = null
  localStorage.removeItem(UNASSIGNED_DRAFT_KEY)
  Object.assign(form, emptyForm())
  if (svgRef.value) svgRef.value.innerHTML = ''
}

const saveDraftToStorage = () => {
  if (saved.value) return

  // BUG-002: Hanya simpan state lokal jika user secara eksplisit menekan 'Simpan Draft'
  if (manualDraftSaved.value) {
    localStorage.setItem(UNASSIGNED_DRAFT_KEY, JSON.stringify({
      form,
      selectedFormat: selectedFormat.value,
      resi: paket.value?.nomor_resi || null
    }))
  }
}

onBeforeRouteLeave((to, from, next) => {
  // BUG-002: Jangan simpan draft otomatis di route leave kecuali user menekan 'Simpan Draft'
  if (manualDraftSaved.value && !saved.value) {
    saveDraftToStorage()
  }
  next()
})

onBeforeUnmount(() => {
  if (manualDraftSaved.value && !saved.value) {
    saveDraftToStorage()
  }
})

// Lanjutkan draft dari halaman "Paket Saya" (?resi=XXXX) atau pulihkan form yang belum di-generate resi
onMounted(async () => {
  const resi = (route.query.resi || '').toString().toUpperCase()
  if (!resi) {
    // Pulihkan form draft lokal jika ada (tanpa resi, tidak menyentuh database)
    const localUnassigned = localStorage.getItem(UNASSIGNED_DRAFT_KEY)
    if (localUnassigned) {
      try {
        const parsed = JSON.parse(localUnassigned)
        if (parsed.form) Object.assign(form, parsed.form)
        if (parsed.selectedFormat) {
          const isValidFormat = BARCODE_FORMAT_OPTIONS.some((opt) => opt.value === parsed.selectedFormat)
          if (isValidFormat) {
            selectedFormat.value = parsed.selectedFormat
          } else {
            // Hapus cache draft lama jika formatnya sudah tidak berlaku lagi
            localStorage.removeItem(UNASSIGNED_DRAFT_KEY)
          }
        }
      } catch (_) {}
    }
    return
  }

  await paketStore.fetchPakets()
  let draft = paketStore.findPaketByResi(resi)
  if (!draft) {
    const res = await paketStore.lookupByResi(resi)
    if (res.success) draft = res.paket
  }

  if (draft && draft.status === 'DRAFT' && authStore.isCustomer) {
    paket.value = draft
    draftId.value = draft.draft_id || null
    selectedFormat.value = draft.barcode_format || 'CODE_128'

    const localDraft = localStorage.getItem(`draft_paket_${resi}`)
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft)
        if (parsed.form) Object.assign(form, parsed.form)
        else Object.assign(form, parsed)
        if (parsed.format) selectedFormat.value = parsed.format
        if (parsed.draftId) draftId.value = parsed.draftId
      } catch (_) {}
    } else {
      form.nama_barang = draft.nama_barang || ''
      form.pengirim_nama = draft.pengirim || authStore.currentUser?.name || ''
      form.pengirim_telepon = draft.telepon_pengirim || ''
      form.pengirim_alamat = draft.alamat_pengirim || ''
      form.penerima_nama = draft.penerima || ''
      form.penerima_telepon = draft.telepon_penerima || ''
      form.penerima_alamat = draft.alamat_tujuan || ''
      form.berat_kg = draft.berat_kg || 1.0
      form.jenis_layanan = draft.jenis_layanan || 'REG'
    }

    await nextTick()
    renderCurrentBarcode()

    $q.notify({
      type: 'info',
      icon: 'restore',
      message: `Draft resi ${resi} telah dimuat (Format: ${selectedFormat.value})`,
      position: 'top',
      timeout: 2000
    })
  }
})
</script>

<style scoped>
.opacity-40 {
  opacity: 0.45;
}
.pointer-events-none {
  pointer-events: none;
}
.barcode-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 110px;
  max-height: 250px;
  margin: 10px auto;
}
.barcode-preview-container :deep(svg) {
  max-width: 500px;
  max-height: 230px;
  width: auto;
  height: auto;
}
</style>
