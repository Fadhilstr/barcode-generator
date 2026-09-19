package Wahana::Config;
use strict;
use warnings;
use Exporter 'import';

our @EXPORT_OK = qw(config validate_config);

# Konfigurasi terpusat — dapat dioverride lewat environment variable.
sub config {
    my $host = $ENV{DB_HOST} // $ENV{WAHANA_DB_HOST} // '127.0.0.1';
    my $port = $ENV{DB_PORT} // $ENV{WAHANA_DB_PORT} // 3306;
    my $name = $ENV{DB_NAME} // $ENV{WAHANA_DB_NAME} // 'wahana_scan';
    my $dsn  = $ENV{WAHANA_DB_DSN} // "DBI:mysql:database=$name;host=$host;port=$port";

    return {
        db_dsn       => $dsn,
        db_user      => $ENV{DB_USER}      // $ENV{WAHANA_DB_USER}      // 'wahana_app',
        db_pass      => $ENV{DB_PASS}      // $ENV{WAHANA_DB_PASS}      // 'wahana_pass',
        api_port     => $ENV{WAHANA_API_PORT}     // 5000,
        token_secret   => $ENV{WAHANA_TOKEN_SECRET} // 'wahana-dev-secret-2026-ganti-di-produksi',
        token_ttl      => $ENV{WAHANA_TOKEN_TTL}    // 86400,   
        smtp_host      => $ENV{SMTP_HOST}           // 'smtp.gmail.com',
        smtp_port      => $ENV{SMTP_PORT}           // 587,
        smtp_user      => $ENV{SMTP_USER}           // '',
        smtp_pass      => $ENV{SMTP_PASSWORD}       // '',
        smtp_secure    => $ENV{SMTP_SECURE}         // 'false',
        smtp_from_name => $ENV{SMTP_FROM_NAME}      // 'DIJAK EXPRESS',
    };
}

# Validasi konfigurasi saat startup (BUG-009)
# Menolak startup jika secret default dipakai pada lingkungan produksi
sub validate_config {
    my $cfg = config();
    my $env = lc($ENV{APP_ENV} // $ENV{ENVIRONMENT} // $ENV{NODE_ENV} // $ENV{WAHANA_ENV} // 'development');

    if ($env eq 'production' || $env eq 'prod') {
        my $secret = $cfg->{token_secret} // '';
        if ($secret eq '' || $secret eq 'wahana-dev-secret-2026-ganti-di-produksi') {
            die "\n" . ("!" x 70) . "\n"
              . "[FATAL KEAMANAN] Startup backend dibatalkan!\n"
              . "Aplikasi berjalan dalam mode PRODUCTION ($env),\n"
              . "tetapi WAHANA_TOKEN_SECRET menggunakan secret default atau kosong.\n"
              . "Silakan tentukan nilai rahasia acak yang kuat melalui environment variable:\n"
              . "  export WAHANA_TOKEN_SECRET='<rahasia-acak-panjang>'\n"
              . ("!" x 70) . "\n\n";
        }
    }
    return 1;
}

1;
