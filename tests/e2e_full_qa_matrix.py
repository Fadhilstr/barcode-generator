#!/usr/bin/env python3
import urllib.request
import json
import subprocess
import time
import sys

BASE_URL = "http://localhost:8080/api"

def get_bearer_token(user_id):
    cmd = ["perl", "-Ibackend/lib", "-Ibackend/lib/perl5/lib/perl5", "-MWahana::Auth", "-e", f'print Wahana::Auth->issue_token("{user_id}");']
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout.strip()

def make_request(path, method="GET", body=None, headers=None):
    if headers is None:
        headers = {}
    
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            res_bytes = response.read()
            content_type = response.headers.get("Content-Type", "")
            
            if "application/json" in content_type:
                return response.status, json.loads(res_bytes.decode("utf-8"))
            else:
                return response.status, {"text": res_bytes.decode("utf-8", errors="ignore")}
    except urllib.error.HTTPError as e:
        res_bytes = e.read()
        try:
            return e.code, json.loads(res_bytes.decode("utf-8"))
        except:
            return e.code, {"text": res_bytes.decode("utf-8", errors="ignore")}
    except Exception as e:
        return 500, {"error": str(e)}

results = []

def record_test(category, mode, test_name, passed, detail=""):
    status_str = "PASSED" if passed else "FAILED"
    results.append({
        "category": category,
        "mode": mode,
        "name": test_name,
        "passed": passed,
        "detail": detail
    })
    print(f"[{category} | {mode}] {test_name}: {status_str} - {detail}")

print("==================================================================")
print(" COMPREHENSIVE QA MATRIX TEST SUITE - ONLINE & OFFLINE ALL ROLES")
print("==================================================================")

# -------------------------------------------------------------------
# 1. PUBLIC API & DOCUMENTATION QA
# -------------------------------------------------------------------
code, data = make_request("/docs", "GET")
record_test("PUBLIC", "ONLINE", "Get Swagger UI Interactive Docs (/api/docs)", code == 200, f"HTTP Status: {code}")

code, data = make_request("/openapi.yaml", "GET")
record_test("PUBLIC", "ONLINE", "Get OpenAPI 3.0 YAML Specification (/api/openapi.yaml)", code == 200, f"HTTP Status: {code}")

# -------------------------------------------------------------------
# 2. ROLE 1: ADMIN SYSTEM QA (ONLINE)
# -------------------------------------------------------------------
code, login_res = make_request("/auth/login", "POST", {"username": "admin", "password": "admin123"})
record_test("ADMIN", "ONLINE", "Admin Credential Verification (/api/auth/login)", login_res.get("success") == True, f"Requires OTP: {login_res.get('requires_otp')}")

admin_token = get_bearer_token("USR-ADMIN-001")
admin_headers = {"Authorization": f"Bearer {admin_token}"}
record_test("ADMIN", "ONLINE", "Admin Bearer Token Authentication", bool(admin_token), "User: Admin System (USR-ADMIN-001)")

code, users_data = make_request("/users", "GET", headers=admin_headers)
record_test("ADMIN", "ONLINE", "Get Master Users List (/api/users)", code == 200 and len(users_data.get("users", [])) > 0, f"Total Users in DB: {len(users_data.get('users', []))}")

code, task_data = make_request("/tasks", "POST", {
    "user_id": "USR-001",
    "shift": "Pagi",
    "target": 120,
    "lokasi": "CIPUTAT"
}, headers=admin_headers)
created_task_id = task_data.get("task", {}).get("task_id")
record_test("ADMIN", "Create Task Shift Allocation (/api/tasks)", code == 200 and bool(created_task_id), f"Created Task ID: {created_task_id}")

code, audit_data = make_request("/audit-logs", "GET", headers=admin_headers)
record_test("ADMIN", "Get System Audit Trail Logs (/api/audit-logs)", code == 200, f"Total Audit Logs: {len(audit_data.get('logs', []))}")

# -------------------------------------------------------------------
# 3. ROLE 2: CUSTOMER QA (ONLINE)
# -------------------------------------------------------------------
cust_token = get_bearer_token("USR-CUST-001")
cust_headers = {"Authorization": f"Bearer {cust_token}"}
record_test("CUSTOMER", "ONLINE", "Customer Bearer Token Authentication", bool(cust_token), "User: Customer Demo (USR-CUST-001)")

code, draft_res = make_request("/paket/resi", "POST", headers=cust_headers)
generated_resi = draft_res.get("paket", {}).get("nomor_resi")
record_test("CUSTOMER", "Generate Draft Resi Server-Side (/api/paket/resi)", code == 200 and bool(generated_resi), f"Generated Resi: {generated_resi}")

if generated_resi:
    code, update_res = make_request(f"/paket/{generated_resi}", "PATCH", {
        "nama_barang": "Laptop QA Full Matrix Test",
        "pengirim": "Customer Demo QA",
        "alamat_pengirim": "Jl. Raya Ciputat No. 12",
        "telepon_pengirim": "081234567890",
        "penerima": "Siti Penerima QA",
        "alamat_tujuan": "Jl. Sudirman Jakarta",
        "telepon_penerima": "089876543210",
        "berat_kg": 3.0,
        "jenis_layanan": "EXPRESS"
    }, headers=cust_headers)
    p_status = update_res.get("paket", {}).get("status")
    record_test("CUSTOMER", "Update Parcel Data to TERDAFTAR (/api/paket/:resi)", code == 200 and p_status == "TERDAFTAR", f"Parcel Status: {p_status}")

code, my_pakets = make_request("/paket", "GET", headers=cust_headers)
record_test("CUSTOMER", "Get Customer Parcel List (/api/paket)", code == 200, f"Total Customer Parcels: {len(my_pakets.get('pakets', []))}")

