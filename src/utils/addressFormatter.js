/**
 * addressFormatter.js — Utility helper untuk format alamat terstruktur & string
 */

/**
 * Format detail alamat (objek terstruktur atau string) menjadi baris alamat yang rapi.
 * Menurut Aturan PRD:
 * - Baris 1: Jalan + (No. X jika no_rumah ada) + (, Kelurahan jika ada)
 * - Baris 2: Kecamatan + (, Kota/Kabupaten jika ada)
 * - Baris 3: Provinsi + ( Kode Pos jika ada)
 * - Jika Nomor Rumah kosong, JANGAN tampilkan "No.".
 * - Jika nomor telepon kosong, sembunyikan nomor telepon.
 * - Tanpa undefined, null, string kosong, koma berlebihan, spasi kosong ganda.
 *
 * @param {Object|string} detail - Objek terstruktur alamat atau string
 * @param {string} fallbackName - Nama default jika detail adalah string
 * @param {string} fallbackAddress - Alamat default jika detail adalah string
 * @returns {{ name: string, phone: string, addressLines: string[] }}
 */
export function formatAddressInfo(detail, fallbackName = '', fallbackAddress = '') {
  if (!detail || typeof detail === 'string') {
    const rawAddress = typeof detail === 'string' && detail.trim() ? detail.trim() : fallbackAddress.trim()
    return {
      name: fallbackName.trim(),
      phone: '',
      addressLines: rawAddress ? [rawAddress] : []
    }
  }

  const d = detail || {}
  const name = (d.nama || d.nama_lengkap || fallbackName || '').trim()
  const phone = (d.telepon || d.no_tlp || d.phone || '').trim()

  // Baris 1: Jalan, No. Rumah, Kelurahan
  const jalan = (d.alamat || d.jalan || '').trim()
  const noRumah = (d.no_rumah || d.nomor_rumah || '').trim()
  const kelurahan = (d.kelurahan || d.desa || '').trim()

  let line1 = jalan
  if (noRumah) {
    line1 += (line1 ? ' No. ' : 'No. ') + noRumah
  }
  if (kelurahan) {
    line1 += (line1 ? ', ' : '') + kelurahan
  }

  // Baris 2: Kecamatan, Kota/Kabupaten
  const kecamatan = (d.kecamatan || '').trim()
  const kota = (d.kota || d.kabupaten || d.kota_kabupaten || '').trim()

  let line2 = kecamatan
  if (kota) {
    line2 += (line2 ? ', ' : '') + kota
  }

  // Baris 3: Provinsi Kode Pos
  const provinsi = (d.provinsi || '').trim()
  const kodePos = (d.kode_pos || '').trim()

  let line3 = provinsi
  if (kodePos) {
    line3 += (line3 ? ' ' : '') + kodePos
  }

  // Filter baris kosong
  const addressLines = [line1, line2, line3].filter((line) => line && line.trim().length > 0)

  // Jika tidak ada baris terstruktur yang terbentuk, gunakan fallbackAddress
  if (addressLines.length === 0 && fallbackAddress.trim()) {
    addressLines.push(fallbackAddress.trim())
  }

  return {
    name,
    phone,
    addressLines
  }
}

/**
 * Gabungkan detail alamat terstruktur menjadi string single line (untuk alamat_tujuan)
 */
export function buildSingleLineAddress(d = {}) {
  const { addressLines } = formatAddressInfo(d)
  return addressLines.join(', ')
}

/**
 * Ekstrak nama Kota/Kabupaten dari alamat (objek terstruktur, string, atau array baris alamat)
 * @param {Object|string|Array} addressSource - Objek alamat terstruktur, string alamat, atau array baris alamat
 * @param {string} fallback - Nilai default jika tidak dapat diekstrak
 * @returns {string}
 */
