/**
 * tests/test_camera_code93_upce.js
 * Verification test suite for CODE_93 & UPC_E camera scanner optimization,
 * and confirmation of complete removal of MAXICODE & RSS_EXPANDED.
 */

import assert from 'node:assert/strict'
import bwipjs from 'bwip-js'
import { PNG } from 'pngjs'
import * as zxing from '@zxing/library'
import { readBarcodesFromImageData } from 'zxing-wasm/reader'

import {
  BARCODE_FORMAT_OPTIONS,
  resolveBarcodePayload,
  normalizeScannedBarcode,
  generateClientResi,
  calculateUpceCheckDigit
} from '../src/utils/barcodeGenerator.js'
import {
  readBarcodesWasm,
  mapZxingWasmFormat,
  extractZxingWasmText
} from '../src/utils/zxingWasmReader.js'

const {
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  Code93Reader
} = zxing

async function renderBwipImageData(bwipName, text, options = {}) {
  const buf = await bwipjs.toBuffer({
    bcid: bwipName,
    text,
    scale: options.scale || 4,
    height: options.height || 22,
    paddingwidth: options.paddingwidth || 20,
    paddingheight: options.paddingheight || 15,
    includecheck: bwipName === 'code93',
    addongap: options.addongap || 9,
    backgroundcolor: 'ffffff'
  })

  const png = PNG.sync.read(buf)
  return {
    data: new Uint8ClampedArray(png.data),
    width: png.width,
    height: png.height,
    png
  }
}

