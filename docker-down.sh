#!/bin/bash
# ============================================================
# docker-down.sh — Menghentikan Full Stack Wahana Scan App
# ============================================================

set -e

echo "=========================================================="
echo "  Menghentikan seluruh container Wahana Scan..."
echo "=========================================================="

docker compose down

echo ""
echo "=========================================================="
echo "  ✓ Seluruh container Docker berhasil dihentikan."
echo "=========================================================="
