<template>
  <q-dialog v-model="show" persistent>
    <q-card style="width: 440px; max-width: 95vw; border-radius: 16px">
      <!-- Header Dialog -->
      <q-card-section class="row items-center justify-between q-pb-xs no-print">
        <div class="text-subtitle1 text-weight-bold text-slate-900 row items-center">
          <q-icon name="local_shipping" color="primary" size="22px" class="q-mr-xs" />
          Preview Label Dijak Express
        </div>
        <q-btn flat round dense icon="close" color="grey-7" v-close-popup />
      </q-card-section>

      <q-separator class="no-print" />

      <!-- Info Format Barcode yang dipilih saat buat paket (no-print, tanpa dropdown) -->
      <q-card-section class="q-px-md q-py-sm bg-grey-1 no-print row items-center justify-between">
        <div class="text-caption text-weight-bold text-slate-800 row items-center">
          <q-icon name="qr_code" size="18px" color="primary" class="q-mr-xs" />
          Format Barcode:
        </div>
        <q-badge color="primary" text-color="white" class="text-weight-bold font-mono q-px-sm q-py-xs">
          {{ currentFormat }}
        </q-badge>
      </q-card-section>

      <q-separator class="no-print" />
      <q-card-section class="q-pa-md flex flex-center bg-grey-2" style="max-height: 75vh; overflow-y: auto;">
        <div v-if="renderError" class="text-negative text-caption bg-red-1 q-pa-md rounded-borders full-width text-center">
          {{ renderError }}
        </div>

        <!-- Wadah Label Ekspedisi Compact Dijak Express -->
        <div v-else class="express-label-box bg-white text-black shadow-3">
          <!-- 1. HEADER -->
          <div class="label-header text-left">
            <div class="brand-title">DIJAK EXPRESS</div>
          </div>

          <div class="label-divider"></div>

          <!-- 2. NOMOR RESI & BARCODE (ALIGNMENT CENTER) -->
          <div class="label-resi-section text-center">
            <div class="resi-label-heading">NO. RESI</div>
            <div class="resi-number-main">{{ displayResi }}</div>
            <div class="barcode-svg-container">
              <svg ref="svgRef"></svg>
            </div>
            <div class="resi-number-sub">{{ displayResi }}</div>
            <div v-if="currentFormat === 'CODE_93' && code93Ck" class="resi-number-ck" style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 1px; font-family: monospace;">
              Check Digits C &amp; K: [ {{ code93Ck.c }} ] [ {{ code93Ck.k }} ]
            </div>
          </div>

          <div class="label-divider"></div>

          <!-- 3. DATA PENGIRIM (ALIGNMENT KIRI) -->
          <div class="label-section text-left">
            <div class="section-title-bold">PENGIRIM</div>
            <div class="person-name">{{ displayPengirimNama }}</div>
            <div v-if="displayPengirimTlp" class="person-phone">{{ displayPengirimTlp }}</div>
            <div v-if="displayPengirimAlamat && displayPengirimAlamat !== '-'" class="address-block">{{ displayPengirimAlamat }}</div>
          </div>

          <div class="label-divider"></div>

          <!-- 4. DATA PENERIMA (ALIGNMENT KIRI) -->
          <div class="label-section text-left">
            <div class="section-title-bold">PENERIMA</div>
            <div class="person-name recipient-highlight">{{ displayPenerimaNama }}</div>
            <div v-if="displayPenerimaTlp" class="person-phone">{{ displayPenerimaTlp }}</div>
            <div v-if="displayPenerimaAlamat && displayPenerimaAlamat !== '-'" class="address-block">{{ displayPenerimaAlamat }}</div>
          </div>

          <div class="label-divider"></div>

          <!-- 5. DETAIL PAKET (ALIGNMENT KIRI) -->
          <div class="label-section text-left">
            <div class="section-title-bold">DETAIL PAKET</div>
            <div class="detail-line font-medium">{{ displayJenisDanJumlah }}</div>
            <div class="detail-line">Berat: {{ displayBerat }}</div>
            <div class="detail-line">Dimensi: {{ displayDimensi }}</div>
            <div class="detail-line">COD: {{ displayCodText }}</div>
          </div>

          <div class="label-divider"></div>

          <!-- 6. INFORMASI RUTE (ALIGNMENT KIRI) -->
          <div class="label-section text-left">
            <div class="route-info">{{ displayRute }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator class="no-print" />

      <!-- Footer Aksi Dialog -->
      <q-card-actions align="right" class="q-pa-md bg-white no-print">
        <q-btn flat label="Tutup" no-caps color="grey-7" v-close-popup />
        <q-btn
          unelevated
          color="primary"
          icon="print"
          label="Cetak Label"
          no-caps
          :disable="!!renderError"
          class="text-weight-bold q-px-lg"
          @click="printLabel"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { BARCODE_FORMAT_OPTIONS, renderBarcode as utilRenderBarcode, calculateCode93CheckDigits } from '../utils/barcodeGenerator'
import { usePaketStore } from '../stores/paketStore'
import { useAuthStore } from '../stores/authStore'
import { formatAddressInfo, extractCityFromAddress, maskPhone, maskAddress } from '../utils/addressFormatter'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  resi: {
    type: String,
    default: ''
  },
  paketData: {
    type: Object,
    default: null
  },
  masked: {
    type: Boolean,
    default: undefined
  },
  initialFormat: {
    type: String,
    default: 'CODE_128'
  }
})

