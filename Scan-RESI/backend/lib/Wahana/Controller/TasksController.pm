package Wahana::Controller::TasksController;
use strict;
use warnings;
use POSIX qw(strftime);
use Wahana::Db;
use Wahana::Query;
use Wahana::Util qw(fmt_date iso_date trim);
use Wahana::Audit qw(record_audit);
use Exporter 'import';

our @EXPORT_OK = qw(map_task);

sub map_task {
    my ($r) = @_;
    return {
        task_id   => $r->{task_id},
        user_id   => $r->{user_id},
        user_name => $r->{user_name},
        shift     => $r->{shift},
        tanggal   => fmt_date($r->{tanggal}),
        target    => int($r->{target} // 0),
        progress  => int($r->{progress} // 0),
        status    => $r->{status},
        lokasi    => $r->{lokasi},
    };
}

# GET /api/tasks?user_id=&status=
sub list {
    my ($req) = @_;
    my $params = $req->{params} // {};

    my @where;
    my @bind;
    if (my $uid = trim($params->{user_id} // '')) {
        push @where, 't.user_id = ?';
        push @bind,  $uid;
    }
    if (my $status = trim($params->{status} // '')) {
        push @where, 't.status = ?';
        push @bind,  $status;
    }

    my $limit = int($params->{limit} // 100);
    $limit = 100 if $limit <= 0;
    $limit = 500 if $limit > 500;

    my $page   = int($params->{page} // 1);
    $page      = 1 if $page <= 0;
    my $offset = int($params->{offset} // (($page - 1) * $limit));
    $offset    = 0 if $offset < 0;

    my $dbh = Wahana::Db->connect();
    my $base_sql = Wahana::Query->get('tasks_list_base');
    my $sql = $base_sql
        . (@where ? ' WHERE ' . join(' AND ', @where) : '')
        . " ORDER BY t.task_id DESC LIMIT $limit OFFSET $offset";

    my $rows = $dbh->selectall_arrayref($sql, { Slice => {} }, @bind);

    return { tasks => [ map { map_task($_) } @$rows ] };
}

# POST /api/tasks  (ADMIN only)
# Body: { user_id, shift?, tanggal?, target?, lokasi? }
sub create {
    my ($req) = @_;
    my $body = $req->{body} // {};

    my $user_id = trim($body->{user_id} // '');
    return { success => \0, message => 'user_id wajib diisi.' }
        unless length $user_id;

    my %valid_shifts = map { $_ => 1 } qw(Pagi Sore);
    my $shift = $valid_shifts{ $body->{shift} // '' } ? $body->{shift} : 'Pagi';

    my $tanggal = iso_date($body->{tanggal}) // strftime('%Y-%m-%d', localtime);
    my $target  = int($body->{target} || 100);
    my $lokasi  = trim($body->{lokasi} // '') || 'CIPUTAT';

    my $dbh = Wahana::Db->connect();

    # User harus ada
    my $user_exists = $dbh->selectrow_array(
        Wahana::Query->get('tasks_check_user_exists'), undef, $user_id
    );
    return { success => \0, message => "User '$user_id' tidak ditemukan." }
        unless $user_exists;

    # Generate ID berurutan: TASK-004, TASK-005, ...
    my $max_num = $dbh->selectrow_array(Wahana::Query->get('tasks_get_max_id'));
    my $new_id = sprintf 'TASK-%03d', $max_num + 1;

    $dbh->do(
        Wahana::Query->get('tasks_insert'),
        undef, $new_id, $user_id, $shift, $tanggal, $target, $lokasi
    );

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'TASK_CREATED',
        details    => "Task $new_id dibuat untuk $user_id (target: $target).",
        ip_address => $req->{ip},
    );

    my $row = $dbh->selectrow_hashref(
        Wahana::Query->get('tasks_get_by_id'), undef, $new_id
    );

    return { success => \1, task => map_task($row) };
}

# PATCH /api/tasks/:id/progress — increment progress +1
sub progress {
    my ($req, $captures) = @_;
    my $task_id = $captures->[0];

    my $dbh = Wahana::Db->connect();
    my $rows = $dbh->do(
        Wahana::Query->get('tasks_increment_progress'),
        undef, 1, $task_id
    );

    return { success => \0, message => "Task $task_id tidak ditemukan atau sudah SELESAI." }
        unless $rows;

    return { success => \1 };
}

# PATCH /api/tasks/:id/complete — selesaikan task (kunci scan)
sub complete {
    my ($req, $captures) = @_;
    my $task_id = $captures->[0];

    my $dbh = Wahana::Db->connect();
    my $task = $dbh->selectrow_hashref(Wahana::Query->get('tasks_get_by_id'), undef, $task_id);

    return { success => \0, message => 'Task tidak ditemukan.' }
        unless $task;

    if ($task->{status} eq 'SELESAI') {
        return { success => \1, message => "Task $task_id sudah berstatus SELESAI." };
    }

    $dbh->do(Wahana::Query->get('tasks_complete'), undef, $task_id);

    record_audit(
        user_id    => $req->{auth_user}{uid},
        action     => 'TASK_COMPLETED',
        details    => "Task $task_id diselesaikan ($task->{progress}/$task->{target}).",
        ip_address => $req->{ip},
    );

    return { success => \1, message => "Task $task_id berhasil diselesaikan." };
}

1;
