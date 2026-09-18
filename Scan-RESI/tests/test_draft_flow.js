import assert from 'assert'
import { generateClientResi, normalizeScannedBarcode } from '../src/utils/barcodeGenerator.js'
import { savePaketData, getPaketByResi, LOCAL_PAKETS } from '../src/services/paket.service.js'
import { addScan, LOCAL_SCANS } from '../src/services/scan.service.js'

console.log('===============================================================')
console.log('TEST SUITE: VERIFIKASI FLOW DRAFT PAKET & SCANNER ISOLATION')
console.log('===============================================================')

// Dummy user & task
const currentUser = { id: 'USR-CUST-999', name: 'Test Customer', role: 'CUSTOMER' }
const activeTask = { task_id: 'TASK-999', status: 'PROSES_SCAN' }

// 1. Test Generate Resi Client-Side (TIDAK MEMBUAT DRAFT)
console.log('\nTEST 1: Generate Client Resi untuk CODE_93 & UPC_E & CODE_128...')
const clientResi93 = generateClientResi('CODE_93')
const clientResiUpce = generateClientResi('UPC_E')
const clientResiC128 = generateClientResi('CODE_128')

assert.strictEqual(typeof clientResi93, 'string')
assert.strictEqual(clientResi93.length, 8)
assert.strictEqual(typeof clientResiUpce, 'string')
assert.strictEqual(clientResiUpce.length, 8)
assert.strictEqual(typeof clientResiC128, 'string')

// Pastikan LOCAL_PAKETS TIDAK bertambah saat resi digenerate
const initialPaketCount = LOCAL_PAKETS.length
assert.strictEqual(
  LOCAL_PAKETS.some(p => p.nomor_resi === clientResi93),
  false,
  'Resi yang baru digenerate tidak boleh ada di LOCAL_PAKETS'
)
console.log('  -> PASS: Client resi digenerate tanpa membuat draft record di database/store.')

// 2. Test Scan Resi yang BELUM Disimpan (Must Return UNKNOWN_RESI)
console.log('\nTEST 2: Petugas Scan Barcode yang BELUM disimpan customer...')
const scanUnsavedRes = await addScan({
  resi: clientResi93,
  currentUser,
  activeTask,
  lokasi: 'CIPUTAT'
})

assert.strictEqual(scanUnsavedRes.success, false)
assert.strictEqual(scanUnsavedRes.reason, 'UNKNOWN_RESI')
console.log(`  -> PASS: Respon scan = UNKNOWN_RESI ("${scanUnsavedRes.message}")`)

// 3. Test Simpan Paket (Submit Form) -> Menjadi TERDAFTAR
console.log('\nTEST 3: Customer klik Simpan/Submit paket...')
const saveRes = await savePaketData(
  clientResi93,
  {
    nama_barang: 'Kamera HP Test',
    jenis_layanan: 'EXPRESS',
    berat_kg: 1.5,
    pengirim: 'Customer Test',
    alamat_pengirim: 'Jl. Merdeka 10',
    telepon_pengirim: '08123456789',
    penerima: 'Penerima Test',
    alamat_tujuan: 'Jl. Sudirman 20',
    telepon_penerima: '08987654321',
    barcode_format: 'CODE_93'
  },
  currentUser
)

assert.strictEqual(saveRes.success, true)
assert.strictEqual(saveRes.paket.status, 'TERDAFTAR')
assert.strictEqual(saveRes.paket.nomor_resi, clientResi93)
assert.strictEqual(LOCAL_PAKETS.length, initialPaketCount + 1)
console.log('  -> PASS: Paket berhasil disimpan langsung dengan status TERDAFTAR.')

// 4. Test Scan Resi TERDAFTAR oleh Petugas -> SUCCESS 1x
console.log('\nTEST 4: Petugas Scan Barcode TERDAFTAR...')
const scanSavedRes = await addScan({
  resi: clientResi93,
  currentUser,
  activeTask,
  lokasi: 'CIPUTAT'
})

assert.strictEqual(scanSavedRes.success, true)
assert.strictEqual(scanSavedRes.resi, clientResi93)
console.log('  -> PASS: Scan resi TERDAFTAR berhasil 1x.')

// 5. Test Scan Duplikat -> DUPLICATE
console.log('\nTEST 5: Scan ulang resi yang sama pada task yang sama...')
const scanDupRes = await addScan({
  resi: clientResi93,
  currentUser,
  activeTask,
  lokasi: 'CIPUTAT'
})

assert.strictEqual(scanDupRes.success, false)
assert.strictEqual(scanDupRes.reason, 'DUPLICATE')
console.log('  -> PASS: Scan duplikat ditolak dengan status DUPLICATE.')

console.log('\n===============================================================')
console.log('SEMUA VERIFIKASI DRAFT & SCANNER ISOLATION BERHASIL (PASS)')
console.log('===============================================================')
