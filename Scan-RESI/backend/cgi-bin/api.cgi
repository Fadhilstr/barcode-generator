#!/usr/bin/env perl
# =====================================================================
# api.cgi — Adapter CGI untuk produksi (Nginx + fcgiwrap)
#
# Logika identik dengan server.pl — keduanya hanya adapter tipis di
# atas Wahana::Router. Letakkan di cgi-bin dan aktifkan blok fastcgi
# pada deploy/nginx.conf (varian B).
#
# Endpoint yang sama tersedia via PATH_INFO:
#   /cgi-bin/api.cgi/api/auth/login  → POST /api/auth/login
# =====================================================================
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";

use CGI                    ();
use Wahana::Router         qw(handle_request);
use Wahana::Response       qw(decode_json_body);

my $CGI = CGI->new();

# --- Path info: dukung PATH_INFO maupun REQUEST_URI ---
my $path = $ENV{PATH_INFO} || '';
unless ($path) {
    $path = $ENV{REQUEST_URI} || '/';
    my $script = $ENV{SCRIPT_NAME} || '';
    $path =~ s/^\Q$script\E//;           # buang prefix script
    $path =~ s/\?.*$//;                  # buang query string
}
$path ||= '/';

# --- Query params ---
my %params = map { $_ => scalar $CGI->param($_) } $CGI->param();

# --- Body JSON (POST/PATCH) ---
my $body_raw = $CGI->param('POSTDATA') // '';
my $body     = decode_json_body($body_raw);

# --- Header lowercase ---
my %headers;
for my $name ( $CGI->http() ) {
    my $key = lc $name;
    $key =~ s/^http_//;
    $key =~ tr/_/-/;
    $headers{$key} = $CGI->http($name);
}

my %req = (
    method  => scalar $CGI->request_method() || 'GET',
    path    => $path,
    params  => \%params,
    headers => \%headers,
    body    => $body,
    ip      => $ENV{REMOTE_ADDR} || '-',
);

my $res = handle_request(%req);

# --- Emit respons HTTP ---
my @extra_headers;
while ( my ( $k, $v ) = each %{ $res->{headers} || {} } ) {
    next if lc $k eq 'content-type';
    push @extra_headers, -ucfirst_hyphen($k) => $v;
}

print $CGI->header(
    -type   => 'application/json; charset=utf-8',
    -status => ( $res->{status} || 200 ) . '',
    @extra_headers,
);

print $res->{body} // ''
    unless ( $res->{status} || 200 ) == 204;

exit 0;

sub ucfirst_hyphen {
    my ($h) = @_;
    $h =~ s/-([a-z])/-\u$1/g;
    $h =~ s/^(\w)/\u$1/;
    return $h;
}
