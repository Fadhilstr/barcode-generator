package Wahana::Controller::UsersController;
use strict;
use warnings;
use Wahana::Db;
use Wahana::Query;
use Wahana::Util qw(fmt_datetime trim);
use Wahana::Auth ();
use Wahana::Audit qw(record_audit);
use Exporter 'import';

our @EXPORT_OK = qw(map_user get_user_role);

# Map baris tabel users ke bentuk JSON yang dikonsumsi frontend.
# CATATAN: password_hash TIDAK PERNAH dikirim ke klien.
sub map_user {
    my ($r) = @_;
    return {
        id        => $r->{id},
        name      => $r->{name},
        username  => $r->{username},
        email     => $r->{email} // '',
        role      => $r->{role},
        status    => $r->{status},
        lastLogin => fmt_datetime($r->{last_login}),
    };
}

sub get_user_role {
    my ($user_id) = @_;
    my $dbh  = Wahana::Db->connect();
    my $sql  = Wahana::Query->get('users_get_role');
    my $role = $dbh->selectrow_array($sql, undef, $user_id);
    return $role;
}

# GET /api/users
sub list {
    my ($req) = @_;

    my $dbh  = Wahana::Db->connect();
    my $sql  = Wahana::Query->get('users_list_all');
    my $rows = $dbh->selectall_arrayref($sql, { Slice => {} });

    return { users => [ map { map_user($_) } @$rows ] };
}

