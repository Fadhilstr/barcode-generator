package Wahana::Query;
use strict;
use warnings;
use File::Basename qw(dirname);
use File::Spec;
use Exporter 'import';

our @EXPORT_OK = qw(get_sql);

my %QUERIES;
my $INITIALIZED = 0;

sub _find_query_file {
    my @candidates = (
        $ENV{WAHANA_QUERY_FILE},
        File::Spec->catfile(dirname(__FILE__), '..', '..', 'db', 'query.sql'),
        File::Spec->catfile(dirname(__FILE__), '..', '..', '..', 'backend', 'db', 'query.sql'),
        '/app/backend/db/query.sql',
        'backend/db/query.sql',
        'db/query.sql',
    );

    for my $path (@candidates) {
        next unless defined $path && -f $path;
        return File::Spec->rel2abs($path);
    }

    die "[QUERY] File query.sql tidak ditemukan di lokasi manapun!";
}

sub _init {
    return if $INITIALIZED;

    my $file = _find_query_file();
    open my $fh, '<:encoding(UTF-8)', $file or die "[QUERY] Gagal membuka $file: $!";

    my $current_name = '';
    my @current_sql  = ();

    while (my $line = <$fh>) {
        if ($line =~ /^\s*--\s*name:\s*(\w+)\s*$/) {
            if ($current_name && @current_sql) {
                my $sql = join "\n", @current_sql;
                $sql =~ s/;\s*$//; # Hapus titik koma di akhir
                $sql =~ s/^\s+|\s+$//g;
                $QUERIES{$current_name} = $sql;
            }
            $current_name = $1;
            @current_sql  = ();
        } elsif ($current_name) {
            # Abaikan komentar baris tunggal lainnya
            next if $line =~ /^\s*--/;
            push @current_sql, $line;
        }
    }

    if ($current_name && @current_sql) {
        my $sql = join "\n", @current_sql;
        $sql =~ s/;\s*$//;
        $sql =~ s/^\s+|\s+$//g;
        $QUERIES{$current_name} = $sql;
    }

    close $fh;
    $INITIALIZED = 1;
}

sub get {
    my ($class_or_self, $name) = @_;
    _init() unless $INITIALIZED;

    my $sql = $QUERIES{$name};
    die "[QUERY] Query dengan nama '$name' tidak ditemukan di query.sql!"
        unless defined $sql;

    return $sql;
}

sub get_sql {
    my ($name) = @_;
    return __PACKAGE__->get($name);
}

sub all {
    my ($class_or_self) = @_;
    _init() unless $INITIALIZED;
    return \%QUERIES;
}

1;
