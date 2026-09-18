# 📘 DOKUMENTASI ARSITEKTUR TEKNIS & DEVELOPER GUIDE
## Dijak Express (Scan-RESI) — Platform Manajemen & Pemindaian Resi Logistik Terintegrasi

* **Versi Dokumentasi**: v1.2.0
* **Tanggal Update**: 9 September 2026
* **Status**: Production Ready & Fully Documented

---

## 1. Arsitektur Umum & Pattern Desain System

Platform **Dijak Express (Scan-RESI)** dibangun dengan mematuhi prinsip arsitektur perangkat lunak modern yang mementingkan performa, efisiensi resource, keamanan, dan ketahanan jaringan (*network resiliency*).

```text
+-----------------------------------------------------------------------------------------------+
|                                    FRONTEND SPA / PWA LAYER                                   |
|  - Framework: Vue 3 + Quasar Framework v2                                                     |
|  - State Management: Pinia Stores (authStore, packageStore, scanStore, taskStore)             |
|  - Offline Storage: IndexedDB Database `ScanResiOfflineDB` (Table: pending_scans)             |
|  - Synchronization Service: offlineSync.service.js (Auto Background Worker & Sync Queue)      |
+-----------------------------------------------------------------------------------------------+
                                               |
                                   (HTTPS / JSON REST API)
                                               v
+-----------------------------------------------------------------------------------------------+
|                                   WEB GATEWAY LAYER (Nginx)                                   |
|  - Routing: Static Web Assets (/dist/spa) + API Reverse Proxy (/api/* -> Backend uWSGI)       |
|  - Security Headers & CORS Handling                                                           |
+-----------------------------------------------------------------------------------------------+
                                               |
                                         (Unix Socket / HTTP)
                                               v
+-----------------------------------------------------------------------------------------------+
|                                     BACKEND PERL API SERVER                                   |
|  - Dynamic OpenAPI Router: Wahana::Router (DCAF SWB Pattern via scanresi.yaml)                |
|  - Security Middleware: Wahana::RateLimit (Rate Limiter) + Wahana::Auth (HMAC-SHA256 Auth)    |
|  - Email OTP Service: Wahana::Mail (Gmail SMTP SSL Engine)                                    |
|  - SQL Query Catalog Engine: Wahana::Query (Mapping catalog database/query.sql)               |
+-----------------------------------------------------------------------------------------------+
                                               |
                                     (DBI Prepared Statements)
                                               v
+-----------------------------------------------------------------------------------------------+
|                                    DATABASE LAYER (MariaDB 11)                                |
|  - Tables: users, tasks, paket, scan_events, audit_logs                                       |
|  - Transaction Locks: SELECT ... FOR UPDATE (Anti Duplicate Transaksional)                    |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Arsitektur Core Backend (Perl uWSGI Framework)

Backend dikembangkan menggunakan Bahasa Perl dengan arsitektur mikro-modular Plack/uWSGI:

### 2.1 Modul Core Framework (`backend/lib/Wahana/`)

1. **`Wahana::Router`**: Router aktif berbasis OpenAPI 3.0 YAML (`scanresi.yaml`). Mengadopsi pola DCAF SWB di mana rute HTTP diekstrak dari atribut `operationId: <method>/<Controller>` dan di-compile secara dinamis dengan deteksi otomatis perubahan berkas (*hot-reloading via mtime*).
2. **`Wahana::RateLimit`**: Middleware pembatas rate request API berbasis memori. Mencegah DoS / Brute-force serangan login/OTP dengan batas max 100 req/menit per IP.
3. **`Wahana::Query`**: Katalog query SQL terisolasi yang membaca file `backend/db/query.sql`. Mencegah SQL Injection dengan secara ketat mengeksekusi DBI Placeholders (`?`).
4. **`Wahana::Auth`**: Manajemen enkripsi token HMAC-SHA256 (masa berlaku 24 jam) dan pencincangan password `sha256$<salt>$<hash>`.
5. **`Wahana::Mail`**: Engine pengirim email verifikasi Gmail OTP 6-digit menggunakan protokol Net::SMTP::SSL.
6. **`Wahana::Db`**: Koneksi database MariaDB terpusat dengan dukungan auto-reconnect dan penanganan transaksi `eval { ... $dbh->commit; }`.

### 2.2 Controllers Layer (`backend/lib/Wahana/Controller/`)

- **`AuthController.pm`**: Menangani `login`, `quick_login`, `logout`, `send_otp`, dan `verify_otp`.
- **`PaketController.pm`**: Menangani generator nomor resi acak 8-karakter (`_generate_resi`), pembuatan draft paket, pencarian resi, dan pembacaan daftar paket berdasar role.
- **`ScansController.pm`**: Menangani validasi pemindaian barcode resi, pengecekan duplikasi transaksional (`DUPLICATE`), pembaruan progres kuota task, dan statistik scan petugas.
- **`TasksController.pm`**: Menangani alokasi task/shift baru oleh admin, pencarian task aktif petugas, dan penyelesaian shift.
- **`UsersController.pm`**: Menangani CRUD master user, enkripsi reset password, dan perubahan status akun (`ONLINE`/`OFFLINE`/`DISABLED`).
- **`AuditController.pm`**: Menampilkan riwayat jejak audit aktivitas pengguna (`audit_logs`).

---

## 3. Arsitektur Frontend & Offline PWA Engine

Frontend dibangun menggunakan **Vue 3 + Quasar v2 Framework** dengan arsitektur PWA (*Progressive Web App*).

### 3.1 Alur Kerja Pemindaian Offline & Auto-Sync Engine

Salah satu fitur unggulan pada versi v1.2.0 adalah ketahanan aplikasi saat tidak ada sinyal internet di hub ekspedisi (*Offline Resiliency*):

```text
               +----------------------------------+
               | Petugas Memindai Barcode Resi    |
               +----------------+-----------------+
                                |
                    +-----------v-----------+
                    | Cek Koneksi Internet  |
                    +-----+-----------+-----+
                          |           |
               ONLINE     |           | OFFLINE
      +-------------------+           +-------------------+
      |                                                   |
      v                                                   v
