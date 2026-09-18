#!/bin/bash
# ============================================================
# docker-up.sh — Menjalankan Full Stack Wahana Scan App
# ============================================================

set -e

echo ""
echo "  ███████╗ ██████╗ █████╗ ███╗   ██╗███╗   ██╗███████╗██████╗"
echo "  ██╔════╝██╔════╝██╔══██╗████╗  ██║████╗  ██║██╔════╝██╔══██╗"
echo "  ███████╗██║     ███████║██╔██╗ ██║██╔██╗ ██║█████╗  ██████╔╝"
echo "  ╚════██║██║     ██╔══██║██║╚██╗██║██║╚██╗██║██╔══╝  ██╔══██╗"
echo "  ███████║╚██████╗██║  ██║██║ ╚████║██║ ╚████║███████╗██║  ██║"
echo "  ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝"
echo ""
echo "            ██████╗  █████╗ ███╗   ██╗"
echo "            ██║  ██║███████║██╔██╗ ██║"
echo "            ██║  ██║██╔══██║██║╚██╗██║"
echo "            ██████╔╝██║  ██║██║ ╚████║"
echo "            ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝"
echo ""
echo "    ██████╗  █████╗ ██████╗  ██████╗ ██████╗ ██████╗ ███████╗"
echo "    ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝"
echo "    ██████╔╝███████║██████╔╝██║     ██║   ██║██║  ██║█████╗"
echo "    ██╔══██╗██╔══██║██╔══██╗██║     ██║   ██║██║  ██║██╔══╝"
echo "    ██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝██████╔╝███████╗"
echo "    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝"
echo ""
echo "  ██████╗ ███████╗███╗   ██╗███████╗██████╗  █████╗ ████████╗ ██████╗ ██████╗"
echo "  ██╔════╝ ██╔════╝████╗  ██║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗"
echo "  ██║  ███╗█████╗  ██╔██╗ ██║█████╗  ██████╔╝███████║   ██║   ██║   ██║██████╔╝"
echo "  ██║   ██║██╔══╝  ██║╚██╗██║██╔══╝  ██╔══██╗██╔══██║   ██║   ██║   ██║██╔══██╗"
echo "  ╚██████╔╝███████╗██║ ╚████║███████╗██║  ██║██║  ██║   ██║   ╚██████╔╝██║  ██║"
echo "   ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝"
echo ""
echo "              >> Fadhil Satria.W  - Zaki Syifa.N <<"
echo ""
echo "=========================================================="
echo "  Membangun & Menjalankan Container (DB + BE + FE + NGINX)"
echo "=========================================================="

docker compose up --build -V -d

echo ""
echo "Menunggu database & backend siap..."
sleep 5

echo ""
echo "=========================================================="
echo "  ✓ Seluruh container berhasil dijalankan!"
echo "  🌐 Nginx Gateway : http://localhost:8080 (Akses Utama)"
echo "  💻 Frontend Dev  : http://localhost:9000 (Quasar Dev Server)"
echo "  ⚙️  Backend API   : http://localhost:5000 (Perl uWSGI)"
echo "  🗄️  Database     : localhost:3308 (MariaDB wahana_scan)"
echo "  📄 Swagger UI   : http://localhost:8080/api/docs"
echo "  📊 Grafana Dash : http://localhost:3000 (Admin Monitoring & Logs)"
echo "  📈 Prometheus   : http://localhost:9090 (System & Scanner Metrics)"
echo "  📋 Loki Engine  : http://localhost:3100 (Centralized Logging)"
echo "=========================================================="
echo "  Lihat status : docker compose ps"
echo "  Lihat log    : docker compose logs -f"
echo "  Matikan      : ./docker-down.sh"
echo "=========================================================="
