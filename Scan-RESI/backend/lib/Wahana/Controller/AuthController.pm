package Wahana::Controller::AuthController;
use strict;
use warnings;
use POSIX qw(strftime);
use Wahana::Db;
use Wahana::Query;
use Wahana::Auth ();
use Wahana::Mail qw(send_otp_email);
use Wahana::Util qw(trim);
use Wahana::Audit qw(record_audit);
use Wahana::Controller::UsersController qw(map_user);

# ---------------------------------------------------------------------
# POST /api/auth/login
# Body: { username, password }
# Flow OTP: Credential Benar -> Generate OTP & Hash -> Simpan DB -> SMTP Gmail -> Return preauth_token
# ---------------------------------------------------------------------
sub login {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $username = trim($body->{username} // '');
    my $password = $body->{password} // '';

    return { success => \0, message => 'Username dan password wajib diisi.' }
        unless length $username && length $password;

    my $dbh = Wahana::Db->connect();
    my $sql = Wahana::Query->get('auth_get_user_by_username');
    my $row = $dbh->selectrow_hashref($sql, undef, $username, $username);

    if (!$row || !Wahana::Auth->verify_password($password, $row->{password_hash})) {
        record_audit(
            user_id    => $row ? $row->{id} : undef,
            action     => 'LOGIN_FAILED',
            details    => "Percobaan login gagal untuk '$username'.",
            ip_address => $req->{ip},
        );
        return { success => \0, message => 'Username atau password salah.' };
    }

    return { success => \0, message => 'Akun Anda telah dinonaktifkan.' }
        if $row->{status} eq 'DISABLED';

    # Tentukan email penerima OTP
    my $email = trim($row->{email} // '');
    if (!$email || $email !~ /@/) {
        $email = ($row->{username} =~ /@/)
            ? $row->{username}
            : $row->{username} . '@dijakexpress.com';
    }

    # Invalidate OTP lama yang masih aktif
    $dbh->do(Wahana::Query->get('otp_invalidate_old'), undef, $row->{id});

    # Generate OTP 6 digit acak & hash SHA256
    my $otp_code   = Wahana::Auth->generate_otp();
    my $otp_hash   = Wahana::Auth->hash_otp($otp_code);
    my $expires_at = strftime('%Y-%m-%d %H:%M:%S', localtime(time() + 300)); # 5 menit

    # Simpan ke tabel user_otps
    $dbh->do(
        Wahana::Query->get('otp_insert'),
        undef, $row->{id}, $email, $otp_hash, $expires_at
    );

    # Kirim OTP via SMTP Gmail
    my ($mail_ok, $mail_msg) = send_otp_email(
        to_email  => $email,
        user_name => $row->{name},
        otp_code  => $otp_code,
        context   => 'LOGIN',
        app_name  => 'DIJAK EXPRESS'
    );

    # Pengecekan Email
    unless ($mail_ok) {
        warn "[EMAIL_SEND_FAILED] Failed to send OTP login to $email: $mail_msg\n";
        return {
            success => \0,
            message => "Gagal mengirimkan kode OTP ke email ($mail_msg). Silakan coba lagi atau hubungi admin.",
        };
    }

    record_audit(
        user_id    => $row->{id},
        action     => 'OTP_SENT',
        details    => "Kode OTP dikirim ke email " . Wahana::Auth->mask_email($email),
        ip_address => $req->{ip},
    );

    # Buat token pre-auth sementara (5 menit)
    my $preauth_token = Wahana::Auth->issue_preauth_token($row->{id});

    return {
        success       => \1,
        requires_otp  => \1,
        preauth_token => $preauth_token,
        masked_email  => Wahana::Auth->mask_email($email),
        message       => "Kredensial benar. Kode OTP 6-digit telah dikirim ke email " . Wahana::Auth->mask_email($email),
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/verify-otp
# Body: { preauth_token, otp }
# Validasi OTP 6-digit -> terbitkan full JWT session & user data
# ---------------------------------------------------------------------
sub verify_otp {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $preauth_token = trim($body->{preauth_token} // '');
    my $otp_input     = trim($body->{otp} // '');

    return { success => \0, message => 'Token sesi OTP wajib disertakan.' }
        unless length $preauth_token;

    return { success => \0, message => 'Kode OTP 6-digit wajib diisi.' }
        unless length $otp_input && $otp_input =~ /^\d{6}$/;

    my $payload = Wahana::Auth->verify_preauth_token($preauth_token);
    return { success => \0, message => 'Sesi verifikasi OTP kedaluwarsa. Silakan login kembali.' }
        unless $payload && $payload->{uid};

    my $user_id = $payload->{uid};
    my $dbh     = Wahana::Db->connect();

    # Ambil OTP aktif terbaru milik user
    my $otp_row = $dbh->selectrow_hashref(
        Wahana::Query->get('otp_get_latest'), undef, $user_id
    );

    return { success => \0, message => 'Kode OTP tidak ditemukan atau sudah tidak berlaku. Silakan kirim ulang OTP.' }
        unless $otp_row;

    # Cek percobaan (max 5x)
    if (($otp_row->{attempt_count} // 0) >= 5) {
        return { success => \0, message => 'Batas percobaan OTP (5x) terlampaui. Silakan minta kode OTP baru.' };
    }

    # Bandingkan hash OTP
    my $input_hash = Wahana::Auth->hash_otp($otp_input);

    if ($input_hash ne $otp_row->{otp_hash}) {
        # Increment attempt_count
        $dbh->do(Wahana::Query->get('otp_increment_attempt'), undef, $otp_row->{id});

        record_audit(
            user_id    => $user_id,
            action     => 'OTP_FAILED',
            details    => "Verifikasi OTP gagal (percobaan ke-" . ($otp_row->{attempt_count} + 1) . ").",
            ip_address => $req->{ip},
        );

        my $sisa = 4 - ($otp_row->{attempt_count} // 0);
        return {
            success => \0,
            message => "Kode OTP salah." . ($sisa > 0 ? " Sisa percobaan: $sisa kali." : " Batas percobaan habis.")
        };
    }

    # OTP BENAR -> tandai digunaan & terbitkan full JWT session
    $dbh->do(Wahana::Query->get('otp_mark_used'), undef, $otp_row->{id});
    $dbh->do(Wahana::Query->get('auth_update_user_online'), undef, $user_id);

    my $user = $dbh->selectrow_hashref(
        Wahana::Query->get('auth_get_user_by_id'), undef, $user_id
    );

    return { success => \0, message => 'User tidak ditemukan.' } unless $user;

    my $full_token = Wahana::Auth->issue_token($user->{id});

    record_audit(
        user_id    => $user->{id},
        action     => 'LOGIN_SUCCESS',
        details    => 'Login & Verifikasi 2-Factor OTP Berhasil.',
        ip_address => $req->{ip},
    );

    my $mapped = map_user({ %$user, status => 'ONLINE' });

    return {
        success => \1,
        user    => $mapped,
        role    => $user->{role},
        token   => $full_token,
        message => "Verifikasi OTP berhasil. Selamat datang, $user->{name}!",
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/resend-otp
# Body: { preauth_token }
# Cooldown 60 detik -> Invalidate OTP lama -> Generate & Kirim SMTP
# ---------------------------------------------------------------------
sub resend_otp {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $preauth_token = trim($body->{preauth_token} // '');
    return { success => \0, message => 'Token sesi OTP wajib disertakan.' }
        unless length $preauth_token;

    my $payload = Wahana::Auth->verify_preauth_token($preauth_token);
    return { success => \0, message => 'Sesi verifikasi OTP kedaluwarsa. Silakan login kembali.' }
        unless $payload && $payload->{uid};

    my $user_id = $payload->{uid};
    my $dbh     = Wahana::Db->connect();

    my $user = $dbh->selectrow_hashref(
        Wahana::Query->get('auth_get_user_by_id'), undef, $user_id
    );
    return { success => \0, message => 'User tidak ditemukan.' } unless $user;

    # Cek cooldown 60 detik dari OTP terakhir
    my $otp_row = $dbh->selectrow_hashref(
        Wahana::Query->get('otp_get_latest'), undef, $user_id
    );

    if ($otp_row && defined $otp_row->{created_at}) {
        my $created_ts = $dbh->selectrow_array("SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) FROM user_otps WHERE id = ?", undef, $otp_row->{id});
        if (defined $created_ts && $created_ts < 60) {
            my $sisa_cooldown = 60 - $created_ts;
            return {
                success => \0,
                message => "Silakan tunggu $sisa_cooldown detik sebelum meminta OTP baru."
            };
        }
    }

    my $email = trim($user->{email} // '');
    if (!$email || $email !~ /@/) {
        $email = ($user->{username} =~ /@/)
            ? $user->{username}
            : $user->{username} . '@dijakexpress.com';
    }


    # Invalidate OTP lama
    $dbh->do(Wahana::Query->get('otp_invalidate_old'), undef, $user_id);

    # Generate OTP baru
    my $otp_code   = Wahana::Auth->generate_otp();
    my $otp_hash   = Wahana::Auth->hash_otp($otp_code);
    my $expires_at = strftime('%Y-%m-%d %H:%M:%S', localtime(time() + 300));

    $dbh->do(
        Wahana::Query->get('otp_insert'),
        undef, $user_id, $email, $otp_hash, $expires_at
    );

    # Kirim email SMTP Gmail
    my ($mail_ok, $mail_msg) = send_otp_email(
        to_email => $email,
        otp_code => $otp_code,
        app_name => 'DIJAK EXPRESS'
    );

    #Pengecekan Email        
    unless($mail_ok){
        warn "[EMAIL_SEND_FAILED] Failed to send OTP to $email: $mail_msg";
        return {
            success => \0,
            message => "Gagal mengirim OTP. Silakan coba lagi atau hubungi admin."
        };
    }

    record_audit(
        user_id    => $user_id,
        action     => 'OTP_RESENT',
        details    => "Kode OTP baru dikirim ke email " . Wahana::Auth->mask_email($email),
        ip_address => $req->{ip},
    );

    return {
        success      => \1,
        masked_email => Wahana::Auth->mask_email($email),
        message      => "Kode OTP baru telah dikirim ke email " . Wahana::Auth->mask_email($email),
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/quick-login (Demo Mode - juga diintegrasikan OTP jika dipicu)
# ---------------------------------------------------------------------
sub quick_login {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $user_id = trim($body->{user_id} // '');
    return { success => \0, message => 'user_id wajib diisi.' }
        unless length $user_id;

    my $dbh = Wahana::Db->connect();
    my $sql = Wahana::Query->get('auth_get_user_by_id');
    my $row = $dbh->selectrow_hashref($sql, undef, $user_id);

    return { success => \0, message => 'User tidak ditemukan.' }
        unless $row;

    return { success => \0, message => 'Akun Anda telah dinonaktifkan.' }
        if $row->{status} eq 'DISABLED';

    my $email = trim($row->{email} // '');
    if (!$email || $email !~ /@/) {
        $email = ($row->{username} =~ /@/)
            ? $row->{username}
            : $row->{username} . '@dijakexpress.com';
    }

    $dbh->do(Wahana::Query->get('otp_invalidate_old'), undef, $row->{id});

    my $otp_code   = Wahana::Auth->generate_otp();
    my $otp_hash   = Wahana::Auth->hash_otp($otp_code);
    my $expires_at = strftime('%Y-%m-%d %H:%M:%S', localtime(time() + 300));

    $dbh->do(
        Wahana::Query->get('otp_insert'),
        undef, $row->{id}, $email, $otp_hash, $expires_at
    );

    send_otp_email(
        to_email  => $email,
        user_name => $row->{name},
        otp_code  => $otp_code,
        context   => 'LOGIN',
        app_name  => 'DIJAK EXPRESS'
    );

    record_audit(
        user_id    => $row->{id},
        action     => 'OTP_SENT',
        details    => 'Quick login demo memicu verifikasi OTP.',
        ip_address => $req->{ip},
    );

    my $preauth_token = Wahana::Auth->issue_preauth_token($row->{id});

    return {
        success       => \1,
        requires_otp  => \1,
        preauth_token => $preauth_token,
        masked_email  => Wahana::Auth->mask_email($email),
        message       => "Quick Login memicu OTP. Masukkan kode OTP 6-digit dari email " . Wahana::Auth->mask_email($email),
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------
sub logout {
    my ($req) = @_;

    my $payload = $req->{auth_user};
    my $uid     = $payload ? $payload->{uid} : ($req->{body}{user_id} // undef);

    if ($uid) {
        my $dbh = Wahana::Db->connect();
        $dbh->do(Wahana::Query->get('auth_update_user_offline'), undef, $uid);

        record_audit(
            user_id    => $uid,
            action     => 'LOGOUT',
            details    => 'User keluar dari sistem.',
            ip_address => $req->{ip},
        );
    }

    return { success => \1 };
}

# ---------------------------------------------------------------------
# POST /api/auth/forgot-password
# Body: { identity }  (username atau email)
# Minta OTP Reset Password -> Kirim via SMTP Gmail ke email user dari DB
# ---------------------------------------------------------------------
sub forgot_password_request {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $identity = trim($body->{identity} // $body->{username} // '');
    return { success => \0, message => 'Username atau Email wajib diisi.' }
        unless length $identity;

    my $dbh = Wahana::Db->connect();
    my $sql = Wahana::Query->get('auth_get_user_by_username');
    my $row = $dbh->selectrow_hashref($sql, undef, $identity, $identity);

    return { success => \0, message => 'Akun dengan username atau email tersebut tidak ditemukan.' }
        unless $row;

    return { success => \0, message => 'Akun Anda telah dinonaktifkan. Silakan hubungi Admin.' }
        if $row->{status} eq 'DISABLED';

    my $email = trim($row->{email} // '');
    if (!$email || $email !~ /@/) {
        $email = ($row->{username} =~ /@/)
            ? $row->{username}
            : $row->{username} . '@dijakexpress.com';
    }

    # Invalidate OTP lama
    $dbh->do(Wahana::Query->get('otp_invalidate_old'), undef, $row->{id});

    # Generate OTP 6 digit acak & hash SHA256
    my $otp_code   = Wahana::Auth->generate_otp();
    my $otp_hash   = Wahana::Auth->hash_otp($otp_code);
    my $expires_at = strftime('%Y-%m-%d %H:%M:%S', localtime(time() + 300)); # 5 menit

    # Simpan ke tabel user_otps
    $dbh->do(
        Wahana::Query->get('otp_insert'),
        undef, $row->{id}, $email, $otp_hash, $expires_at
    );

    # Kirim OTP Reset Password via SMTP Gmail
    my ($mail_ok, $mail_msg) = send_otp_email(
        to_email  => $email,
        user_name => $row->{name},
        otp_code  => $otp_code,
        context   => 'FORGOT_PASSWORD',
        app_name  => 'DIJAK EXPRESS'
    );

    # Pengecekan Email
    unless ($mail_ok) {
        warn "[EMAIL_SEND_FAILED] Failed to send OTP reset password to $email: $mail_msg\n";
        return {
            success => \0,
            message => "Gagal mengirimkan kode verifikasi reset password ke email. Silakan coba lagi nanti.",
        };
    }

    record_audit(
        user_id    => $row->{id},
        action     => 'FORGOT_PASSWORD_REQUEST',
        details    => "Permintaan reset password. OTP dikirim ke " . Wahana::Auth->mask_email($email),
        ip_address => $req->{ip},
    );

    # Preauth token ber-context RESET_PASSWORD (5 menit)
    my $reset_token = Wahana::Auth->issue_preauth_token($row->{id}, 'RESET_PASSWORD');

    return {
        success      => \1,
        reset_token  => $reset_token,
        masked_email => Wahana::Auth->mask_email($email),
        message      => "Kode OTP reset password telah dikirim ke email " . Wahana::Auth->mask_email($email),
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/verify-forgot-otp
# Body: { reset_token, otp }
# Validasi OTP 6-digit Reset Password -> terbitkan reset_verified_token
# ---------------------------------------------------------------------
sub verify_forgot_password_otp {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $reset_token = trim($body->{reset_token} // '');
    my $otp_input   = trim($body->{otp} // '');

    return { success => \0, message => 'Token sesi reset password wajib disertakan.' }
        unless length $reset_token;

    return { success => \0, message => 'Kode OTP 6-digit wajib diisi.' }
        unless length $otp_input && $otp_input =~ /^\d{6}$/;

    my $payload = Wahana::Auth->verify_preauth_token($reset_token, 'RESET_PASSWORD');
    return { success => \0, message => 'Sesi verifikasi OTP kedaluwarsa. Silakan minta kode OTP baru.' }
        unless $payload && $payload->{uid};

    my $user_id = $payload->{uid};
    my $dbh     = Wahana::Db->connect();

    my $otp_row = $dbh->selectrow_hashref(
        Wahana::Query->get('otp_get_latest'), undef, $user_id
    );

    return { success => \0, message => 'Kode OTP tidak ditemukan atau sudah kedaluwarsa. Silakan minta OTP baru.' }
        unless $otp_row;

    if (($otp_row->{attempt_count} // 0) >= 5) {
        return { success => \0, message => 'Batas percobaan OTP (5x) terlampaui. Silakan minta kode OTP baru.' };
    }

    # Cek tanggal expire
    my $exp_str = $otp_row->{expires_at} // '';
    if ($exp_str) {
        $exp_str =~ s/T/ /;
        $exp_str =~ s/\..*//;
        my ($y,$m,$d,$h,$mi,$s) = $exp_str =~ /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
        if ($y) {
            use Time::Local qw(timelocal_posix);
            my $exp_epoch = eval { timelocal_posix($s, $mi, $h, $d, $m - 1, $y) };
            if (defined $exp_epoch && $exp_epoch < time()) {
                return { success => \0, message => 'Kode OTP telah kedaluwarsa (lebih dari 5 menit). Silakan minta OTP baru.' };
            }
        }
    }

    # Verifikasi hash OTP
    my $input_hash = Wahana::Auth->hash_otp($otp_input);
    if ($input_hash ne $otp_row->{otp_hash}) {
        $dbh->do(Wahana::Query->get('otp_increment_attempt'), undef, $otp_row->{id});
        record_audit(
            user_id    => $user_id,
            action     => 'OTP_FAILED',
            details    => "OTP Reset Password salah. Percobaan ke-" . (($otp_row->{attempt_count} // 0) + 1),
            ip_address => $req->{ip},
        );
        return { success => \0, message => 'Kode OTP yang Anda masukkan salah.' };
    }

    # Tandai OTP telah digunakan
    $dbh->do(Wahana::Query->get('otp_mark_used'), undef, $otp_row->{id});

    record_audit(
        user_id    => $user_id,
        action     => 'OTP_VERIFIED',
        details    => 'Kode OTP Reset Password berhasil diverifikasi.',
        ip_address => $req->{ip},
    );

    # Terbitkan reset_verified_token ber-context RESET_VERIFIED (berlaku 10 menit)
    my $reset_verified_token = Wahana::Auth->issue_preauth_token($user_id, 'RESET_VERIFIED', 600);

    return {
        success              => \1,
        reset_verified_token => $reset_verified_token,
        message              => 'OTP berhasil diverifikasi. Silakan buat password baru Anda.',
    };
}

# ---------------------------------------------------------------------
# POST /api/auth/reset-password
# Body: { reset_verified_token, new_password, confirm_password }
# Update password user dengan SHA-256 hash
# ---------------------------------------------------------------------
sub reset_password {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $token            = trim($body->{reset_verified_token} // '');
    my $new_password     = $body->{new_password} // '';
    my $confirm_password = $body->{confirm_password} // '';

    return { success => \0, message => 'Token sesi reset password tidak valid.' }
        unless length $token;

    return { success => \0, message => 'Password baru minimal 6 karakter.' }
        unless length $new_password >= 6;

    return { success => \0, message => 'Konfirmasi password baru tidak cocok.' }
        unless $new_password eq $confirm_password;

    my $payload = Wahana::Auth->verify_preauth_token($token, 'RESET_VERIFIED');
    return { success => \0, message => 'Sesi reset password kedaluwarsa. Silakan ulangi proses Lupa Password.' }
        unless $payload && $payload->{uid};

    my $user_id = $payload->{uid};
    my $dbh     = Wahana::Db->connect();

    my $user_row = $dbh->selectrow_hashref(Wahana::Query->get('auth_get_user_by_id'), undef, $user_id);
    return { success => \0, message => 'User tidak ditemukan.' } unless $user_row;

    # Update password di database
    my $password_hash = Wahana::Auth->hash_password($new_password);
    $dbh->do(Wahana::Query->get('auth_update_user_password'), undef, $password_hash, $user_id);

    # Invalidate seluruh OTP lama
    $dbh->do(Wahana::Query->get('otp_invalidate_old'), undef, $user_id);

    record_audit(
        user_id    => $user_id,
        action     => 'PASSWORD_RESET',
        details    => "Password user $user_row->{name} ($user_id) berhasil diubah.",
        ip_address => $req->{ip},
    );

    return {
        success => \1,
        message => 'Password Anda berhasil diubah. Silakan login kembali dengan password baru Anda.'
    };
}

1;
