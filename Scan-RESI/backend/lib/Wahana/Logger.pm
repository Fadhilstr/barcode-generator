package Wahana::Logger;
use strict;
use warnings;
use Exporter 'import';
use POSIX qw(strftime);
use Time::HiRes qw(gettimeofday);

our @EXPORT_OK = qw(
    log_debug
    log_info
    log_warn
    log_error
    log_api_request
    log_scanner_event
);

my $LOG_FILE = '/app/log/backend.log';

# Filter field-field sensitif (Security OWASP)
my %SENSITIVE_FIELDS = map { lc($_) => 1 } qw(
    password pass db_pass otp preauth_token
    token access_token refresh_token jwt
    secret secret_key smtp_pass
);

sub _iso_timestamp {
    my ($s, $usec) = gettimeofday();
    my $dt = strftime("%Y-%m-%dT%H:%M:%S", gmtime($s));
    return sprintf("%s.%03dZ", $dt, int($usec / 1000));
}

sub _sanitize_val {
    my ($k, $v) = @_;
    return '-' unless defined $v;
    if ($SENSITIVE_FIELDS{lc($k)}) {
        return '[REDACTED]';
    }
    my $str = "$v";
    $str =~ s/[\r\n\t]+/ /g;
    $str =~ s/"/\\"/g;
    return $str;
}

sub _format_logfmt {
    my ($level, %fields) = @_;
    my $ts = _iso_timestamp();
    $fields{timestamp} //= $ts;
    $fields{level}     //= $level;
    $fields{service}   //= 'backend';

    my @pairs;
    # Letakkan timestamp, level, service di depan
    for my $k (qw(timestamp level service)) {
        if (defined $fields{$k}) {
            push @pairs, sprintf('%s="%s"', $k, _sanitize_val($k, delete $fields{$k}));
        }
    }

    for my $k (sort keys %fields) {
        my $v = _sanitize_val($k, $fields{$k});
        push @pairs, sprintf('%s="%s"', $k, $v);
    }

    return join(' ', @pairs);
}

sub _write_log {
    my ($line) = @_;
    # Tulis ke STDERR agar tertangkap oleh log driver uWSGI & Docker
    print STDERR $line . "\n";

    # Tulis juga ke file log lokal jika path tersedia
    eval {
        if (-d '/app/log' && open my $fh, '>>', $LOG_FILE) {
            print $fh $line . "\n";
            close $fh;
        }
    };
}

sub log_debug {
    my (%fields) = @_;
    _write_log(_format_logfmt('DEBUG', %fields));
}

sub log_info {
    my (%fields) = @_;
    _write_log(_format_logfmt('INFO', %fields));
}

sub log_warn {
    my (%fields) = @_;
    _write_log(_format_logfmt('WARN', %fields));
}

sub log_error {
    my (%fields) = @_;
    _write_log(_format_logfmt('ERROR', %fields));
}

sub log_api_request {
    my (%args) = @_;
    my $status   = int($args{status} // 200);
    my $level    = ($status >= 500) ? 'ERROR' : ($status >= 400) ? 'WARN' : 'INFO';
    my $duration = sprintf("%.2fms", ($args{duration} // 0) * 1000);

    my %fields = (
        service  => 'backend',
        event    => ($status >= 400) ? 'API_ERROR' : 'API_REQUEST',
        method   => $args{method} // 'GET',
        endpoint => $args{endpoint} // '/',
        status   => $status,
        duration => $duration,
        ip       => $args{ip} // '-',
    );
    $fields{message} = $args{message} if defined $args{message};

    _write_log(_format_logfmt($level, %fields));
}

sub log_scanner_event {
    my (%args) = @_;
    my $event = $args{event} // 'SCAN_EVENT'; # SCAN_START, SCAN_SUCCESS, SCAN_DUPLICATE, SCAN_ERROR
    my $level = ($event eq 'SCAN_ERROR') ? 'ERROR' : ($event eq 'SCAN_DUPLICATE') ? 'WARN' : 'INFO';

    my %fields = (
        service => 'scanner',
        event   => $event,
        format  => $args{format} // 'UNKNOWN',
    );

    $fields{duration} = sprintf("%.2fms", $args{duration} * 1000) if defined $args{duration};
    $fields{task_id}  = $args{task_id} if defined $args{task_id};
    $fields{user_id}  = $args{user_id} if defined $args{user_id};
    $fields{message}  = $args{message} if defined $args{message};

    # Masking resi untuk privasi jika disertakan (misal S7N***)
    if (my $r = $args{nomor_resi}) {
        my $len = length($r);
        $fields{resi_masked} = ($len > 4) ? substr($r, 0, 3) . '***' : '***';
    }

    _write_log(_format_logfmt($level, %fields));
}

1;
