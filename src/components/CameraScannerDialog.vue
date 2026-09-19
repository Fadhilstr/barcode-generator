<template>
  <q-dialog v-model="show" @before-show="onOpen" @hide="stopCamera">
    <q-card style="width: 500px; max-width: 94vw">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1 text-weight-bold text-slate-900 row items-center">
          <q-icon name="photo_camera" color="primary" size="22px" class="q-mr-xs" />
          SCAN BARCODE VIA KAMERA
        </div>
        <q-space />

        <!-- Tombol Flash / Senter Manual jika hardware HP mendukung -->
        <q-btn
          v-if="hasTorch"
          flat
          round
          dense
          :icon="isTorchOn ? 'flash_on' : 'flash_off'"
          :color="isTorchOn ? 'amber-9' : 'grey-7'"
          class="q-mr-xs"
          @click="toggleTorch"
        >
          <q-tooltip>{{ isTorchOn ? 'Matikan Lampu Senter (Flash)' : 'Nyalakan Lampu Senter (Flash)' }}</q-tooltip>
        </q-btn>

        <q-btn flat round dense icon="close" color="grey-7" @click="closeDialog">
          <q-tooltip>Tutup kamera</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator class="q-mt-sm" />

      <!-- Area Kamera -->
      <q-card-section class="q-pa-md">
        <div
          class="camera-frame bg-black rounded-borders overflow-hidden position-relative"
          style="min-height: 260px"
        >
          <div id="camera-scanner-region"></div>

          <!-- Single Centered Scan Area Overlay & Line -->
          <div v-if="status === 'scanning'" class="scan-overlay-box">
            <div class="scan-line" :class="{ 'scan-line--paused': isPaused || scannerState !== 'SCANNING' }"></div>
          </div>

          <!-- Floating Status & Torch Indicator inside Camera View -->
          <div v-if="status === 'scanning'" class="camera-floating-overlay">
            <!-- Badge jika lampu senter sedang menyala -->
            <div
              v-if="isTorchOn"
              class="light-status-pill light-status-pill--active row items-center q-gutter-x-xs"
            >
              <q-icon name="flash_on" size="13px" />
              <span>Senter Menyala</span>
            </div>

            <!-- Tombol Floating Torch di pojok kanan preview (mudah dijangkau jempol di HP) -->
            <q-btn
              v-if="hasTorch"
              round
              dense
              unelevated
              size="sm"
              :color="isTorchOn ? 'amber-8' : 'dark'"
              :text-color="isTorchOn ? 'black' : 'white'"
              :icon="isTorchOn ? 'flash_on' : 'flash_off'"
              class="torch-floating-btn"
              @click="toggleTorch"
            >
              <q-tooltip anchor="top middle" self="bottom middle">
                {{ isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter' }}
              </q-tooltip>
            </q-btn>
          </div>

          <!-- Overlay loading / error -->
          <div
            v-if="status === 'starting'"
            class="absolute-full flex flex-center bg-black-75"
          >
            <div class="text-center text-white">
              <q-spinner-dots size="40px" color="amber-4" />
              <div class="text-caption q-mt-xs">Mengaktifkan kamera...</div>
            </div>
          </div>

          <div v-if="status === 'error'" class="absolute-full flex flex-center q-pa-lg">
            <div class="text-center text-white">
              <q-icon name="no_photography" size="40px" color="negative" />
              <div class="text-body2 text-weight-bold q-mt-xs">Kamera tidak dapat diakses</div>
              <div class="text-caption text-grey-4 q-mt-xs">{{ errorMessage }}</div>
              <div class="text-caption text-grey-5 font-mono q-mt-sm" style="font-size: 10px">
                {{ technicalError }}
              </div>
              <q-btn outline dense color="amber-4" icon="refresh" label="Coba Lagi" no-caps class="q-mt-md" @click="startCamera" />
            </div>
          </div>
        </div>

        <!-- Status State Machine Barcode Scanner -->
        <div class="text-caption text-grey-7 text-center q-mt-sm row items-center justify-center">
          <template v-if="scannerState === 'PAUSED' || scannerState === 'PROCESSING'">
            <q-spinner-dots size="16px" color="amber-9" class="q-mr-xs" />
            <span class="text-weight-bold text-amber-9">PAUSED — Memproses resi {{ lastScannedResi }}...</span>
          </template>
          <template v-else-if="scannerState === 'WAITING_FOR_EXTENSION'">
            <q-spinner-dots size="16px" color="primary" class="q-mr-xs" />
            <span class="text-weight-bold text-primary">Membaca supplemental extension (+2 / +5 digit)...</span>
          </template>
          <template v-else-if="scannerState === 'ALERT' || scannerState === 'COOLDOWN'">
            <q-icon name="check_circle" size="16px" color="positive" class="q-mr-xs" v-if="latest?.level === 'success'" />
            <q-icon name="warning" size="16px" color="negative" class="q-mr-xs" v-else />
            <span class="text-weight-bold" :class="latest?.level === 'success' ? 'text-positive' : 'text-negative'">
              {{ latest ? `${latest.label}: ${latest.message}` : 'Hasil scan diproses' }}
            </span>
          </template>
          <template v-else-if="status === 'scanning'">
            <q-icon name="center_focus_strong" size="16px" color="primary" class="q-mr-xs" />
            <span class="text-weight-bold text-slate-700">SCANNING — Arahkan barcode ke layar kamera</span>
          </template>
        </div>

        <!-- Hasil scan TERAKHIR sesungguhnya (tervalidasi backend) -->
        <div v-if="latest" class="scan-result q-mt-sm" :class="`scan-result--${latest.level}`" role="status">
          <q-icon :name="levelIcon" size="22px" />
          <div class="col">
            <div class="row items-center q-gutter-x-xs">
              <span class="font-mono text-weight-bold">{{ latest.resi }}</span>
              <span class="text-weight-bold">{{ latest.label }}</span>
            </div>
            <div class="text-caption">{{ latest.message }}</div>
            <div v-if="latest.detail" class="text-caption" style="opacity: 0.85;">{{ latest.detail }}</div>
          </div>
        </div>

        <!-- Riwayat scan sesi ini (maks. 3 terakhir) -->
        <div v-if="history.length > 1" class="row justify-center q-gutter-x-xs q-mt-xs">
          <span
            v-for="h in history"
            :key="h.seq"
            class="history-chip font-mono"
            :class="`history-chip--${h.level}`"
          >
            {{ h.resi }}
          </span>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  DecodeHintType,
  BarcodeFormat,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  MultiFormatReader,
  Code93Reader,
  RSS14Reader,
  InvertedLuminanceSource
} from '@zxing/library'
import { normalizeScannedBarcode } from '../utils/barcodeGenerator'
import { readBarcodesWasm, mapZxingWasmFormat, extractZxingWasmText } from '../utils/zxingWasmReader'

const $q = useQuasar()

const ALL_SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.UPC_A
]

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  // Hasil validasi scan terakhir dari parent:
  // { seq, resi, level: 'success'|'warning'|'danger', label, message, detail? }
  feedback: {
    type: Object,
    default: null
  },
  // P1: hint format dominan (misal 'RSS_EXPANDED' / 'CODE_93') agar ZXing fallback pakai set hints & fast-path.
  // null/undefined = AUTO (9 format gabungan, bukan 15).
  preferredFormat: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'detected'])

