# Dokumentasi Observability & Monitoring Full-Stack: Grafana + Loki + Prometheus

Platform: **Scanner Barcode Express (Dijak Express)**  
Stack Observability: **Prometheus, Grafana, Loki, Promtail, cAdvisor**  
Arsitektur Deployment: **Docker Compose**

---

## 1. Arsitektur Observability

Sistem monitoring dan observabilitas ini dibangun di atas arsitektur terdesentralisasi namun terpusat pada visualisasi Grafana:

```text
                     Scanner Barcode Express
                               │
               ┌───────────────┴───────────────┐
               │                               │
       Metrics (Telemetry)               Logs (Stream)
 (HTTP + Scanner Barcode Format)     (Nginx + Backend + Docker)
               │                               │
               ▼                               ▼
       Prometheus (:9090)                 Loki (:3100)
       Scrapes:                           Collected by:
       - backend:5000/metrics             - Promtail (:9080) via docker.sock
       - cadvisor:8080/metrics            - Structured logs (logfmt & JSON)
               │                               │
               └───────────────┬───────────────┘
                               ▼
                        Grafana (:3000)
                     Provisioned Datasources:
                     - Prometheus (Metrics)
                     - Loki (Logs)
                               │
                               ▼
        Dashboard: "Scanner Barcode Express — System Monitoring"
                   (Juga disematkan di Role Admin)
```

### Prinsip Utama
1. **Non-Blocking & Auxiliary:**
   Sistem monitoring berstatus sebagai penunjang (auxiliary). Jika Prometheus, Loki, atau Grafana terhenti atau tidak responsif, **aplikasi utama (Nginx, backend Perl, dan scanner barcode frontend) tetap berfungsi 100% normal tanpa gangguan**.
2. **Low-Cardinality Prometheus Labels:**
   Semua label Prometheus dibatasi pada dimensi terkontrol (`method`, `endpoint` yang dinormalisasi, `status`, dan `format` barcode). Tidak ada data pribadi, nomor resi, email, atau IP address yang dimasukkan ke label Prometheus.
3. **Structured & Sanitized Logging:**
   Log aplikasi dicatat dalam format `logfmt` dan `JSON` dengan filter otomatis yang me-redact password, token JWT, dan kode OTP.

---

## 2. Komponen & Fungsinya

| Komponen | Versi | Port | Fungsi Utama |
|---|---|---|---|
| **Prometheus** | `v2.51.0` | `9090` | Mengumpulkan (*scraping*) dan menyimpan metrik berbasis *time-series* dari backend dan cAdvisor. |
| **Loki** | `2.9.8` | `3100` | Mesin penyimpan dan pengindeks log terpusat (*like Prometheus, but for logs*). |
| **Promtail** | `2.9.8` | `9080` | Agent pengumpul log dari Docker socket (`/var/run/docker.sock`) dan file log lokal backend, lalu meneruskannya ke Loki. |
| **Grafana** | `10.4.0` | `3000` | Dashboard analitik dan visualisasi korelasi metrics & log. Otomatis terkonfigurasi (*auto-provisioned*). |
| **cAdvisor** | `v0.49.1` | `8088` (host) | Mengumpulkan metrik penggunaan resource kontainer (CPU, RAM, Network I/O, status restart). |

---

## 3. Daftar Port & Alokasi Jaringan

| Port | Service | Protokol | Akses |
|---|---|---|---|
| `8080` | Nginx Gateway | HTTP | Publik / Host (Aplikasi Utama) |
| `9000` | Frontend Quasar Dev | HTTP | Publik / Host (Development) |
| `5000` | Backend Perl uWSGI | HTTP | Publik / Host |
| `3308` | MariaDB | MySQL | Host (`3308:3306`) |
| `3000` | Grafana | HTTP | Host (Web UI Grafana) |
| `9090` | Prometheus | HTTP | Host (Metrics UI) |
| `3100` | Loki | HTTP | Host / Internal (Log Ingestion & Query) |
| `8088` | cAdvisor | HTTP | Host (`8088:8080` internal) |

*Semua container observability berada dalam satu bridge network: `wahana_net`.*

---

## 4. Cara Menjalankan

### Menjalankan Seluruh Sistem (Aplikasi + Observability)
Gunakan skrip runner otomatis:
```bash
./docker-up.sh
```
Atau gunakan perintah Docker Compose:
```bash
docker compose up -d
```

