package Wahana::Router;
use strict;
use warnings;
use Exporter 'import';
use FindBin;
use File::stat;
use lib "$FindBin::Bin/lib/perl5/lib/perl5", "$FindBin::Bin/lib/perl5", "$FindBin::Bin/../lib/perl5/lib/perl5", "$FindBin::Bin/../lib/perl5";

# Perl YAML Parser (Mendukung YAML::Syck sesuai standar DCAF SWB, dengan fallback ke YAML::Tiny)
BEGIN {
    if (eval { require YAML::Syck; 1 }) {
        *load_yaml_file = sub { YAML::Syck::LoadFile($_[0]) };
    } elsif (eval { require YAML::Tiny; 1 }) {
        *load_yaml_file = sub { YAML::Tiny::LoadFile($_[0]) };
    } else {
        die "Modul YAML tidak ditemukan. Pastikan libyaml-syck-perl atau libyaml-tiny-perl terpasang.\n";
    }
}

use Wahana::Config qw(config);
use Wahana::Auth ();
use Wahana::Response qw(json_response);
use Wahana::Controller::UsersController qw(get_user_role);
use Wahana::RateLimit qw(check_rate_limit);

# Controllers
use Wahana::Controller::AuthController ();
use Wahana::Controller::UsersController ();
use Wahana::Controller::TasksController ();
use Wahana::Controller::ScansController ();
use Wahana::Controller::PaketController ();
use Wahana::Controller::AuditController ();
use Wahana::Controller::DocsController ();

our @EXPORT_OK = qw(handle_request load_api_routes);

# Cache route table & last modified time
our $COMPILED_ROUTES = [];
our $LAST_MTIME      = 0;
our $YAML_PATH       = undef;

# Cari file scanresi.yaml di beberapa kemungkinan path
sub _find_yaml_path {
    my @candidates = (
        "$FindBin::Bin/etc/api/scanresi.yaml",
        "$FindBin::Bin/../etc/api/scanresi.yaml",
        "/app/etc/api/scanresi.yaml",
        "/Documents/Scan-resi-magang/backend/etc/api/scanresi.yaml",
        "/Documents/Scan-resi-magang/etc/api/scanresi.yaml",
    );
    for my $f (@candidates) {
        return $f if -f $f;
    }
    return undef;
}