const emit = defineEmits(['update:modelValue'])
const paketStore = usePaketStore()
const authStore = useAuthStore()

const isMasked = computed(() => {
  if (props.masked !== undefined) {
    return props.masked
  }
  return authStore.currentUser?.role === 'CUSTOMER'
})

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const svgRef = ref(null)
const renderError = ref('')
const currentPaket = ref(null)

const resolveBarcodeFormat = () => {
  if (currentPaket.value?.barcode_format) {
    return currentPaket.value.barcode_format
  }
  const targetResi = (currentPaket.value?.nomor_resi || props.resi || '').toUpperCase()
  if (targetResi) {
    const saved = localStorage.getItem(`paket_barcode_format_${targetResi}`)
    if (saved) return saved
  }
  if (props.initialFormat && props.initialFormat !== 'CODE_128') {
    return props.initialFormat
  }
  return props.initialFormat || 'CODE_128'
}

const currentFormat = ref(props.initialFormat || 'CODE_128')

watch(
  () => [props.initialFormat, currentPaket.value],
  () => {
    currentFormat.value = resolveBarcodeFormat()
    renderBarcode()
  }
)

const displayResi = computed(() => {
  return (currentPaket.value?.nomor_resi || props.resi || '').toUpperCase()
})

const code93Ck = computed(() => {
  if (currentFormat.value !== 'CODE_93') return null
  return calculateCode93CheckDigits(displayResi.value)
})

const pengirimFormatted = computed(() => {
  return formatAddressInfo(
    currentPaket.value?.pengirim_detail,
    currentPaket.value?.pengirim || currentPaket.value?.creator_name || '',
    currentPaket.value?.pengirim_alamat || currentPaket.value?.alamat_pengirim || ''
  )
})

const penerimaFormatted = computed(() => {
  return formatAddressInfo(
    currentPaket.value?.penerima_detail,
    currentPaket.value?.penerima || '',
    currentPaket.value?.alamat_tujuan || ''
  )
})

const displayPengirimNama = computed(() => {
  return (
    pengirimFormatted.value?.name ||
    currentPaket.value?.pengirim ||
    currentPaket.value?.creator_name ||
    '-'
  )
})

const displayPengirimTlp = computed(() => {
  const phone = currentPaket.value?.telepon_pengirim ||
                currentPaket.value?.pengirim_detail?.telepon ||
                pengirimFormatted.value?.phone ||
                ''
  if (!phone) return ''
  const finalPhone = isMasked.value ? maskPhone(phone) : phone
  return `No. Telp: ${finalPhone}`
})

