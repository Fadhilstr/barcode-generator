import bwipjs from 'bwip-js'

/**
 * 14 Format Barcode standar yang didukung penuh oleh decoder kamera scanner:
 * QR_CODE, AZTEC, CODABAR, CODE_39, CODE_93, CODE_128, DATA_MATRIX, ITF,
 * EAN_13, EAN_8, PDF_417, RSS_14, UPC_A, UPC_E.
 */
export const BARCODE_FORMAT_OPTIONS = [
  { label: 'CODE_128', value: 'CODE_128', supported: true, category: '1D' },
  { label: 'QR_CODE', value: 'QR_CODE', supported: true, category: '2D Matrix' },
  { label: 'AZTEC', value: 'AZTEC', supported: true, category: '2D Matrix' },
  { label: 'DATA_MATRIX', value: 'DATA_MATRIX', supported: true, category: '2D Matrix' },
  { label: 'PDF_417', value: 'PDF_417', supported: true, category: '2D Stacked' },
  { label: 'CODE_39', value: 'CODE_39', supported: true, category: '1D' },
  { label: 'CODE_93', value: 'CODE_93', supported: true, category: '1D' },
  { label: 'CODABAR', value: 'CODABAR', supported: true, category: '1D' },
  { label: 'ITF (Interleaved 2 of 5)', value: 'ITF', supported: true, category: '1D' },
  { label: 'EAN_13', value: 'EAN_13', supported: true, category: '1D Numerik' },
  { label: 'EAN_8', value: 'EAN_8', supported: true, category: '1D Numerik' },
  { label: 'UPC_A', value: 'UPC_A', supported: true, category: '1D Numerik' },
  { label: 'UPC_E', value: 'UPC_E', supported: true, category: '1D Numerik' },
  { label: 'RSS_14 (GS1 DataBar)', value: 'RSS_14', supported: true, category: '1D GS1' }
]

/**
 * Pemetaan format ke identifier BWIPP (Barcode Writer in Pure JavaScript)
 */
const BWIP_FORMAT_MAP = {
  CODE_128: 'code128',
  QR_CODE: 'qrcode',
  AZTEC: 'azteccode',
  DATA_MATRIX: 'datamatrix',
  PDF_417: 'pdf417',
  CODE_39: 'code39',
  CODE_93: 'code93',
  CODABAR: 'rationalizedCodabar',
  ITF: 'interleaved2of5',
  EAN_13: 'ean13',
  EAN_8: 'ean8',
  UPC_A: 'upca',
  UPC_E: 'upce',
  RSS_14: 'databaromni'
}

/**
 * Menghasilkan digit angka deterministik dan unik dari sebuah string (tracking number)
 * Menggunakan algoritma hash FNV-1a 32-bit standar yang 100% identik dengan implementasi Perl backend.
 */
export function stringToDeterministicDigits(str, targetLength) {
  const cleanStr = (str || '').trim().toUpperCase()
  let h = 2166136261 >>> 0
  for (let i = 0; i < cleanStr.length; i++) {
    h = Math.imul(h ^ cleanStr.charCodeAt(i), 16777619) >>> 0
  }
  let digits = String(h)
  let h2 = h
  while (digits.length < targetLength) {
    h2 = Math.imul(h2 ^ 0x12345678, 16777619) >>> 0
    digits += String(h2)
  }
  return digits.slice(0, targetLength)
}

/**
 * Menghitung check digit Modulo 10 standar GS1 / EAN / UPC
 */