# POST /api/users  (ADMIN only)
sub create {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $name     = trim($body->{name}         // '');
    my $username = trim($body->{username}     // '');
    my $email    = trim($body->{email} // $body->{gmail} // '');
    my $password = $body->{password}          // '123456';
    my $raw_role = $body->{role};
    if (ref $raw_role eq 'HASH') {
        $raw_role = $raw_role->{value} // $raw_role->{label};
    }
    my $role = uc(trim($raw_role // 'PETUGAS_SCAN'));
    $role = 'PETUGAS_SCAN' if $role eq 'PETUGAS' || $role eq 'PETUGAS SCAN';
    $role = 'CUSTOMER'     if $role eq 'CUST';

    return { success => \0, message => 'Nama, Gmail/Email, dan Username wajib diisi.' }
        unless length $name && length $username && length $email;

    return { success => \0, message => 'Format Gmail/Email tidak valid.' }
        unless $email =~ /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    my %valid_roles = map { $_ => 1 } qw(ADMIN PETUGAS_SCAN CUSTOMER);
    return { success => \0, message => 'Role tidak valid.' }
        unless $valid_roles{$role};

    my $dbh = Wahana::Db->connect();

    # Username harus unik
    my $check_sql = Wahana::Query->get('users_check_username_exists');
    my $exists = $dbh->selectrow_array($check_sql, undef, $username);
    return { success => \0, message => "Username '$username' sudah digunakan." }
        if $exists;

    # Gmail harus unik
    my $exists_em = $dbh->selectrow_array(Wahana::Query->get('users_check_email_exists'), undef, $email);
    return { success => \0, message => "Gmail '$email' sudah digunakan oleh user lain." }
        if $exists_em;

    # Generate ID berurutan sesuai role:
    my $new_id;
    if ($role eq 'CUSTOMER') {
        my $max_cust = $dbh->selectrow_array(Wahana::Query->get('users_get_max_cust_id'));
        $new_id = sprintf 'USR-CUST-%03d', ($max_cust // 0) + 1;
    } elsif ($role eq 'ADMIN') {
        my $max_admin = $dbh->selectrow_array(Wahana::Query->get('users_get_max_admin_id'));
        $new_id = sprintf 'USR-ADMIN-%03d', ($max_admin // 0) + 1;
    } else {
        my $max_num = $dbh->selectrow_array(Wahana::Query->get('users_get_max_petugas_id'));
        $new_id = sprintf 'USR-%03d', ($max_num // 0) + 1;
    }

    $dbh->do(
        Wahana::Query->get('users_insert'),
        undef,
        $new_id, $name, $username, $email,
        Wahana::Auth->hash_password($password),
        $role, 'OFFLINE'
    );

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'USER_CREATED',
        details    => "User baru $name ($new_id) dengan Gmail $email dan role $role.",
        ip_address => $req->{ip},
    );

    my $row = $dbh->selectrow_hashref(Wahana::Query->get('users_get_by_id'), undef, $new_id);
    return { success => \1, user => map_user($row) };
}

# PATCH /api/users/:id/status  (ADMIN only)
sub toggle_status {
    my ($req, $captures) = @_;
    my $user_id = $captures->[0];

    my $dbh = Wahana::Db->connect();
    my $row = $dbh->selectrow_hashref(Wahana::Query->get('users_get_by_id'), undef, $user_id);

    return { success => \0, message => 'User tidak ditemukan.' }
        unless $row;

    my $new_status = $row->{status} eq 'DISABLED' ? 'OFFLINE' : 'DISABLED';
    $dbh->do(Wahana::Query->get('users_toggle_status'), undef, $new_status, $user_id);

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'USER_STATUS_CHANGED',
        details    => "Status $user_id diubah dari $row->{status} menjadi $new_status.",
        ip_address => $req->{ip},
    );

    return { success => \1, newStatus => $new_status };
}

# PUT /api/users/:id  (ADMIN only)
sub update {
    my ($req, $captures) = @_;
    my $user_id = $captures->[0];
    my $body = $req->{body} // {};

    my $dbh = Wahana::Db->connect();
    my $row = $dbh->selectrow_hashref(Wahana::Query->get('users_get_by_id'), undef, $user_id);
    return { success => \0, message => 'User tidak ditemukan.' } unless $row;

    my $name     = trim($body->{name} // $row->{name});
    my $username = trim($body->{username} // $row->{username});
    my $email    = trim($body->{email} // $body->{gmail} // $row->{email} // '');
    my $password = $body->{password};

    my $raw_role = $body->{role} // $row->{role};
    if (ref $raw_role eq 'HASH') {
        $raw_role = $raw_role->{value} // $raw_role->{label};
    }
    my $role = uc(trim($raw_role // $row->{role}));
    $role = 'PETUGAS_SCAN' if $role eq 'PETUGAS' || $role eq 'PETUGAS SCAN';
    $role = 'CUSTOMER'     if $role eq 'CUST';

    return { success => \0, message => 'Nama, Gmail/Email, dan username wajib diisi.' }
        unless length $name && length $username && length $email;

    return { success => \0, message => 'Format Gmail/Email tidak valid.' }
        unless $email =~ /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    my %valid_roles = map { $_ => 1 } qw(ADMIN PETUGAS_SCAN CUSTOMER);
    return { success => \0, message => 'Role tidak valid.' }
        unless $valid_roles{$role};

    # Username harus unik kecuali untuk user itu sendiri
    my $exists_un = $dbh->selectrow_array(
        Wahana::Query->get('users_check_username_exists_except_self'),
        undef, $username, $user_id
    );
    return { success => \0, message => "Username '$username' sudah digunakan oleh user lain." }
        if $exists_un;

    # Gmail harus unik kecuali untuk user itu sendiri
    my $exists_em = $dbh->selectrow_array(
        Wahana::Query->get('users_check_email_exists_except_self'),
        undef, $email, $user_id
    );
    return { success => \0, message => "Gmail '$email' sudah digunakan oleh user lain." }
        if $exists_em;

    if (defined $password && length trim($password)) {
        $dbh->do(
            Wahana::Query->get('users_update_with_password'),
            undef, $name, $username, $email, $role, Wahana::Auth->hash_password(trim($password)), $user_id
        );
    } else {
        $dbh->do(
            Wahana::Query->get('users_update_without_password'),
            undef, $name, $username, $email, $role, $user_id
        );
    }

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'USER_UPDATED',
        details    => "Data user $name ($user_id) diperbarui. Role: $role.",
        ip_address => $req->{ip},
    );

    my $updated = $dbh->selectrow_hashref(Wahana::Query->get('users_get_by_id'), undef, $user_id);
    return { success => \1, user => map_user($updated), message => 'Data user berhasil diperbarui.' };
}

# DELETE /api/users/:id  (ADMIN only)
sub delete {
    my ($req, $captures) = @_;
    my $user_id = $captures->[0];

    my $dbh = Wahana::Db->connect();
    my $row = $dbh->selectrow_hashref(Wahana::Query->get('users_get_by_id'), undef, $user_id);
    return { success => \0, message => 'User tidak ditemukan.' } unless $row;

    # Cegah admin menghapus dirinya sendiri
    if ($req->{auth_user}{uid} eq $user_id) {
        return { success => \0, message => 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' };
    }

    # Cek relasi data (tasks, paket, scan_events)
    my $has_tasks = $dbh->selectrow_array(Wahana::Query->get('users_count_tasks'), undef, $user_id);
    my $has_scans = $dbh->selectrow_array(Wahana::Query->get('users_count_scans'), undef, $user_id);
    my $has_paket = $dbh->selectrow_array(Wahana::Query->get('users_count_paket'), undef, $user_id);

    if ($has_tasks || $has_scans || $has_paket) {
        return {
            success => \0,
            message => "User $row->{name} tidak dapat dihapus karena memiliki riwayat operasional (Tasks/Scans/Paket). Silakan nonaktifkan (Disable) user."
        };
    }

    $dbh->do(Wahana::Query->get('users_delete'), undef, $user_id);

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'USER_DELETED',
        details    => "User $row->{name} ($user_id) telah dihapus dari sistem.",
        ip_address => $req->{ip},
    );

    return { success => \1, message => "User $row->{name} berhasil dihapus." };
}

1;