async function runTests() {
  console.log('========================================================================')
  console.log('TEST SUITE: OPTIMASI KAMERA SCANNER CODE_93 & UPC_E (DIJAK EXPRESS)')
  console.log('========================================================================\n')

  // TEST 1: Verifikasi MAXICODE, RSS_EXPANDED & UPC_EAN_EXTENSION Telah Dihapus
  console.log('TEST 1: Verifikasi MAXICODE, RSS_EXPANDED & UPC_EAN_EXTENSION tidak ada di opsi format...')
  const maxiOpt = BARCODE_FORMAT_OPTIONS.find(o => o.value === 'MAXICODE')
  const rssExpOpt = BARCODE_FORMAT_OPTIONS.find(o => o.value === 'RSS_EXPANDED')
  const upcEanExtOpt = BARCODE_FORMAT_OPTIONS.find(o => o.value === 'UPC_EAN_EXTENSION')
  assert.strictEqual(maxiOpt, undefined, 'MAXICODE tidak boleh ada di BARCODE_FORMAT_OPTIONS!')
  assert.strictEqual(rssExpOpt, undefined, 'RSS_EXPANDED tidak boleh ada di BARCODE_FORMAT_OPTIONS!')
  assert.strictEqual(upcEanExtOpt, undefined, 'UPC_EAN_EXTENSION tidak boleh ada di BARCODE_FORMAT_OPTIONS!')
  assert.strictEqual(BARCODE_FORMAT_OPTIONS.length, 14, 'Total format barcode harus tepat 14.')
  assert.ok(BARCODE_FORMAT_OPTIONS.some(o => o.value === 'CODE_93'), 'CODE_93 harus aktif.')
  assert.ok(BARCODE_FORMAT_OPTIONS.some(o => o.value === 'UPC_E'), 'UPC_E harus aktif.')
  console.log('  -> PASS: Format tidak terpakai berhasil dihapus. Total 14 format aktif.\n')

  // TEST 2: Benchmark & Akurasi CODE_93 via ZXing-WASM
  console.log('TEST 2: Menguji performa & presisi deteksi CODE_93...')
  const testCode93Resi = 'CD93TEST'
  const payload93 = resolveBarcodePayload(testCode93Resi, 'CODE_93').barcode_value
  const imgData93 = await renderBwipImageData('code93', payload93)

  const tStart93 = performance.now()
  const results93 = await readBarcodesWasm(imgData93, { formats: ['Code93', 'UPCE'] })
  const tEnd93 = performance.now()
  const duration93 = tEnd93 - tStart93

  assert.ok(results93.length > 0, 'CODE_93 harus terdeteksi oleh ZXing-WASM')
  const res93 = results93[0]
  const fmt93 = mapZxingWasmFormat(res93.format, res93.text)
  assert.strictEqual(fmt93, 'CODE_93', 'Format harus terpetakan ke CODE_93')
  const norm93 = normalizeScannedBarcode(res93.text, fmt93)
  assert.strictEqual(norm93, testCode93Resi, 'Hasil normalisasi harus sesuai nomor resi asli')
  console.log(`  -> PASS: CODE_93 terbaca dalam ${duration93.toFixed(2)} ms (Text: ${res93.text}, Resi: ${norm93})\n`)

  // TEST 3: Auxiliary Fallback CODE_93 via JS Code93Reader
  console.log('TEST 3: Menguji fallback Code93Reader JS...')
  const gray93 = new Uint8ClampedArray(imgData93.width * imgData93.height)
  for (let i = 0; i < imgData93.width * imgData93.height; i++) {
    gray93[i] = (imgData93.data[i * 4] * 306 + imgData93.data[i * 4 + 1] * 601 + imgData93.data[i * 4 + 2] * 117) >> 10
  }
  const lum93 = new RGBLuminanceSource(gray93, imgData93.width, imgData93.height)
  const bitmap93 = new BinaryBitmap(new GlobalHistogramBinarizer(lum93))
  const code93Reader = new Code93Reader()
  const jsRes93 = code93Reader.decode(bitmap93)
  assert.strictEqual(normalizeScannedBarcode(jsRes93.getText(), 'CODE_93'), testCode93Resi)
  console.log(`  -> PASS: JS Code93Reader berhasil membaca barcode CODE_93 ("${jsRes93.getText()}").\n`)

  // TEST 4: Benchmark & Akurasi UPC_E via ZXing-WASM
  console.log('TEST 4: Menguji performa & presisi deteksi UPC_E...')
  const testUpceResi = '01234565' // Valid 8-digit UPC-E
  const imgDataUpce = await renderBwipImageData('upce', testUpceResi)

  const tStartUpce = performance.now()
  const resultsUpce = await readBarcodesWasm(imgDataUpce, { formats: ['Code93', 'UPCE', 'EANUPC'] })
  const tEndUpce = performance.now()
  const durationUpce = tEndUpce - tStartUpce

  assert.ok(resultsUpce.length > 0, 'UPC_E harus terdeteksi oleh ZXing-WASM')
  const resUpce = resultsUpce[0]
  const fmtUpce = mapZxingWasmFormat(resUpce.format, resUpce.text)
  assert.strictEqual(fmtUpce, 'UPC_E', 'Format harus terpetakan ke UPC_E')

  const extractedUpce = extractZxingWasmText(resUpce)
  assert.strictEqual(extractedUpce, testUpceResi, 'extractZxingWasmText harus menghasilkan 8-digit UPC-E asli')

  const normUpce = normalizeScannedBarcode(extractedUpce, fmtUpce)
  assert.strictEqual(normUpce, testUpceResi, 'Normalisasi UPC-E 8-digit harus cocok dengan nomor resi asli')

  // Uji normalisasi jika scanner mengembalikan versi dekompresi 13-digit ('0012345000065')
  const normExpanded13 = normalizeScannedBarcode('0012345000065', 'UPC_E')
  assert.strictEqual(normExpanded13, testUpceResi, 'Normalisasi dekompresi 13-digit harus kembali ke 8-digit UPC-E')

  console.log(`  -> PASS: UPC_E terbaca dalam ${durationUpce.toFixed(2)} ms (Extracted: ${extractedUpce}, Resi: ${normUpce})\n`)

  // TEST 5: Responsivitas Multi-Format (AUTO Mode gabungan)
  console.log('TEST 5: Menguji responsivitas mode AUTO terhadap format standar lainnya...')
  const autoTestCases = [
    { format: 'CODE_128', text: 'C128ANDR', bcid: 'code128' },
    { format: 'QR_CODE', text: 'QRCDANDR', bcid: 'qrcode' },
    { format: 'EAN_13', text: '8991234567891', bcid: 'ean13' },
    { format: 'EAN_8', text: '89912348', bcid: 'ean8' },
    { format: 'CODE_39', text: 'CD39ANDR', bcid: 'code39' }
  ]

  const autoFormats = ['Code93', 'UPCE', 'EANUPC', 'DataBar', 'Code128', 'Code39', 'Codabar', 'ITF', 'QRCode', 'DataMatrix', 'Aztec', 'PDF417']

  for (const tc of autoTestCases) {
    const img = await renderBwipImageData(tc.bcid, tc.text)
    const t0 = performance.now()
    const autoResults = await readBarcodesWasm(img, { formats: autoFormats, tryHarder: false })
    const t1 = performance.now()
    assert.ok(autoResults.length > 0, `${tc.format} harus terbaca di mode AUTO`)
    const mappedFmt = mapZxingWasmFormat(autoResults[0].format, autoResults[0].text)
    const norm = normalizeScannedBarcode(autoResults[0].text, mappedFmt)
    assert.strictEqual(norm, tc.text, `Normalisasi ${tc.format} harus cocok`)
    console.log(`  -> PASS: [${tc.format}] terbaca dalam ${(t1 - t0).toFixed(2)} ms -> Resi: "${norm}"`)
  }

  console.log('\n========================================================================')
  console.log(' SEMUA PENGUJIAN KAMERA CODE_93 & UPC_E BERHASIL DENGAN SEMPURNA (PASS)')
  console.log('========================================================================\n')
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