export function calculateMod10CheckDigit(digits) {
  let sum = 0
  for (let i = digits.length - 1; i >= 0; i--) {
    const n = parseInt(digits[i], 10)
    sum += (digits.length - i) % 2 === 1 ? n * 3 : n
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Menghitung check digit UPC-E standar via ekspansi UPC-A
 */
export function calculateUpceCheckDigit(payload6) {
  const d = String(payload6).padStart(6, '0').slice(-6).split('').map(Number)
  let upca = []
  const last = d[5]
  if (last === 0 || last === 1 || last === 2) {
    upca = [0, d[0], d[1], last, 0, 0, 0, 0, d[2], d[3], d[4]]
  } else if (last === 3) {
    upca = [0, d[0], d[1], d[2], 0, 0, 0, 0, 0, d[3], d[4]]
  } else if (last === 4) {
    upca = [0, d[0], d[1], d[2], d[3], 0, 0, 0, 0, 0, d[4]]
  } else {
    upca = [0, d[0], d[1], d[2], d[3], d[4], 0, 0, 0, 0, last]
  }
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += upca[i] * (i % 2 === 0 ? 3 : 1)
  }
  const rem = sum % 10
  return rem === 0 ? 0 : 10 - rem
}

/**
 * Menghitung 2 karakter check digit C dan K standar Code 93
 */
export function calculateCode93CheckDigits(str) {
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%abcd*'
  const clean = (str || '').trim().toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '')
  if (!clean) return { c: '', k: '', full: '' }

  // Check character C (bobot 1..20)
  let weight = 1
  let total = 0
  for (let i = clean.length - 1; i >= 0; i--) {
    total += weight * ALPHABET.indexOf(clean.charAt(i))
    if (++weight > 20) weight = 1
  }
  const c = ALPHABET[total % 47]

  // Check character K (bobot 1..15 terhadap string + C)
  const withC = clean + c
  weight = 1
  total = 0
  for (let i = withC.length - 1; i >= 0; i--) {
    total += weight * ALPHABET.indexOf(withC.charAt(i))
    if (++weight > 15) weight = 1
  }
  const k = ALPHABET[total % 47]

  return { c, k, full: clean + c + k }
}

/**
 * Ekspansi UPC-E (8 digit) ke UPC-A (12 digit)
 */
export function expandUpceToUpca(upceStr) {
  const clean = String(upceStr).padStart(8, '0').slice(-8)
  const d = clean.slice(1, 7).split('').map(Number)
  const cd = clean.slice(7, 8)
  const last = d[5]
  let upcaDigits = []

  if (last === 0 || last === 1 || last === 2) {
    upcaDigits = [0, d[0], d[1], last, 0, 0, 0, 0, d[2], d[3], d[4]]
  } else if (last === 3) {
    upcaDigits = [0, d[0], d[1], d[2], 0, 0, 0, 0, 0, d[3], d[4]]
  } else if (last === 4) {
    upcaDigits = [0, d[0], d[1], d[2], d[3], 0, 0, 0, 0, 0, d[4]]
  } else {
    upcaDigits = [0, d[0], d[1], d[2], d[3], d[4], 0, 0, 0, 0, last]
  }

  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += upcaDigits[i] * (i % 2 === 0 ? 3 : 1)
  }
  const calcCd = (10 - (sum % 10)) % 10
  return upcaDigits.join('') + (cd || calcCd)
}

/**
 * Kompresi UPC-A (12 digit) ke UPC-E (8 digit) jika memungkinkan
 */
export function compressUpcaToUpce(upcaStr) {
  const clean = String(upcaStr).replace(/\D/g, '')
  if (clean.length !== 12 || !clean.startsWith('0')) return null

  const d = clean.split('').map(Number)
  const cd = d[11]

  if (d[3] <= 2 && d[4] === 0 && d[5] === 0 && d[6] === 0 && d[7] === 0) {
    return `0${d[1]}${d[2]}${d[8]}${d[9]}${d[10]}${d[3]}${cd}`
  }
  if (d[4] === 0 && d[5] === 0 && d[6] === 0 && d[7] === 0 && d[8] === 0) {
    return `0${d[1]}${d[2]}${d[3]}${d[9]}${d[10]}3${cd}`
  }
  if (d[5] === 0 && d[6] === 0 && d[7] === 0 && d[8] === 0 && d[9] === 0) {
    return `0${d[1]}${d[2]}${d[3]}${d[4]}${d[10]}4${cd}`
  }
  if (d[6] === 0 && d[7] === 0 && d[8] === 0 && d[9] === 0 && d[10] >= 5) {
    return `0${d[1]}${d[2]}${d[3]}${d[4]}${d[5]}${d[10]}${cd}`
  }

  return null
}

/**
 * Validasi ketat format nomor resi sistem (mencegah false-positive noise dari garis keyboard/benda)
 * @param {string} str
 * @returns {boolean}
 */
