#!/usr/bin/env bash
# =====================================================================
# start-db.sh — Nyalakan MariaDB (Docker) untuk backend Wahana Express
#
# Dipakai ketika MariaDB native tidak dapat diakses (butuh sudo root).
# Container berjalan di port 3307 agar tidak bentrok dengan service
# MariaDB bawaan sistem (port 3306).
#
# Pemakaian:
#   ./backend/start-db.sh          # start + load schema
#   ./backend/stop-db.sh           # atau: docker stop wahana-mariadb
# =====================================================================
set -euo pipefail

DB_CONTAINER="wahana-mariadb"
DB_ROOT_PASS="wahana_root_2026"
HOST_PORT=3307
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Start container jika belum jalan
if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "[DB] Menjalankan container $DB_CONTAINER (port $HOST_PORT)..."
  docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker run -d \
    --name "$DB_CONTAINER" \
    -e MARIADB_ROOT_PASSWORD="$DB_ROOT_PASS" \
    -p "$HOST_PORT":3306 \
    -v wahana_mariadb_data:/var/lib/mysql \
    mariadb:11 >/dev/null

  echo "[DB] Menunggu MariaDB siap..."
  until docker exec "$DB_CONTAINER" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
    sleep 1
  done
fi

echo "[DB] MariaDB aktif."

# 2. Load schema + seed data
echo "[DB] Load schema dari db/schema.sql ..."
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PASS" < "$SCRIPT_DIR/db/schema.sql"

echo "[DB] Selesai."
echo ""
echo "Konfigurasi koneksi untuk API server:"
echo "  export WAHANA_DB_DSN='DBI:mysql:database=wahana_scan;host=127.0.0.1;port=$HOST_PORT'"
echo "  export WAHANA_DB_USER='wahana_app'"
echo "  export WAHANA_DB_PASS='wahana_pass'"