### Memeriksa Status Container
```bash
docker compose ps
```
Pastikan seluruh service berstatus `Up` atau `healthy`:
* `wahana_scan_db`
* `wahana_scan_backend`
* `wahana_scan_frontend`
* `wahana_scan_nginx`
* `wahana_scan_prometheus`
* `wahana_scan_loki`
* `wahana_scan_promtail`
* `wahana_scan_grafana`
* `wahana_scan_cadvisor`

### Menghentikan Sistem
```bash
./docker-down.sh
# Atau: docker compose down
```

---

## 5. Mengakses Dashboard Grafana

### A. Melalui Portal Admin Aplikasi (Direkomendasikan)
1. Buka browser ke: `http://localhost:8080`
2. Login sebagai admin:
   * **Username:** `admin`
   * **Password:** `admin123`
3. Pada navigasi sidebar sebelah kiri, klik menu **`Monitoring & Observability`**.
4. Tab **`Live Observability Dashboard (Grafana)`** akan menampilkan seluruh metrik dan log secara terintegrasi langsung di dalam halaman aplikasi!

### B. Membuka Grafana Mandiri (Full-Screen)
1. Buka URL:
   * **Lokal (Nginx Gateway):** `http://localhost:8080/grafana/` (atau port internal `http://localhost:3000/grafana/`)
   * **Remote / Cloudflare Tunnel:** `https://[tunnel-anda].trycloudflare.com/grafana/`
2. Kredensial default Admin:
   * **Username:** `admin`
   * **Password:** `admin`
3. Dashboard utama otomatis tersedia di:
   * **Menu:** Dashboards → **Wahana Monitoring** → **Scanner Barcode Express — System Monitoring**
   * **URL Langsung:** `http://localhost:8080/grafana/d/scanner-monitoring` (atau `/grafana/d/scanner-monitoring` pada domain Cloudflare)

---

## 6. Panel Dashboard yang Tersedia

Dashboard **Scanner Barcode Express — System Monitoring** dibagi ke dalam 6 seksi utama:

### 1. System Overview (API)
* **Total API Requests:** Akumulasi total request HTTP yang diproses backend.
* **API Success Rate (%):** Persentase request berstatus 2xx.
* **API Errors:** Jumlah request yang mengalami kegagalan (4xx dan 5xx).
* **Avg API Response Time:** Rata-rata durasi respons backend dalam milidetik (ms).
* **Active Requests:** Jumlah HTTP request yang sedang diproses secara paralel saat ini.

### 2. Scanner Barcode Overview
* **Total Scans:** Total percobaan pemindaian barcode yang diproses.
* **Successful Scans:** Jumlah resi yang berhasil discan.
* **Duplicate Scans:** Jumlah resi yang terdeteksi duplikat pada task/batch yang sama.
* **Failed / Rejected Scans:** Scan resi yang ditolak (misal resi tidak terdaftar, resi masih draft, atau barcode invalid).

### 3. Scan Performance & Barcode Format Analysis
* **Scans Breakdown by Barcode Format:** Diagram donat persentase scan berdasarkan 14 format barcode yang didukung (`CODE_128`, `QR_CODE`, `AZTEC`, `DATA_MATRIX`, `PDF_417`, `CODE_39`, `CODE_93`, `CODABAR`, `ITF`, `EAN_13`, `EAN_8`, `UPC_A`, `UPC_E`, `RSS_14`).
* **Average Decode Duration by Format (ms):** Grafik batang kecepatan decoding frame kamera per format barcode (misal performa `CODE_128` vs `QR_CODE`).
* **Scan Events Timeline:** Grafik laju scan per menit (Success vs Duplicate vs Error).

### 4. API Performance & Error Diagnostics
* **API Request Rate by Endpoint:** Frekuensi request per endpoint (misal `POST /api/scans`, `POST /api/auth/login`).
* **API Response Duration Percentiles:** Visualisasi latensi P50 (median), P90, dan P99.

### 5. Infrastructure Metrics (Docker & System)
* **CPU Usage by Container (%):** Beban prosesor per container.
* **Memory Usage by Container (MB):** Penggunaan RAM aktual tiap container.
* **Network I/O Rate (KB/s):** Trafik jaringan keluar-masuk tiap service.

### 6. Live Logs Explorer (Loki)
* **Scanner & Backend Logs Panel:** Log terstruktur dari backend Perl & scanner kamera. Dilengkapi filter level `INFO`, `WARN`, `ERROR` dan event `SCAN_SUCCESS`, `SCAN_DUPLICATE`, `SCAN_ERROR`.
* **Nginx Access & Gateway Logs:** Log akses HTTP reverse proxy Nginx dalam format JSON.