const REGION_ID = 'camera-scanner-region'

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Lifecycle & State Machine Variables
let scanner = null
let zxingReader = null
let bindInterval = null
let audioCtx = null
let fallbackCanvas = null
let fallbackCtx = null
let isFrameProcessing = false
let fallbackTimer = null

let lastScanTimestamp = 0
let lastScannedResi = ''
let lastEmittedResi = ''
let emptyFramesCount = 0

// Synchronous Mutex Lock & Dua Tahap Extension State Machine
let isProcessingSync = false
let pendingMainBarcode = ''
let waitingExtensionTimer = null

// State Machine Status: IDLE -> STARTING -> SCANNING -> WAITING_FOR_EXTENSION -> PAUSED -> PROCESSING -> ALERT -> COOLDOWN -> RESUME -> SCANNING
const status = ref('idle') // idle | starting | scanning | error
const scannerState = ref('IDLE') // IDLE | SCANNING | WAITING_FOR_EXTENSION | PAUSED | PROCESSING | ALERT | COOLDOWN | RESUME
const isPaused = ref(false)
const isProcessingScan = ref(false)

const errorMessage = ref('')
const technicalError = ref('')
const latest = ref(null)
const history = ref([])

// Hardware Flash (Torch) State (Manual ON/OFF)
const hasTorch = ref(false)
const isTorchOn = ref(false)
let activeVideoTrack = null

let feedbackTimer = null
let lockFallbackTimer = null
let cooldownTimer = null

