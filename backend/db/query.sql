-- =====================================================================
-- Dijak Express — Master Query Catalog (query.sql)
-- Seluruh query SQL backend dikelola secara terpusat di file ini.
-- Dipanggil oleh Perl controllers melalui Wahana::Query->get('query_name')
-- =====================================================================

-- =====================================================================
-- AUTH & USERS
-- =====================================================================

-- name: auth_get_user_by_username
SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)) LIMIT 1;

-- name: auth_get_user_by_id
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: auth_update_user_online
UPDATE users SET status = 'ONLINE', last_login = NOW() WHERE id = ?;

-- name: auth_update_user_offline
UPDATE users SET status = 'OFFLINE' WHERE id = ?;

-- name: otp_invalidate_old
UPDATE user_otps SET used = 1 WHERE user_id = ? AND used = 0;

-- name: otp_insert
INSERT INTO user_otps (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?);

-- name: otp_get_latest
SELECT * FROM user_otps WHERE user_id = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1;

-- name: otp_increment_attempt
UPDATE user_otps SET attempt_count = attempt_count + 1 WHERE id = ?;

-- name: otp_mark_used
UPDATE user_otps SET used = 1 WHERE id = ?;


-- name: auth_update_user_password
UPDATE users SET password_hash = ? WHERE id = ?;

-- name: users_get_role
SELECT role FROM users WHERE id = ?;

-- name: users_list_all
SELECT * FROM users ORDER BY id ASC;

-- name: users_check_username_exists
SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?);

-- name: users_check_username_exists_except_self
SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?) AND id != ?;

-- name: users_check_email_exists
SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?);

-- name: users_check_email_exists_except_self
SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?) AND id != ?;

-- name: users_get_max_admin_id
SELECT COALESCE(MAX(CAST(SUBSTRING(id, 11) AS UNSIGNED)), 0)
  FROM users WHERE id REGEXP '^USR-ADMIN-[0-9]+$';

-- name: users_get_max_cust_id
SELECT COALESCE(MAX(CAST(SUBSTRING(id, 10) AS UNSIGNED)), 0)
  FROM users WHERE id REGEXP '^USR-CUST-[0-9]+$';

-- name: users_get_max_petugas_id
SELECT COALESCE(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)), 0)
  FROM users WHERE id REGEXP '^USR-[0-9]+$';

-- name: users_insert
INSERT INTO users (id, name, username, email, password_hash, role, status)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: users_get_by_id
SELECT * FROM users WHERE id = ?;

-- name: users_toggle_status
UPDATE users SET status = ? WHERE id = ?;

-- name: users_update_with_password
UPDATE users SET name = ?, username = ?, email = ?, role = ?, password_hash = ? WHERE id = ?;

-- name: users_update_without_password
UPDATE users SET name = ?, username = ?, email = ?, role = ? WHERE id = ?;

-- name: users_count_tasks
SELECT COUNT(*) FROM tasks WHERE user_id = ?;

-- name: users_count_scans
SELECT COUNT(*) FROM scan_events WHERE user_id = ?;

-- name: users_count_paket
SELECT COUNT(*) FROM paket WHERE created_by = ?;

-- name: users_delete
DELETE FROM users WHERE id = ?;

-- =====================================================================
-- TASKS
-- =====================================================================

-- name: tasks_list_base
SELECT t.*, u.name AS user_name
  FROM tasks t JOIN users u ON u.id = t.user_id;

-- name: tasks_check_user_exists
SELECT COUNT(*) FROM users WHERE id = ?;

-- name: tasks_get_max_id
SELECT COALESCE(MAX(CAST(SUBSTRING(task_id, 6) AS UNSIGNED)), 0)
  FROM tasks WHERE task_id REGEXP '^TASK-[0-9]+$';

-- name: tasks_insert
INSERT INTO tasks (task_id, user_id, shift, tanggal, target, progress, status, lokasi)
VALUES (?, ?, ?, ?, ?, 0, 'PROSES_SCAN', ?);

-- name: tasks_get_by_id
SELECT t.*, u.name AS user_name
  FROM tasks t JOIN users u ON u.id = t.user_id
 WHERE t.task_id = ?;

-- name: tasks_increment_progress
UPDATE tasks SET progress = progress + ? WHERE task_id = ?;

