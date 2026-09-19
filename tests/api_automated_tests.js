import axios from 'axios';
import { execSync } from 'child_process';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

let adminToken = '';
let newResiNumber = '';
let taskId = '';
let testPetugasId = 'USR-001';

function enablePetugasInDb(userId) {
    try {
        const cmd = `docker exec wahana_scan_db mysql -u root -proot wahana_scan -e "UPDATE users SET status = 'OFFLINE' WHERE id = '${userId}';"`;
        execSync(cmd);
    } catch (err) {
        console.error('Failed to update petugas status:', err.message);
    }
}

async function runAutomatedTests() {
    console.log('===========================================================');
    console.log('🚀 AUTOMATED QA TEST SUITE — DIJAK EXPRESS / SCAN-RESI');
    console.log(` Target API: ${BASE_URL}`);
    console.log('===========================================================\n');

    let totalPassed = 0;
    let totalFailed = 0;

    async function test(name, fn) {
        process.stdout.write(`⏳ Running: ${name} ... `);
        try {
            await fn();
            console.log('✅ [PASS]');
            totalPassed++;
        } catch (err) {
            console.log('❌ [FAIL]');
            console.error('   Error detail:', err.response?.data || err.message);
            totalFailed++;
        }
    }

    // -------------------------------------------------------------
    // TEST 1: Documentation API
    // -------------------------------------------------------------
    await test('TC-DOCS-001: Check Swagger Docs & OpenAPI Specification', async () => {
        const resDocs = await axios.get(`${BASE_URL}/api/docs`);
        if (resDocs.status !== 200 || !resDocs.data.includes('SwaggerUIBundle')) {
            throw new Error('Swagger UI page returned unexpected content');
        }
        const resYaml = await axios.get(`${BASE_URL}/api/openapi.yaml`);
        if (resYaml.status !== 200 || !resYaml.data.includes('openapi:')) {
            throw new Error('OpenAPI YAML spec is invalid or missing');
        }
    });

    // -------------------------------------------------------------
    // TEST 2: Admin Quick Login & 2FA OTP Trigger
    // -------------------------------------------------------------
    let preauthAuthToken = '';
    await test('TC-AUTH-001: Admin Quick Login (Trigger 2FA OTP)', async () => {
        const res = await axios.post(`${BASE_URL}/api/auth/quick-login`, {
            user_id: 'USR-ADMIN-001'
        });
        if (!res.data.success || !res.data.preauth_token) {
            throw new Error('Quick login failed to generate preauth_token');
        }
        preauthAuthToken = res.data.preauth_token;
    });

    // -------------------------------------------------------------
    // TEST 3: OTP Verification & JWT Token Issuance
    // -------------------------------------------------------------
    await test('TC-AUTH-003: Verify 2FA OTP & Obtain JWT Bearer Token', async () => {
        const cmd = `docker exec wahana_scan_db mysql -u root -proot wahana_scan -s -N -e "SELECT id FROM user_otps WHERE user_id = 'USR-ADMIN-001' ORDER BY id DESC LIMIT 1;"`;
        const otpId = execSync(cmd, { encoding: 'utf-8' }).trim();
        
        const testOtp = '123456';
        const secret = 'wahana-dev-secret-2026-ganti-di-produksi';

        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(`wahana_otp_salt_${secret}_${testOtp}`).digest('hex');
        
        execSync(`docker exec wahana_scan_db mysql -u root -proot wahana_scan -e "UPDATE user_otps SET otp_hash = '${hash}', attempt_count = 0, expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = '${otpId}';"`);

        const res = await axios.post(`${BASE_URL}/api/auth/verify-otp`, {
            preauth_token: preauthAuthToken,
            otp: testOtp
        });

        if (!res.data.success || !res.data.token) {
            throw new Error('OTP verification failed: ' + (res.data.message || 'No token returned'));
        }
        adminToken = res.data.token;
    });

    // -------------------------------------------------------------
    // TEST 4: Fetch User List (Admin Auth Guard)
    // -------------------------------------------------------------
    await test('TC-ADMIN-002: Fetch All Users (Admin Auth Guard)', async () => {
        const res = await axios.get(`${BASE_URL}/api/users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (!Array.isArray(res.data.users)) {
            throw new Error('Failed to retrieve user list, users array missing');
        }
    });

    // -------------------------------------------------------------
    // TEST 5: Customer Create New Package (Draft -> Terdaftar)
    // -------------------------------------------------------------
    await test('TC-CUST-001: Customer Create New Parcel & Register Data', async () => {
        const resDraft = await axios.post(`${BASE_URL}/api/paket/resi`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!resDraft.data.success || !resDraft.data.paket?.nomor_resi) {
            throw new Error('Failed to generate parcel draft resi');
        }
        newResiNumber = resDraft.data.paket.nomor_resi;

        const resUpdate = await axios.patch(`${BASE_URL}/api/paket/${newResiNumber}`, {
            nama_barang: 'Kamera DSLR Canon EOS',
            pengirim: 'Toko Elektronik Maju',
            alamat_pengirim: 'Jl. Sudirman No. 12, Jakarta',
            telepon_pengirim: '081234567890',
            penerima: 'Budi Santoso',
            alamat_tujuan: 'Jl. Merdeka No. 45, Bandung',
            telepon_penerima: '089876543210',
            berat_kg: 2.5,
            jenis_layanan: 'EXPRESS'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!resUpdate.data.success || resUpdate.data.paket?.status !== 'TERDAFTAR') {
            throw new Error('Failed to update parcel status to TERDAFTAR');
        }
    });

    // -------------------------------------------------------------
    // TEST 6: Admin Create Task for Petugas
    // -------------------------------------------------------------
    await test('TC-ADMIN-004: Admin Create Scanning Task Shift', async () => {
        enablePetugasInDb(testPetugasId);

        const res = await axios.post(`${BASE_URL}/api/tasks`, {
            user_id: testPetugasId,
            shift: 'Pagi',
            target: 50,
            lokasi: 'HUB CIPUTAT'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!res.data.success || !res.data.task?.task_id) {
            throw new Error('Failed to create task shift');
        }
        taskId = res.data.task.task_id;
    });

    // -------------------------------------------------------------
    // TEST 7: Petugas Scan Resi Barcode (Status SUCCESS)
    // -------------------------------------------------------------
    await test('TC-PETUGAS-002: Petugas Executing Scan Barcode (SUCCESS)', async () => {
        const res = await axios.post(`${BASE_URL}/api/scans`, {
            nomor_resi: newResiNumber,
            user_id: testPetugasId,
            task_id: taskId,
            lokasi: 'HUB CIPUTAT',
            jenis_scan: 'INBOUND'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!res.data.success || res.data.status_scan !== 'SUCCESS') {
            throw new Error('Scan failed or status was not SUCCESS: ' + (res.data.message || ''));
        }
    });

    // -------------------------------------------------------------
    // TEST 8: Anti-Duplicate Scan Test (Status DUPLICATE)
    // -------------------------------------------------------------
    await test('TC-PETUGAS-003: Anti-Duplicate Scan Validation (DUPLICATE)', async () => {
        const res = await axios.post(`${BASE_URL}/api/scans`, {
            nomor_resi: newResiNumber,
            user_id: testPetugasId,
            task_id: taskId,
            lokasi: 'HUB CIPUTAT',
            jenis_scan: 'INBOUND'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (res.data.status_scan !== 'DUPLICATE' || res.data.reason !== 'DUPLICATE') {
            throw new Error('Anti-duplicate test failed! Expected DUPLICATE status but received: ' + JSON.stringify(res.data));
        }
    });

    // -------------------------------------------------------------
    // TEST 9: Verify Audit Logs
    // -------------------------------------------------------------
    await test('TC-ADMIN-006: Audit Logs Tracking Verification', async () => {
        const res = await axios.get(`${BASE_URL}/api/audit-logs`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!Array.isArray(res.data.logs)) {
            throw new Error('Failed to retrieve audit logs, logs array missing');
        }
        if (res.data.logs.length === 0) {
            throw new Error('Audit logs table is empty');
        }
    });

    // -------------------------------------------------------------
    // TEST 10: Logout Session
    // -------------------------------------------------------------
    await test('TC-AUTH-008: Logout User Session', async () => {
        const res = await axios.post(`${BASE_URL}/api/auth/logout`, {
            user_id: 'USR-ADMIN-001'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        if (!res.data.success) {
            throw new Error('Logout request failed');
        }
    });

    console.log('\n===========================================================');
    console.log(`📊 AUTOMATED QA SUMMARY:`);
    console.log(`   TOTAL TESTS : ${totalPassed + totalFailed}`);
    console.log(`   PASSED      : ${totalPassed} ✅`);
    console.log(`   FAILED      : ${totalFailed} ❌`);
    console.log('===========================================================');

    if (totalFailed > 0) {
        process.exit(1);
    }
}

runAutomatedTests();