export function isValidResiFormat(str) {
  if (!str || typeof str !== 'string') return false
  const s = str.trim().toUpperCase()
  if (s.length < 4 || s.length > 50) return false

  // 1. Alfanumerik 4-32 karakter (format resi standar sistem: C128ANDR, 4VEUU3Z4, DTMXANDR, dll)
  if (/^[A-Z0-9]{4,32}$/.test(s)) {
    if (/^\d+$/.test(s)) {
      const len = s.length
      // Panjang digit murni yang valid dalam sistem: 8 (EAN8/UPCE), 10 (CODABAR), 12 (UPCA/ITF), 13 (EAN13), 14 (RSS14)
      if (len === 8 || len === 10 || len === 12 || len === 13 || len === 14) {
        if (len === 14 && !s.startsWith('1')) return false // RSS_14 selalu diawali 1
        return true
      }
      return false
    }
    return true
  }

  // 2. Codabar wrapped: A...B, C...D, dsb
  if (/^[ABCD][0-9\-\$\:\/\.\+]{6,20}[ABCD]$/.test(s)) return true

  // 3. RSS_14
  if (s.startsWith('(01)') || /^01\d{14}$/.test(s)) return true

  return false
}

/**
 * Normalisasi nomor resi dari output scanner kamera/laser (GS1 AI, Codabar start/stop, MaxiCode, UPC-E, dsb)
 * @param {string} raw - Output mentah dari scanner
 * @param {string|null} format - Format barcode opsional (misal: 'MAXICODE', 'CODE_93', 'UPC_E', dsb)
 * @returns {string} - Nomor resi yang sudah ter-normalisasi ke format resi awal (tracking number)
 */
