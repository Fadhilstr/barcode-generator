# ============================================================
# Dockerfile — Backend Perl uWSGI PSGI Service (Wahana Express)
# ============================================================
FROM debian:bookworm-slim

# Install Perl runtime, DBI driver MySQL/MariaDB, JSON, uWSGI & PSGI plugin
RUN apt-get update && apt-get install -y --no-install-recommends \
    perl \
    libdbi-perl \
    libdbd-mysql-perl \
    libjson-pp-perl \
    libjson-xs-perl \
    libio-socket-ssl-perl \
    libnet-ssleay-perl \
    libauthen-sasl-perl \
    libyaml-syck-perl \
    libyaml-tiny-perl \
    uwsgi \
    uwsgi-plugin-psgi \
    default-mysql-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code backend
COPY backend/ /app/

# Pastikan folder log tersedia
RUN mkdir -p /app/log

EXPOSE 5000

# Jalankan uWSGI PSGI server
CMD ["uwsgi", \
     "--http-socket", "0.0.0.0:5000", \
     "--plugin", "psgi", \
     "--psgi", "web.pl", \
     "--chdir", "/app", \
     "--master", \
     "--workers", "4", \
     "--enable-threads", \
     "--threads", "2", \
     "--die-on-term"]
