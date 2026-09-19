package Wahana::Util;
use strict;
use warnings;
use Exporter 'import';

our @EXPORT_OK = qw(fmt_datetime fmt_date iso_date trim);

# 'YYYY-MM-DD HH:MM:SS' → 'DD-MM-YYYY HH:MM:SS' (format UI aplikasi)
sub fmt_datetime {
    my ($dt) = @_;
    return '' unless defined $dt && length $dt;
    if ($dt =~ /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/) {
        return "$3-$2-$1 $4";
    }
    return $dt;
}

# 'YYYY-MM-DD' → 'DD-MM-YYYY'
sub fmt_date {
    my ($d) = @_;
    return '' unless defined $d && length $d;
    if ($d =~ /^(\d{4})-(\d{2})-(\d{2})/) {
        return "$3-$2-$1";
    }
    return $d;
}

# 'DD-MM-YYYY' → 'YYYY-MM-DD' (untuk input tanggal dari klien)
sub iso_date {
    my ($d) = @_;
    return undef unless defined $d;
    if ($d =~ /^(\d{2})-(\d{2})-(\d{4})$/) {
        return "$3-$2-$1";
    }
    if ($d =~ /^\d{4}-\d{2}-\d{2}$/) {
        return $d;   # sudah ISO
    }
    return undef;
}

sub trim {
    my ($s) = @_;
    return '' unless defined $s;
    $s =~ s/^\s+|\s+$//g;
    return $s;
}

1;