const stopZxing = () => {
  if (bindInterval) {
    clearInterval(bindInterval)
    bindInterval = null
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
  if (waitingExtensionTimer) {
    clearTimeout(waitingExtensionTimer)
    waitingExtensionTimer = null
  }
  pendingMainBarcode = ''
  if (zxingReader) {
    try {
      zxingReader.stopContinuousDecode()
    } catch {
      /* ignore */
    }
    try {
      zxingReader.reset()
    } catch {
      /* ignore */
    }
    zxingReader = null
  }
  fallbackCanvas = null
  fallbackCtx = null
  isFrameProcessing = false
}

const startZxingFallback = (videoElement) => {
  if (!videoElement || fallbackTimer) return
  try {
    const GS1_FAMILY = ['RSS_14', 'CODABAR', 'CODE_93']
    const preferred = String(props.preferredFormat || '').toUpperCase()
    const wantGs1Heavy = GS1_FAMILY.includes(preferred)

    // Format 2D murni ditangani engine utama → fallback tidak perlu jalan (hemat CPU).
    const PURE_2D = ['QR_CODE', 'DATA_MATRIX', 'AZTEC', 'PDF_417']
    if (PURE_2D.includes(preferred)) return

    const GS1_ZXING_FORMATS = [
      BarcodeFormat.CODE_93,
      BarcodeFormat.UPC_E,
      BarcodeFormat.RSS_14,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF
    ]
    // AUTO: CODE_93 & UPC_E diprioritaskan di awal array
    const AUTO_ZXING_FORMATS = [
      BarcodeFormat.CODE_93,
      BarcodeFormat.UPC_E,
      BarcodeFormat.RSS_14,
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_EAN_EXTENSION,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417
    ]
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      wantGs1Heavy ? GS1_ZXING_FORMATS : AUTO_ZXING_FORMATS
    )

    const multiReader = new MultiFormatReader()
    multiReader.setHints(hints)

    // Fast-path dedicated readers khusus format Code 93 & RSS-14
    const code93Dedicated = new Code93Reader()
    const rss14Dedicated = new RSS14Reader()

    const ZXING_FORMAT_NAME_MAP = {
      [BarcodeFormat.AZTEC]: 'AZTEC',
      [BarcodeFormat.CODABAR]: 'CODABAR',
      [BarcodeFormat.CODE_39]: 'CODE_39',
      [BarcodeFormat.CODE_93]: 'CODE_93',
      [BarcodeFormat.CODE_128]: 'CODE_128',
      [BarcodeFormat.DATA_MATRIX]: 'DATA_MATRIX',
      [BarcodeFormat.EAN_8]: 'EAN_8',
      [BarcodeFormat.EAN_13]: 'EAN_13',
      [BarcodeFormat.ITF]: 'ITF',
      [BarcodeFormat.PDF_417]: 'PDF_417',
      [BarcodeFormat.QR_CODE]: 'QR_CODE',
      [BarcodeFormat.RSS_14]: 'RSS_14',
      [BarcodeFormat.UPC_A]: 'UPC_A',
      [BarcodeFormat.UPC_E]: 'UPC_E',
      [BarcodeFormat.UPC_EAN_EXTENSION]: 'UPC_EAN_EXTENSION'
    }

    fallbackCanvas = document.createElement('canvas')
    fallbackCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true })

    const processFrame = async () => {
      if (!show.value || status.value !== 'scanning') return

      if (
        isProcessingSync ||
        isPaused.value ||
        isProcessingScan.value ||
        (scannerState.value !== 'SCANNING' && scannerState.value !== 'WAITING_FOR_EXTENSION')
      ) {
        fallbackTimer = setTimeout(processFrame, 100)
        return
      }

      if (isFrameProcessing) {
        fallbackTimer = setTimeout(processFrame, 30)
        return
      }

      const vw = videoElement.videoWidth
      const vh = videoElement.videoHeight

      if (!vw || !vh) {
        fallbackTimer = setTimeout(processFrame, 150)
        return
      }

      isFrameProcessing = true

      try {
        // Skala canvas ke lebar optimal (maks 960px) untuk keseimbangan kecepatan & ketajaman modul bar HP
        const maxW = 960
        const scale = vw > maxW ? maxW / vw : 1.0
        const cw = Math.floor(vw * scale)
        const ch = Math.floor(vh * scale)

        if (fallbackCanvas.width !== cw || fallbackCanvas.height !== ch) {
          fallbackCanvas.width = cw
          fallbackCanvas.height = ch
        }

        fallbackCtx.drawImage(videoElement, 0, 0, cw, ch)
        const imgData = fallbackCtx.getImageData(0, 0, cw, ch)
        const decodeStartTime = performance.now()

        // -----------------------------------------------------------------
        // FAST-PATH WASM (ZXing-C++):
        // Membaca Code 93, UPC-E, EAN/UPC, dsb secara ultra-instan (<10ms)
        // -----------------------------------------------------------------
        let wasmFormats = []
        if (preferred === 'CODE_93') {
          wasmFormats = ['Code93']
        } else if (preferred === 'UPC_E') {
          wasmFormats = ['UPCE', 'EANUPC']
        } else if (preferred === 'UPC_A') {
          wasmFormats = ['UPCA', 'EANUPC']
        } else if (preferred === 'UPC_EAN_EXTENSION') {
          wasmFormats = ['EANUPC']
        } else if (preferred === 'RSS_14') {
          wasmFormats = ['DataBar']
        } else if (wantGs1Heavy) {
          wasmFormats = ['Code93', 'UPCE', 'UPCA', 'DataBar', 'EANUPC']
        } else {
          // AUTO mode: prioritaskan format Code 93, UPC-E, UPC-A, EAN/UPC, DataBar, 1D linear, dan 2D
          wasmFormats = ['Code93', 'UPCE', 'UPCA', 'EANUPC', 'DataBar', 'Code128', 'Code39', 'Codabar', 'ITF', 'QRCode', 'DataMatrix', 'Aztec', 'PDF417']
        }

        try {
          const wasmResults = await readBarcodesWasm(imgData, {
            formats: wasmFormats,
            tryHarder: true,
            eanAddOnSymbol: 'Read'
          })

          if (wasmResults && wasmResults.length > 0) {
            const r = wasmResults[0]
            if (r) {
              const text = extractZxingWasmText(r)
              if (text) {
                const formatName = mapZxingWasmFormat(r.format, text)
                const decodeDuration = Math.round(performance.now() - decodeStartTime)
                onScanSuccess(text, { result: { format: { formatName } } }, decodeDuration)
                return
              }
            }
          }
        } catch {
          /* WASM pass selesai tanpa temuan -> lanjut ke JS auxiliary pass */
        }

        // -----------------------------------------------------------------
        // JS AUXILIARY ENGINE (@zxing/library):
        // -----------------------------------------------------------------
        const data = imgData.data
        const gray = new Uint8ClampedArray(cw * ch)
        for (let i = 0; i < cw * ch; i++) {
          const r = data[i * 4]
          const g = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          gray[i] = (r * 306 + g * 601 + b * 117) >> 10
        }

        const lumSource = new RGBLuminanceSource(gray, cw, ch)
        let decodeResult = null

        // Reset state pembaca dedicated sebelum memproses frame baru
        try { code93Dedicated.reset() } catch {}
        try { rss14Dedicated.reset() } catch {}

        // Crop ROI tengah (area laser overlay 92% x 55%) untuk kepresisian modul Code 93 & 1D
        let roiSource = lumSource
        try {
          const cropW = Math.floor(cw * 0.92)
          const cropH = Math.floor(ch * 0.55)
          const cropX = Math.floor((cw - cropW) / 2)
          const cropY = Math.floor((ch - cropH) / 2)
          roiSource = lumSource.crop(cropX, cropY, cropW, cropH)
        } catch {
          roiSource = lumSource
        }

        // Fast-path 1: Spesifik ke CODE_93 (pada ROI crop)
        if (preferred === 'CODE_93' || wantGs1Heavy || !preferred) {
          try {
            const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(roiSource))
            decodeResult = code93Dedicated.decode(bitmap)
          } catch {
            try {
              const bitmap = new BinaryBitmap(new HybridBinarizer(roiSource))
              decodeResult = code93Dedicated.decode(bitmap)
            } catch {}
          }
        }

        // Fast-path 2: Spesifik ke RSS_14
        if (!decodeResult && (preferred === 'RSS_14' || wantGs1Heavy || !preferred)) {
          try {
            const bitmap = new BinaryBitmap(new HybridBinarizer(roiSource))
            decodeResult = rss14Dedicated.decode(bitmap)
          } catch {
            try {
              const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(roiSource))
              decodeResult = rss14Dedicated.decode(bitmap)
            } catch {}
          }
        }

        // Pass 1 Utama: HybridBinarizer + MultiFormatReader (pada ROI crop)
        if (!decodeResult) {
          try {
            const bitmapHybrid = new BinaryBitmap(new HybridBinarizer(roiSource))
            decodeResult = multiReader.decodeWithState(bitmapHybrid)
          } catch {}
        }

        // Pass 2 Fallback: GlobalHistogramBinarizer + MultiFormatReader (full frame)
        if (!decodeResult) {
          try {
            const bitmapGlobal = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource))
            decodeResult = multiReader.decodeWithState(bitmapGlobal)
          } catch {}
        }

        // Pass 3 Inverted: Barcode pada latar gelap / refleksi gudang
        if (!decodeResult && (wantGs1Heavy || preferred === 'CODE_93' || preferred === 'UPC_E' || preferred === 'RSS_14')) {
          try {
            const invLum = new InvertedLuminanceSource(roiSource)
            const bitmapInv = new BinaryBitmap(new GlobalHistogramBinarizer(invLum))
            decodeResult = multiReader.decodeWithState(bitmapInv)
          } catch {}
        }

        if (decodeResult && decodeResult.getText && decodeResult.getText()) {
          const text = decodeResult.getText()
          const fmtEnum = decodeResult.getBarcodeFormat()
          const formatName = ZXING_FORMAT_NAME_MAP[fmtEnum] || null
          const decodeDuration = Math.round(performance.now() - decodeStartTime)
          onScanSuccess(text, { result: { format: { format: fmtEnum, formatName } } }, decodeDuration)
        }
      } catch (err) {
        /* decode gagal senyap di frame ini */
      } finally {
        isFrameProcessing = false
        fallbackTimer = setTimeout(processFrame, 30)
      }
    }

    fallbackTimer = setTimeout(processFrame, 60)
    console.log('[CAMERA] Scanner engine (ZXing-WASM fast-path + CODE_93 & UPC_E optimized) aktif.')
  } catch (err) {
    console.warn('[CAMERA] ZXing auxiliary engine could not bind:', err)
  }
}