+-----------------------------+             +-----------------------------+
| Kirim HTTP POST /api/scans  |             | Simpan Payload Scan ke      |
| Langsung ke Backend Server  |             | IndexedDB (`pending_scans`) |
+--------------+--------------+             +--------------+--------------+
               |                                           |
               |                                           v
               |                            +-----------------------------+
               |                            | Tampilkan Feedback UI:      |
               |                            | "Disimpan di Antrean Offline|
               |                            +--------------+--------------+
               |                                           |
               |                                (Koneksi Kembali Online)
               |                                           v
               |                            +-----------------------------+
               |                            | Event `online` Dipicu       |
               |                            | Background Sync Engine      |
               |                            | Mengirim Isi Antrean        |
               |                            +--------------+--------------+
               |                                           |
               +--------------------+----------------------+
                                    |
                                    v
                     +------------------------------+
                     | Update Database MariaDB      |
                     | & Sinkronkan Progres Task    |
                     +------------------------------+
```

1. **`src/utils/offlineDb.js`**: Mengelola database browser `ScanResiOfflineDB` versi 1 dengan Object Store `pending_scans`.
2. **`src/services/offlineSync.service.js`**: 
   - Mendengarkan event window `online` dan `offline`.
   - Mengisi antrean lokal jika request `/api/scans` gagal atau saat status navigator `onLine === false`.
   - Saat status berubah menjadi `ONLINE`, skrip melakukan iterasi antrean `pending_scans`, mengunggah satu per satu ke `/api/scans`, dan menghapus antrean jika sukses.

---

## 4. Skema Basis Data & Spesifikasi Query SQL

### 4.1 Diagram Relasi Entitas (ERD)

```text
+-------------------+        1:N        +-------------------+
|       users       |<------------------|       tasks       |
|-------------------|                   |-------------------|
| id (PK)           |                   | task_id (PK)      |
| username          |                   | user_id (FK)      |
| password_hash     |                   | shift, target     |
| role, status      |                   | progress, status  |
+---------+---------+                   +---------+---------+
          |                                       |
          | 1:N                                   | 1:N
          v                                       v
