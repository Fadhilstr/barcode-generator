import { prepareZXingModule, getZXingModule, readBarcodesFromImageData } from 'zxing-wasm/reader'

let isReady = false
let initPromise = null

/**
 * Inisialisasi modul WebAssembly ZXing-C++ (zxing-wasm)
 */
export async function initZxingWasm() {
  if (isReady) return true
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        prepareZXingModule({
          overrides: {
            locateFile: (path) => {
              if (path.endsWith('.wasm')) return '/zxing_reader.wasm'
              return path
            }
          }
        })
      }
      await getZXingModule()
      isReady = true
      console.log('[ZXING-WASM] ZXing-C++ WebAssembly decoder module initialized.')
      return true
    } catch (err) {
      console.warn('[ZXING-WASM] Gagal inisialisasi modul WASM ZXing-C++:', err)
      return false
    }
  })()

  return initPromise
}

/**
 * Pindai barcode dari HTML5 ImageData menggunakan engine ZXing-C++ WebAssembly
 * Mendukung format CODE_93, UPC_E, dan format standar lainnya dengan performa instan (<10ms)
 * @param {ImageData} imageData
 * @param {object} options
 * @returns {Promise<Array>}
 */
export async function readBarcodesWasm(imageData, options = {}) {
  if (!imageData) return []
  try {
    const ready = await initZxingWasm()
    if (!ready) return []

    const results = await readBarcodesFromImageData(imageData, {
      tryHarder: true,
      eanAddOnSymbol: 'Read',
      ...options
    })
    return results || []
  } catch {
    return []
  }
}

/**
 * Ekstraksi teks hasil decode ZXing-WASM dengan penanganan khusus UPC-E.
 * - Untuk UPC-E: ZXing-C++ menyimpan 8-digit UPC-E string di `extra` ({"UPCE":"01234565"}).
 * @param {object} result
 * @returns {string}
 */
export function extractZxingWasmText(result) {
  if (!result) return ''
  if (result.format === 'UPCE' && result.extra) {
    try {
      const parsed = typeof result.extra === 'string' ? JSON.parse(result.extra) : result.extra
      if (parsed && parsed.UPCE) return String(parsed.UPCE)
    } catch {}
  }
  return String(result.text || '')
}

/**
 * Pemetaan nama format ZXing-C++ ke identifier standar 14 format DIJAK EXPRESS
 * @param {string} formatStr
 * @param {string} text
 * @returns {string}
 */
export function mapZxingWasmFormat(formatStr, text = '') {
  const f = String(formatStr || '')
  if (f.startsWith('DataBar')) return 'RSS_14'
  if (f === 'Code93') return 'CODE_93'
  if (f === 'Code128') return 'CODE_128'
  if (f.startsWith('Code39')) return 'CODE_39'
  if (f === 'Codabar') return 'CODABAR'
  if (f.startsWith('ITF')) return 'ITF'
  if (f.includes('PDF417')) return 'PDF_417'
  if (f.includes('QRCode')) return 'QR_CODE'
  if (f.includes('Aztec')) return 'AZTEC'
  if (f === 'DataMatrix') return 'DATA_MATRIX'
  if (f === 'EAN13' || f === 'ISBN' || f === 'UPCA' || f === 'EANUPC') {
    return f === 'UPCA' ? 'UPC_A' : 'EAN_13'
  }
  if (f === 'EAN8') return 'EAN_8'
  if (f === 'UPCE') return 'UPC_E'
  return f.toUpperCase()
}
