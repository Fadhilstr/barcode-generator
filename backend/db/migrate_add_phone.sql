-- =====================================================================
-- Wahana Express — Migrasi: Tambah Kolom Telepon Terstruktur
-- Menambahkan telepon_pengirim & telepon_penerima ke tabel paket
--
-- Cara jalankan:
--   mysql -u root -p < backend/db/migrate_add_phone.sql
-- =====================================================================
USE wahana_scan;

-- 1. Tambah kolom telepon_pengirim & telepon_penerima (nullable dulu untuk migrasi data)
ALTER TABLE paket
  ADD COLUMN telepon_pengirim VARCHAR(20) NULL AFTER alamat_pengirim,
  ADD COLUMN telepon_penerima VARCHAR(20) NULL AFTER alamat_tujuan;

-- 2. Migrasi data lama: ekstrak telepon dari JSON detail ke kolom baru
-- Hanya update jika JSON memiliki field telepon yang tidak null
UPDATE paket
SET 
  telepon_pengirim = TRIM(JSON_UNQUOTE(JSON_EXTRACT(pengirim_detail, '$.telepon'))),
  telepon_penerima = TRIM(JSON_UNQUOTE(JSON_EXTRACT(penerima_detail, '$.telepon')))
WHERE 
  (JSON_EXTRACT(pengirim_detail, '$.telepon') IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(pengirim_detail, '$.telepon')) != '')
  OR (JSON_EXTRACT(penerima_detail, '$.telepon') IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(penerima_detail, '$.telepon')) != '');

-- 3. Set kolom NOT NULL dengan default empty string (validasi di aplikasi)
ALTER TABLE paket
  MODIFY telepon_pengirim VARCHAR(20) NOT NULL DEFAULT '',
  MODIFY telepon_penerima VARCHAR(20) NOT NULL DEFAULT '';

-- 4. Verifikasi migrasi
SELECT nomor_resi, pengirim, telepon_pengirim, penerima, telepon_penerima 
FROM paket 
WHERE telepon_pengirim != '' OR telepon_penerima != '';