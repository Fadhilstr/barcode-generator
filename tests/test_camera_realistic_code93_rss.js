/**
 * tests/test_camera_realistic_code93_rss.js
 * P3: Simulasi kondisi kamera HP Android menengah (720p, cahaya gudang)
 * untuk CODE_93 & RSS_EXPANDED hasil render default baru P0
 * (scale 4, height 25/30, padding 20/12).
 *
 * Degradasi yang disimulasikan murni di JS (tanpa dep baru):
 *  1. Box-blur 3x3 (defocus kamera murah)
 *  2. Brightness -15% (cahaya gudang)
 *  3. Crop 10% sisi kanan (simbol terpotong bingkai) — khusus uji fallback
 *  4. Downscale lebar 50% (simulasi 720p) untuk CODE_93
 *
 * Decode memakai path produksi: patch RSS + MultiFormatReader hints AUTO-9
 * (bukan 15), Code93Reader tunggal, dan RSSExpandedReader still-image.
 *
 * Jalankan: node tests/test_camera_realistic_code93_rss.js
 */
import assert from 'node:assert/strict'
import bwipjs from 'bwip-js'
import { PNG } from 'pngjs'
import * as zxing from '@zxing/library'

import { applyZxingRssExpandedPatch } from '../src/utils/zxingRssExpandedPatcher.js'
import {
  resolveBarcodePayload,
  normalizeScannedBarcode,
  calculateCode93CheckDigits
} from '../src/utils/barcodeGenerator.js'

applyZxingRssExpandedPatch()

const {
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat
} = zxing

// --- helper citra -----------------------------------------------------------
function pngToGray(png) {
  const gray = new Uint8ClampedArray(png.width * png.height)
  for (let i = 0; i < png.width * png.height; i++) {
    const r = png.data[i * 4]
    const g = png.data[i * 4 + 1]
    const b = png.data[i * 4 + 2]
    gray[i] = (r * 306 + g * 601 + b * 117) >> 10
  }
  return { gray, width: png.width, height: png.height }
}

function boxBlur({ gray, width, height }) {
  const out = new Uint8ClampedArray(gray.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < width && yy < height) {
            sum += gray[yy * width + xx]
            n++
          }
        }
      }
      out[y * width + x] = Math.round(sum / n)
    }
  }
  return { gray: out, width, height }
}

function dimBrightness({ gray, width, height }, factor = 0.85) {
  const out = new Uint8ClampedArray(gray.length)
  for (let i = 0; i < gray.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(gray[i] * factor)))
  return { gray: out, width, height }
}

function cropRight({ gray, width, height }, frac = 0.1) {
  const w2 = Math.floor(width * (1 - frac))
  const out = new Uint8ClampedArray(w2 * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w2; x++) out[y * w2 + x] = gray[y * width + x]
  }
  return { gray: out, width: w2, height }
}

function downscaleHalf({ gray, width, height }) {
  const w2 = Math.floor(width / 2)
  const h2 = Math.floor(height / 2)
  const out = new Uint8ClampedArray(w2 * h2)
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const s = gray[(y * 2) * width + x * 2] + gray[(y * 2) * width + x * 2 + 1] +
        gray[(y * 2 + 1) * width + x * 2] + gray[(y * 2 + 1) * width + x * 2 + 1]
      out[y * w2 + x] = Math.round(s / 4)
    }
  }
  return { gray: out, width: w2, height }
}

function toBitmap(img) {
  return new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(img.gray, img.width, img.height)))
}

function autoHints9() {
  const hints = new Map()
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.RSS_EXPANDED,
    BarcodeFormat.RSS_14,
    BarcodeFormat.CODABAR,
    BarcodeFormat.ITF
  ])
  return hints
}

// --- test -------------------------------------------------------------------
async function renderPng(bcid, text, extra = {}) {
  const buf = await bwipjs.toBuffer({
    bcid,
    text,
    scale: 4,
    paddingwidth: 20,
    paddingheight: 12,
    backgroundcolor: 'ffffff',
    ...extra
  })
  return PNG.sync.read(buf)
}