# Compile rute dari file YAML OpenAPI 3.0 (DCAF Pattern)
sub load_api_routes {
    my ($force) = @_;

    $YAML_PATH //= _find_yaml_path();
    unless ($YAML_PATH && -f $YAML_PATH) {
        warn "[ROUTER ERROR] File scanresi.yaml tidak ditemukan!\n";
        return $COMPILED_ROUTES;
    }

    my $st = stat($YAML_PATH);
    my $mtime = $st ? $st->mtime : 0;

    # Jika sudah dicompile dan file belum berubah, gunakan cache memori
    return $COMPILED_ROUTES if !$force && @$COMPILED_ROUTES && ($mtime <= $LAST_MTIME);

    warn "[ROUTER DCAF] Mem-parsing & memuat rute dari $YAML_PATH (mtime: $mtime)...\n";
    my $spec = eval { load_yaml_file($YAML_PATH) };
    if ($@ || !$spec || ref $spec ne 'HASH' || !$spec->{paths}) {
        warn "[ROUTER ERROR] Gagal membaca struktur YAML: $@\n";
        return $COMPILED_ROUTES;
    }

    my @routes;
    my $paths = $spec->{paths};

    # Urutkan paths agar rute statis diprioritaskan sebelum rute bertemplate parameter {id}
    my @sorted_paths = sort {
        my $has_param_a = ($a =~ /{/) ? 1 : 0;
        my $has_param_b = ($b =~ /{/) ? 1 : 0;
        $has_param_a <=> $has_param_b || length($b) <=> length($a)
    } keys %$paths;

    for my $p (@sorted_paths) {
        my $methods = $paths->{$p};
        next unless ref $methods eq 'HASH';

        # Buat regex path dari template OpenAPI
        # Contoh: /users/{id} -> ^(?:/api)?/users/([^/]+)/?$
        my $p_regex_str = $p;
        # Dukung variasi ekstensi dokumen openapi.yaml dan openapi.yml
        $p_regex_str =~ s!\.yaml$!\\.ya?ml!g;
        # Ubah parameter path {name} menjadi capture regex ([^/]+)
        $p_regex_str =~ s!\{[^}]+\}!([^/]+)!g;

        my $full_regex = qr{^(?:/api)?$p_regex_str/?$};

        for my $m (sort keys %$methods) {
            my $m_uc = uc($m);
            next unless $m_uc =~ /^(GET|POST|PUT|DELETE|PATCH)$/;

            my $info = $methods->{$m};
            next unless ref $info eq 'HASH';

            my $op_id = $info->{operationId};
            unless (defined $op_id && $op_id =~ m{/}) {
                warn "[ROUTER DCAF] Lewati $m_uc $p: operationId tidak valid ('$op_id')\n";
                next;
            }

            # Pola DCAF SWB: <methodName>/<ControllerName>
            my ($sub_name, $ctrl_name) = split '/', $op_id, 2;
            my $full_package = "Wahana::Controller::$ctrl_name";

            my $handler = $full_package->can($sub_name);
            unless ($handler) {
                warn "[ROUTER DCAF] Method '$sub_name' tidak ditemukan pada $full_package!\n";
                next;
            }

            # Metadata autentikasi dari deklarasi security & x-role di YAML
            my $is_auth  = 0;
            my $is_admin = 0;

            if (exists $info->{security} && ref $info->{security} eq 'ARRAY') {
                $is_auth = (@{ $info->{security} } > 0) ? 1 : 0;
            }

            if (my $role = $info->{'x-role'}) {
                $is_admin = 1 if uc($role) eq 'ADMIN';
                $is_auth  = 1 if $is_admin;
            }

            push @routes, [
                $m_uc,
                $full_regex,
                $handler,
                {
                    auth         => $is_auth,
                    admin        => $is_admin,
                    operation_id => $op_id,
                    path         => $p
                }
            ];
        }
    }

    $COMPILED_ROUTES = \@routes;
    $LAST_MTIME      = $mtime;

    warn "[ROUTER DCAF] Berhasil memuat " . scalar(@routes) . " rute API aktif dari YAML!\n";
    return $COMPILED_ROUTES;
}

# Titik masuk utama semua adapter (dev server HTTP & uWSGI produksi).
# %req: method, path, params, body(hashref|undef), headers(lowercase keys), ip
sub handle_request {
    my (%req) = @_;

    my $method = uc($req{method} // 'GET');
    my $path   = $req{path} // '/';

    # Preflight CORS
    if ($method eq 'OPTIONS') {
        return json_response(status => 204, body => '');
    }

    # --- Middleware Rate Limiting & Anti Brute-Force ---
    my $rate_check = check_rate_limit(\%req);
    if (!$rate_check->{allowed}) {
        return json_response(
            status  => $rate_check->{status} || 429,
            headers => { 'Retry-After' => $rate_check->{retry_after} || 60 },
            data    => { success => \0, reason => 'RATE_LIMIT', message => $rate_check->{message} }
        );
    }

    # Muat / periksa perubahan file YAML (DCAF dynamic reload)
    my $routes = load_api_routes();

    for my $route (@$routes) {
        my ($r_method, $r_regex, $handler, $meta) = @$route;
        next unless $method eq $r_method;
        my @captures = $path =~ $r_regex or next;

        # --- Middleware Auth ---
        if ($meta->{auth} || $meta->{admin}) {
            my $payload = Wahana::Auth->authenticate_request(\%req);
            return json_response(
                status => 401,
                data   => { success => \0, message => 'Sesi tidak valid atau sudah kedaluwarsa.' }
            ) unless $payload;

            if ($meta->{admin}) {
                my $role = get_user_role($payload->{uid});
                return json_response(
                    status => 403,
                    data   => { success => \0, message => 'Akses ditolak. Hanya ADMIN.' }
                ) unless defined $role && $role eq 'ADMIN';
            }

            $req{auth_user} = $payload;
        }

        # --- Eksekusi handler ---
        my $data = eval { $handler->(\%req, \@captures) };
        if ($@) {
            warn "[ROUTER] Handler error pada $method $path: $@";
            return json_response(
                status => 500,
                data   => { success => \0, message => 'Terjadi kesalahan internal pada server.' }
            );
        }

        # Raw responses (misal YAML / Swagger UI HTML)
        if (ref $data eq 'HASH' && $data->{_is_raw}) {
            return {
                status  => $data->{status} // 200,
                headers => $data->{headers} // {},
                body    => $data->{body} // '',
            };
        }

        return json_response(data => $data // {});
    }

    return json_response(
        status => 404,
        data   => { success => \0, message => "Endpoint tidak ditemukan: $method $path" }
    );
}

# Inisialisasi rute saat modul pertama kali di-load
load_api_routes();

1;