export function normalizeScannedBarcode(raw, format = null) {
  if (!raw) return ''
  let s = String(raw).trim()
  // 1. Hapus karakter kontrol tak terlihat (FNC1, GS ASCII 29, RS ASCII 30, dsb)
  s = s.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().toUpperCase()
  // 2. Hapus AIM Symbology Identifier jika dikirim scanner (misal ]e0, ]C1, ]A0, ]G0)
  s = s.replace(/^\][A-Z0-9]{2}/i, '').trim()
  // Tolak noise / artefak terlalu pendek
  if (s.length < 3) return ''

  const checkLocalStorage = (key) => {
    if (typeof localStorage === 'undefined' || !key) return null
    const cleanKey = String(key).trim()
    return (
      localStorage.getItem(`barcode_mapping_${cleanKey}`) ||
      localStorage.getItem(`barcode_mapping_${cleanKey.toUpperCase()}`) ||
      null
    )
  }

  // 1. Direct local storage mapping check
  let localMapped = checkLocalStorage(s)
  if (localMapped) return localMapped

  const sCleanBracket = s.replace(/[\(\)\-\s]/g, '')
  localMapped = checkLocalStorage(sCleanBracket)
  if (localMapped) return localMapped

  let fmt = ''
  if (typeof format === 'string') {
    fmt = format.toUpperCase()
  } else if (typeof format === 'number') {
    // P2: URUTAN enum ZXing (@zxing/library BarcodeFormat) BERBEDA dari
    // Html5QrcodeSupportedFormats di header file ini. Jalur live kamera selalu
    // memetakan enum -> nama via ZXING_FORMAT_NAME_MAP dulu, sehingga map
    // numerik ini mengikuti urutan ZXing (bukan urutan html5-qrcode).
    // Nama string selalu diutamakan; angka hanya fallback legacy.
    const FORMAT_ENUM_MAP = {
      0: 'AZTEC', 1: 'CODABAR', 2: 'CODE_39', 3: 'CODE_93', 4: 'CODE_128',
      5: 'DATA_MATRIX', 6: 'EAN_8', 7: 'EAN_13', 8: 'ITF', 10: 'PDF_417',
      11: 'QR_CODE', 12: 'RSS_14', 14: 'UPC_A', 15: 'UPC_E', 18: 'CODABAR', 29: 'RSS_14'
    }
    fmt = FORMAT_ENUM_MAP[format] || ''
  } else if (format && typeof format === 'object') {
    fmt = String(format.formatName || format.name || '').toUpperCase()
  }

  // 2. RSS_14: Parsing format GS1 DataBar Omni (01)GTIN-14 (14 digit angka murni)
  if (fmt === 'RSS_14' || /^(?:\(01\)|01)\d{14}$/i.test(s)) {
    const m01 = s.match(/^(?:\(01\)|01)?(\d{14})$/i)
    if (m01 && m01[1]) {
      const gtin = m01[1]
      return (
        checkLocalStorage(gtin) ||
        checkLocalStorage(`(01)${gtin}`) ||
        checkLocalStorage(`01${gtin}`) ||
        gtin
      )
    }
  }

  // 5. CODABAR: Hapus start/stop A, B, C, D wrapping
  // CATATAN: Codabar resi logistik valid minimal 6 karakter.
  // Garis scan parsial sependek 1-2 digit (misal A1B -> '1' atau A-B -> '-') harus ditolak (return '')
  if (fmt === 'CODABAR' || /^[ABCD][0-9\-\$\:\/\.\+]+[ABCD]$/i.test(s)) {
    const mCoda = s.match(/^[ABCD]([0-9\-\$\:\/\.\+]+)[ABCD]$/i)
    if (mCoda && mCoda[1]) {
      const inner = mCoda[1]
      if (inner.length < 6) return '' // Tolak glitch parsial 1 digit
      return checkLocalStorage(inner) || checkLocalStorage(s) || inner
    }
    const digitsOnly = s.replace(/\D/g, '')
    if (digitsOnly && digitsOnly.length >= 6) {
      return checkLocalStorage(digitsOnly) || checkLocalStorage(`A${digitsOnly}B`) || digitsOnly
    }
    return ''
  }

  // 6. CODE_93: pertahankan charset legal, kupas trailer check digits C & K
  if (fmt === 'CODE_93') {
    // P2: charset legal Code 93 mencakup - . space / + % (sebelumnya ikut terhapus)
    const clean93 = s.replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '').trim()
    if (clean93 && clean93.length >= 4) {
      const direct = checkLocalStorage(clean93)
      if (direct) return direct
      // Decoder (bwip includecheck:true) sering mengembalikan base + C&K.
      // Jika 2 char terakhir cocok sebagai C&K dari base, kupas lalu lookup lagi.
      if (clean93.length >= 6) {
        const base = clean93.slice(0, -2)
        const ck = calculateCode93CheckDigits(base)
        if (ck.full && clean93 === ck.full) {
          return checkLocalStorage(base) || base
        }
      }
      return clean93
    }
  }

  // 7. CODE_39: Hapus bintang wrapping dan karakter non-Code39
  if (fmt === 'CODE_39' || /^\*[^*]+\*$/.test(s)) {
    const unstar = s.replace(/^\*|\*$/g, '')
    const clean39 = unstar.replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '').trim()
    if (clean39 && clean39.length >= 4) {
      return checkLocalStorage(clean39) || checkLocalStorage(unstar) || clean39
    }
  }

  // 8. UPC-E: Ekspansi ke UPC-A dengan check digit (termasuk hasil dekompresi ZXing/WASM)
  if (fmt === 'UPC_E' || /^0\d{7}$/.test(s) || /^0\d{6}$/.test(s) || (fmt === 'UPC_E' && /^\d{12,13}$/.test(s))) {
    let upceStr = s.replace(/\D/g, '')
    // Jika format UPC_E mengembalikan 12 atau 13 digit (hasil dekompresi ZXing/WASM 0012345000065 atau 012345000065),
    // kompresi kembali menjadi 8-digit UPC-E
    if (upceStr.length === 13 && upceStr.startsWith('00')) {
      const comp = compressUpcaToUpce(upceStr.slice(1))
      if (comp) upceStr = comp
    } else if (upceStr.length === 12 && upceStr.startsWith('0')) {
      const comp = compressUpcaToUpce(upceStr)
      if (comp) upceStr = comp
    }
    if (upceStr.length === 6) {
      const cd = calculateUpceCheckDigit(upceStr)
      upceStr = '0' + upceStr + cd
    }
    if (upceStr.length === 8 && upceStr.startsWith('0')) {
      const upcaExpanded = expandUpceToUpca(upceStr)
      return (
        checkLocalStorage(upceStr) ||
        checkLocalStorage(upcaExpanded) ||
        upceStr
      )
    }
  }

  // 9. UPC_A: Tambahkan check digit atau tetap
  if (fmt === 'UPC_A' || (/^\d{11,12}$/.test(s) && fmt !== 'EAN_13')) {
    let digits = s.replace(/\D/g, '')
    if (digits.length === 11) {
      const cd = calculateMod10CheckDigit(digits)
      digits = digits + cd
    }
    if (digits.length === 12) {
      const upceCompressed = compressUpcaToUpce(digits)
      return (
        checkLocalStorage(digits) ||
        checkLocalStorage(digits.slice(0, 11)) ||
        (upceCompressed ? checkLocalStorage(upceCompressed) : null) ||
        digits
      )
    }
  }

  // 10. EAN_13: Tambahkan / check digit
  if (fmt === 'EAN_13' || (/^\d{12,13}$/.test(s) && fmt !== 'UPC_A')) {
    let digits = s.replace(/\D/g, '')
    if (digits.length === 12) {
      const cd = calculateMod10CheckDigit(digits)
      digits = digits + cd
    }
    if (digits.length === 13) {
      return (
        checkLocalStorage(digits) ||
        checkLocalStorage(digits.slice(0, 12)) ||
        digits
      )
    }
  }

  // 11. EAN_8: Tambahkan / check digit
  if (fmt === 'EAN_8' || /^\d{7,8}$/.test(s)) {
    let digits = s.replace(/\D/g, '')
    if (digits.length === 7) {
      let sum = 0
      for (let i = 0; i < 7; i++) {
        sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 3 : 1)
      }
      const cd = (10 - (sum % 10)) % 10
      digits = digits + cd
    }
    if (digits.length === 8) {
      return (
        checkLocalStorage(digits) ||
        checkLocalStorage(digits.slice(0, 7)) ||
        digits
      )
    }
  }



  // 13. ITF: ITF di sistem adalah 12 digit (genap 12 digit)
  if (fmt === 'ITF' || (fmt !== 'RSS_14' && /^\d{12}$/.test(s))) {
    const digits = s.replace(/\D/g, '')
    if (digits.length === 12) {
      return checkLocalStorage(digits) || digits
    }
  }

  // Generic GS1 AI (01) 14 digit GTIN: (01)XXXXX
  const m01Gen = s.match(/^(?:\(01\)|01)\s*(\d{14})/i)
  if (m01Gen && m01Gen[1]) {
    const gtin = m01Gen[1]
    return checkLocalStorage(gtin) || gtin
  }

  // Generic Codabar start/stop A, B, C, D wrapping
  const mCodaGen = s.match(/^[ABCD]([0-9\-\$\:\/\.\+]{6,})[ABCD]$/i)
  if (mCodaGen && mCodaGen[1]) {
    return checkLocalStorage(mCodaGen[1]) || mCodaGen[1]
  }

  // Tolak teks artefak pendek / invalid format
  if (s.length < 4 || !isValidResiFormat(s)) return ''

  return s
}

