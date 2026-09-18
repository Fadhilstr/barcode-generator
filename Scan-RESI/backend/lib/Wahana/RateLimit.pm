package Wahana::RateLimit;
use strict;
use warnings;
use Fcntl qw(:flock O_RDWR O_CREAT);
use JSON::PP ();
use Exporter 'import';

our @EXPORT_OK = qw(check_rate_limit);

my $STORE_FILE = '/tmp/wahana_ratelimit.json';

my %RULES = (
    '/auth/login' => {
        max_requests => 5,
        window_sec   => 60,
        message      => 'Terlalu banyak percobaan login dari IP Anda. Silakan tunggu 60 detik.',
    },
    '/auth/resend-otp' => {
        max_requests => 3,
        window_sec   => 300,
        message      => 'Permintaan kode OTP terlalu sering. Silakan tunggu 5 menit.',
    },
);

sub check_rate_limit {
    my ($class, $req) = @_;

    my $result = eval {
        my $now  = time();
        my $ip   = $req->{ip} // '127.0.0.1';
        my $path = $req->{path} // '';
        $path =~ s{^/api}{}; # Normalize path

        sysopen(my $fh, $STORE_FILE, O_RDWR | O_CREAT) or return { allowed => 1 };
        flock($fh, LOCK_EX);

        my $raw = do { local $/; <$fh> };
        my $data = (defined $raw && length $raw) ? (eval { JSON::PP::decode_json($raw) } // {}) : {};

        # 1. Check Specific Endpoint Rule
        my $rule = $RULES{$path};
        if ($rule) {
            my $key = "$ip:$path";
            my ($allowed, $retry_after, $msg) = _evaluate_key($data, $key, $rule, $now);
            unless ($allowed) {
                _save_data($fh, $data);
                flock($fh, LOCK_UN);
                close $fh;
                return {
                    allowed     => 0,
                    status      => 429,
                    retry_after => $retry_after,
                    message     => $msg,
                };
            }
        }

        # 2. Check Global Rule
        my $global_rule = $RULES{'GLOBAL'};
        if ($global_rule) {
            my $global_key = "$ip:GLOBAL";
            my ($allowed, $retry_after, $msg) = _evaluate_key($data, $global_key, $global_rule, $now);
            unless ($allowed) {
                _save_data($fh, $data);
                flock($fh, LOCK_UN);
                close $fh;
                return {
                    allowed     => 0,
                    status      => 429,
                    retry_after => $retry_after,
                    message     => $msg,
                };
            }
        }

        _save_data($fh, $data);
        flock($fh, LOCK_UN);
        close $fh;

        return { allowed => 1 };
    };

    if ($@) {
        warn "[RATE_LIMIT_ERROR] $@\n";
        return { allowed => 1 };
    }

    return $result // { allowed => 1 };
}

sub _evaluate_key {
    my ($data, $key, $rule, $now) = @_;

    $data->{$key} //= [];
    my $window_start = $now - $rule->{window_sec};

    # Filter timestamps within current sliding window
    @{$data->{$key}} = grep { $_ > $window_start } @{$data->{$key}};

    if (@{$data->{$key}} >= $rule->{max_requests}) {
        my $oldest = $data->{$key}[0];
        my $retry_after = ($oldest + $rule->{window_sec}) - $now;
        $retry_after = 1 if $retry_after < 1;

        return (0, $retry_after, $rule->{message});
    }

    push @{$data->{$key}}, $now;
    return (1, 0, '');
}

sub _save_data {
    my ($fh, $data) = @_;
    my $now = time();

    # Cleanup entries older than 5 minutes
    for my $k (keys %$data) {
        @{$data->{$k}} = grep { $_ > ($now - 300) } @{$data->{$k}};
        delete $data->{$k} unless @{$data->{$k}};
    }

    truncate($fh, 0);
    seek($fh, 0, 0);
    print $fh JSON::PP::encode_json($data);
}

1;