const applyHardwareCameraConstraints = async (videoElement) => {
  if (!videoElement) return
  try {
    const stream = videoElement.srcObject
    if (stream && typeof stream.getVideoTracks === 'function') {
      const tracks = stream.getVideoTracks()
      if (tracks && tracks.length > 0) {
        const track = tracks[0]
        activeVideoTrack = track

        if (typeof track.getCapabilities === 'function' && typeof track.applyConstraints === 'function') {
          const caps = track.getCapabilities() || {}
          if (caps.torch) {
            hasTorch.value = true
          }

          const constraints = {}
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            constraints.focusMode = 'continuous'
          }
          if (caps.zoom && typeof caps.zoom === 'object' && caps.zoom.max >= 1.2) {
            constraints.zoom = Math.min(1.2, caps.zoom.max)
          }
          if (Object.keys(constraints).length > 0) {
            await track.applyConstraints({ advanced: [constraints] }).catch(() => {})
            console.log('[CAMERA] Hardware constraints applied:', constraints)
          }
        }
      }
    }
  } catch {
    /* hardware constraint opsional */
  }
}

// ---------------------------------------------------------------------
// KONTROL SENTER (TORCH) MANUAL
// ---------------------------------------------------------------------
const setTorch = async (targetState) => {
  if (!activeVideoTrack || !hasTorch.value) return
  try {
    await activeVideoTrack.applyConstraints({
      advanced: [{ torch: targetState }]
    })
    isTorchOn.value = targetState
  } catch (err) {
    console.warn('[CAMERA] Gagal mengatur status torch:', err)
  }
}