/**
 * Memisahkan dan menyelesaikan payload barcode untuk ke-17 format:
 * Menyimpan seluruh variasi barcode_value -> cleanTracking di localStorage.
 */
export function resolveBarcodePayload(trackingNo, format = 'CODE_128') {
  const cleanTracking = (trackingNo || '').trim().toUpperCase()

  let barcodeValue = cleanTracking
  let isMapped = false
  let checkDigits = null

  switch (format) {
    case 'CODE_128':
    case 'QR_CODE':
    case 'AZTEC':
    case 'DATA_MATRIX':
    case 'PDF_417':
      barcodeValue = cleanTracking
      break

    case 'CODE_39':
      barcodeValue = cleanTracking.replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '') || cleanTracking
      break

    case 'CODE_93': {
      barcodeValue = cleanTracking.replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '') || cleanTracking
      checkDigits = calculateCode93CheckDigits(barcodeValue)
      break
    }

    case 'ITF': {
      if (/^\d{4,16}$/.test(cleanTracking) && cleanTracking.length % 2 === 0) {
        isMapped = false
        barcodeValue = cleanTracking
      } else {
        isMapped = true
        barcodeValue = stringToDeterministicDigits(cleanTracking, 14)
      }
      break
    }

    case 'CODABAR': {
      if (/^[A-D][0-9\-\$\:\/\.\+]+[A-D]$/i.test(cleanTracking)) {
        isMapped = false
        barcodeValue = cleanTracking.toUpperCase()
      } else if (/^\d{6,16}$/.test(cleanTracking)) {
        isMapped = false
        barcodeValue = 'A' + cleanTracking + 'B'
      } else {
        isMapped = true
        const numPart = stringToDeterministicDigits(cleanTracking, 10)
        barcodeValue = 'A' + numPart + 'B'
      }
      break
    }

    case 'EAN_13': {
      if (/^\d{13}$/.test(cleanTracking)) {
        isMapped = false
        barcodeValue = cleanTracking
      } else if (/^\d{12}$/.test(cleanTracking)) {
        isMapped = false
        const cd = calculateMod10CheckDigit(cleanTracking)
        barcodeValue = cleanTracking + cd
      } else {
        isMapped = true
        const d12 = stringToDeterministicDigits(cleanTracking, 12)
        const cd = calculateMod10CheckDigit(d12)
        barcodeValue = d12 + cd
      }
      break
    }

    case 'EAN_8': {
      if (/^\d{8}$/.test(cleanTracking)) {
        isMapped = false
        barcodeValue = cleanTracking
      } else if (/^\d{7}$/.test(cleanTracking)) {
        isMapped = false
        let sum = 0
        for (let i = 0; i < 7; i++) {
          sum += parseInt(cleanTracking[i], 10) * (i % 2 === 0 ? 3 : 1)
        }
        const cd = (10 - (sum % 10)) % 10
        barcodeValue = cleanTracking + cd
      } else {
        isMapped = true
        const d7 = stringToDeterministicDigits(cleanTracking, 7)
        let sum = 0
        for (let i = 0; i < 7; i++) {
          sum += parseInt(d7[i], 10) * (i % 2 === 0 ? 3 : 1)
        }
        const cd = (10 - (sum % 10)) % 10
        barcodeValue = d7 + cd
      }
      break
    }

    case 'UPC_A': {
      if (/^\d{12}$/.test(cleanTracking)) {
        isMapped = false
        barcodeValue = cleanTracking
      } else if (/^\d{11}$/.test(cleanTracking)) {
        isMapped = false
        let sum = 0
        for (let i = 0; i < 11; i++) {
          sum += parseInt(cleanTracking[i], 10) * (i % 2 === 0 ? 3 : 1)
        }
        const cd = (10 - (sum % 10)) % 10
        barcodeValue = cleanTracking + cd
      } else {
        isMapped = true
        const d11 = stringToDeterministicDigits(cleanTracking, 11)
        let sum = 0
        for (let i = 0; i < 11; i++) {
          sum += parseInt(d11[i], 10) * (i % 2 === 0 ? 3 : 1)
        }
        const cd = (10 - (sum % 10)) % 10
        barcodeValue = d11 + cd
      }
      break
    }

    case 'UPC_E': {
      if (/^0\d{7}$/.test(cleanTracking)) {
        const payload6 = cleanTracking.slice(1, 7)
        const cd = calculateUpceCheckDigit(payload6)
        barcodeValue = '0' + payload6 + cd
        isMapped = (barcodeValue !== cleanTracking)
      } else if (/^0\d{6}$/.test(cleanTracking)) {
        const payload6 = cleanTracking.slice(1, 7)
        const cd = calculateUpceCheckDigit(payload6)
        barcodeValue = '0' + payload6 + cd
        isMapped = true
      } else {
        isMapped = true
        const payload6 = stringToDeterministicDigits(cleanTracking, 6)
        const cd = calculateUpceCheckDigit(payload6)
        barcodeValue = '0' + payload6 + cd
      }
      break
    }

    case 'RSS_14': {
      if (/^\(01\)\d{13,14}$/.test(cleanTracking)) {
        isMapped = false
        barcodeValue = cleanTracking
      } else if (/^\d{14}$/.test(cleanTracking)) {
        isMapped = false
        const data13 = cleanTracking.slice(0, 13)
        const cd = calculateMod10CheckDigit(data13)
        barcodeValue = `(01)${data13}${cd}`
      } else if (/^\d{13}$/.test(cleanTracking)) {
        isMapped = false
        const cd = calculateMod10CheckDigit(cleanTracking)
        barcodeValue = `(01)${cleanTracking}${cd}`
      } else {
        isMapped = true
        const d13 = '1' + stringToDeterministicDigits(cleanTracking, 12)
        const cd = calculateMod10CheckDigit(d13)
        barcodeValue = `(01)${d13}${cd}`
      }
      break
    }

    default:
      barcodeValue = cleanTracking
  }

  const payload = {
    tracking_no: cleanTracking,
    barcode_format: format,
    barcode_value: barcodeValue,
    is_mapped: isMapped,
    check_digits: checkDigits
  }

  // Simpan seluruh pemetaan variasi ke localStorage
  if (typeof localStorage !== 'undefined' && cleanTracking) {
    try {
      localStorage.setItem(`barcode_mapping_${barcodeValue}`, cleanTracking)
      localStorage.setItem(`barcode_mapping_${cleanTracking}`, cleanTracking)

      if (format === 'UPC_E' && barcodeValue.length === 8) {
        const upca = expandUpceToUpca(barcodeValue)
        localStorage.setItem(`barcode_mapping_${upca}`, cleanTracking)
      }
      if (format === 'UPC_A' && barcodeValue.length === 12) {
        localStorage.setItem(`barcode_mapping_${barcodeValue.slice(0, 11)}`, cleanTracking)
        const upce = compressUpcaToUpce(barcodeValue)
        if (upce) localStorage.setItem(`barcode_mapping_${upce}`, cleanTracking)
      }
      if (format === 'EAN_13' && barcodeValue.length === 13) {
        localStorage.setItem(`barcode_mapping_${barcodeValue.slice(0, 12)}`, cleanTracking)
      }
      if (format === 'EAN_8' && barcodeValue.length === 8) {
        localStorage.setItem(`barcode_mapping_${barcodeValue.slice(0, 7)}`, cleanTracking)
      }
      if (format === 'CODABAR') {
        const inner = barcodeValue.replace(/^[ABCD]|[ABCD]$/gi, '')
        localStorage.setItem(`barcode_mapping_${inner}`, cleanTracking)
      }
      if (format === 'RSS_14') {
        localStorage.setItem(`barcode_mapping_${barcodeValue.replace('(01)', '')}`, cleanTracking)
      }
      if (format === 'CODE_93') {
        // P2: decoder bisa mengembalikan base+C&K (bwip includecheck:true),
        // simpan varian ber-C&K agar direct mapping selalu kena.
        try {
          const ck = checkDigits || calculateCode93CheckDigits(barcodeValue)
          if (ck && ck.full && ck.full !== barcodeValue) {
            localStorage.setItem(`barcode_mapping_${ck.full}`, cleanTracking)
          }
        } catch {
          /* ignore */
        }
      }

      localStorage.setItem(`barcode_meta_${cleanTracking}_${format}`, JSON.stringify(payload))
    } catch {
      /* ignore quota errors */
    }
  }

  return payload
}