const displayPengirimAlamat = computed(() => {
  const lines = pengirimFormatted.value?.addressLines
  const rawAddr = (lines && lines.length > 0)
    ? lines.join(', ')
    : (currentPaket.value?.pengirim_alamat || currentPaket.value?.alamat_pengirim || currentPaket.value?.hub_asal || currentPaket.value?.kota_asal || '-')

  if (rawAddr === '-') return '-'

  if (isMasked.value) {
    return maskAddress(rawAddr, currentPaket.value?.pengirim_detail)
  }

  return rawAddr
})

const displayPenerimaNama = computed(() => {
  return penerimaFormatted.value?.name || currentPaket.value?.penerima || '-'
})

const displayPenerimaTlp = computed(() => {
  const phone = currentPaket.value?.telepon_penerima ||
                currentPaket.value?.penerima_detail?.telepon ||
                penerimaFormatted.value?.phone ||
                ''
  if (!phone) return ''
  const finalPhone = isMasked.value ? maskPhone(phone) : phone
  return `No. Telp: ${finalPhone}`
})

const displayPenerimaAlamat = computed(() => {
  const lines = penerimaFormatted.value?.addressLines
  const rawAddr = (lines && lines.length > 0)
    ? lines.join(', ')
    : (currentPaket.value?.alamat_tujuan || currentPaket.value?.hub_tujuan || currentPaket.value?.kota_tujuan || '-')

  if (rawAddr === '-') return '-'

  if (isMasked.value) {
    return maskAddress(rawAddr, currentPaket.value?.penerima_detail)
  }

  return rawAddr
})


const displayJenisDanJumlah = computed(() => {
  const jenis = currentPaket.value?.nama_barang || currentPaket.value?.jenis_barang
  const jumlah = currentPaket.value?.jumlah_barang || currentPaket.value?.jumlah
  if (jenis && jumlah) return `${jenis} — ${jumlah} PCS`
  if (jenis) return jenis
  return '-'
})

const displayBerat = computed(() => {
  const b = currentPaket.value?.berat_kg
  return (b !== undefined && b !== null && b !== '') ? `${b} KG` : '-'
})

const displayDimensi = computed(() => {
  return currentPaket.value?.dimensi || '-'
})

const displayCodText = computed(() => {
  if (currentPaket.value) {
    if (currentPaket.value.cod_amount && Number(currentPaket.value.cod_amount) > 0) return 'YA'
    if (currentPaket.value.is_cod !== undefined && currentPaket.value.is_cod) return 'YA'
    if (currentPaket.value.cod === 'YA') return 'YA'
  }
  return 'TIDAK'
})

const displayRute = computed(() => {
  // 1. Ekstrak Kota Asal dari variabel riil paket (tanpa dummy fallback)
  const asal = extractCityFromAddress(
    currentPaket.value?.hub_asal ||
    currentPaket.value?.kota_asal ||
    currentPaket.value?.pengirim_detail?.kota ||
    currentPaket.value?.pengirim_detail?.kabupaten ||
    currentPaket.value?.pengirim_detail ||
    currentPaket.value?.alamat_pengirim ||
    currentPaket.value?.pengirim_alamat ||
    pengirimFormatted.value?.addressLines,
    ''
  )

  // 2. Ekstrak Kota Tujuan dari variabel riil paket (tanpa dummy fallback)
  const tujuan = extractCityFromAddress(
    currentPaket.value?.hub_tujuan ||
    currentPaket.value?.kota_tujuan ||
    currentPaket.value?.penerima_detail?.kota ||
    currentPaket.value?.penerima_detail?.kabupaten ||
    currentPaket.value?.penerima_detail ||
    currentPaket.value?.alamat_tujuan ||
    penerimaFormatted.value?.addressLines,
    ''
  )

  if (asal && tujuan) {
    return `${asal.toUpperCase()} → ${tujuan.toUpperCase()}`
  }
  if (tujuan) {
    return tujuan.toUpperCase()
  }
  if (asal) {
    return asal.toUpperCase()
  }
  return '-'
})

