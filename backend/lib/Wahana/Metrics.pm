package Wahana::Metrics;
use strict;
use warnings;
use Exporter 'import';
use File::Path qw(make_path);
use JSON::PP;

our @EXPORT_OK = qw(
    record_http_request
    record_scan_metric
    inc_active_requests
    dec_active_requests
    render_prometheus_metrics
);

# Folder penyimpanan metrik per worker (uWSGI multi-worker safe)
my $METRICS_DIR = '/tmp/wahana_metrics';
eval { make_path($METRICS_DIR) };

# Durasi histogram buckets (dalam detik)
my @HTTP_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0);
my @SCAN_BUCKETS = (0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0);

# Format barcode yang valid & diizinkan (Low Cardinality)
my %VALID_FORMATS = map { $_ => 1 } qw(
    CODE_128 CODE_39 CODE_93 QR_CODE AZTEC CODABAR DATA_MATRIX
    MAXICODE ITF EAN_13 EAN_8 PDF_417 RSS_14 RSS_EXPANDED UPC_A
    UPC_E UPC_EAN_EXTENSION UNKNOWN
);

# In-memory storage untuk worker saat ini
my %WORKER_DATA = (
    active_requests => 0,
    http_requests   => {}, # key: "$method|$endpoint|$status" => count
    http_errors     => {}, # key: "$method|$endpoint|$status" => count
    http_dur_sum    => {}, # key: "$method|$endpoint" => sum
    http_dur_count  => {}, # key: "$method|$endpoint" => count
    http_dur_bucket => {}, # key: "$method|$endpoint|$bucket" => count
    scan_scans      => {}, # key: "$format" => count
    scan_success    => {}, # key: "$format" => count
    scan_duplicate  => {}, # key: "$format" => count
    scan_error      => {}, # key: "$format" => count
    scan_dur_sum    => {}, # key: "$format" => sum
    scan_dur_count  => {}, # key: "$format" => count
    scan_dur_bucket => {}, # key: "$format|$bucket" => count
);

my $JSON_CODER = JSON::PP->new->utf8->canonical;

# Normalisasi path untuk menghindari high cardinality
sub normalize_path {
    my ($path) = @_;
    return '/' unless defined $path && length $path;
    $path =~ s/\?.*$//; # buang query string
    $path =~ s{^/api/?}{/api/};

    # Normalisasi pola ID umum
    $path =~ s{/scans/stats/[^/]+}{/scans/stats/:user_id}g;
    $path =~ s{/paket/[A-Za-z0-9_-]+}{/paket/:resi}g;
    $path =~ s{/tasks/[A-Za-z0-9_-]+}{/tasks/:task_id}g;
    $path =~ s{/users/[A-Za-z0-9_-]+}{/users/:id}g;

    return $path;
}

sub normalize_format {
    my ($fmt) = @_;
    return 'UNKNOWN' unless defined $fmt && length $fmt;
    my $clean = uc($fmt);
    $clean =~ s/[^A-Z0-9_]//g;
    return $VALID_FORMATS{$clean} ? $clean : 'UNKNOWN';
}

sub _get_worker_id {
    my $tid = 0;
    eval {
        # Ambil thread id dari kernel Linux (SYS_gettid = 186 di x86_64)
        $tid = syscall(186);
    };
    $tid ||= $$;
    return "${$}_${tid}";
}

