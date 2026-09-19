package Wahana::Db;
use strict;
use warnings;
use DBI;
use Wahana::Config qw(config);

sub connect {
    my ($class) = @_;

    our $DBH;
    if ($DBH && eval { $DBH->ping }) {
        return $DBH;
    }

    my $cfg = config();
    $DBH = DBI->connect(
        $cfg->{db_dsn}, $cfg->{db_user}, $cfg->{db_pass},
        {
            RaiseError => 0,
            PrintError => 0,
            AutoCommit => 1,
            mysql_enable_utf8mb4 => 1,
            AutoInactiveDestroy => 1,
        }
    ) or die "Koneksi database gagal: " . DBI->errstr;

    $DBH->do("SET time_zone = '+07:00'");

    return $DBH;
}

1;