const toggleTorch = () => {
  setTorch(!isTorchOn.value)
}

const stopTorch = () => {
  if (isTorchOn.value && activeVideoTrack) {
    try {
      activeVideoTrack.applyConstraints({ advanced: [{ torch: false }] })
    } catch {}
  }
  isTorchOn.value = false
  hasTorch.value = false
  activeVideoTrack = null
}

// Ikon sesuai tingkat hasil terakhir
const levelIcon = computed(() => {
  switch (latest.value?.level) {
    case 'success': return 'check_circle'
    case 'warning': return 'warning'
    default: return 'cancel'
  }
})

let lastFeedbackSeq = 0

// Parent mengirim hasil validasi baru (setelah request HTTP selesai) -> tampilkan alert + catat riwayat -> masuk cooldown -> resume scanner
watch(
  () => props.feedback,
  (fb) => {
    if (!fb || fb.seq === lastFeedbackSeq) return
    lastFeedbackSeq = fb.seq

    if (lockFallbackTimer) {
      clearTimeout(lockFallbackTimer)
      lockFallbackTimer = null
    }

    latest.value = fb
    history.value = [fb, ...history.value.filter((h) => h.resi !== fb.resi)].slice(0, 3)

    scannerState.value = 'ALERT'

    if (feedbackTimer) clearTimeout(feedbackTimer)
    // Tampilkan alert selama 1.2 detik, kemudian masuk fase COOLDOWN dan RESUME
    feedbackTimer = setTimeout(() => {
      resumeScanner()
    }, 1200)
  }
)

