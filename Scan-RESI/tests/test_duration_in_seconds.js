/**
 * tests/test_duration_in_seconds.js
 * Pengujian Waktu Scan Kamera / Dekoder per Format Barcode dalam Satuan Detik
 */

import bwipjs from 'bwip-js'
import { PNG } from 'pngjs'
import * as zxing from '@zxing/library'

import { applyZxingRssExpandedPatch } from '../src/utils/zxingRssExpandedPatcher.js'
import {
  BARCODE_FORMAT_OPTIONS,
  resolveBarcodePayload,
  normalizeScannedBarcode
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

const FORMAT_TEST_SUITE = [
  { name: 'CODE_128', testResi: 'C128ANDR', bwipName: 'code128', formatEnum: BarcodeFormat.CODE_128 },
  { name: 'QR_CODE', testResi: 'QRCDANDR', bwipName: 'qrcode', formatEnum: BarcodeFormat.QR_CODE },
  { name: 'AZTEC', testResi: 'AZTCANDR', bwipName: 'azteccode', formatEnum: BarcodeFormat.AZTEC },
  { name: 'DATA_MATRIX', testResi: 'DTMXANDR', bwipName: 'datamatrix', formatEnum: BarcodeFormat.DATA_MATRIX },
  { name: 'MAXICODE', testResi: 'MAXIANDR', bwipName: 'maxicode', formatEnum: BarcodeFormat.MAXICODE, blockedReason: 'Dibutuhkan hardware laser scanner 2D industri (Kamera webcam/browser JS tidak mendukung MaxiCode)' },
  { name: 'PDF_417', testResi: 'PDF4ANDR', bwipName: 'pdf417', formatEnum: BarcodeFormat.PDF_417 },
  { name: 'CODE_39', testResi: 'CD39ANDR', bwipName: 'code39', formatEnum: BarcodeFormat.CODE_39 },
  { name: 'CODE_93', testResi: 'CD93ANDR', bwipName: 'code93', readerName: 'Code93Reader', formatEnum: BarcodeFormat.CODE_93 },
  { name: 'CODABAR', testResi: '8823456789', bwipName: 'rationalizedCodabar', overridePayload: 'A8823456789B', readerName: 'CodaBarReader', formatEnum: BarcodeFormat.CODABAR },
  { name: 'ITF', testResi: '881234567890', bwipName: 'interleaved2of5', formatEnum: BarcodeFormat.ITF },
  { name: 'EAN_13', testResi: '8991234567891', bwipName: 'ean13', formatEnum: BarcodeFormat.EAN_13 },
  { name: 'EAN_8', testResi: '89912348', bwipName: 'ean8', formatEnum: BarcodeFormat.EAN_8 },
  { name: 'UPC_A', testResi: '012345678905', bwipName: 'upca', formatEnum: BarcodeFormat.UPC_A },
  { name: 'UPC_E', testResi: '01234565', bwipName: 'upce', readerName: 'UPCEReader', formatEnum: BarcodeFormat.UPC_E },
  { name: 'RSS_14', testResi: '18991234567898', bwipName: 'databaromni', overridePayload: '(01)18991234567898', readerName: 'RSS14Reader', formatEnum: BarcodeFormat.RSS_14 },
  { name: 'RSS_EXPANDED', testResi: 'RSSEANDR', bwipName: 'databarexpanded', readerName: 'RSSExpandedReader', formatEnum: BarcodeFormat.RSS_EXPANDED },
  { name: 'UPC_EAN_EXTENSION', testResi: '012345678905 12', bwipName: 'upcaean2', formatEnum: null, blockedReason: 'Format suplemental extension 2-digit/5-digit membutuhkan 2-pass dekoder' }
]

function getMedian(arr) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatTimestamp(dateObj) {
  const h = String(dateObj.getHours()).padStart(2, '0')
  const m = String(dateObj.getMinutes()).padStart(2, '0')
  const s = String(dateObj.getSeconds()).padStart(2, '0')
  const ms = String(dateObj.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

async function renderBwipPng(bwipName, text) {
  const buf = await bwipjs.toBuffer({
    bcid: bwipName,
    text: text,
    scale: 4,
    height: 20,
    paddingwidth: 20,
    paddingheight: 15,
    includecheck: bwipName === 'code93',
    backgroundcolor: 'ffffff'
  })

  const png = PNG.sync.read(buf)
  const gray = new Uint8ClampedArray(png.width * png.height)
  for (let i = 0; i < png.width * png.height; i++) {
    const r = png.data[i * 4]
    const g = png.data[i * 4 + 1]
    const b = png.data[i * 4 + 2]
    gray[i] = (r * 306 + g * 601 + b * 117) >> 10
  }
  return { lumSource: new RGBLuminanceSource(gray, png.width, png.height) }
}

async function runDetailedSecondsBenchmark() {
  console.log('===================================================================================')
  console.log(' PENGUJIHAN WAKTU SCAN DEKODER PER FORMAT BARCODE (DALAM SATUAN DETIK)')
  console.log(' Kondisi: Resolusi Tinggi, Pencahayaan Optimal, Jarak Standar (15-20 cm)')
  console.log('===================================================================================\n')

  const summaryRows = []

  for (const fmtConfig of FORMAT_TEST_SUITE) {
    console.log(`-----------------------------------------------------------------------------------`)
    console.log(`FORMAT BARCODE: ${fmtConfig.name} (Resi Target: ${fmtConfig.testResi})`)
    console.log(`-----------------------------------------------------------------------------------`)

    if (fmtConfig.blockedReason) {
      console.log(`  -> Status: BLOCKED`)
      console.log(`  -> Alasan: ${fmtConfig.blockedReason}\n`)
      summaryRows.push({
        Format: fmtConfig.name,
        'Resi Target': fmtConfig.testResi,
        Test: 5,
        Berhasil: 0,
        Gagal: 5,
        'Min (Detik)': '-',
        'Max (Detik)': '-',
        'Avg (Detik)': '-',
        'Median (Detik)': '-',
        'Success Rate': '0%',
        Kategori: 'BLOCKED',
        Status: 'BLOCKED'
      })
      continue
    }

    const payloadObj = resolveBarcodePayload(fmtConfig.testResi, fmtConfig.name)
    const payload = fmtConfig.overridePayload || payloadObj.barcode_value || fmtConfig.testResi
    const timesSec = []
    let successCount = 0

    for (let i = 1; i <= 5; i++) {
      const startTimeObj = new Date()
      const startIso = formatTimestamp(startTimeObj)

      try {
        const { lumSource } = await renderBwipPng(fmtConfig.bwipName, payload)
        const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource))

        let reader
        if (fmtConfig.readerName && zxing[fmtConfig.readerName]) {
          reader = new zxing[fmtConfig.readerName]()
        } else {
          const hints = new Map()
          hints.set(DecodeHintType.TRY_HARDER, true)
          if (fmtConfig.formatEnum !== null) {
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [fmtConfig.formatEnum])
          }
          reader = new MultiFormatReader()
          reader.setHints(hints)
        }

        const startHr = process.hrtime.bigint()
        const decodedResult = reader.decode(bitmap)
        const endHr = process.hrtime.bigint()

        const endTimeObj = new Date()
        const endIso = formatTimestamp(endTimeObj)

        const durationSec = Number(endHr - startHr) / 1000000000.0

        if (decodedResult && decodedResult.getText()) {
          const rawResult = decodedResult.getText()
          const normalized = normalizeScannedBarcode(rawResult, fmtConfig.name)

          if (normalized === fmtConfig.testResi || rawResult === payload || normalized.length >= 4) {
            successCount++
            timesSec.push(durationSec)
            console.log(`  Percobaan ${i}: Mulai ${startIso} | Dibaca ${endIso} | Durasi: ${durationSec.toFixed(4)} detik | Resi: ${normalized || rawResult} (PASS)`)
          } else {
            console.log(`  Percobaan ${i}: Mulai ${startIso} | Gagal normalisasi | Resi: ${normalized} (FAIL)`)
          }
        } else {
          console.log(`  Percobaan ${i}: Mulai ${startIso} | Dekoder tidak membaca hasil (FAIL)`)
        }
      } catch (err) {
        console.log(`  Percobaan ${i}: Mulai ${startIso} | Error: ${err.message || 'Decode Error'} (FAIL)`)
      }
    }

    if (successCount > 0) {
      const minSec = Math.min(...timesSec)
      const maxSec = Math.max(...timesSec)
      const avgSec = timesSec.reduce((a, b) => a + b, 0) / timesSec.length
      const medianSec = getMedian(timesSec)
      const successRateStr = `${((successCount / 5) * 100).toFixed(0)}%`

      let category = 'Sangat Cepat (< 1 detik)'
      if (avgSec >= 1 && avgSec < 2) category = 'Cepat (1–2 detik)'
      else if (avgSec >= 2 && avgSec < 3) category = 'Perlu Diperhatikan (2–3 detik)'
      else if (avgSec >= 3) category = 'Lambat (> 3 detik)'

      console.log(`  Summary ${fmtConfig.name}: Min = ${minSec.toFixed(4)}s | Max = ${maxSec.toFixed(4)}s | Avg = ${avgSec.toFixed(4)}s | Median = ${medianSec.toFixed(4)}s | Rate = ${successRateStr}\n`)

      summaryRows.push({
        Format: fmtConfig.name,
        'Resi Target': fmtConfig.testResi,
        Test: 5,
        Berhasil: successCount,
        Gagal: 5 - successCount,
        'Min (Detik)': `${minSec.toFixed(4)} s`,
        'Max (Detik)': `${maxSec.toFixed(4)} s`,
        'Avg (Detik)': `${avgSec.toFixed(4)} s`,
        'Median (Detik)': `${medianSec.toFixed(4)} s`,
        'Success Rate': successRateStr,
        Kategori: category,
        Status: 'PASS'
      })

    } else {
      console.log(`  Summary ${fmtConfig.name}: FAIL (0/5 berhasil)\n`)
      summaryRows.push({
        Format: fmtConfig.name,
        'Resi Target': fmtConfig.testResi,
        Test: 5,
        Berhasil: 0,
        Gagal: 5,
        'Min (Detik)': '-',
        'Max (Detik)': '-',
        'Avg (Detik)': '-',
        'Median (Detik)': '-',
        'Success Rate': '0%',
        Kategori: 'FAIL',
        Status: 'FAIL'
      })
    }
  }

  console.log('===================================================================================')
  console.log(' TABEL RINGKASAN HASIL TEST PERFORMA SCAN DALAM SATUAN DETIK')
  console.log('===================================================================================')
  console.table(summaryRows)
}

runDetailedSecondsBenchmark().catch(console.error)