// Load paket detail setiap kali dialog dibuka
watch(
  () => [props.modelValue, props.resi, props.paketData],
  async ([open]) => {
    if (!open) return
    renderError.value = ''

    if (props.paketData) {
      currentPaket.value = props.paketData
    } else if (props.resi) {
      const found = paketStore.findPaketByResi(props.resi)
      if (found) {
        currentPaket.value = found
      } else {
        const res = await paketStore.lookupByResi(props.resi)
        if (res.success) {
          currentPaket.value = res.paket
        } else {
          currentPaket.value = null
        }
      }
    } else {
      currentPaket.value = null
    }

    currentFormat.value = resolveBarcodeFormat()
    await nextTick()
    renderBarcode()
  },
  { immediate: true }
)

const renderBarcode = async () => {
  if (!svgRef.value) return
  const targetResi = displayResi.value
  if (!targetResi) return
  renderError.value = ''

  const isCode93 = currentFormat.value === 'CODE_93'
  const is2D = ['QR_CODE', 'AZTEC', 'DATA_MATRIX'].includes(currentFormat.value)
  const isStacked = currentFormat.value === 'PDF_417'

  // P0: CODE_93 dibesarkan agar terbaca kamera HP 720p (cahaya gudang)
  const res = await utilRenderBarcode(svgRef.value, targetResi, currentFormat.value, {
    scale: isCode93 ? 4 : 3,
    height: isCode93 ? 25 : 18.5,
    qrSize: is2D ? 152 : 135,
    width: isStacked ? 260 : undefined,
    paddingwidth: isCode93 ? 20 : undefined,
    paddingheight: isCode93 ? 12 : undefined,
    maxWidth: isCode93 ? '430px' : (is2D ? '152px' : (isStacked ? '260px' : '315px')),
    maxHeight: is2D ? '152px' : (isCode93 ? '132px' : (isStacked ? '90px' : '95px')),
    background: '#ffffff',
    lineColor: '#000000'
  })

  if (!res.success) {
    console.error('[LABEL] Gagal render barcode:', res.error)
    renderError.value = res.error || `Karakter pada resi tidak didukung format ${currentFormat.value}: "${targetResi}"`
  }
}