// ---------------------------------------------------------------------
// RESUME SCANNER AUTOMATION
// ---------------------------------------------------------------------
const resumeScanner = () => {
  if (feedbackTimer) { clearTimeout(feedbackTimer); feedbackTimer = null }
  if (lockFallbackTimer) { clearTimeout(lockFallbackTimer); lockFallbackTimer = null }
  if (cooldownTimer) { clearTimeout(cooldownTimer); cooldownTimer = null }
  if (waitingExtensionTimer) { clearTimeout(waitingExtensionTimer); waitingExtensionTimer = null }
  pendingMainBarcode = ''

  scannerState.value = 'COOLDOWN'

  // Resume native html5-qrcode jika didukung
  if (scanner && typeof scanner.resume === 'function') {
    try {
      scanner.resume()
    } catch {
      /* ignore */
    }
  }

  // Cooldown singkat 300ms untuk memastikan buffer frame kamera bersih
  cooldownTimer = setTimeout(() => {
    emptyFramesCount = 0
    isProcessingSync = false
    isPaused.value = false
    isProcessingScan.value = false
    if (status.value === 'scanning' && show.value) {
      scannerState.value = 'SCANNING'
    }
  }, 300)
}

// ---------------------------------------------------------------------
// SIKLUS HIDUP KAMERA & SINGLE INSTANCE GUARANTEE
// ---------------------------------------------------------------------
const onOpen = () => {
  latest.value = null
  history.value = []
  lastScannedResi = ''
  lastEmittedResi = ''
  lastScanTimestamp = 0
  emptyFramesCount = 0
  isProcessingSync = false
  isPaused.value = false
  isProcessingScan.value = false
  pendingMainBarcode = ''
  scannerState.value = 'IDLE'

  if (feedbackTimer) clearTimeout(feedbackTimer)
  if (lockFallbackTimer) clearTimeout(lockFallbackTimer)
  if (cooldownTimer) clearTimeout(cooldownTimer)
  if (waitingExtensionTimer) clearTimeout(waitingExtensionTimer)
  startCamera()
}

const FRIENDLY_ERRORS = {
  NotAllowedError: 'Izin kamera ditolak. Klik ikon 🔒/📷 di address bar → izinkan Kamera → muat ulang halaman.',
  NotFound: 'Tidak ada kamera yang terdeteksi pada perangkat ini.',
  NotReadableError: 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.',
  OverconstrainedError: 'Kamera tidak mendukung mode yang diminta.'
}

const startCamera = async () => {
  // Pastikan instance lama terhenti total (mencegah kamera/overlay ganda)
  cleanupScanner()

  // Konteks tidak aman → getUserMedia diblokir browser
  if (!window.isSecureContext) {
    status.value = 'error'
    scannerState.value = 'IDLE'
    errorMessage.value =
      `Halaman ini dibuka via ${location.protocol}//${location.host}. ` +
      `Kamera hanya aktif di http://localhost atau halaman HTTPS.`
    technicalError.value = 'insecure context'
    return
  }

  status.value = 'starting'
  scannerState.value = 'IDLE'
  errorMessage.value = ''
  technicalError.value = ''

  const attempts = [
    // P1: minta resolusi HD + fokus kontinu agar bar 1-px CODE_93 & stacked RSS terbaca di HP menengah
    {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      focusMode: 'continuous'
    },
    { facingMode: 'environment' },
    true
  ]

  let lastError = null

  for (const cameraConfig of attempts) {
    try {
      scanner = new Html5Qrcode(REGION_ID, {
        formatsToSupport: ALL_SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false
        }
      })
      await scanner.start(
        cameraConfig,
        {
          // Full-frame: tanpa qrbox agar seluruh area video di-decode
          // (simbol lebar RSS_EXPANDED & posisi tepi ikut terbaca).
          // 30 fps dihindari: mempergelap frame gudang & membebani CPU HP menengah.
          fps: 22,
          aspectRatio: 1.7777778,
          disableFlip: false
        },
        onScanSuccess,
        onScanFailure
      )

      // Sambungkan auxiliary engine ZXing untuk membaca Code 93 & GS1 Expanded
      if (bindInterval) clearInterval(bindInterval)
      let bindAttempts = 0
      bindInterval = setInterval(() => {
        bindAttempts++
        const videoEl = document.querySelector(`#${REGION_ID} video`)
        if (videoEl && videoEl.videoWidth > 0) {
          if (bindInterval) clearInterval(bindInterval)
          bindInterval = null
          applyHardwareCameraConstraints(videoEl)
          startZxingFallback(videoEl)
        } else if (bindAttempts > 20) {
          if (bindInterval) clearInterval(bindInterval)
          bindInterval = null
          if (videoEl) {
            applyHardwareCameraConstraints(videoEl)
            startZxingFallback(videoEl)
          }
        }
      }, 200)

      status.value = 'scanning'
      scannerState.value = 'SCANNING'
      isPaused.value = false
      isProcessingScan.value = false
      emptyFramesCount = 0
      return
    } catch (err) {
      lastError = err
      console.error('[CAMERA] Gagal dengan config', cameraConfig, err)
      cleanupScanner()
    }
  }

  console.error('[CAMERA] Semua percobaan kamera gagal:', lastError)
  status.value = 'error'
  scannerState.value = 'IDLE'
  const errName = lastError?.name || 'UnknownError'
  errorMessage.value =
    FRIENDLY_ERRORS[errName] ||
    'Pastikan halaman dibuka via http://localhost atau https:// dan izinkan akses kamera.'
  technicalError.value = `${errName}: ${lastError?.message || '(tanpa pesan)'}`
}

