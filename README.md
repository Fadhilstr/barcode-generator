# 📦 Dijak Express — Platform Manajemen & Pemindaian Resi Barcode Logistik

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](PRD.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Quasar](https://img.shields.io/badge/Frontend-Quasar%20Vue%203-050B14?logo=quasar)](src/)
[![Backend](https://img.shields.io/badge/Backend-Perl%20uWSGI-39457E?logo=perl)](backend/)
[![Database](https://img.shields.io/badge/Database-MariaDB%2011-003545?logo=mariadb)](backend/db/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ED?logo=docker)](docker-compose.yml)
[![PWA](https://img.shields.io/badge/PWA-IndexedDB%20Offline%20Sync-5A0FC8?logo=pwa)](src-pwa/)

**Dijak Express (Scan-RESI)** adalah platform manajemen dan pemindaian resi logistik berbasis web SPA/PWA terintegrasi. Dilengkapi dengan generator nomor resi server-side 8-karakter unik, verifikasi OTP Gmail, live camera barcode scanner (Code 128 & QR Code), kapabilitas **Offline Scanning PWA** (IndexedDB background sync), serta dashboard analitik & monitoring role-based (Admin, Petugas Scan, Customer).

---

## 📸 Fitur Utama System

### 1. 🔐 Autentikasi & Keamanan Tingkat Tinggi
* **Role-Based Access Control (RBAC)**: Pemisahan hak akses ketat antara `ADMIN`, `PETUGAS_SCAN`, dan `CUSTOMER`.
* **Gmail OTP Verification**: Pengiriman kode verifikasi 6-digit ke email Gmail pengguna untuk registrasi dan lupa password.
* **API Rate Limiting**: Middleware pembatas request (100 req/menit per IP) untuk mencegah *brute-force* dan serangan DoS.
* **Salted Password Hash**: Keamanan enkripsi password SHA-256 ber-salt unik per pengguna.

### 2. 📦 Portal Pelanggan (Customer Portal)
* **Pendaftaran Paket Mandiri**: Input terstruktur data pengirim, penerima, deskripsi barang, berat (kg), dan jenis layanan (`REGULER`, `EXPRESS`, `SAME_DAY`).
* **Generator Resi Server-Side**: Menghasilkan nomor resi acak 8-karakter unik non-ambigu (contoh: `D99X5MV2`, `GJXL8FLB`).
* **Cetak Label Resi Logistik (10x15cm)**: Render visual Barcode Code 128 & QR Code siap cetak thermal/printer biasa.

### 3. 📱 Petugas Operasional & Offline PWA Scanning Engine
* **Live Camera Barcode Scanner**: Memindai barcode resi via kamera smartphone/laptop dengan dukungan ganti kamera & Senter (*Flash/Torch*).
* **Offline Scanning via IndexedDB**: Ketika koneksi terputus (`OFFLINE`), scan resi disimpan ke memori lokal browser (`pending_scans`).
* **Automatic Background Sync**: Antrean scan offline secara otomatis diunggah ke database MariaDB server ketika koneksi kembali terhubung (`ONLINE`).
* **Proteksi Transaksional Anti-Duplikasi**: Mencegah pemindaian ganda resi pada shift task yang sama dengan query transaksional `FOR UPDATE`.
* **Umpan Balik Audio-Visual**: Suara Beep nada tinggi untuk `SUCCESS` & Buzzer nada ganda untuk `DUPLICATE`/Error.

### 4. 📊 Admin Portal & Monitoring Rayon
* **Dashboard KPI Real-time**: Grafik & persentase ketercapaian target scan shift harian.
* **User Management & Task Allocation**: Penambahan user baru, pengaturan status akun (`ONLINE`/`OFFLINE`/`DISABLED`), dan alokasi target shift petugas.
* **Audit Trail Logs**: Pencatatan otomatis jejak aktivitas penting pengguna beserta IP Address dan timestamp.

### 5. 🛠️ Dynamic OpenAPI Router & Query Catalog
* **Active DCAF SWB Router**: Routing backend dikendalikan secara deklaratif oleh file `backend/etc/api/scanresi.yaml` dengan hot-reloading `mtime`.
* **SQL Query Catalog**: Pemisahan seluruh sintaks SQL ke `backend/db/query.sql` untuk keamanan dan perawatan query.

---

## 🛠️ Stack Teknologi

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Frontend Framework** | Vue 3 + Quasar v2 | Framework SPA & PWA modern dengan Pinia State Management |
| **Local Database PWA** | IndexedDB (`offlineDb.js`) | Penyimpanan antrean scan saat jaringan offline |
| **Backend Core** | Perl (Plack / uWSGI) | REST API server performa tinggi |
| **Routing Engine** | OpenAPI 3.0 YAML + DCAF | Router dinamis berbasis deklarasi OpenAPI |
| **Database Server** | MariaDB 11 | Database relational transaksional |
| **Web Gateway** | Nginx | Reverse proxy API & Static Web Server |
| **Containerization** | Docker & Docker Compose | Deployment ter-container |

---

## 🚀 Panduan Quick Start (Cara Menjalankan)

### Opsi A: Deployment via Docker Compose (Rekomendasi)

Cukup satu langkah menggunakan skrip Docker Compose bawaan:

```bash
# 1. Jalankan seluruh container (Nginx, Backend Perl uWSGI, MariaDB)
./docker-up.sh

# Aplikasi akan dapat diakses di:
# - Frontend Web App & API: http://localhost:8080
# - Dokumentasi Interactive Swagger UI: http://localhost:8080/api/docs
```

Untuk menghentikan layanan:
```bash
./docker-down.sh
```

---

### Opsi B: Running Manual (Development Mode)

#### 1. Jalankan MariaDB Database Container
```bash
./backend/start-db.sh
```

#### 2. Jalankan Backend Perl API Server
```bash
export WAHANA_DB_DSN='DBI:mysql:database=wahana_scan;host=127.0.0.1;port=3307'
export WAHANA_DB_USER='wahana_app'
export WAHANA_DB_PASS='wahana_pass'

perl backend/server.pl
```

#### 3. Jalankan Frontend Quasar SPA
```bash
# Install dependencies
npm install

# Jalankan dev server lokal
npx quasar dev
```

#### 4. Uji Pemindaian Smartphone via WiFi (HTTPS LAN)
```bash
npm run dev:lan
# Akses dari browser HP: https://<IP-LAPTOP>:9000
```

---

## 🔑 Akun Demo Testing (Master Seed Credentials)

| Role | Username | Password | Fungsi Akses |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin` | `admin123` | Akses penuh ke seluruh menu admin & monitoring |

> **Catatan**: Akun `PETUGAS_SCAN` dan `CUSTOMER` dapat dibuat melalui menu **User Management** (Role Admin) atau registrasi mandiri Customer. Anda juga dapat menggunakan tombol **Quick Login Simulator** pada halaman Login.

---

## 📁 Struktur Direktori Proyek

```text
Scan-RESI/
├── backend/
│   ├── cgi-bin/                # CGI Wrappers
│   ├── db/                     # Schema SQL, Query Catalog & Migrasi Database
│   │   ├── schema.sql          # DDL Skema MariaDB
│   │   └── query.sql           # Katalog SQL Query
│   ├── etc/api/
│   │   └── scanresi.yaml       # OpenAPI Specification & Router Engine DCAF
│   ├── lib/Wahana/             # Modul Core Perl Backend
│   │   ├── Controller/         # Auth, Users, Tasks, Scans, Paket, Audit, Docs
│   │   ├── Auth.pm             # HMAC-SHA256 & Hashing Salt
│   │   ├── Mail.pm             # SMTP Gmail OTP Integration
│   │   ├── Query.pm            # Wahana Query Engine Catalog
│   │   ├── RateLimit.pm        # API Rate Limiter Middleware
│   │   └── Router.pm           # OpenAPI Dynamic Router
│   └── server.pl               # Standalone HTTP Server
├── nginx/
│   └── docker-nginx.conf       # Nginx Reverse Proxy Configuration
├── src/
│   ├── boot/                   # Quasar Boot Init (Axios, Stores)
│   ├── components/             # Camera Scanner, Barcode Generator, Label Print, Tables
│   ├── css/                    # Custom CSS & Design System
│   ├── layouts/                # Main Layouts
│   ├── pages/                  # Pages: Admin, Petugas, Customer, Auth
│   ├── services/               # API & Offline Synchronization Service
│   ├── stores/                 # Pinia State Management
│   └── utils/                  # IndexedDB Utility, Address Formatter
├── tests/
│   ├── e2e_full_qa_matrix.py   # Automated E2E QA Matrix Test Script
│   ├── laporan_qa.html         # Interactive HTML Test Report
│   └── test_rate_limit.py      # Rate Limit Test Script
├── docker-compose.yml          # Configuration Docker Deployment
├── PRD.md                      # Product Requirement Document (v1.2.0)
├── DOCUMENTATION.md            # Technical Architecture & Developer Guide
└── README.md                   # Dokumentasi Utama Proyek
```

---

## 🧪 Pengujian QA Otomatis (E2E Test Matrix)

Aplikasi telah terverifikasi melalui pengujian otomatis **E2E QA Matrix**:

```bash
# Menjalankan pengujian E2E Full Matrix
python3 tests/e2e_full_qa_matrix.py
```

Laporan pengujian interaktif dapat dibuka di browser: [tests/laporan_qa.html](tests/laporan_qa.html) atau dalam format PDF `LAPORAN_QA_DAN_PENGUJIAN_SYSTEM_DIJAK_EXPRESS.pdf`.

---

## 📄 Lisensi & Dokumen Referensi

- **Product Requirement Document**: [PRD.md](PRD.md)
- **Panduan Arsitektur Teknis**: [DOCUMENTATION.md](DOCUMENTATION.md)
- **Lisensi**: MIT License