// Print label terisolasi dengan CSS compact
const printLabel = () => {
  const svgHtml = svgRef.value?.outerHTML || ''
  const win = window.open('', '_blank', 'width=600,height=750')
  if (!win) return

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Label Resi ${displayResi.value}</title>
    <style>
      @page {
        size: 10cm 14cm;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html, body {
        width: 100%;
        height: 100%;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        color: #000000;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .express-label {
        width: 10cm;
        padding: 12px 14px;
        border: 1px solid #000000;
        background: #ffffff;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .brand-title {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .label-divider {
        border-top: 1px solid #000000;
        margin: 7px 0;
      }
      .resi-label-heading {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .resi-number-main {
        font-size: 22px;
        font-weight: 800;
        font-family: 'Courier New', Courier, monospace;
        margin: 2px 0;
      }
      .barcode-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 4px 0;
      }
      .barcode-box svg {
        max-width: 350px;
        max-height: 155px;
        width: auto;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .resi-number-sub {
        font-size: 12px;
        font-weight: 700;
        font-family: 'Courier New', Courier, monospace;
        margin-top: 2px;
      }
      .section-title-bold {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        margin-bottom: 2px;
        letter-spacing: 0.5px;
      }
      .person-name {
        font-size: 13px;
        font-weight: 600;
      }
      .recipient-highlight {
        font-size: 14px;
        font-weight: 800;
      }
      .person-phone {
        font-size: 12px;
        margin-bottom: 1px;
      }
      .address-block {
        font-size: 11px;
        line-height: 1.35;
      }
      .detail-line {
        font-size: 12px;
        line-height: 1.4;
      }
      .font-medium {
        font-weight: 700;
      }
      .route-info {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
    </style>
  </head>
  <body>
    <div class="express-label">
      <!-- 1. HEADER -->
      <div class="text-left">
        <div class="brand-title">DIJAK EXPRESS</div>
      </div>

      <div class="label-divider"></div>

      <!-- 2. NOMOR RESI & BARCODE -->
      <div class="text-center">
        <div class="resi-label-heading">NO. RESI</div>
        <div class="resi-number-main">${displayResi.value}</div>
        <div class="barcode-box">
          ${svgHtml}
          <div class="resi-number-sub">${displayResi.value}</div>
          ${currentFormat.value === 'CODE_93' && code93Ck.value ? `<div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px; font-family: monospace;">Check Digits C &amp; K: [ ${code93Ck.value.c} ] [ ${code93Ck.value.k} ]</div>` : ''}
        </div>
      </div>

      <div class="label-divider"></div>

      <!-- 3. PENGIRIM -->
      <div class="text-left">
        <div class="section-title-bold">PENGIRIM</div>
        <div class="person-name">${displayPengirimNama.value}</div>
        ${displayPengirimTlp.value ? `<div class="person-phone">${displayPengirimTlp.value}</div>` : ''}
        ${displayPengirimAlamat.value && displayPengirimAlamat.value !== '-' ? `<div class="address-block">${displayPengirimAlamat.value}</div>` : ''}
      </div>

      <div class="label-divider"></div>

      <!-- 4. PENERIMA -->
      <div class="text-left">
        <div class="section-title-bold">PENERIMA</div>
        <div class="person-name recipient-highlight">${displayPenerimaNama.value}</div>
        ${displayPenerimaTlp.value ? `<div class="person-phone">${displayPenerimaTlp.value}</div>` : ''}
        ${displayPenerimaAlamat.value && displayPenerimaAlamat.value !== '-' ? `<div class="address-block">${displayPenerimaAlamat.value}</div>` : ''}
      </div>

      <div class="label-divider"></div>

      <!-- 5. DETAIL PAKET -->
      <div class="text-left">
        <div class="section-title-bold">DETAIL PAKET</div>
        <div class="detail-line font-medium">${displayJenisDanJumlah.value}</div>
        <div class="detail-line">Berat: ${displayBerat.value}</div>
        <div class="detail-line">Dimensi: ${displayDimensi.value}</div>
        <div class="detail-line">COD: ${displayCodText.value}</div>
      </div>

      <div class="label-divider"></div>

      <!-- 6. INFORMASI RUTE -->
      <div class="text-left">
        <div class="route-info">${displayRute.value}</div>
      </div>
    </div>
  </body>
</html>`)

  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
  }
}
</script>

<style scoped>
.express-label-box {
  width: 9.5cm;
  padding: 12px 14px;
  border: 1px solid #000000;
  box-sizing: border-box;
  font-family: Arial, Helvetica, sans-serif;
  color: #000000;
  background-color: #ffffff;
  border-radius: 4px;
}

.brand-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.label-divider {
  border-top: 1px solid #000000;
  margin: 7px 0;
}

.resi-label-heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.resi-number-main {
  font-size: 22px;
  font-weight: 800;
  font-family: 'Courier New', Courier, monospace;
  margin: 2px 0;
}

.barcode-svg-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 6px 0;
  min-height: 75px;
}

.barcode-svg-container :deep(svg) {
  max-width: 350px;
  max-height: 155px;
  width: auto;
  height: auto;
}

.resi-number-sub {
  font-size: 12px;
  font-weight: 700;
  font-family: 'Courier New', Courier, monospace;
}

.section-title-bold {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}

.person-name {
  font-size: 13px;
  font-weight: 600;
}

.recipient-highlight {
  font-size: 14px;
  font-weight: 800;
}

.person-phone {
  font-size: 12px;
}

.address-block {
  font-size: 11px;
  line-height: 1.35;
}

.detail-line {
  font-size: 12px;
  line-height: 1.4;
}

.font-medium {
  font-weight: 700;
}

.route-info {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
</style>