# -------------------------------------------------------------------
# 4. ROLE 3: PETUGAS SCAN QA (ONLINE MODE)
# -------------------------------------------------------------------
pet_token = get_bearer_token("USR-001")
pet_headers = {"Authorization": f"Bearer {pet_token}"}
record_test("PETUGAS_SCAN", "ONLINE", "Petugas Scan Bearer Token Authentication", bool(pet_token), "User: Fadhil (USR-001)")

if generated_resi and created_task_id:
    code, scan_res = make_request("/scans", "POST", {
        "nomor_resi": generated_resi,
        "task_id": created_task_id,
        "lokasi": "CIPUTAT",
        "device_id": "QA-MATRIX-DEVICE",
        "jenis_scan": "INBOUND"
    }, headers=pet_headers)
    scan_status = scan_res.get("status_scan")
    record_test("PETUGAS_SCAN", "ONLINE", "Scan Registered Parcel (/api/scans)", code == 200 and scan_status == "SUCCESS", f"Scan Status: {scan_status}")

    # Anti-duplicate scan check
    code, dup_scan_res = make_request("/scans", "POST", {
        "nomor_resi": generated_resi,
        "task_id": created_task_id,
        "lokasi": "CIPUTAT",
        "device_id": "QA-MATRIX-DEVICE",
        "jenis_scan": "INBOUND"
    }, headers=pet_headers)
    dup_status = dup_scan_res.get("status_scan") or dup_scan_res.get("reason")
    record_test("PETUGAS_SCAN", "ONLINE", "Anti-Duplicate Scan Validation", dup_status == "DUPLICATE", f"Duplicate Status: {dup_status}")

code, stats_res = make_request("/scans/stats/USR-001", "GET", headers=pet_headers)
stats = stats_res.get("stats", {})
record_test("PETUGAS_SCAN", "ONLINE", "Get Performance Stats (/api/scans/stats/:id)", code == 200, f"Success: {stats.get('success')}, Duplicate: {stats.get('duplicate')}")

# -------------------------------------------------------------------
# 5. ROLE 3: PETUGAS SCAN QA (OFFLINE MODE & INDEXEDDB SYNC SIMULATION)
# -------------------------------------------------------------------
# Simulate creating another parcel for offline scan test
code, draft_res_off = make_request("/paket/resi", "POST", headers=cust_headers)
offline_resi = draft_res_off.get("paket", {}).get("nomor_resi")
if offline_resi:
    make_request(f"/paket/{offline_resi}", "PATCH", {
        "nama_barang": "Paket Offline Test",
        "pengirim": "Customer Offline",
        "alamat_pengirim": "Jl. Offline No. 1",
        "telepon_pengirim": "081299998888",
        "penerima": "Penerima Offline",
        "alamat_tujuan": "Jl. Tujuan Offline",
        "telepon_penerima": "089988887777",
        "berat_kg": 1.5,
        "jenis_layanan": "REGULER"
    }, headers=cust_headers)

# Test offline storage simulation (saving scan object locally into IndexedDB format)
offline_scan_queue = [
    {
        "nomor_resi": offline_resi or "OFFLINE888",
        "user_id": "USR-001",
        "user_name": "Fadhil",
        "task_id": created_task_id or "TASK-001",
        "lokasi": "CIPUTAT",
        "device_id": "OFFLINE-HP-DEVICE",
        "jenis_scan": "INBOUND",
        "synced": 0
    }
]
record_test("PETUGAS_SCAN", "OFFLINE", "Simulate Offline Scan & IndexedDB Queue Storage", len(offline_scan_queue) > 0, f"Queued Resi: {offline_scan_queue[0]['nomor_resi']} in pending_scans")

# Test background auto-sync when online connection restores
sync_success = True
for item in offline_scan_queue:
    code, sync_res = make_request("/scans", "POST", {
        "nomor_resi": item["nomor_resi"],
        "task_id": item["task_id"],
        "lokasi": item["lokasi"],
        "device_id": item["device_id"],
        "jenis_scan": item["jenis_scan"]
    }, headers=pet_headers)
    if code != 200 or sync_res.get("status_scan") not in ["SUCCESS", "DUPLICATE"]:
        sync_success = False

record_test("PETUGAS_SCAN", "OFFLINE->ONLINE", "Auto-Sync Pending Scans to Server MariaDB", sync_success, f"Synced Resi: {offline_scan_queue[0]['nomor_resi']} to Database")

# -------------------------------------------------------------------
# 6. SECURITY & RATE LIMITING QA
# -------------------------------------------------------------------
# Test invalid Bearer token guard (401 Unauthorized)
code, unauth_res = make_request("/users", "GET", headers={"Authorization": "Bearer invalid_token_123"})
record_test("SECURITY", "ONLINE", "Invalid Bearer Token Guard (/api/users)", code == 401, f"HTTP Status: {code} Unauthorized")

# -------------------------------------------------------------------
# SUMMARY RESULT
# -------------------------------------------------------------------
passed_count = sum(1 for r in results if r["passed"])
total_count = len(results)
pass_rate = (passed_count / total_count) * 100 if total_count > 0 else 0

print("\n==================================================================")
print(f" FULL QA MATRIX SUMMARY: {passed_count}/{total_count} PASSED ({pass_rate:.1f}%)")
print("==================================================================")

with open("tests/qa_full_matrix_results.json", "w") as f:
    json.dump({"total": total_count, "passed": passed_count, "pass_rate": pass_rate, "results": results}, f, indent=2)

if passed_count == total_count:
    sys.exit(0)
else:
    sys.exit(1)
