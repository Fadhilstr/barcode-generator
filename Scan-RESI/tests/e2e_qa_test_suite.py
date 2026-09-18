#!/usr/bin/env python3
import urllib.request
import json
import subprocess
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

def record_test(role, test_name, passed, detail=""):
    status_str = "PASSED" if passed else "FAILED"
    results.append({"role": role, "name": test_name, "passed": passed, "detail": detail})
    print(f"[{role}] {test_name}: {status_str} - {detail}")

print("==================================================")
print(" AUTOMATED END-TO-END QA TEST SUITE - DIJAK EXPRESS")
print("==================================================")

# -------------------------------------------------------------------
# 1. PUBLIC & DOCS API TEST
# -------------------------------------------------------------------
code, data = make_request("/docs", "GET")
record_test("PUBLIC", "Get Swagger UI Docs (/api/docs)", code == 200, f"HTTP Status: {code}")

code, data = make_request("/openapi.yaml", "GET")
record_test("PUBLIC", "Get OpenAPI 3.0 Spec (/api/openapi.yaml)", code == 200, f"HTTP Status: {code}")

# -------------------------------------------------------------------
# 2. ROLE 1: ADMIN SYSTEM QA
# -------------------------------------------------------------------
# 2.1 Login Admin Credential Check
code, login_res = make_request("/auth/login", "POST", {"username": "admin", "password": "admin123"})
admin_requires_otp = login_res.get("requires_otp")
record_test("ADMIN", "Admin Credential Verification (/api/auth/login)", login_res.get("success") == True, f"Requires OTP: {admin_requires_otp}")

# 2.2 Token Issuance for Admin
admin_token = get_bearer_token("USR-ADMIN-001")
admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
record_test("ADMIN", "Admin Bearer Token Authentication", bool(admin_token), f"User: Admin System (USR-ADMIN-001)")

# 2.3 Get Users List
code, users_data = make_request("/users", "GET", headers=admin_headers)
user_list = users_data.get("users", [])
record_test("ADMIN", "Get Master Users List (/api/users)", code == 200 and len(user_list) > 0, f"Total Users in DB: {len(user_list)}")

# 2.4 Create Task Shift Allocation
code, task_data = make_request("/tasks", "POST", {
    "user_id": "USR-001",
    "shift": "Pagi",
    "target": 150,
    "lokasi": "CIPUTAT"
}, headers=admin_headers)
created_task_id = task_data.get("task", {}).get("task_id")
record_test("ADMIN", "Create Task Shift Allocation (/api/tasks)", code == 200 and bool(created_task_id), f"Created Task ID: {created_task_id}")

# 2.5 Get Audit Logs
code, audit_data = make_request("/audit-logs", "GET", headers=admin_headers)
audit_list = audit_data.get("logs", [])
record_test("ADMIN", "Get System Audit Trail Logs (/api/audit-logs)", code == 200, f"Total Audit Logs: {len(audit_list)}")

# -------------------------------------------------------------------
# 3. ROLE 2: CUSTOMER QA
# -------------------------------------------------------------------
# 3.1 Token Issuance for Customer
cust_token = get_bearer_token("USR-CUST-001")
cust_headers = {"Authorization": f"Bearer {cust_token}"} if cust_token else {}
record_test("CUSTOMER", "Customer Bearer Token Authentication", bool(cust_token), "User: Customer Demo (USR-CUST-001)")

# 3.2 Generate Draft Resi
code, draft_res = make_request("/paket/resi", "POST", headers=cust_headers)
generated_resi = draft_res.get("paket", {}).get("nomor_resi")
record_test("CUSTOMER", "Generate Draft Resi Server-Side (/api/paket/resi)", code == 200 and bool(generated_resi), f"Generated Resi: {generated_resi}")