/**
 * Render barcode atau QR Code / 2D Matrix ke dalam elemen SVG
 */
export async function renderBarcode(svgEl, rawTrackingNo, format = 'CODE_128', options = {}) {
  const trackingNo = (rawTrackingNo || '').trim()
  if (!trackingNo) {
    if (svgEl) svgEl.innerHTML = ''
    return { success: false, error: 'Nomor resi tidak boleh kosong.' }
  }

  const payload = resolveBarcodePayload(trackingNo, format)
  const bcid = BWIP_FORMAT_MAP[format] || 'code128'

  try {
    const is2DMatrix = ['QR_CODE', 'AZTEC', 'DATA_MATRIX'].includes(format)
    const isStacked = format === 'PDF_417'

    const isCode93 = format === 'CODE_93'

    const bwipOptions = {
      bcid,
      text: payload.barcode_value,
      // P0: CODE_93 butuh modul lebih besar agar terbaca kamera HP 720p
      scale: options.scale || (isCode93 ? 4 : 3),
      includetext: false,
      backgroundcolor: 'ffffff'
    }

    if (format === 'CODE_93') {
      // Code 93 memerlukan 2 digit check characters C & K sesuai standar spesifikasi internasional
      bwipOptions.includecheck = true
    }

    if (!is2DMatrix && !isStacked) {
      // Barcode 1D linear: tingkatkan tinggi dan beri quiet zone padding agar mudah dideteksi kamera
      const defaultHeight = isCode93 ? 25 : 16
      bwipOptions.height = options.height || defaultHeight
      bwipOptions.paddingwidth = options.paddingwidth || (isCode93 ? 20 : 15)
      bwipOptions.paddingheight = options.paddingheight || (isCode93 ? 12 : 8)
    }

    const svgString = bwipjs.toSVG(bwipOptions)

    if (svgEl && typeof document !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgString, 'image/svg+xml')
      const newSvg = doc.documentElement

      svgEl.innerHTML = newSvg.innerHTML
      if (newSvg.getAttribute('viewBox')) {
        svgEl.setAttribute('viewBox', newSvg.getAttribute('viewBox'))
      }

      if (is2DMatrix) {
        const size = String(options.qrSize || 120)
        svgEl.setAttribute('width', size)
        svgEl.setAttribute('height', size)
        svgEl.style.maxWidth = options.maxWidth || `${size}px`
        svgEl.style.maxHeight = options.maxHeight || `${size}px`
        svgEl.style.width = 'auto'
        svgEl.style.height = 'auto'
      } else if (isStacked) {
        const w = options.width ? String(options.width) : '240'
        svgEl.setAttribute('width', w)
        svgEl.style.maxWidth = options.maxWidth || `${w}px`
        svgEl.style.maxHeight = options.maxHeight || '80px'
        svgEl.style.width = 'auto'
        svgEl.style.height = 'auto'
      } else if (format === 'CODE_93') {
        svgEl.removeAttribute('width')
        svgEl.removeAttribute('height')
        svgEl.style.maxWidth = options.maxWidth || '430px'
        svgEl.style.maxHeight = options.maxHeight || '132px'
        // P0: jangan stretch width:100% agar bar 1-px tidak blur saat downscale
        svgEl.style.width = 'auto'
        svgEl.style.height = 'auto'
      } else {
        svgEl.removeAttribute('width')
        svgEl.removeAttribute('height')
        svgEl.style.maxWidth = options.maxWidth || '280px'
        svgEl.style.maxHeight = options.maxHeight || '85px'
        svgEl.style.width = '100%'
        svgEl.style.height = 'auto'
      }
    }

    return {
      success: true,
      svgHtml: svgString,
      payload
    }
  } catch (err) {
    console.error(`[BARCODE-GENERATOR] Gagal render ${format}:`, err)
    if (svgEl) svgEl.innerHTML = ''
    return {
      success: false,
      error: `Gagal menghasilkan barcode format ${format}: ${err.message}`
    }
  }
}