export function extractCityFromAddress(addressSource, fallback = '') {
  if (!addressSource) return fallback

  // 1. Jika objek terstruktur
  if (typeof addressSource === 'object' && !Array.isArray(addressSource)) {
    const directCity =
      addressSource.kota ||
      addressSource.kabupaten ||
      addressSource.kota_kabupaten ||
      addressSource.city ||
      addressSource.hub_tujuan ||
      addressSource.hub_asal ||
      addressSource.tujuan ||
      addressSource.asal
    if (directCity && typeof directCity === 'string' && directCity.trim()) {
      return directCity.trim()
    }
    // Cek nested detail jika objek berupa paket utuh
    if (addressSource.penerima_detail) {
      const nested = extractCityFromAddress(addressSource.penerima_detail)
      if (nested) return nested
    }
    if (addressSource.pengirim_detail) {
      const nested = extractCityFromAddress(addressSource.pengirim_detail)
      if (nested) return nested
    }
    if (addressSource.alamat_tujuan) {
      return extractCityFromAddress(addressSource.alamat_tujuan, fallback)
    }
    if (addressSource.alamat_pengirim || addressSource.pengirim_alamat) {
      return extractCityFromAddress(addressSource.alamat_pengirim || addressSource.pengirim_alamat, fallback)
    }
  }

  // 2. Jika array baris alamat (misal addressLines)
  let rawStr = ''
  if (Array.isArray(addressSource)) {
    rawStr = addressSource.join(', ')
  } else if (typeof addressSource === 'string') {
    rawStr = addressSource
  }

  // Hapus kode pos 5 digit terlebih dahulu agar tidak terbawa sebagai nama kota
  rawStr = rawStr.replace(/\b\d{5}\b/g, '').trim()
  if (!rawStr) return fallback

  // Daftar provinsi Indonesia umum untuk deteksi segmen provinsi
  const provincePatterns = [
    /dki\s+jakarta/i, /jawa\s+barat/i, /jawa\s+tengah/i, /jawa\s+timur/i, /banten/i,
    /di\s+yogyakarta/i, /bali/i, /sumatera\s+utara/i, /sumatera\s+barat/i, /riau/i,
    /kepulauan\s+riau/i, /jambi/i, /sumatera\s+selatan/i, /bangka\s+belitung/i,
    /bengkulu/i, /lampung/i, /kalimantan\s+barat/i, /kalimantan\s+tengah/i,
    /kalimantan\s+selatan/i, /kalimantan\s+timur/i, /kalimantan\s+utara/i,
    /sulawesi\s+utara/i, /gorontalo/i, /sulawesi\s+tengah/i, /sulawesi\s+barat/i,
    /sulawesi\s+selatan/i, /sulawesi\s+tenggara/i, /maluku\s+utara/i, /maluku/i,
    /papua\s+barat\s+daya/i, /papua\s+barat/i, /papua\s+selatan/i, /papua\s+tengah/i,
    /papua\s+pegunungan/i, /papua/i, /nusa\s+tenggara\s+barat/i, /nusa\s+tenggara\s+timur/i, /aceh/i
  ]

  const cleanPart = (s) => s.replace(/[\(\)\[\]]/g, '').trim()

  const parts = rawStr.split(/[,;\n]+/).map(p => cleanPart(p)).filter(p => p.length > 0)
  if (parts.length === 0) return fallback
  if (parts.length === 1) {
    return cleanPart(parts[0]) || fallback
  }

  // 1. Cari bagian yang mengandung kata kunci eksplisit "Kota" / "Kabupaten" / "Kab."
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^(kota\s+adm\.?|kota|kabupaten|kab\.?)\s+/i.test(parts[i])) {
      return parts[i]
    }
  }

  // 2. Jika bagian terakhir adalah provinsi yang terdaftar
  if (provincePatterns.some((rx) => rx.test(parts[parts.length - 1]))) {
    return parts[parts.length - 2] || parts[0]
  }

  // 3. Struktur standar alamat lengkap [Jalan & No, (Kelurahan), (Kecamatan), Kota/Kabupaten, Provinsi]:
  // Jika alamat memiliki >= 3 bagian, bagian terakhir adalah Provinsi sehingga Kota/Kabupaten berada di posisi kedua terakhir
  if (parts.length >= 3) {
    return parts[parts.length - 2]
  }

  // 4. Jika alamat hanya memiliki 2 bagian: jika bagian pertama adalah jalan, maka bagian kedua adalah Kota
  if (parts.length === 2) {
    if (/^(jl|jalan|gang|gg|komp|komplek|dusun|kp|kampung)\.?\s+/i.test(parts[0]) || /\bno\.?\s*\d+/i.test(parts[0])) {
      return parts[1]
    }
    if (provincePatterns.some((rx) => rx.test(parts[1]))) {
      return parts[0]
    }
    return parts[1]
  }

  return parts[parts.length - 1] || fallback
}

/**
 * Ekstrak Kode Pos dari alamat (objek terstruktur, string, atau array baris alamat)
 * @param {Object|string|Array} addressSource
 * @param {string} fallback
 * @returns {string}
 */