---

## 7. Cara Melihat Metrics di Prometheus

1. Buka browser: `http://localhost:9090`
2. Periksa target scraping di menu **Status → Targets**:
   * `backend` (`http://backend:5000/metrics`) → Status: **UP**
   * `cadvisor` (`http://cadvisor:8080/metrics`) → Status: **UP**
3. Contoh query Prometheus (PromQL):
   ```promql
   # Total request per endpoint
   sum by (endpoint) (http_requests_total)

   # Total scan sukses per format barcode
   sum by (format) (scanner_scan_success_total)

   # Rata-rata waktu decode kamera per format
   sum by (format) (rate(scanner_decode_duration_seconds_sum[5m])) / sum by (format) (rate(scanner_decode_duration_seconds_count[5m])) * 1000

   # Error rate API per status code
   sum by (status) (rate(http_errors_total[5m]))
   ```

---

## 8. Cara Melihat Logs di Loki

1. Buka Grafana di: `http://localhost:3000/explore`
2. Pilih datasource: **Loki**
3. Contoh query LogQL:
   ```logql
   # Melihat semua log backend
   {service="backend"}

   # Melihat log error saja
   {service="backend"} |= "level=\"ERROR\""

   # Melihat event scan duplicate
   {service="scanner"} |= "event=\"SCAN_DUPLICATE\""

   # Melihat log Nginx dengan status HTTP 500
   {service="nginx"} | json | status >= 500
   ```

---

## 9. Korelasi Metrics + Logs untuk Troubleshooting

Ketika terjadi peningkatan error pada metrik Prometheus:
1. Perhatikan grafik **API Errors** atau **API Response Duration** di Grafana.
2. Sorot (*drag & drop zoom*) rentang waktu lonjakan error tersebut.
3. Panel **Live Logs Explorer (Loki)** di bagian bawah akan secara otomatis membatasi log pada jendela waktu yang sama persis.
4. Anda dapat langsung mengidentifikasi baris log penyebab error (contoh: kegagalan koneksi database atau parameter request yang tidak valid).

---

## 10. Aspek Keamanan (Security Considerations)

1. **Privasi Data Barcode & Pelanggan:**
   * Prometheus labels **TIDAK PERNAH** memuat nomor resi, nama petugas, username, atau data sensitif pelanggan.
   * Hanya identifier kategori teknis yang digunakan sebagai label (misal: `format="CODE_128"`, `status="200"`).
2. **Sanitasi Kredensial di Logger:**
   * Modul `Wahana::Logger` secara otomatis mengganti nilai parameter sensitif (`password`, `otp`, `token`, `preauth_token`, `jwt`) dengan `[REDACTED]`.
   * Pada Promtail, pipeline regex tahap kedua turut mensterilkan potensi kebocoran password sebelum dikirim ke Loki.
3. **Endpoint Metrics Privat:**
   * Endpoint `http://backend:5000/metrics` hanya di-scrape secara internal oleh Prometheus melalui Docker bridge network `wahana_net`.
4. **Frame Kamera Tidak Membanjiri Log:**
   * Scanner kamera di browser memproses hingga 30 frame/detik. **Frame kosong atau kegagalan frame rutin TIDAK dicatat ke log**. Hanya event scan final (`SCAN_SUCCESS`, `SCAN_DUPLICATE`, `SCAN_ERROR`) yang dicatat.

---

## 11. Troubleshooting

| Masalah | Kemungkinan Penyebab | Langkah Solusi |
|---|---|---|
| **Iframe Grafana tidak muncul di halaman Admin** | Browser memblokir mixed-content atau CSP. | Pastikan Nginx memiliki `frame-src 'self' http://localhost:3000`. Grafana harus mengaktifkan `GF_SECURITY_ALLOW_EMBEDDING=true`. |
| **Target Prometheus DOWN** | Container `wahana_scan_backend` belum siap atau network terputus. | Jalankan `docker compose ps` dan pastikan backend running. Cek curl: `curl http://localhost:5000/metrics`. |
| **Log tidak masuk ke Loki** | Promtail tidak dapat membaca Docker socket. | Periksa izin `/var/run/docker.sock` dan jalankan `docker compose logs wahana_scan_promtail`. |
| **Data di dashboard Grafana kosong ("No Data")** | Belum ada aktivitas HTTP atau scan yang dilakukan. | Lakukan pemindaian barcode resi di menu Petugas atau lakukan request API (Login/List Task), lalu refresh dashboard. |