const stopCamera = () => {
  if (feedbackTimer) { clearTimeout(feedbackTimer); feedbackTimer = null }
  if (lockFallbackTimer) { clearTimeout(lockFallbackTimer); lockFallbackTimer = null }
  if (cooldownTimer) { clearTimeout(cooldownTimer); cooldownTimer = null }
  if (waitingExtensionTimer) { clearTimeout(waitingExtensionTimer); waitingExtensionTimer = null }
  pendingMainBarcode = ''
  isProcessingSync = false

  stopZxing()
  stopTorch()

  // Hentikan hardware track kamera secara eksplisit agar stream tidak bocor
  const videoEl = document.querySelector(`#${REGION_ID} video`)
  if (videoEl && videoEl.srcObject) {
    try {
      const stream = videoEl.srcObject
      if (typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try { track.stop() } catch {}
        })
      }
      videoEl.srcObject = null
    } catch {}
  }

  if (scanner) {
    try {
      const s = scanner
      scanner = null
      s.stop()
        .then(() => s.clear())
        .catch(() => {})
    } catch {
      /* sudah terhenti */
    }
  }
  status.value = 'idle'
  scannerState.value = 'IDLE'
  isPaused.value = false
  isProcessingScan.value = false
  lastScannedResi = ''
  emptyFramesCount = 0
}

const cleanupScanner = () => {
  stopZxing()
  isProcessingSync = false
  if (waitingExtensionTimer) {
    clearTimeout(waitingExtensionTimer)
    waitingExtensionTimer = null
  }
  pendingMainBarcode = ''

  const videoEl = document.querySelector(`#${REGION_ID} video`)
  if (videoEl && videoEl.srcObject) {
    try {
      const stream = videoEl.srcObject
      if (typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try { track.stop() } catch {}
        })
      }
      videoEl.srcObject = null
    } catch {}
  }

  if (scanner) {
    try {
      scanner.clear()
    } catch {
      /* elemen belum siap */
    }
    scanner = null
  }
}

const closeDialog = () => {
  show.value = false
}

// Handler frame tanpa barcode: hitung berturut-turut untuk mereset lock resi saat barcode diangkat/dijauhkan dari kamera
const onScanFailure = () => {
  if (status.value === 'scanning' && !isPaused.value) {
    emptyFramesCount++
    // 120 frame (~5 detik) tanpa barcode sama sekali -> reset lock resi terakhir agar bisa discan ulang jika dibutuhkan
    if (emptyFramesCount >= 120) {
      if (lastEmittedResi) {
        lastEmittedResi = ''
      }
      if (lastScannedResi) {
        lastScannedResi = ''
      }
    }
  }
}

// ---------------------------------------------------------------------
// DETEKSI OTOMATIS BERDASARKAN STATE MACHINE & LOCKING RIGID
// SCANNING -> DETECTED -> PAUSED -> PROCESSING -> RESULT/ALERT -> COOLDOWN -> RESUME -> SCANNING
// ---------------------------------------------------------------------
const onScanSuccess = (decodedText, decodedResult, decodeDuration = null) => {
  // Guard 1: Mutex Lock synchronous dan status check
  if (
    isProcessingSync ||
    isPaused.value ||
    isProcessingScan.value ||
    scannerState.value !== 'SCANNING' ||
    status.value !== 'scanning'
  ) {
    return
  }

  // Guard 2: Sanitasi input decode
  const raw = String(decodedText || '').trim()
  if (!raw || raw.length < 4) return

  const formatName =
    decodedResult?.result?.format?.formatName ||
    decodedResult?.format?.formatName ||
    decodedResult?.result?.formatName ||
    null

  finalizeScan(raw, formatName, decodeDuration)
}