export function extractPostalCodeFromAddress(addressSource, fallback = '') {
  if (!addressSource) return fallback

  // 1. Jika objek terstruktur
  if (typeof addressSource === 'object' && !Array.isArray(addressSource)) {
    const directZip =
      addressSource.kode_pos ||
      addressSource.kodepos ||
      addressSource.postal_code ||
      addressSource.zip_code ||
      addressSource.zip
    if (directZip && String(directZip).trim()) {
      return String(directZip).trim()
    }
    if (addressSource.penerima_detail) {
      const nested = extractPostalCodeFromAddress(addressSource.penerima_detail)
      if (nested) return nested
    }
    if (addressSource.pengirim_detail) {
      const nested = extractPostalCodeFromAddress(addressSource.pengirim_detail)
      if (nested) return nested
    }
    if (addressSource.alamat_tujuan) {
      return extractPostalCodeFromAddress(addressSource.alamat_tujuan, fallback)
    }
    if (addressSource.alamat_pengirim || addressSource.pengirim_alamat) {
      return extractPostalCodeFromAddress(addressSource.alamat_pengirim || addressSource.pengirim_alamat, fallback)
    }
  }

  // 2. Jika string atau array baris alamat
  let rawStr = ''
  if (Array.isArray(addressSource)) {
    rawStr = addressSource.join(', ')
  } else if (typeof addressSource === 'string') {
    rawStr = addressSource
  }

  const match = rawStr.match(/\b\d{5}\b/)
  if (match) {
    return match[0]
  }

  return fallback
}

/**
 * Ekstrak Kota + Kode Pos sekaligus (misal: "JAKARTA SELATAN 12310")
 * @param {Object|string|Array} addressSource
 * @param {string} fallbackCity
 * @returns {string}
 */
export function extractCityAndZip(addressSource, fallbackCity = '') {
  const city = extractCityFromAddress(addressSource, fallbackCity)
  const zip = extractPostalCodeFromAddress(addressSource, '')
  if (city && zip) {
    return `${city} ${zip}`.trim()
  }
  return city || fallbackCity
}

/**
 * Masking nomor telepon untuk cetak label Customer.
 * Ketentuan:
 * - Pertahankan 2 digit pertama.
 * - Pertahankan 2 digit terakhir.
 * - Semua digit di tengah diganti dengan '*'.
 * - Contoh: 081234567890 -> 08********90
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone) return ''
  const str = String(phone).trim()
  const digits = str.replace(/\D/g, '')
  if (digits.length <= 4) {
    return str
  }
  const first2 = digits.slice(0, 2)
  const last2 = digits.slice(-2)
  const middleAsterisks = '*'.repeat(digits.length - 4)
  return `${first2}${middleAsterisks}${last2}`
}

/**
 * Masking alamat untuk cetak label Customer.
 * Ketentuan:
 * - Detail nomor rumah, nama jalan lengkap, blok, RT/RW dsb diganti bintang.
 * - Pertahankan informasi wilayah yang berguna seperti kota/kabupaten atau provinsi jika tersedia.
 * - Contoh: "Jl. Contoh No. 123, Jakarta Selatan" -> "Jl. ************, Jakarta Selatan"
 * @param {string|Array} addressInput - String alamat atau array baris alamat
 * @param {Object} [detailObj] - Objek terstruktur detail alamat jika ada
 * @returns {string}
 */
export function maskAddress(addressInput, detailObj = null) {
  let addressStr = ''
  if (Array.isArray(addressInput)) {
    addressStr = addressInput.join(', ')
  } else if (typeof addressInput === 'string') {
    addressStr = addressInput.trim()
  }

  // 1. Ekstrak informasi wilayah (Kota / Kabupaten / Provinsi / Kode Pos)
  let regionInfo = ''

  if (detailObj && typeof detailObj === 'object') {
    const city = (detailObj.kota || detailObj.kabupaten || detailObj.kota_kabupaten || '').trim()
    const prov = (detailObj.provinsi || '').trim()
    const zip = (detailObj.kode_pos || detailObj.kodepos || '').trim()

    const regParts = []
    if (city) regParts.push(city)
    if (prov) regParts.push(prov)
    if (zip) regParts.push(zip)

    if (regParts.length > 0) {
      regionInfo = regParts.join(', ')
    }
  }

  if (!regionInfo && addressStr) {
    const extractedCity = extractCityFromAddress(addressStr, '')
    const parts = addressStr.split(/,\s*/)
    if (parts.length >= 2) {
      const cityIndex = parts.findIndex(p => extractedCity && p.toLowerCase().includes(extractedCity.toLowerCase()))
      if (cityIndex > 0) {
        regionInfo = parts.slice(cityIndex).join(', ')
      } else {
        regionInfo = parts.slice(1).join(', ')
      }
    } else if (extractedCity) {
      regionInfo = extractedCity
    }
  }

  // 2. Format street detail dengan masking "Jl. ************"
  let prefix = 'Jl. '
  if (/^jalan\b/i.test(addressStr)) {
    prefix = 'Jalan '
  } else if (/^gg\.?\b/i.test(addressStr) || /^gang\b/i.test(addressStr)) {
    prefix = 'Gg. '
  }

  const maskedStreet = `${prefix}************`

  if (regionInfo) {
    return `${maskedStreet}, ${regionInfo}`
  }

  return maskedStreet
}