+-------------------+        1:N        +-------------------+
|       paket       |<------------------|    scan_events    |
|-------------------|                   |-------------------|
| nomor_resi (PK)   |                   | scan_id (PK)      |
| nama_barang       |                   | nomor_resi (FK)   |
| pengirim, penerima|                   | task_id (FK)      |
| created_by (FK)   |                   | user_id (FK)      |
+-------------------+                   | status_scan       |
                                        +-------------------+
```

### 4.2 Struktur Tabel Utama

- **`users`**: Master akun pengguna & role sistem (`ADMIN`, `PETUGAS_SCAN`, `CUSTOMER`).
- **`tasks`**: Penugasan shift harian petugas scan di hub tertentu.
- **`paket`**: Master data paket dan nomor resi terdaftar.
- **`scan_events`**: Jejak event pemindaian resi barcode oleh petugas (mencatat status `SUCCESS` / `DUPLICATE`).
- **`audit_logs`**: Log audit keamanan dan operasional sistem.

---

## 5. Dokumentasi API & Endpoint

Seluruh API menggunakan format `application/json`.

### 5.1 Endpoint Autentikasi (`/api/auth/*`)
- `POST /api/auth/login`: Autentikasi username & password.
- `POST /api/auth/quick-login`: 1-Click login cepat simulasi demo.
- `POST /api/auth/otp/send`: Mengirim kode OTP ke Gmail.
- `POST /api/auth/otp/verify`: Verifikasi kode OTP 6-digit.
- `POST /api/auth/logout`: Mengakhiri sesi pengguna.

### 5.2 Endpoint User Management (`/api/users/*`)
- `GET /api/users`: Mengambil daftar pengguna (Memerlukan Token).
- `POST /api/users`: Membuat pengguna baru (`ADMIN`).
- `PUT /api/users/:id`: Mengubah data pengguna (`ADMIN`).
- `DELETE /api/users/:id`: Menghapus pengguna (`ADMIN`).

### 5.3 Endpoint Paket (`/api/paket/*`)
- `POST /api/paket/resi`: Generate resi acak 8-karakter & simpan paket baru.
- `GET /api/paket`: Mengambil daftar paket berdasar hak akses role.
- `GET /api/paket/:resi`: Mengambil rincian detail paket tertentu.

### 5.4 Endpoint Pemindaian Scan (`/api/scans/*`)
- `POST /api/scans`: Eksekusi pemindaian resi barcode (Validasi & Duplikasi).
- `GET /api/scans`: Mengambil log event pemindaian.
- `GET /api/scans/stats/:user_id`: Mengambil statistik performa scan petugas.

---

## 6. Panduan Deployment Produksi

### 6.1 Berkas Konfigurasi Docker (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:11
    container_name: scanresi-db
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: wahana_scan
      MYSQL_USER: wahana_app
      MYSQL_PASSWORD: wahana_pass
    ports:
      - "3308:3306"
    volumes:
      - mariadb_data:/var/lib/mysql

  backend:
    build: ./backend
    container_name: scanresi-backend
    environment:
      WAHANA_DB_DSN: "DBI:mysql:database=wahana_scan;host=mariadb;port=3306"
      WAHANA_DB_USER: "wahana_app"
      WAHANA_DB_PASS: "wahana_pass"
    depends_on:
      - mariadb

  web:
    build: .
    container_name: scanresi-web
    ports:
      - "8080:80"
    depends_on:
      - backend
```

### 6.2 Menjalankan Tunneling Cloudflare (Remote Access Test)
```bash
cloudflared tunnel --url http://localhost:8080
```

---

## 7. Panduan Pemeliharaan & Troubleshooting

1. **Jaringan Offline Tidak Tersinkronisasi**:
   Buka Developer Tools Browser -> tab `Application` -> `IndexedDB` -> `ScanResiOfflineDB` -> `pending_scans`. Pastikan ada data antrean dan tekan tombol **Sync Manual** pada halaman Petugas Scan.
2. **Koneksi Database Gagal**:
   Periksa variabel lingkungan `WAHANA_DB_DSN` dan pastikan port container MariaDB aktif (`docker ps`).
3. **Hot-Reloading Router YAML**:
   Setiap perubahan rute pada `backend/etc/api/scanresi.yaml` secara otomatis dibaca ulang oleh `Wahana::Router` tanpa perlu merestart backend Perl.
