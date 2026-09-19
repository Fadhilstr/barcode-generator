package Wahana::Controller::ScansController;
use strict;
use warnings;
use Wahana::Db;
use Wahana::Query;
use Wahana::Util qw(fmt_datetime trim);
use Wahana::Audit qw(record_audit);
use Wahana::Controller::UsersController qw(get_user_role);
use Wahana::Metrics qw(record_scan_metric);
use Wahana::Logger qw(log_scanner_event);
use Exporter 'import';

our @EXPORT_OK = qw(map_scan);

sub map_scan {
    my ($r) = @_;
    return {
        scan_id     => $r->{scan_id},
        nomor_resi  => $r->{nomor_resi},
        user_id     => $r->{user_id},
        user_name   => $r->{user_name},
        task_id     => $r->{task_id},
        waktu_scan  => fmt_datetime($r->{waktu_scan}),
        lokasi      => $r->{lokasi},
        status_scan => $r->{status_scan},
        device_id   => $r->{device_id},
        jenis_scan  => $r->{jenis_scan},
    };
}

# GET /api/scans?user_id=&task_id=&status_scan=
sub list {
    my ($req) = @_;
    my $user_id = $req->{auth_user}{uid};
    my $role = get_user_role($user_id);
    if($role eq 'CUSTOMER'){
        return { 
            success => \0, 
            message => "Akses ditolak. Pelanggan tidak dapat melihat data scan petugas" };
    }
    
    my $params = $req->{params} // {};

    my @where;
    my @bind;
    for my $f (qw(user_id task_id status_scan)) {
        if (my $v = trim($params->{$f} // '')) {
            push @where, "s.$f = ?";
            push @bind,  $v;
        }
    }

    my $limit = int($params->{limit} // 100);
    $limit = 100 if $limit <= 0;
    $limit = 500 if $limit > 500;

    my $page   = int($params->{page} // 1);
    $page      = 1 if $page <= 0;
    my $offset = int($params->{offset} // (($page - 1) * $limit));
    $offset    = 0 if $offset < 0;

    my $dbh = Wahana::Db->connect();
    my $base_sql = Wahana::Query->get('scans_list_base');
    my $sql = $base_sql
        . (@where ? ' WHERE ' . join(' AND ', @where) : '')
        . " ORDER BY s.scan_id DESC LIMIT $limit OFFSET $offset";

    my $rows = $dbh->selectall_arrayref($sql, { Slice => {} }, @bind);

    return { scans => [ map { map_scan($_) } @$rows ] };
}

# GET /api/scans/stats/:user_id
sub stats {
    my ($req, $captures) = @_;
    my $user_id = $captures->[0];

    my $dbh = Wahana::Db->connect();

    my ($success) = $dbh->selectrow_array(
        Wahana::Query->get('scans_stats_success'),
        undef, $user_id
    );
    my ($duplicate) = $dbh->selectrow_array(
        Wahana::Query->get('scans_stats_duplicate'),
        undef, $user_id
    );
    my ($last) = $dbh->selectrow_array(
        Wahana::Query->get('scans_stats_last_scan'),
        undef, $user_id
    );

    return {
        stats => {
            total    => int($success // 0),
            success  => int($success // 0),
            duplicate => int($duplicate // 0),
            lastScan => $last ? fmt_datetime($last) : '-',
        }
    };
}

# POST /api/scans
# Body: { nomor_resi, user_id?, task_id, lokasi?, device_id?, jenis_scan? }
#
# Validasi duplikasi + increment progress dilakukan TRANSAKSIONAL di server:
#   BEGIN → LOCK task → cek duplikat → INSERT scan → UPDATE progress → COMMIT
sub create {
    my ($req) = @_;
    my $body = $req->{body} // {};

    # Prioritaskan user_id dari token auth; fallback ke body.
    my $user_id  = $req->{auth_user}{uid} // trim($body->{user_id} // '');
    my $resi     = uc(trim($body->{nomor_resi} // ''));
    my $task_id  = trim($body->{task_id} // '');
    my $format   = trim($body->{barcode_format} // $body->{format} // '');
    my $duration = defined $body->{decode_duration} ? ($body->{decode_duration} + 0) : undef;
    if (defined $duration && $duration > 10) {
        $duration = $duration / 1000.0;
    }

    return { success => \0, reason => 'EMPTY', message => 'Nomor resi tidak boleh kosong.' }
        unless length $resi;

    return { success => \0, reason => 'EMPTY', message => 'task_id wajib diisi.' }
        unless length $task_id;

    my $dbh = Wahana::Db->connect();

    # --- Validasi ketat: hanya resi TERDAFTAR di tabel paket yang boleh discan ---
    # Resi tidak dikenal maupun masih DRAFT TIDAK dicatat sebagai scan event.
    my $paket = $dbh->selectrow_hashref(
        Wahana::Query->get('scans_check_paket_registered'), undef, $resi
    );

    # Normalisasi otomatis jika scanner barcode membaca prefiks GS1 (01), padding leading zero, Codabar, atau GS1 AI(10)
    if (!$paket) {
        my $alt_resi = $resi;
        $alt_resi =~ s/[\x00-\x1F\x7F-\x9F]//g;
        $alt_resi =~ s/^\][A-Z0-9]{2}//i;
        if ($alt_resi =~ /\(10\)\s*([A-Z0-9]+)/i || $alt_resi =~ /^(?:\(01\)|01)?\s*\d{13,14}\s*(?:\(10\)|10)\s*([A-Z0-9]+)/i || $alt_resi =~ /\d{14}10([A-Z0-9]{4,16})/i) {
            $alt_resi = $1;
        } elsif ($alt_resi =~ /^[ABCD]([0-9]+)[ABCD]$/i) {
            $alt_resi = $1;
        } elsif ($alt_resi =~ /^\(01\)\s*(\d{13,14})$/i || $alt_resi =~ /^01(\d{14})$/i) {
            $alt_resi = $1;
        } elsif ($alt_resi =~ /^0(\d{12})$/) {
            $alt_resi = $1;
        }
        if ($alt_resi ne $resi) {
            $paket = $dbh->selectrow_hashref(
                Wahana::Query->get('scans_check_paket_registered'), undef, $alt_resi
            );
            $resi = $alt_resi if $paket;
        }

        # Toleransi pembacaan optik kamera pada UPC-E (misal digit 2/8 tertukar akibat noise sensor)
        if (!$paket && $resi =~ /^0\d{7}$/) {
            my $upce_rows = $dbh->selectall_arrayref(
                "SELECT nomor_resi FROM paket WHERE barcode_format = 'UPC_E' AND status = 'TERDAFTAR'",
                { Slice => {} }
            );
            for my $item (@$upce_rows) {
                my $target = $item->{nomor_resi};
                if (length($target) == 8) {
                    my $diff = 0;
                    for my $i (0 .. 7) {
                        $diff++ if substr($resi, $i, 1) ne substr($target, $i, 1);
                    }
                    if ($diff == 1) {
                        $paket = $dbh->selectrow_hashref(
                            Wahana::Query->get('scans_check_paket_registered'), undef, $target
                        );
                        if ($paket) {
                            $resi = $target;
                            last;
                        }
                    }
                }
            }
        }

        # Fallback: lookup via barcode_value (untuk format mapped seperti CODABAR, ITF, EAN_8, UPC_A, UPC_E, RSS_14)
        # Diperlukan karena localStorage mapping hanya ada di browser customer, bukan di browser petugas.
        if (!$paket) {
            my $row_by_bv = $dbh->selectrow_hashref(
                Wahana::Query->get('paket_lookup_by_barcode_value'), undef, $resi
            );
            if ($row_by_bv) {
                $paket = $dbh->selectrow_hashref(
                    Wahana::Query->get('scans_check_paket_registered'), undef, $row_by_bv->{nomor_resi}
                );
                $resi = $row_by_bv->{nomor_resi} if $paket;
            }
        }
    }

    unless ($paket) {
        $format ||= 'UNKNOWN';
        eval {
            record_scan_metric(format => $format, status => 'ERROR', duration => $duration);
            log_scanner_event(
                event      => 'SCAN_ERROR',
                format     => $format,
                nomor_resi => $resi,
                user_id    => $user_id,
                task_id    => $task_id,
                duration   => $duration,
                message    => "Nomor resi tidak terdaftar",
            );
        };
        record_audit(
            user_id    => $user_id,
            action     => 'SCAN_REJECTED',
            details    => "Resi: $resi, Status: UNKNOWN_RESI",
            ip_address => $req->{ip},
        );
        return {
            success => \0,
            reason  => 'UNKNOWN_RESI',
            status_scan => 'REJECTED',
            message     => "Nomor resi $resi tidak terdaftar. Pastikan customer sudah membuat resi.",
        };
    }

    $format ||= $paket->{barcode_format} || 'UNKNOWN';

    if ($paket->{status} ne 'TERDAFTAR') {
        my $st = $paket->{status} // 'NON_ACTIVE';
        eval {
            record_scan_metric(format => $format, status => 'ERROR', duration => $duration);
            log_scanner_event(
                event      => 'SCAN_ERROR',
                format     => $format,
                nomor_resi => $resi,
                user_id    => $user_id,
                task_id    => $task_id,
                duration   => $duration,
                message    => "Nomor resi tidak aktif (Status: $st)",
            );
        };
        record_audit(
            user_id    => $user_id,
            action     => 'SCAN_REJECTED',
            details    => "Resi: $resi, Status: $st",
            ip_address => $req->{ip},
        );
        my $msg = ($st eq 'DRAFT')
            ? "Nomor resi $resi masih DRAFT — data barang belum disimpan customer."
            : "Nomor resi $resi tidak aktif (Status: $st).";
        return {
            success => \0,
            reason  => $st,
            status_scan => 'REJECTED',
            message     => $msg,
        };
    }

    $dbh->begin_work();
    my $failed = 0;
    my $result;

    eval {
        # Kunci baris task untuk mencegah race condition antar petugas.
        my $task = $dbh->selectrow_hashref(
            Wahana::Query->get('scans_lock_task'), undef, $task_id
        );
        die "__notfound__" unless $task;
        die "__finished__" if $task->{status} eq 'SELESAI';

        my $dup = $dbh->selectrow_array(
            Wahana::Query->get('scans_check_duplicate'),
            undef, $resi, $task_id
        );

        if ($dup) {
            eval {
                record_scan_metric(format => $format, status => 'DUPLICATE', duration => $duration);
                log_scanner_event(
                    event      => 'SCAN_DUPLICATE',
                    format     => $format,
                    nomor_resi => $resi,
                    user_id    => $user_id,
                    task_id    => $task_id,
                    duration   => $duration,
                    message    => "Nomor resi sudah pernah discan",
                );
            };

            record_audit(
                user_id    => $user_id,
                action     => 'SCAN_DUPLICATE',
                details    => "Resi: $resi, Status: DUPLICATE",
                ip_address => $req->{ip},
            );

            $dbh->commit();

            $result = {
                success     => \0,
                reason      => 'DUPLICATE',
                status_scan => 'DUPLICATE',
                message     => "Nomor resi $resi sudah pernah discan.",
            };
        } else {
            # Generate scan_id unik via UUID untuk mencegah race condition (BUG-004)
            # Format: SCN-<uuid_hex_28> (total 32 karakter, muat di VARCHAR(32))
            my $scan_id = $dbh->selectrow_array("SELECT CONCAT('SCN-', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 28))");
            $scan_id ||= sprintf('SCN-%s', substr(join('', map { sprintf("%02x", rand(256)) } 1..14), 0, 28));

            $dbh->do(
                Wahana::Query->get('scans_insert'),
                undef,
                $scan_id, $resi, $user_id, $task_id,
                trim($body->{lokasi}      // '') || $task->{lokasi} || 'CIPUTAT',
                'SUCCESS',
                trim($body->{device_id}   // '') || 'SCAN-DEVICE-01',
                trim($body->{jenis_scan}  // '') || 'INBOUND',
            ) or die "insert gagal: " . ($dbh->errstr // '');

            # Progress hanya bertambah untuk scan SUCCESS (FR-4.2)
            $dbh->do(Wahana::Query->get('tasks_increment_progress'), undef, 1, $task_id);

            eval {
                record_scan_metric(format => $format, status => 'SUCCESS', duration => $duration);
                log_scanner_event(
                    event      => 'SCAN_SUCCESS',
                    format     => $format,
                    nomor_resi => $resi,
                    user_id    => $user_id,
                    task_id    => $task_id,
                    duration   => $duration,
                    message    => "Nomor resi berhasil discan",
                );
            };

            record_audit(
                user_id    => $user_id,
                action     => 'SCAN_EVENT_CREATED',
                details    => "Resi: $resi, Status: SUCCESS",
                ip_address => $req->{ip},
            );

            $dbh->commit();

            my $row = $dbh->selectrow_hashref(
                Wahana::Query->get('scans_get_by_id'), undef, $scan_id
            );
            my $scan_obj = map_scan($row);

            $result = {
                success     => \1,
                resi        => $resi,
                status_scan => 'SUCCESS',
                message     => "Nomor resi $resi berhasil discan.",
                scan        => $scan_obj,
            };
        }

        1;
    } or do {
        my $err = $@;
        eval { $dbh->rollback() };
        $failed = 1;

        eval {
            record_scan_metric(format => $format || 'UNKNOWN', status => 'ERROR', duration => $duration);
            log_scanner_event(
                event      => 'SCAN_ERROR',
                format     => $format || 'UNKNOWN',
                nomor_resi => $resi,
                user_id    => $user_id,
                task_id    => $task_id,
                duration   => $duration,
                message    => "Transaksi scan gagal: $err",
            );
        };

        if ($err =~ /__notfound__/) {
            $result = { success => \0, reason => 'NOT_FOUND', message => 'Task tidak ditemukan.' };
        }
        elsif ($err =~ /__finished__/) {
            $result = {
                success => \0, reason => 'FINISHED',
                message => 'Task sudah selesai dan tidak dapat melakukan scan.',
            };
        }
        else {
            warn "[SCANS] Transaksi gagal: $err";
            die $err;   # ditangkap Router → HTTP 500
        }
    };

    return $result;
}

1;