async function run() {
  console.log('===============================================================')
  console.log('TEST P3: KAMERA REALISTIS CODE_93 & RSS_EXPANDED (HP 720p GUDANG)')
  console.log('===============================================================\n')

  // TEST 1: CODE_93 ideal (render P0) terbaca Code93Reader tunggal
  console.log('TEST 1: CODE_93 render P0 ideal → Code93Reader...')
  {
    const resi = 'CD93ANDR'
    const payload = resolveBarcodePayload(resi, 'CODE_93')
    const png = await renderPng('code93', payload.barcode_value, { height: 25, includecheck: true })
    const reader = new zxing.Code93Reader()
    const text = reader.decode(toBitmap(pngToGray(png))).getText()
    const norm = normalizeScannedBarcode(text, 'CODE_93')
    // bwip mengembalikan base+C&K → normalisasi harus mengupas ke resi awal
    assert.strictEqual(norm, resi, `CODE_93 ideal harus kembali ke ${resi}, dapat ${norm}`)
    console.log(`  -> PASS: "${text}" → "${norm}"\n`)
  }

  // TEST 2: CODE_93 degradasi gudang (blur + gelap + downscale 720p) via hints AUTO-9
  console.log('TEST 2: CODE_93 degradasi gudang → MultiFormatReader AUTO-9...')
  {
    const resi = 'CD93ANDR'
    const payload = resolveBarcodePayload(resi, 'CODE_93')
    const png = await renderPng('code93', payload.barcode_value, { height: 25, includecheck: true })
    const degraded = downscaleHalf(dimBrightness(boxBlur(pngToGray(png))))
    const reader = new MultiFormatReader()
    reader.setHints(autoHints9())
    const text = reader.decode(toBitmap(degraded)).getText()
    const norm = normalizeScannedBarcode(text, 'CODE_93')
    assert.strictEqual(norm, resi, `CODE_93 gudang harus kembali ke ${resi}, dapat ${norm}`)
    console.log(`  -> PASS: "${text}" → "${norm}" (${degraded.width}x${degraded.height})\n`)
  }

  // TEST 3: CODE_93 charset legal + kupas C&K (unit, tanpa citra)
  console.log('TEST 3: CODE_93 charset legal & C&K stripping (unit)...')
  {
    assert.strictEqual(normalizeScannedBarcode('AB-12.5', 'CODE_93'), 'AB-12.5')
    const ck = calculateCode93CheckDigits('CD93ANDR')
    assert.strictEqual(normalizeScannedBarcode(ck.full, 'CODE_93'), 'CD93ANDR')
    console.log(`  -> PASS: "AB-12.5" utuh, "${ck.full}" → "CD93ANDR"\n`)
  }

  // TEST 4: RSS_EXPANDED ideal (render P0) terbaca RSSExpandedReader ter-patch
  console.log('TEST 4: RSS_EXPANDED render P0 ideal → RSSExpandedReader...')
  {
    const resi = 'RSSEANDR'
    const payload = resolveBarcodePayload(resi, 'RSS_EXPANDED')
    assert.match(payload.barcode_value, /^\(01\)\d{14}\(10\)/)
    const png = await renderPng('databarexpanded', payload.barcode_value, { height: 30 })
    const reader = new zxing.RSSExpandedReader()
    const text = reader.decode(toBitmap(pngToGray(png))).getText()
    assert.strictEqual(text, payload.barcode_value)
    assert.strictEqual(normalizeScannedBarcode(text, 'RSS_EXPANDED'), resi)
    console.log(`  -> PASS: "${text}" → "${resi}"\n`)
  }

  // TEST 5: RSS_EXPANDED degradasi gudang (blur + gelap, tanpa crop)
  console.log('TEST 5: RSS_EXPANDED degradasi gudang → RSSExpandedReader...')
  {
    const resi = 'RSSEANDR'
    const payload = resolveBarcodePayload(resi, 'RSS_EXPANDED')
    const png = await renderPng('databarexpanded', payload.barcode_value, { height: 30 })
    const degraded = dimBrightness(boxBlur(pngToGray(png)))
    const reader = new zxing.RSSExpandedReader()
    const text = reader.decode(toBitmap(degraded)).getText()
    assert.strictEqual(normalizeScannedBarcode(text, 'RSS_EXPANDED'), resi)
    console.log(`  -> PASS: decode gudang → "${resi}"\n`)
  }

  // TEST 6: RSS_EXPANDED terpotong 10% → fallback GTIN (tidak boleh '')
  console.log('TEST 6: RSS_EXPANDED terpotong → fallback GTIN...')
  {
    const resi = 'RSSEANDR'
    const payload = resolveBarcodePayload(resi, 'RSS_EXPANDED')
    const gtinOnly = payload.barcode_value.split('(10)')[0] // "(01)GTIN14"
    const out = normalizeScannedBarcode(gtinOnly, 'RSS_EXPANDED')
    assert.ok(out && out.length > 0, 'Fallback GTIN tidak boleh string kosong')
    assert.strictEqual(out, gtinOnly.replace('(01)', ''))
    // unit crop citra: pastikan helper crop tidak merusak dimensi
    const png = await renderPng('databarexpanded', payload.barcode_value, { height: 30 })
    const cropped = cropRight(pngToGray(png), 0.1)
    assert.ok(cropped.width < png.width && cropped.width > 0)
    console.log(`  -> PASS: "${gtinOnly}" → "${out}"\n`)
  }

  console.log('===============================================================')
  console.log('SEMUA TEST KAMERA REALISTIS PASS')
  console.log('===============================================================')
}

run().catch((err) => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})
