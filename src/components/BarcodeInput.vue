<template>
  <q-card class="scan-card q-pa-md q-mb-lg">
    <q-card-section class="q-pa-sm">
      <div class="row items-center justify-between q-mb-sm">
        <div class="text-subtitle1 text-weight-bold text-slate-900 row items-center">
          <q-icon name="qr_code_scanner" size="22px" color="primary" class="q-mr-sm" />
          Nomor Resi / Hasil Barcode
        </div>
        <div class="text-caption text-grey-6 flex items-center" v-if="!disabled">
          <span class="scanner-dot q-mr-xs"></span> Scanner siap
        </div>
      </div>

      <div class="row q-col-gutter-sm items-center">
        <div class="col-12 col-sm-9 col-md-10">
          <q-input
            ref="inputRef"
            v-model="barcodeValue"
            outlined
            dense
            placeholder="Scan atau masukkan barcode..."
            class="scanner-input-box font-mono text-weight-bold text-h6"
            :disabled="disabled"
            autofocus
            @keyup.enter="handleScan"
            bg-color="white"
          >
            <template v-slot:prepend>
              <q-icon name="barcode_reader" color="primary" />
            </template>
            <template v-slot:append>
              <q-btn
                flat
                round
                dense
                icon="photo_camera"
                color="primary"
                :disable="disabled"
                @click="showCamera = true"
              >
                <q-tooltip>Scan via kamera</q-tooltip>
              </q-btn>
              <q-btn
                v-if="barcodeValue"
                flat
                round
                dense
                icon="close"
                @click="clearInput"
              />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-sm-3 col-md-2">
          <q-btn
            color="primary"
            class="full-width"
            size="lg"
            icon="search"
            label="Scan"
            no-caps
            :disabled="disabled || !barcodeValue.trim()"
            @click="handleScan"
            unelevated
          />
        </div>
      </div>
    </q-card-section>
  </q-card>

  <!-- Dialog Scan Kamera -->
  <CameraScannerDialog v-model="showCamera" :feedback="feedback" @detected="handleCameraDetected" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import CameraScannerDialog from './CameraScannerDialog.vue'
import { normalizeScannedBarcode } from '../utils/barcodeGenerator'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  // Hasil validasi scan terakhir (dari halaman) → diteruskan ke dialog kamera
  feedback: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['scan'])
const barcodeValue = ref('')
const inputRef = ref(null)
const showCamera = ref(false)

const focusInput = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

const clearInput = () => {
  barcodeValue.value = ''
  focusInput()
}

// Satu jalur submit untuk semua sumber input (manual / scanner USB / kamera)
const submitValue = (rawValue, format = null, duration = null) => {
  const normalized = normalizeScannedBarcode((rawValue || '').trim(), format)
  if (props.disabled || !normalized) return false

  emit('scan', normalized, format, duration)
  barcodeValue.value = ''
  focusInput()
  return true
}

const handleScan = () => {
  submitValue(barcodeValue.value, null, 25)
}

// Hasil deteksi kamera → alur scan yang sama dengan input manual (FR-3)
const handleCameraDetected = (val, format = null, duration = null) => {
  submitValue(val, format, duration)
}

// ---------------------------------------------------------------------
// Auto-capture scanner USB (keyboard wedge)
//
// Scanner handheld "mengetik" karakter cepat lalu menutup dengan Enter.
// Listener global ini menangkap burst tersebut walau fokus sedang tidak
// di kolom input — misal setelah petugas klik tombol lain.
// Ketikan manusia di elemen input lain TIDAK ikut terjacking.
// ---------------------------------------------------------------------
const WEDGE_GAP_MS = 120 // jeda maks antar karakter agar dianggap burst scanner
let wedgeBuffer = ''
let wedgeLastAt = 0
let wedgeStartAt = 0

const isTypingTarget = (el) =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

const onGlobalKeydown = (e) => {
  if (props.disabled || showCamera.value) return
  if (e.ctrlKey || e.altKey || e.metaKey) return

  // Sedang mengetik di elemen form mana pun → serahkan ke perilaku normal
  if (isTypingTarget(e.target)) return

  const now = Date.now()

  if (e.key === 'Enter') {
    const value = wedgeBuffer
    const wedgeDurationMs = wedgeStartAt ? Math.min(Math.max(now - wedgeStartAt, 15), 500) : 25
    wedgeBuffer = ''
    wedgeStartAt = 0
    if (value.length >= 4 && now - wedgeLastAt <= WEDGE_GAP_MS * 3) {
      e.preventDefault()
      submitValue(value, null, wedgeDurationMs)
    }
    return
  }

  if (e.key.length === 1) {
    if (!wedgeBuffer) {
      wedgeStartAt = now
    }
    wedgeBuffer = now - wedgeLastAt <= WEDGE_GAP_MS ? wedgeBuffer + e.key : e.key
    wedgeLastAt = now
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  focusInput()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>