const RESI_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Menghasilkan nomor resi baru secara deterministik di sisi-klien sesuai format barcode.
 * Digunakan untuk pratinjau barcode sebelum disimpan ke database (TANPA membuat draft di backend/paketStore).
 * @param {string} format
 * @returns {string}
 */
export function generateClientResi(format = 'CODE_128') {
  const fmt = String(format || 'CODE_128').toUpperCase()
  const randomDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
  const randomChars = (n) => Array.from({ length: n }, () => RESI_CHARS[Math.floor(Math.random() * RESI_CHARS.length)]).join('')

  if (fmt === 'EAN_13') {
    const data = '899' + randomDigits(9)
    return data + calculateMod10CheckDigit(data)
  }
  if (fmt === 'EAN_8') {
    const data = randomDigits(7)
    return data + calculateMod10CheckDigit(data)
  }
  if (fmt === 'UPC_A') {
    const data = '0' + randomDigits(10)
    return data + calculateMod10CheckDigit(data)
  }
  if (fmt === 'UPC_E') {
    const payload6 = randomDigits(6)
    return '0' + payload6 + calculateUpceCheckDigit(payload6)
  }
  if (fmt === 'ITF') {
    return randomDigits(12)
  }
  if (fmt === 'CODABAR') {
    return randomDigits(10)
  }
  if (fmt === 'RSS_14') {
    const data = '1' + randomDigits(12)
    return data + calculateMod10CheckDigit(data)
  }
  if (fmt === 'UPC_EAN_EXTENSION') {
    const data = '899' + randomDigits(9)
    return `${data}${calculateMod10CheckDigit(data)} ${randomDigits(5)}`
  }
  return randomChars(8)
}

