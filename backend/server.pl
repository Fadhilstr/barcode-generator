#!/usr/bin/env perl
# =====================================================================
# server.pl — Development HTTP Server untuk REST API Wahana Express
#
# Menggunakan HANYA modul core Perl (IO::Socket::INET) sehingga tidak
# butuh instalasi tambahan. Logika bisnis 100% sama dengan mode CGI:
# keduanya dispatch ke Wahana::Router.
#
# Jalankan:
#   perl backend/server.pl          # default port 8080
#   WAHANA_API_PORT=9090 perl backend/server.pl
# =====================================================================
use strict;
use warnings;
use IO::Socket::INET;
use Time::HiRes qw(time);
use FindBin;
use lib "$FindBin::Bin/lib", "$FindBin::Bin/lib/perl5/lib/perl5", "$FindBin::Bin/lib/perl5";

use Wahana::Config  qw(config validate_config);
use Wahana::Router  qw(handle_request);
use Wahana::Metrics qw(record_http_request inc_active_requests dec_active_requests render_prometheus_metrics);
use Wahana::Logger  qw(log_api_request);

# Validasi keamanan environment saat startup
validate_config();

my $PORT = int(config->{api_port});

my $SERVER = IO::Socket::INET->new(
    LocalAddr => '0.0.0.0',
    LocalPort => $PORT,
    Proto     => 'tcp',
    Listen    => 20,
    ReuseAddr => 1,
) or die "Tidak dapat bind port $PORT: $!\n";

print "=" x 60, "\n";
print " Wahana Express API Server (Perl)\n";
print " Listening : http://0.0.0.0:$PORT\n";
print " Tekan Ctrl+C untuk berhenti\n";
print "=" x 60, "\n\n";

$SIG{CHLD} = 'IGNORE';   # reap child otomatis

while ( my $client = $SERVER->accept ) {
    my $pid = fork();
    unless (defined $pid) { close $client; next; }

    if ($pid == 0) {
        # --- CHILD ---
        close($SERVER);
        eval { handle_connection($client) };
        if ($@) { warn "[CHILD] $@\n" }
        exit 0;
    }

    # --- PARENT ---
    close($client);
}

exit 0;

# ---------------------------------------------------------------------
sub handle_connection {
    my ($client) = @_;

    $client->autoflush(1);

    # --- Parse request line + headers ---
    my $request_line = read_line($client);
    return unless defined $request_line;

    my ($method, $uri) = (split /\s+/, $request_line)[0, 1];
    return unless $method && $uri;

    my %headers;
    while ( defined( my $line = read_line($client) ) ) {
        last if $line =~ /^\r?$/;
        my ($k, $v) = split /:\s*/, $line, 2;
        next unless defined $v;
        $headers{ lc $k } = trim_ws($v);
    }

    # --- Read body ---
    my $body_raw = '';
    if ( my $len = int( $headers{'content-length'} // 0 ) ) {
        read( $client, $body_raw, $len );
    }

    # --- Parse path & query string ---
    my ( $path, $query ) = split /\?/, $uri, 2;
    my %params;
    if ($query) {
        for my $pair ( split /[&;]/, $query ) {
            my ( $k, $v ) = map { uri_decode($_) } split /=/, $pair, 2;
            next unless length $k;
            $params{$k} = $v // '';
        }
    }

    my $decoded_path = uri_decode($path);

    if ($decoded_path eq '/metrics' || $decoded_path eq '/api/metrics') {
        my $metrics_text = eval { render_prometheus_metrics() } // "# ERROR rendering metrics: $@\n";
        write_response($client, {
            status => 200,
            headers => {
                'Content-Type' => 'text/plain; version=0.0.4; charset=utf-8',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            },
            body => $metrics_text
        });
        return;
    }

    my %req = (
        method  => $method,
        path    => $decoded_path,
        params  => \%params,
        headers => \%headers,
        body    => decode_body($body_raw, $headers{'content-type'} // ''),
        ip      => $client->peerhost // '-',
    );

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

    eval {
        record_http_request(
            method   => $method,
            endpoint => $decoded_path,
            status   => $status,
            duration => $duration,
        );
        log_api_request(
            method   => $method,
            endpoint => $decoded_path,
            status   => $status,
            duration => $duration,
            ip       => $req{ip},
            message  => $err ? "Handler uncaught error: $err" : undef,
        );
    };

    write_response($client, $res);
}

sub read_line {
    my ($client) = @_;
    my $line = <$client>;
    return undef unless defined $line;
    $line =~ s/\r?\n$//;
    return $line;
}

sub trim_ws {
    my ($s) = @_;
    return '' unless defined $s;
    $s =~ s/^\s+|\s+$//g;
    return $s;
}

sub uri_decode {
    my ($s) = @_;
    return '' unless defined $s;
    $s =~ s/\+/ /g;
    $s =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
    return $s;
}

sub decode_body {
    my ($raw, $content_type) = @_;
    return {} unless defined $raw && length $raw;

    if ( $content_type =~ m{application/x-www-form-urlencoded}i ) {
        my %form;
        for my $pair ( split /[&;]/, $raw ) {
            my ( $k, $v ) = map { uri_decode($_) } split /=/, $pair, 2;
            next unless length $k;
            $form{$k} = $v // '';
        }
        return \%form;
    }

    # Default: JSON
    require Wahana::Response;
    my $data = Wahana::Response::decode_json_body($raw);
    warn "[BODY] JSON body tidak valid.\n" unless $data;
    return $data // {};
}

sub write_response {
    my ($client, $res) = @_;
    my %status_text = (
        200 => 'OK', 201 => 'Created', 204 => 'No Content',
        400 => 'Bad Request', 401 => 'Unauthorized', 403 => 'Forbidden',
        404 => 'Not Found', 409 => 'Conflict', 429 => 'Too Many Requests',
        500 => 'Internal Server Error',
    );
    my $status = int( $res->{status} || 200 );

    print $client "HTTP/1.1 $status " . ($status_text{$status} // 'OK') . "\r\n";
    while ( my ( $k, $v ) = each %{ $res->{headers} } ) {
        print $client "$k: $v\r\n";
    }
    printf $client "Content-Length: %d\r\n", length( $res->{body} // '' );
    print $client "Connection: close\r\n\r\n";

    print $client ( $res->{body} // '' )
        unless $status == 204;
}
