#!/usr/bin/env perl
# =====================================================================
# web.pl — PSGI Entrypoint untuk uWSGI & Plack Server (Wahana Express)
#
# Mengadaptasikan Wahana::Router ke spesifikasi standar PSGI
# Dijalankan dengan uWSGI:
#   uwsgi --ini backend/uwsgi.ini
#   uwsgi --http-socket 0.0.0.0:5000 --plugin psgi --psgi backend/web.pl
# =====================================================================
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/lib", "$FindBin::Bin/lib/perl5/lib/perl5", "$FindBin::Bin/lib/perl5";

use Time::HiRes     qw(time);
use Wahana::Config   qw(validate_config);
use Wahana::Router   qw(handle_request);
use Wahana::Response qw(decode_json_body);
use Wahana::Metrics  qw(record_http_request inc_active_requests dec_active_requests render_prometheus_metrics);
use Wahana::Logger   qw(log_api_request);

# Validasi keamanan environment saat startup
validate_config();

my $app = sub {
    my ($env) = @_;

    my $method = uc($env->{REQUEST_METHOD} // 'GET');
    my $path   = $env->{PATH_INFO} // '/';
    $path ||= '/';

    # --- Prometheus Metrics Endpoint (Internal Scrape) ---
    if ($path eq '/metrics' || $path eq '/api/metrics') {
        my $metrics_text = eval { render_prometheus_metrics() } // "# ERROR rendering metrics: $@\n";
        return [
            200,
            [
                'Content-Type' => 'text/plain; version=0.0.4; charset=utf-8',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
            [ $metrics_text ]
        ];
    }

    # --- Query Params ---
    my %params;
    if (defined $env->{QUERY_STRING} && length $env->{QUERY_STRING}) {
        for my $pair (split /[&;]/, $env->{QUERY_STRING}) {
            my ($k, $v) = map {
                my $s = $_ // '';
                $s =~ s/\+/ /g;
                $s =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
                $s;
            } split /=/, $pair, 2;
            $params{$k} = $v // '' if length $k;
        }
    }

    # --- Read Request Body ---
    my $body_raw = '';
    if (my $len = int($env->{CONTENT_LENGTH} // 0)) {
        if (my $input = $env->{'psgi.input'}) {
            $input->read($body_raw, $len);
        }
    }

    # --- Extract Headers ---
    my %headers;
    for my $key (keys %$env) {
        if ($key =~ /^HTTP_(.+)$/) {
            my $h = lc $1;
            $h =~ tr/_/-/;
            $headers{$h} = $env->{$key};
        } elsif ($key eq 'CONTENT_TYPE') {
            $headers{'content-type'} = $env->{$key};
        } elsif ($key eq 'CONTENT_LENGTH') {
            $headers{'content-length'} = $env->{$key};
        }
    }

    # --- Decode Body (JSON / Form) ---
    my $body;
    my $content_type = $headers{'content-type'} // '';
    if ($content_type =~ m{application/x-www-form-urlencoded}i) {
        my %form;
        for my $pair (split /[&;]/, $body_raw) {
            my ($k, $v) = map {
                my $s = $_ // '';
                $s =~ s/\+/ /g;
                $s =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
                $s;
            } split /=/, $pair, 2;
            $form{$k} = $v // '' if length $k;
        }
        $body = \%form;
    } else {
        $body = decode_json_body($body_raw);
    }

    my %req = (
        method  => $method,
        path    => $path,
        params  => \%params,
        headers => \%headers,
        body    => $body // {},
        ip      => $env->{REMOTE_ADDR} // $env->{HTTP_X_FORWARDED_FOR} // '-',
    );

    # Dispatch ke Wahana::Router dengan tracing durasi & metrik
    inc_active_requests();
    my $t0 = time();

    my $res = eval { handle_request(%req) };
    my $err = $@;

    my $duration = time() - $t0;
    dec_active_requests();

    if ($err || !$res) {
        $res = {
            status => 500,
            headers => { 'Content-Type' => 'application/json' },
            body => '{"success":false,"message":"Internal Server Error"}'
        };
    }

    my $status = int($res->{status} || 200);

    # Non-blocking metrics recording & structured logging
    eval {
        record_http_request(
            method   => $method,
            endpoint => $path,
            status   => $status,
            duration => $duration,
        );
        log_api_request(
            method   => $method,
            endpoint => $path,
            status   => $status,
            duration => $duration,
            ip       => $req{ip},
            message  => $err ? "Handler uncaught error: $err" : undef,
        );
    };

    my @psgi_headers;
    while (my ($k, $v) = each %{ $res->{headers} || {} }) {
        push @psgi_headers, $k => $v;
    }

    my $res_body = ($status == 204) ? '' : ($res->{body} // '');
    return [ $status, \@psgi_headers, [ $res_body ] ];
};

return $app;
