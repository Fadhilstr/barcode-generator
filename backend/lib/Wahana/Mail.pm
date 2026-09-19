package Wahana::Mail;
use strict;
use warnings;
use Net::SMTP;
use Wahana::Config qw(config);
use Exporter 'import';

our @EXPORT_OK = qw(send_otp_email);

# Mengirim email OTP profesional HTML via SMTP Gmail (Net::SMTP + STARTTLS)
sub send_otp_email {
    my %args = @_ % 2 == 0 ? @_ : @_[1 .. $#_];

    my $to_email  = $args{to_email};
    my $user_name = $args{user_name} // $args{name} // $args{nama} // '';
    my $otp_code  = $args{otp_code};
    my $context   = uc($args{context} // $args{type} // 'LOGIN');
    my $app_name  = $args{app_name} // 'DIJAK EXPRESS';

    return (0, "Alamat email penerima tidak valid.")
        unless defined $to_email && $to_email =~ /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    my $cfg  = config();
    my $host = $cfg->{smtp_host} // 'smtp.gmail.com';
    my $port = int($cfg->{smtp_port} // 587);
    my $user = $cfg->{smtp_user} // '';
    my $pass = $cfg->{smtp_pass} // '';
    $user =~ s/^\s+|\s+$//g;
    $pass =~ s/\s+//g;

    if (!$user || !$pass || $pass eq 'ganti-dengan-app-password') {
        warn "[MAIL SIMULATION] SMTP credentials belum diisi di .env ($user / $pass). Simulasi pengiriman OTP ke $to_email sukses.\n";
        return (1, "Kode OTP berhasil dikirim (mode simulasi SMTP).");
    }

    # Format Nama Pengguna (Greeting)
    $user_name =~ s/^\s+|\s+$//g;
    my $greeting = (length $user_name) ? "Halo, $user_name" : "Halo,";

    # Tentukan Subject, Judul, Narasi & Pesan Keamanan berdasarkan Context
    my ($subject, $title, $explanation, $sec_warning, $sec_footer);

    if ($context eq 'FORGOT_PASSWORD' || $context eq 'RESET_PASSWORD') {
        $subject     = "DIJAK EXPRESS — Kode Reset Password";
        $title       = "Reset Password Anda";
        $explanation = "Kami menerima permintaan untuk mengatur ulang password akun Anda.<br>Gunakan kode berikut untuk melanjutkan proses reset password:";
        $sec_warning = "Jangan berikan kode reset password ini kepada siapa pun, termasuk pihak yang mengaku sebagai petugas <strong>DIJAK EXPRESS</strong>.";
        $sec_footer  = "Jika Anda tidak meminta reset password, abaikan email ini.<br>Password Anda tidak akan berubah tanpa proses verifikasi.";
    } else {
        $subject     = "DIJAK EXPRESS — Kode Verifikasi Anda";
        $title       = "Verifikasi Akun Anda";
        $explanation = "Kami menerima permintaan untuk melakukan verifikasi akun Anda.<br>Gunakan kode berikut untuk melanjutkan proses:";
        $sec_warning = "Jangan berikan kode OTP ini kepada siapa pun, termasuk pihak yang mengaku sebagai petugas <strong>DIJAK EXPRESS</strong>.";
        $sec_footer  = "Jika Anda tidak meminta kode ini, abaikan email ini.";
    }

    # Template Email HTML Professional DIJAK EXPRESS (#FFD100, Clean Table Layout)
    my $html_body = <<"END_HTML";
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$subject</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Kuning #FFD100 -->
          <tr>
            <td style="background-color: #FFD100; padding: 24px 32px; text-align: left;">
              <div style="font-size: 22px; font-weight: bold; color: #111111; letter-spacing: -0.5px; margin: 0;">
                DIJAK EXPRESS
              </div>
              <div style="font-size: 12px; font-weight: bold; color: #333333; margin-top: 4px; opacity: 0.85;">
                Sistem Informasi DIJAK EXPRESS
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px; text-align: left; background-color: #ffffff;">
              <!-- Greeting Personalisasi -->
              <div style="font-size: 16px; font-weight: bold; color: #111111; margin-bottom: 12px;">
                $greeting
              </div>

              <!-- Judul Konteks -->
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: bold; color: #111111; letter-spacing: -0.3px;">
                $title
              </h2>

              <!-- Narasi -->
              <div style="font-size: 14px; color: #333333; line-height: 1.6; margin-bottom: 24px;">
                $explanation
              </div>

              <!-- OTP Box Highlight (Center & Bold) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 22px 16px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; letter-spacing: 10px; color: #111111; display: inline-block; margin-left: 10px;">
                      $otp_code
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Durasi Expiration -->
              <div style="font-size: 14px; color: #475569; text-align: center; margin-bottom: 24px;">
                Kode ini berlaku selama <strong>5 menit</strong>.
              </div>

              <!-- Security Notice Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: #fffbe6; border-left: 4px solid #FFD100; border-radius: 6px; padding: 16px;">
                    <div style="font-weight: bold; font-size: 14px; color: #856404; margin-bottom: 6px;">
                      🔒 Keamanan Akun
                    </div>
                    <div style="font-size: 13px; color: #4a5568; line-height: 1.5;">
                      $sec_warning<br><br>
                      $sec_footer
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Email -->
          <tr>
            <td style="padding: 24px 32px; background-color: #ffffff; border-top: 1px solid #f1f5f9; text-align: center;">
              <div style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">
                DIJAK EXPRESS
              </div>
              <div style="font-size: 12px; color: #64748b; line-height: 1.6;">
                Email ini dikirim secara otomatis. Mohon tidak membalas email ini.<br><br>
                &copy; 2026 DIJAK EXPRESS
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
END_HTML

    warn "[MAIL DEBUG] Mencoba mengirim email OTP HTML ($context) ke $to_email via $host:$port ($user)...\n";

    my $sec_mode = lc($cfg->{smtp_secure} // '');
    my $is_direct_ssl = ($port == 465 || $sec_mode eq 'ssl' || $sec_mode eq 'true');

    my %smtp_opts = (
        Port    => $port,
        Timeout => 20,
        Debug   => 0,
    );

    if ($is_direct_ssl) {
        $smtp_opts{SSL} = 1;
        $smtp_opts{SSL_verify_mode} = 0;
    }

    my $smtp = Net::SMTP->new($host, %smtp_opts);

    unless ($smtp) {
        warn "[MAIL ERROR] Gagal koneksi ke server SMTP $host:$port ($!)\n";
        return (0, "Gagal terhubung ke server email SMTP.");
    }

    # Jalankan STARTTLS hanya jika BUKAN direct SSL dan port 587 atau mode starttls
    if (!$is_direct_ssl && ($port == 587 || $sec_mode eq 'starttls')) {
        if ($smtp->can('starttls')) {
            eval {
                $smtp->starttls(SSL_verify_mode => 0) or die "STARTTLS failed";
                1;
            } or do {
                warn "[MAIL ERROR] Gagal inisialisasi STARTTLS: $@\n";
                return (0, "Gagal mengamankan enkripsi koneksi email.");
            };
        }
    }

    # Otentikasi SASL (App Password)
    my $auth_ok = eval { $smtp->auth($user, $pass) };
    unless ($auth_ok) {
        warn "[MAIL ERROR] Autentikasi SMTP Gmail gagal untuk akun $user: $@\n";
        return (0, "Gagal otentikasi SMTP. Periksa SMTP_USER & App Password pada .env.");
    }

    my $from_name = $cfg->{smtp_from_name} // 'DIJAK EXPRESS';

    $smtp->mail($user);
    if ($smtp->to($to_email)) {
        $smtp->data();
        $smtp->datasend("From: $from_name <$user>\n");
        $smtp->datasend("To: $to_email\n");
        $smtp->datasend("Subject: $subject\n");
        $smtp->datasend("MIME-Version: 1.0\n");
        $smtp->datasend("Content-Type: text/html; charset=UTF-8\n\n");
        $smtp->datasend($html_body);
        $smtp->dataend();
        $smtp->quit();
        warn "[MAIL SUCCESS] Email OTP HTML ($context) berhasil dikirim ke $to_email via SMTP Gmail!\n";
        return (1, "Kode OTP berhasil dikirim ke $to_email");
    } else {
        warn "[MAIL ERROR] Alamat email ditolak server SMTP: $to_email\n";
        $smtp->quit();
        return (0, "Email penerima ditolak oleh server SMTP.");
    }
}

1;