-- name: tasks_complete
UPDATE tasks SET status = 'SELESAI' WHERE task_id = ?;

-- =====================================================================
-- SCANS
-- =====================================================================

-- name: scans_list_base
SELECT s.*, u.name AS user_name
  FROM scan_events s JOIN users u ON u.id = s.user_id;

-- name: scans_stats_success
SELECT COUNT(*) FROM scan_events WHERE user_id = ? AND status_scan = 'SUCCESS';

-- name: scans_stats_duplicate
SELECT COUNT(*) FROM audit_logs WHERE user_id = ? AND action = 'SCAN_DUPLICATE';

-- name: scans_stats_last_scan
SELECT MAX(waktu_scan) FROM scan_events WHERE user_id = ?;

-- name: scans_lock_task
SELECT * FROM tasks WHERE task_id = ? FOR UPDATE;

-- name: scans_check_duplicate
SELECT COUNT(*) FROM scan_events WHERE nomor_resi = ? AND task_id = ? AND status_scan = 'SUCCESS';

-- name: scans_check_paket_registered
SELECT * FROM paket WHERE nomor_resi = ?;

-- name: scans_get_max_id
SELECT COALESCE(MAX(CAST(SUBSTRING(scan_id, 5) AS UNSIGNED)), 0)
  FROM scan_events WHERE scan_id REGEXP '^SCN-[0-9]+$';

-- name: scans_insert
INSERT INTO scan_events (scan_id, nomor_resi, user_id, task_id, lokasi, status_scan, device_id, jenis_scan)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: scans_get_by_id
SELECT s.*, u.name AS user_name
  FROM scan_events s JOIN users u ON u.id = s.user_id
 WHERE s.scan_id = ?;

-- =====================================================================
-- PAKET
-- =====================================================================

-- name: paket_check_resi_exists
SELECT COUNT(*) FROM paket WHERE nomor_resi = ?;

-- name: paket_supersede_draft
UPDATE paket SET status = 'REPLACED' WHERE (draft_id = ? OR nomor_resi = ?) AND status = 'DRAFT';

-- name: paket_void_replaced_drafts
UPDATE paket SET status = 'VOID' WHERE draft_id = ? AND status = 'REPLACED';

-- name: paket_insert_draft
INSERT INTO paket (nomor_resi, status, created_by, draft_id, barcode_format, barcode_value, nama_barang, pengirim, alamat_pengirim, telepon_pengirim, penerima, alamat_tujuan, telepon_penerima, berat_kg, jenis_layanan, created_at)
VALUES (?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());

-- name: paket_insert_registered
INSERT INTO paket (nomor_resi, status, created_by, barcode_format, barcode_value, nama_barang, pengirim, alamat_pengirim, telepon_pengirim, penerima, alamat_tujuan, telepon_penerima, berat_kg, jenis_layanan, created_at)
VALUES (?, 'TERDAFTAR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());


-- name: paket_get_detail
SELECT p.*, u.name AS creator_name
  FROM paket p LEFT JOIN users u ON u.id = p.created_by
 WHERE p.nomor_resi = ?;

-- name: paket_get_by_resi
SELECT * FROM paket WHERE nomor_resi = ?;

-- name: paket_list_base
SELECT p.*, u.name AS creator_name
  FROM paket p LEFT JOIN users u ON u.id = p.created_by;

-- name: paket_lookup_by_barcode_value
SELECT p.*, u.name AS creator_name
  FROM paket p LEFT JOIN users u ON u.id = p.created_by
 WHERE p.barcode_value = ? LIMIT 1;

-- name: paket_update_data
UPDATE paket
   SET nama_barang = ?, pengirim = ?, alamat_pengirim = ?, telepon_pengirim = ?,
       penerima = ?, alamat_tujuan = ?, telepon_penerima = ?,
       berat_kg = ?, jenis_layanan = ?, barcode_format = ?, status = 'TERDAFTAR'
 WHERE nomor_resi = ?;

-- =====================================================================
-- AUDIT LOGS
-- =====================================================================

-- name: audit_insert
INSERT INTO audit_logs (user_id, user_name, action, details, ip_address)
VALUES (?, ?, ?, ?, ?);

-- name: audit_list_base
SELECT a.*, COALESCE(a.user_name, u.name) AS user_name
  FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id;