# Inisialisasi baseline scanner dari MariaDB saat startup container/worker
sub _init_db_baseline {
    return unless -d $METRICS_DIR;
    my $baseline_file = "$METRICS_DIR/db_baseline.json";
    return if -f $baseline_file;

    eval {
        require Wahana::Db;
        my $dbh = Wahana::Db->connect();
        return unless $dbh;

        my %base = (
            scan_scans     => {},
            scan_success   => {},
            scan_duplicate => {},
            scan_error     => {},
        );

        my $sth = $dbh->prepare("
            SELECT COALESCE(p.barcode_format, 'UNKNOWN') as fmt, s.status_scan, count(*) as cnt
            FROM scan_events s
            LEFT JOIN paket p ON s.nomor_resi = p.nomor_resi
            GROUP BY fmt, s.status_scan
        ");
        $sth->execute();
        while (my $row = $sth->fetchrow_hashref) {
            my $fmt = normalize_format($row->{fmt});
            my $cnt = int($row->{cnt} // 0);
            my $st  = uc($row->{status_scan} // 'SUCCESS');

            $base{scan_scans}{$fmt} += $cnt;
            if ($st eq 'SUCCESS') {
                $base{scan_success}{$fmt} += $cnt;
            } elsif ($st eq 'DUPLICATE') {
                $base{scan_duplicate}{$fmt} += $cnt;
            } else {
                $base{scan_error}{$fmt} += $cnt;
            }
        }

        my $tmp_file = "$baseline_file.tmp";
        if (open my $fh, '>', $tmp_file) {
            print $fh $JSON_CODER->encode(\%base);
            close $fh;
            rename $tmp_file, $baseline_file;
        }
    };
}

sub _flush_worker_file {
    return unless -d $METRICS_DIR;
    my $wid = _get_worker_id();
    my $file = "$METRICS_DIR/worker_${wid}.json";
    my $tmp_file = "$file.tmp";
    eval {
        if (open my $fh, '>', $tmp_file) {
            print $fh $JSON_CODER->encode(\%WORKER_DATA);
            close $fh;
            rename $tmp_file, $file;
        }
    };
}

sub inc_active_requests {
    $WORKER_DATA{active_requests}++;
    _flush_worker_file();
}

sub dec_active_requests {
    $WORKER_DATA{active_requests}-- if $WORKER_DATA{active_requests} > 0;
    _flush_worker_file();
}

# Catat metrik HTTP request
sub record_http_request {
    my (%args) = @_;
    my $method   = uc($args{method} // 'GET');
    my $endpoint = normalize_path($args{endpoint} // '/');
    my $status   = int($args{status} // 200);
    my $duration = sprintf("%.6f", $args{duration} // 0);

    my $key_full = "$method|$endpoint|$status";
    $WORKER_DATA{http_requests}{$key_full}++;

    if ($status >= 400) {
        $WORKER_DATA{http_errors}{$key_full}++;
    }

    my $key_ep = "$method|$endpoint";
    $WORKER_DATA{http_dur_sum}{$key_ep} += $duration;
    $WORKER_DATA{http_dur_count}{$key_ep}++;

    for my $b (@HTTP_BUCKETS) {
        if ($duration <= $b) {
            $WORKER_DATA{http_dur_bucket}{"$key_ep|$b"}++;
        }
    }
    $WORKER_DATA{http_dur_bucket}{"$key_ep|+Inf"}++;

    _flush_worker_file();
}

# Catat metrik Scanner Barcode
sub record_scan_metric {
    my (%args) = @_;
    my $format   = normalize_format($args{format});
    my $status   = uc($args{status} // 'SUCCESS'); # SUCCESS, DUPLICATE, ERROR
    my $duration = defined $args{duration} ? sprintf("%.6f", $args{duration}) : undef;

    $WORKER_DATA{scan_scans}{$format}++;

    if ($status eq 'SUCCESS') {
        $WORKER_DATA{scan_success}{$format}++;
    } elsif ($status eq 'DUPLICATE') {
        $WORKER_DATA{scan_duplicate}{$format}++;
    } else {
        $WORKER_DATA{scan_error}{$format}++;
    }

    if (defined $duration && $duration > 0) {
        $WORKER_DATA{scan_dur_sum}{$format} += $duration;
        $WORKER_DATA{scan_dur_count}{$format}++;

        for my $b (@SCAN_BUCKETS) {
            if ($duration <= $b) {
                $WORKER_DATA{scan_dur_bucket}{"$format|$b"}++;
            }
        }
        $WORKER_DATA{scan_dur_bucket}{"$format|+Inf"}++;
    }

    _flush_worker_file();
}

# Agregasi seluruh data worker dari /tmp/wahana_metrics/
sub _aggregate_all_metrics {
    _flush_worker_file();
    _init_db_baseline();

    my %agg = (
        active_requests => 0,
        http_requests   => {},
        http_errors     => {},
        http_dur_sum    => {},
        http_dur_count  => {},
        http_dur_bucket => {},
        scan_scans      => {},
        scan_success    => {},
        scan_duplicate  => {},
        scan_error      => {},
        scan_dur_sum    => {},
        scan_dur_count  => {},
        scan_dur_bucket => {},
    );

    # 1. Masukkan baseline dari database jika file tersedia
    my $baseline_file = "$METRICS_DIR/db_baseline.json";
    if (-f $baseline_file) {
        eval {
            if (open my $bfh, '<', $baseline_file) {
                local $/;
                my $bcontent = <$bfh>;
                close $bfh;
                my $bdata = $JSON_CODER->decode($bcontent);
                for my $k (keys %{ $bdata->{scan_scans} || {} }) {
                    $agg{scan_scans}{$k} += $bdata->{scan_scans}{$k};
                }
                for my $k (keys %{ $bdata->{scan_success} || {} }) {
                    $agg{scan_success}{$k} += $bdata->{scan_success}{$k};
                }
                for my $k (keys %{ $bdata->{scan_duplicate} || {} }) {
                    $agg{scan_duplicate}{$k} += $bdata->{scan_duplicate}{$k};
                }
                for my $k (keys %{ $bdata->{scan_error} || {} }) {
                    $agg{scan_error}{$k} += $bdata->{scan_error}{$k};
                }
            }
        };
    }

    # 2. Agregasikan seluruh file metrik live worker
    opendir my $dh, $METRICS_DIR or return \%agg;
    my @files = grep { /^worker_[\d_]+\.json$/ } readdir($dh);
    closedir $dh;

    for my $fn (@files) {
        my $fpath = "$METRICS_DIR/$fn";
        next unless -f $fpath;
        eval {
            if (open my $fh, '<', $fpath) {
                local $/;
                my $content = <$fh>;
                close $fh;
                my $data = $JSON_CODER->decode($content);

                $agg{active_requests} += int($data->{active_requests} // 0);

                for my $k (keys %{ $data->{http_requests} || {} }) {
                    $agg{http_requests}{$k} += $data->{http_requests}{$k};
                }
                for my $k (keys %{ $data->{http_errors} || {} }) {
                    $agg{http_errors}{$k} += $data->{http_errors}{$k};
                }
                for my $k (keys %{ $data->{http_dur_sum} || {} }) {
                    $agg{http_dur_sum}{$k} += $data->{http_dur_sum}{$k};
                }
                for my $k (keys %{ $data->{http_dur_count} || {} }) {
                    $agg{http_dur_count}{$k} += $data->{http_dur_count}{$k};
                }
                for my $k (keys %{ $data->{http_dur_bucket} || {} }) {
                    $agg{http_dur_bucket}{$k} += $data->{http_dur_bucket}{$k};
                }
                for my $k (keys %{ $data->{scan_scans} || {} }) {
                    $agg{scan_scans}{$k} += $data->{scan_scans}{$k};
                }
                for my $k (keys %{ $data->{scan_success} || {} }) {
                    $agg{scan_success}{$k} += $data->{scan_success}{$k};
                }
                for my $k (keys %{ $data->{scan_duplicate} || {} }) {
                    $agg{scan_duplicate}{$k} += $data->{scan_duplicate}{$k};
                }
                for my $k (keys %{ $data->{scan_error} || {} }) {
                    $agg{scan_error}{$k} += $data->{scan_error}{$k};
                }
                for my $k (keys %{ $data->{scan_dur_sum} || {} }) {
                    $agg{scan_dur_sum}{$k} += $data->{scan_dur_sum}{$k};
                }
                for my $k (keys %{ $data->{scan_dur_count} || {} }) {
                    $agg{scan_dur_count}{$k} += $data->{scan_dur_count}{$k};
                }
                for my $k (keys %{ $data->{scan_dur_bucket} || {} }) {
                    $agg{scan_dur_bucket}{$k} += $data->{scan_dur_bucket}{$k};
                }
            }
        };
    }

    return \%agg;
}

# Render format teks Prometheus (OpenMetrics / standard v0.0.4)
sub render_prometheus_metrics {
    my $data = _aggregate_all_metrics();
    my @lines;

    # 1. Active Requests
    push @lines, "# HELP active_requests Number of active HTTP requests currently being processed";
    push @lines, "# TYPE active_requests gauge";
    push @lines, sprintf("active_requests %d", $data->{active_requests} || 0);

    # 2. HTTP Requests Total
    push @lines, "# HELP http_requests_total Total number of HTTP requests processed";
    push @lines, "# TYPE http_requests_total counter";
    for my $k (sort keys %{ $data->{http_requests} }) {
        my ($m, $ep, $st) = split /\|/, $k;
        push @lines, sprintf('http_requests_total{endpoint="%s",method="%s",status="%s"} %d',
            $ep, $m, $st, $data->{http_requests}{$k});
    }

    # 3. HTTP Errors Total
    push @lines, "# HELP http_errors_total Total number of HTTP requests resulting in 4xx/5xx errors";
    push @lines, "# TYPE http_errors_total counter";
    for my $k (sort keys %{ $data->{http_errors} }) {
        my ($m, $ep, $st) = split /\|/, $k;
        push @lines, sprintf('http_errors_total{endpoint="%s",method="%s",status="%s"} %d',
            $ep, $m, $st, $data->{http_errors}{$k});
    }

    # 4. HTTP Request Duration Seconds (Histogram)
    push @lines, "# HELP http_request_duration_seconds HTTP request duration in seconds";
    push @lines, "# TYPE http_request_duration_seconds histogram";
    for my $ep_key (sort keys %{ $data->{http_dur_count} }) {
        my ($m, $ep) = split /\|/, $ep_key;
        my $cum = 0;
        for my $b (@HTTP_BUCKETS) {
            $cum += ($data->{http_dur_bucket}{"$ep_key|$b"} // 0);
            push @lines, sprintf('http_request_duration_seconds_bucket{endpoint="%s",le="%.3f",method="%s"} %d',
                $ep, $b, $m, $cum);
        }
        my $total_count = $data->{http_dur_count}{$ep_key} // 0;
        push @lines, sprintf('http_request_duration_seconds_bucket{endpoint="%s",le="+Inf",method="%s"} %d',
            $ep, $m, $total_count);
        push @lines, sprintf('http_request_duration_seconds_sum{endpoint="%s",method="%s"} %.6f',
            $ep, $m, $data->{http_dur_sum}{$ep_key} // 0);
        push @lines, sprintf('http_request_duration_seconds_count{endpoint="%s",method="%s"} %d',
            $ep, $m, $total_count);
    }

    # 5. Scanner Metrics
    push @lines, "# HELP scanner_scans_total Total barcode scan attempts processed";
    push @lines, "# TYPE scanner_scans_total counter";
    for my $fmt (sort keys %{ $data->{scan_scans} }) {
        push @lines, sprintf('scanner_scans_total{format="%s"} %d', $fmt, $data->{scan_scans}{$fmt});
    }

    push @lines, "# HELP scanner_scan_success_total Total successful barcode scans";
    push @lines, "# TYPE scanner_scan_success_total counter";
    for my $fmt (sort keys %{ $data->{scan_success} }) {
        push @lines, sprintf('scanner_scan_success_total{format="%s"} %d', $fmt, $data->{scan_success}{$fmt});
    }

    push @lines, "# HELP scanner_scan_duplicate_total Total duplicate barcode scans detected";
    push @lines, "# TYPE scanner_scan_duplicate_total counter";
    for my $fmt (sort keys %{ $data->{scan_duplicate} }) {
        push @lines, sprintf('scanner_scan_duplicate_total{format="%s"} %d', $fmt, $data->{scan_duplicate}{$fmt});
    }

    push @lines, "# HELP scanner_scan_error_total Total rejected or erroneous barcode scans";
    push @lines, "# TYPE scanner_scan_error_total counter";
    for my $fmt (sort keys %{ $data->{scan_error} }) {
        push @lines, sprintf('scanner_scan_error_total{format="%s"} %d', $fmt, $data->{scan_error}{$fmt});
    }

    # 6. Scanner Decode Duration Seconds (Histogram)
    push @lines, "# HELP scanner_decode_duration_seconds Barcode frame decoding duration in seconds";
    push @lines, "# TYPE scanner_decode_duration_seconds histogram";
    for my $fmt (sort keys %{ $data->{scan_dur_count} }) {
        my $cum = 0;
        for my $b (@SCAN_BUCKETS) {
            $cum += ($data->{scan_dur_bucket}{"$fmt|$b"} // 0);
            push @lines, sprintf('scanner_decode_duration_seconds_bucket{format="%s",le="%.3f"} %d',
                $fmt, $b, $cum);
        }
        my $total_count = $data->{scan_dur_count}{$fmt} // 0;
        push @lines, sprintf('scanner_decode_duration_seconds_bucket{format="%s",le="+Inf"} %d',
            $fmt, $total_count);
        push @lines, sprintf('scanner_decode_duration_seconds_sum{format="%s"} %.6f',
            $fmt, $data->{scan_dur_sum}{$fmt} // 0);
        push @lines, sprintf('scanner_decode_duration_seconds_count{format="%s"} %d',
            $fmt, $total_count);
    }

    return join("\n", @lines, "");
}

1;
