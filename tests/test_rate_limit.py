#!/usr/bin/env python3
import urllib.request
import json
import time
import sys

BASE_URL = "http://localhost:8080/api"

def make_post_login():
    url = f"{BASE_URL}/auth/login"
    data = json.dumps({"username": "admin", "password": "wrong_password_test"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode("utf-8")), dict(res.headers)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(res_body), dict(e.headers)
        except:
            return e.code, {"text": res_body}, dict(e.headers)

print("==================================================")
print(" AUTOMATED RATE-LIMITING & BRUTE-FORCE TEST SUITE")
print("==================================================")

statuses = []
headers_list = []

# Send 7 consecutive login attempts with 500ms interval
for i in range(1, 8):
    code, data, hdrs = make_post_login()
    statuses.append(code)
    headers_list.append(hdrs)
    reason = data.get("reason", "")
    msg = data.get("message", "")
    print(f"Attempt #{i}: HTTP {code} - Reason: {reason} | Msg: {msg}")
    time.sleep(0.5)

# Verify Rate Limit hit (HTTP 429 on attempt #6 or #7)
rate_limit_triggered = any(code == 429 for code in statuses)

print("\n==================================================")
if rate_limit_triggered:
    print(" RESULT: RATE-LIMITING PASSED (HTTP 429 Triggered Correctly!)")
    print("==================================================")
    sys.exit(0)
else:
    print(f" RESULT: RATE-LIMITING FAILED (Statuses: {statuses})")
    print("==================================================")
    sys.exit(1)