const finalizeScan = (raw, formatName, decodeDuration = null) => {
  const now = Date.now()

  // Full-frame: latar (garis keyboard, label tetangga) ikut ter-decode.
  // Hasil yang gagal normalisasi/validasi ditolak senyap — tanpa beep/emit.
  const resi = normalizeScannedBarcode(raw, formatName)
  if (!resi || resi.length < 4) return

  // Guard 3: KUNCI RIGID RESI TERAKHIR DALAM SESI KAMERA
  // Mencegah re-emit, bunyi beep berulang, atau spam alert saat kamera masih diarahkan ke paket yang sama
  if (lastEmittedResi === resi || (lastScannedResi === resi && (now - lastScanTimestamp) < 10000)) {
    lastScannedResi = resi
    emptyFramesCount = 0
    return
  }

  // === MASUK KE STATE PAUSED & PROCESSING SEKETIKA DENGAN SYNCHRONOUS MUTEX ===
  isProcessingSync = true
  isPaused.value = true
  isProcessingScan.value = true
  scannerState.value = 'PAUSED'
  pendingMainBarcode = ''
  lastScannedResi = resi
  lastEmittedResi = resi
  lastScanTimestamp = now
  emptyFramesCount = 0

  // Pause native html5-qrcode jika didukung
  if (scanner && typeof scanner.pause === 'function') {
    try {
      scanner.pause(true)
    } catch {
      /* ignore */
    }
  }

  playBeep()
  navigator.vibrate?.(60)

  // Emisikan hasil deteksi ke parent HANYA 1 KALI (Single Event Emission)
  emit('detected', resi, formatName, decodeDuration)

  // Safety fallback lock timer: Kamera 100% PAUSED sampai HTTP request selesai.
  // Fallback hanya aktif jika server/jaringan mati total (30 detik timeout).
  if (lockFallbackTimer) clearTimeout(lockFallbackTimer)
  lockFallbackTimer = setTimeout(() => {
    if (scannerState.value === 'PAUSED' || scannerState.value === 'PROCESSING') {
      resumeScanner()
    }
  }, 30000)
}

// Bunyi "beep" singkat tanpa file audio (WebAudio API)
const playBeep = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.1)
  } catch {
    /* autoplay policy — beep boleh gagal senyap */
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) stopCamera()
  }
)

onBeforeUnmount(stopCamera)
</script>

<!-- Unscoped CSS khusus untuk elemen dinamis html5-qrcode — matikan seluruh overlay bawaan agar HANYA ADA 1 FRAME SCANNING -->
<style>
#camera-scanner-region__scan_region,
#camera-scanner-region__scan_region svg,
#camera-scanner-region__scan_region img,
#camera-scanner-region__scan_region canvas,
#camera-scanner-region__shaded_region,
#camera-scanner-region__dashboard,
#camera-scanner-region__status_span,
#camera-scanner-region__header_message,
.html5-qrcode-element {
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  background: transparent !important;
  display: none !important;
}
</style>

<style scoped>
.camera-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

#camera-scanner-region {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

#camera-scanner-region video {
  border-radius: 12px;
  object-fit: cover;
  width: 100% !important;
  display: block;
  margin: 0 auto;
}

/* Panel hasil scan — tonal sesuai tingkat keberhasilan */
.scan-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.scan-result--success {
  background-color: #dcfce7;
  color: #15803d;
  border-color: #22c55e;
}

.scan-result--warning {
  background-color: #fee2e2;
  color: #b91c1c;
  border-color: #ef4444;
}

.scan-result--danger {
  background-color: #fee2e2;
  color: #b91c1c;
  border-color: #ef4444;
}

.history-chip {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.history-chip--success { background-color: #dcfce7; color: #15803d; }
.history-chip--warning { background-color: #fee2e2; color: #b91c1c; }
.history-chip--danger  { background-color: #fee2e2; color: #b91c1c; }

/* Single Centered Scan Area & Laser Line Overlay */
.scan-overlay-box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 92%;
  height: 55%;
  border: 2px dashed rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.scan-line {
  width: 92%;
  height: 2px;
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
  animation: scanMove 2s infinite ease-in-out;
}

.scan-line--paused {
  background: #f59e0b;
  box-shadow: 0 0 10px #f59e0b;
  animation-play-state: paused;
}

@keyframes scanMove {
  0% { transform: translateY(-45px); opacity: 0.8; }
  50% { transform: translateY(45px); opacity: 1.0; }
  100% { transform: translateY(-45px); opacity: 0.8; }
}

/* Floating overlay untuk indikator cahaya & tombol senter */
.camera-floating-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  pointer-events: none;
}

.light-status-pill {
  background: rgba(0, 0, 0, 0.68);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.4);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
  pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: all 0.25s ease;
}

.light-status-pill--active {
  background: rgba(245, 158, 11, 0.9);
  color: #1e1b4b;
  border-color: #f59e0b;
}

.torch-floating-btn {
  margin-left: auto;
  pointer-events: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: transform 0.15s ease;
}

.torch-floating-btn:active {
  transform: scale(0.92);
}
</style>

