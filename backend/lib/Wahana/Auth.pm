package Wahana::Auth;
use strict;
use warnings;
use Digest::SHA qw(sha256_hex hmac_sha256_hex);
use MIME::Base64 qw(encode_base64url decode_base64url);
use JSON::PP ();
use Exporter 'import';
use Wahana::Config qw(config);

our @EXPORT_OK = qw(verify_password issue_token verify_token authenticate_request hash_password generate_otp hash_otp issue_preauth_token verify_preauth_token mask_email);

# Generate OTP 6 digit angka acak (100000 - 999999)
sub generate_otp {
    my ($class) = @_;
    # Gunakan /dev/urandom sebagai CSPRNG — lebih aman dari srand(time())
    my $num;
    if (open my $fh, '<:raw', '/dev/urandom') {
        my $bytes = '';
        read($fh, $bytes, 4);
        close $fh;
        $num = unpack('N', $bytes);
    } else {
        # Fallback jika /dev/urandom tidak tersedia (non-Unix)
        srand(time() ^ ($$ << 15) ^ $$);
        $num = int(rand(0xFFFFFFFF));
    }
    return sprintf '%06d', ($num % 900000) + 100000;
}

# Hash OTP dengan SHA-256 (bukan plaintext)
sub hash_otp {
    my ($class, $otp) = @_;
    return '' unless defined $otp && length $otp;
    my $cfg = config();
    return sha256_hex("wahana_otp_salt_" . $cfg->{token_secret} . "_" . $otp);
}

# Token pre-auth sementara (berlaku 5 menit / 300 detik) sebelum verifikasi OTP
sub issue_preauth_token {
    my ($class, $user_id, $purpose, $ttl) = @_;
    $purpose //= 'LOGIN';
    $ttl     //= 300;
    my $cfg = config();

    my $payload = encode_base64url(
        JSON::PP::encode_json({
            uid     => $user_id,
            preauth => 1,
            purpose => $purpose,
            exp     => time() + $ttl
        })
    );
    my $sig = hmac_sha256_hex($payload, $cfg->{token_secret});

    return "$payload.$sig";
}

sub verify_preauth_token {
    my ($class, $token, $expected_purpose) = @_;
    my $cfg = config();

    return undef unless defined $token && $token =~ /\./;

    my ($payload, $sig) = split /\./, $token, 2;
    return undef unless defined $payload && defined $sig;

    return undef unless hmac_sha256_hex($payload, $cfg->{token_secret}) eq $sig;

    my $data = eval { JSON::PP::decode_json(decode_base64url($payload)) };
    return undef unless $data && $data->{uid} && $data->{exp} && $data->{preauth};
    return undef unless $data->{exp} > time();

    if (defined $expected_purpose) {
        my $token_purpose = $data->{purpose} // 'LOGIN';
        return undef unless $token_purpose eq $expected_purpose;
    }

    return $data;
}

# Mask alamat email untuk privasi di UI (misal: fadhil@gmail.com -> fa***l@gmail.com)
sub mask_email {
    my ($class, $email) = @_;
    return 'u***r@email.com' unless defined $email && $email =~ /^([^@]+)@(.+)$/;
    my ($name, $domain) = ($1, $2);
    if (length $name <= 2) {
        return substr($name, 0, 1) . '***@' . $domain;
    }
    return substr($name, 0, 2) . '***' . substr($name, -1) . '@' . $domain;
}

# Verifikasi password terhadap hash berformat: sha256$<salt>$<hex>

sub verify_password {
    my ($class, $password, $stored) = @_;

    return 0 unless defined $password && defined $stored;

    my ($scheme, $salt, $hex) = split /\$/, $stored;
    return 0 unless defined $scheme && $scheme eq 'sha256';
    return 0 unless defined $salt && defined $hex;

    return sha256_hex($salt . $password) eq lc($hex) ? 1 : 0;
}

# Token sederhana berformat: base64url(payload_json) . "." . hmac_sha256_hex
sub issue_token {
    my ($class, $user_id) = @_;
    my $cfg = config();

    my $payload = encode_base64url(
        JSON::PP::encode_json({ uid => $user_id, exp => time() + $cfg->{token_ttl} })
    );
    my $sig = hmac_sha256_hex($payload, $cfg->{token_secret});

    return "$payload.$sig";
}

sub verify_token {
    my ($class, $token) = @_;
    my $cfg = config();

    return undef unless defined $token && $token =~ /\./;

    my ($payload, $sig) = split /\./, $token, 2;
    return undef unless defined $payload && defined $sig;

    # Verifikasi tanda tangan HMAC
    return undef unless hmac_sha256_hex($payload, $cfg->{token_secret}) eq $sig;

    my $data = eval { JSON::PP::decode_json(decode_base64url($payload)) };
    return undef unless $data && $data->{uid} && $data->{exp};
    return undef unless $data->{exp} > time();

    return $data;
}

# Ekstrak & verifikasi header "Authorization: Bearer <token>".
# Mengembalikan payload hashref saat valid, undef saat tidak.
sub authenticate_request {
    my ($class, $req) = @_;

    my $auth_header = $req->{headers}{authorization} // '';
    return undef unless $auth_header =~ /^Bearer\s+(\S+)$/i;

    return __PACKAGE__->verify_token($1);
}

# Generate salt acak 8 karakter hex (untuk user baru)
sub generate_salt {
    my ($class) = @_;
    return join '', map { sprintf '%x', int rand(16) } 1 .. 8;
}

# Hash password dengan format identik seed SQL: sha256$<salt>$<hex>
sub hash_password {
    my ($class, $password, $salt) = @_;
    $salt //= __PACKAGE__->generate_salt();
    return "sha256\$$salt\$" . sha256_hex($salt . $password);
}

1;
