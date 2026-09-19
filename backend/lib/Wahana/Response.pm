package Wahana::Response;
use strict;
use warnings;
use JSON::PP ();
use Exporter 'import';

our @EXPORT_OK = qw(cors_headers json_response decode_json_body);

my $JSON = JSON::PP->new->utf8->canonical;

sub cors_headers {
    return (
        'Access-Control-Allow-Origin'  => '*',
        'Access-Control-Allow-Methods' => 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
        'Access-Control-Max-Age'       => '86400',
    );
}

# Bangun respons standar aplikasi:
# { status => INT, headers => {..}, body => STRING_JSON }
sub json_response {
    my (%args) = @_;

    my $body = exists $args{body} ? $args{body} : $JSON->encode($args{data} // {});

    my %headers = (
        'Content-Type' => 'application/json; charset=utf-8',
        cors_headers(),
        %{ $args{headers} // {} },
    );

    return {
        status  => $args{status} // 200,
        headers => \%headers,
        body    => $body,
    };
}

# Decode body JSON mentah dari klien. Mengembalikan hashref atau undef jika invalid.
sub decode_json_body {
    my ($raw) = @_;
    return {}          unless defined $raw && length $raw;
    return undef       unless $raw =~ /^\s*[\{\[]/;
    my $data = eval { $JSON->decode($raw) };
    return $@ ? undef : ($data // {});
}

1;