# 3.3 Update Parcel Details to TERDAFTAR
if generated_resi:
    code, update_res = make_request(f"/paket/{generated_resi}", "PATCH", {
        "nama_barang": "Laptop QA Test Automation",
        "pengirim": "Customer Demo QA",
        "alamat_pengirim": "Jl. Raya Ciputat No. 12",
        "telepon_pengirim": "081234567890",
        "penerima": "Siti Penerima",
        "alamat_tujuan": "Jl. Sudirman Jakarta",
        "telepon_penerima": "089876543210",
        "berat_kg": 2.5,
        "jenis_layanan": "EXPRESS"
    }, headers=cust_headers)
    p_status = update_res.get("paket", {}).get("status")
    record_test("CUSTOMER", "Update Parcel Data to TERDAFTAR (/api/paket/:resi)", code == 200 and p_status == "TERDAFTAR", f"Parcel Status: {p_status}")

# 3.4 Get Customer Parcel History
code, my_pakets = make_request("/paket", "GET", headers=cust_headers)
record_test("CUSTOMER", "Get Customer Parcel List (/api/paket)", code == 200, f"Total Customer Parcels: {len(my_pakets.get('pakets', []))}")

# -------------------------------------------------------------------
# 4. ROLE 3: PETUGAS SCAN QA
# -------------------------------------------------------------------
# 4.1 Token Issuance for Petugas Scan
pet_token = get_bearer_token("USR-001")
pet_headers = {"Authorization": f"Bearer {pet_token}"} if pet_token else {}
record_test("PETUGAS_SCAN", "Petugas Scan Bearer Token Authentication", bool(pet_token), "User: Fadhil (USR-001)")

# 4.2 Execute Barcode Scan on TERDAFTAR Parcel
if generated_resi and created_task_id:
    code, scan_res = make_request("/scans", "POST", {
        "nomor_resi": generated_resi,
        "task_id": created_task_id,
        "lokasi": "CIPUTAT",
        "device_id": "QA-AUTOMATION-DEVICE",
        "jenis_scan": "INBOUND"
    }, headers=pet_headers)
    scan_status = scan_res.get("status_scan")
    record_test("PETUGAS_SCAN", "Scan Registered Parcel (/api/scans)", code == 200 and scan_status == "SUCCESS", f"Scan Status: {scan_status}")

    # 4.3 Test Anti-Duplicate Scan Validation
    code, dup_scan_res = make_request("/scans", "POST", {
        "nomor_resi": generated_resi,
        "task_id": created_task_id,
        "lokasi": "CIPUTAT",
        "device_id": "QA-AUTOMATION-DEVICE",
        "jenis_scan": "INBOUND"
    }, headers=pet_headers)
    dup_status = dup_scan_res.get("status_scan") or dup_scan_res.get("reason")
    record_test("PETUGAS_SCAN", "Anti-Duplicate Scan Validation (/api/scans)", dup_status == "DUPLICATE", f"Duplicate Status: {dup_status}")

# 4.4 Get Petugas Scan Performance Stats
code, stats_res = make_request("/scans/stats/USR-001", "GET", headers=pet_headers)
stats = stats_res.get("stats", {})
record_test("PETUGAS_SCAN", "Get Performance Stats (/api/scans/stats/:id)", code == 200, f"Success: {stats.get('success')}, Duplicate: {stats.get('duplicate')}")

# -------------------------------------------------------------------
# SUMMARY RESULT
# -------------------------------------------------------------------
passed_count = sum(1 for r in results if r["passed"])
total_count = len(results)
pass_rate = (passed_count / total_count) * 100 if total_count > 0 else 0

print("\n==================================================")
print(f" QA TEST SUITE SUMMARY: {passed_count}/{total_count} PASSED ({pass_rate:.1f}%)")
print("==================================================")

with open("tests/qa_results.json", "w") as f:
    json.dump({"total": total_count, "passed": passed_count, "pass_rate": pass_rate, "results": results}, f, indent=2)

if passed_count == total_count:
    sys.exit(0)
else:
    sys.exit(1)
