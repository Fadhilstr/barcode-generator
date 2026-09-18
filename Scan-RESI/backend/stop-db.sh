#!/usr/bin/env bash
# Hentikan & hapus container database demo Wahana Express.
# Data tetap tersimpan pada docker volume "wahana_mariadb_data".
set -euo pipefail
docker rm -f wahana-mariadb >/dev/null 2>&1 || true
echo "[DB] Container wahana-mariadb dihentikan."
