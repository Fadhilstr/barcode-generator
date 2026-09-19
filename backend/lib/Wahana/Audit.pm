package Wahana::Audit;
use strict;
use warnings;
use Wahana::Db;
use Wahana::Query;
use Exporter 'import';

our @EXPORT_OK = qw(record_audit);

# Catat satu event audit ke tabel AUDIT_LOGS.
# Tidak pernah menggagalkan alur utama — kesalahan hanya ditulis ke STDERR.
sub record_audit {
    my (%event) = @_;

    eval {
        my $dbh = Wahana::Db->connect();
        my $user_name = $event{user_name};
        if (!defined $user_name && defined $event{user_id} && length $event{user_id}) {
            my $u = $dbh->selectrow_hashref(Wahana::Query->get('auth_get_user_by_id'), undef, $event{user_id});
            $user_name = $u->{name} if $u;
        }

        my $sql = Wahana::Query->get('audit_insert');
        $dbh->do(
            $sql,
            undef,
            $event{user_id},
            $user_name,
            $event{action},
            $event{details},
            $event{ip_address}
        );
        1;
    } or do {
        warn "[AUDIT] Gagal mencatat event: $@";
    };

    return 1;
}

1;
