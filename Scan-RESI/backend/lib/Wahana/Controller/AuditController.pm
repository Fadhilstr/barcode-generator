package Wahana::Controller::AuditController;
use strict;
use warnings;
use Wahana::Db;
use Wahana::Query;
use Wahana::Util qw(fmt_datetime);
use Exporter 'import';

our @EXPORT_OK = qw();

# GET /api/audit-logs  (ADMIN only)
# Query opsional: ?user_id=&action=&limit=
sub list {
    my ($req) = @_;
    my $params = $req->{params} // {};

    my @where;
    my @bind;
    if (my $uid = $params->{user_id}) {
        push @where, 'a.user_id = ?';
        push @bind,  $uid;
    }
    if (my $action = $params->{action}) {
        push @where, 'a.action = ?';
        push @bind,  $action;
    }

    my $limit = int($params->{limit} || 200);
    $limit = 500 if $limit > 500;
    $limit = 100 if $limit <= 0;

    # Hitung halaman (page) & offset
    my $page   = int($params->{page} // 1);
    $page      = 1 if $page <= 0;
    my $offset = int($params->{offset} // (($page - 1) * $limit));
    $offset    = 0 if $offset < 0;

    my $dbh = Wahana::Db->connect();
    my $base_sql = Wahana::Query->get('audit_list_base');
    my $sql = $base_sql
        . (@where ? ' WHERE ' . join(' AND ', @where) : '')
        . " ORDER BY a.log_id DESC LIMIT $limit OFFSET $offset";

    my $rows = $dbh->selectall_arrayref($sql, { Slice => {} }, @bind);

    my $logs = [ map {
        {
            log_id     => int($_->{log_id}),
            user_id    => $_->{user_id},
            user_name  => $_->{user_name} // '(system)',
            action     => $_->{action},
            details    => $_->{details},
            ip_address => $_->{ip_address},
            created_at => fmt_datetime($_->{created_at}),
        }
    } @$rows ];

    return { logs => $logs };
}

1;
