-- ============================================================================
-- NOWERA Management · Supabase / PostgreSQL schema  (v1.4)
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this WHOLE file → Run.
-- It is safe to run any number of times, on an empty project AND on a project
-- that already contains an older NOWERA schema (it upgrades tables in place,
-- clears stale policies/triggers/functions from older versions, then rebuilds
-- everything). The last statement prints a checklist: every row must say OK.
--
-- Security note: new signups never receive admin rights from submitted phone
-- metadata. Bootstrap the first super-admin through trusted SQL (see README).
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'عضو جدید' check (char_length(full_name) between 2 and 100),
  phone text not null unique,
  department text not null check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')),
  role text not null default 'member' check (role in ('member', 'department_admin', 'super_admin')),
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')),
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '',
  status text not null default 'active' check (status in ('planning', 'active', 'paused', 'completed')),
  deadline date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  unique (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_members (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  unique (task_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')),
  title text not null check (char_length(title) between 2 and 140),
  details text not null default '',
  event_date timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_admin_id uuid references public.profiles(id) on delete set null,
  department text not null check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')),
  title text not null check (char_length(title) between 3 and 160),
  message text not null check (char_length(message) between 5 and 5000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);


-- ---------------------------------------------------------------------------
-- UPGRADE STEP 1 — bring tables created by OLDER versions up to date.
-- `create table if not exists` never alters an existing table, so a project that
-- already had an older NOWERA schema used to fail halfway (e.g. "column
-- p.is_active does not exist"). Because the SQL Editor runs a script as a single
-- transaction, that failure rolled back EVERYTHING — including the member RPCs —
-- which is why removing members / assigning members kept failing after "running
-- the schema". The block below makes the script converge from any earlier state.
-- ---------------------------------------------------------------------------
do $upgrade$
declare
  r record;
  has_nulls boolean;
begin
  for r in
    select * from (values
      ('profiles',        'full_name',    'text',        $v$'عضو جدید'$v$,  true),
      ('profiles',        'phone',        'text',        null,              false),
      ('profiles',        'department',   'text',        $v$'Technoplus'$v$, true),
      ('profiles',        'role',         'text',        $v$'member'$v$,    true),
      ('profiles',        'is_active',    'boolean',     'true',            true),
      ('profiles',        'avatar_url',   'text',        null,              false),
      ('profiles',        'created_at',   'timestamptz', 'now()',           true),
      ('projects',        'department',   'text',        $v$'Technoplus'$v$, true),
      ('projects',        'description',  'text',        $v$''$v$,          true),
      ('projects',        'status',       'text',        $v$'active'$v$,    true),
      ('projects',        'deadline',     'date',        null,              false),
      ('projects',        'created_by',   'uuid',        null,              true),
      ('projects',        'created_at',   'timestamptz', 'now()',           true),
      ('projects',        'updated_at',   'timestamptz', 'now()',           true),
      ('project_members', 'status',       'text',        $v$'pending'$v$,   true),
      ('project_members', 'requested_at', 'timestamptz', 'now()',           true),
      ('project_members', 'decided_by',   'uuid',        null,              false),
      ('project_members', 'decided_at',   'timestamptz', null,              false),
      ('tasks',           'description',  'text',        $v$''$v$,          true),
      ('tasks',           'status',       'text',        $v$'todo'$v$,      true),
      ('tasks',           'priority',     'text',        $v$'medium'$v$,    true),
      ('tasks',           'due_date',     'date',        null,              false),
      ('tasks',           'created_by',   'uuid',        null,              true),
      ('tasks',           'created_at',   'timestamptz', 'now()',           true),
      ('tasks',           'updated_at',   'timestamptz', 'now()',           true),
      ('task_members',    'status',       'text',        $v$'pending'$v$,   true),
      ('task_members',    'requested_at', 'timestamptz', 'now()',           true),
      ('task_members',    'decided_by',   'uuid',        null,              false),
      ('task_members',    'decided_at',   'timestamptz', null,              false),
      ('events',          'department',   'text',        $v$'Technoplus'$v$, true),
      ('events',          'details',      'text',        $v$''$v$,          true),
      ('events',          'created_by',   'uuid',        null,              true),
      ('events',          'created_at',   'timestamptz', 'now()',           true),
      ('reports',         'target_admin_id', 'uuid',     null,              false),
      ('reports',         'department',   'text',        $v$'Technoplus'$v$, true),
      ('reports',         'status',       'text',        $v$'new'$v$,       true),
      ('reports',         'reviewed_by',  'uuid',        null,              false),
      ('reports',         'created_at',   'timestamptz', 'now()',           true),
      ('reports',         'reviewed_at',  'timestamptz', null,              false)
    ) as v(tbl, col, typ, def, nn)
  loop
    execute format('alter table public.%I add column if not exists %I %s', r.tbl, r.col, r.typ);
    if r.def is not null then
      execute format('alter table public.%I alter column %I set default %s', r.tbl, r.col, r.def);
      execute format('update public.%I set %I = %s where %I is null', r.tbl, r.col, r.def, r.col);
    end if;
    if r.nn then
      execute format('select exists (select 1 from public.%I where %I is null)', r.tbl, r.col) into has_nulls;
      if not has_nulls then
        execute format('alter table public.%I alter column %I set not null', r.tbl, r.col);
      end if;
    end if;
  end loop;
end
$upgrade$;

-- Normalise legacy values so the CHECK constraints below cannot be violated.
update public.profiles set role = 'member'        where role not in ('member', 'department_admin', 'super_admin');
update public.profiles set department = 'Technoplus' where department not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen');
update public.projects set department = 'Technoplus' where department not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen');
update public.projects set status = 'active'      where status not in ('planning', 'active', 'paused', 'completed');
update public.events   set department = 'Technoplus' where department not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen');
update public.reports  set department = 'Technoplus' where department not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen');
update public.reports  set status = 'new'         where status not in ('new', 'reviewing', 'resolved');
update public.tasks    set status = 'todo'        where status not in ('todo', 'in_progress', 'review', 'done');
update public.tasks    set priority = 'medium'    where priority not in ('low', 'medium', 'high', 'urgent');
update public.project_members set status = 'pending' where status not in ('pending', 'approved', 'rejected');
update public.task_members    set status = 'pending' where status not in ('pending', 'approved', 'rejected');

-- Older versions used differently named CHECK constraints; drop them all and re-add
-- one canonical set. NOT VALID = enforced for every new/changed row without
-- rescanning (and possibly failing on) historical rows.
do $checks$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.profiles'::regclass, 'public.projects'::regclass, 'public.project_members'::regclass,
                       'public.tasks'::regclass, 'public.task_members'::regclass, 'public.events'::regclass,
                       'public.reports'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end
$checks$;

alter table public.profiles add constraint profiles_full_name_len check (char_length(full_name) between 2 and 100) not valid;
alter table public.profiles add constraint profiles_department_chk check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')) not valid;
alter table public.profiles add constraint profiles_role_chk check (role in ('member', 'department_admin', 'super_admin')) not valid;
alter table public.projects add constraint projects_department_chk check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')) not valid;
alter table public.projects add constraint projects_title_len check (char_length(title) between 2 and 140) not valid;
alter table public.projects add constraint projects_status_chk check (status in ('planning', 'active', 'paused', 'completed')) not valid;
alter table public.project_members add constraint project_members_status_chk check (status in ('pending', 'approved', 'rejected')) not valid;
alter table public.tasks add constraint tasks_title_len check (char_length(title) between 2 and 160) not valid;
alter table public.tasks add constraint tasks_status_chk check (status in ('todo', 'in_progress', 'review', 'done')) not valid;
alter table public.tasks add constraint tasks_priority_chk check (priority in ('low', 'medium', 'high', 'urgent')) not valid;
alter table public.task_members add constraint task_members_status_chk check (status in ('pending', 'approved', 'rejected')) not valid;
alter table public.events add constraint events_department_chk check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')) not valid;
alter table public.events add constraint events_title_len check (char_length(title) between 2 and 140) not valid;
alter table public.reports add constraint reports_department_chk check (department in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')) not valid;
alter table public.reports add constraint reports_title_len check (char_length(title) between 3 and 160) not valid;
alter table public.reports add constraint reports_message_len check (char_length(message) between 5 and 5000) not valid;
alter table public.reports add constraint reports_status_chk check (status in ('new', 'reviewing', 'resolved')) not valid;

-- The assign_* RPCs use ON CONFLICT (project_id, user_id) / (task_id, user_id),
-- which only works when a matching unique index exists. Older tables may lack it
-- (or contain duplicates); remove duplicates (keep the approved/newest row) first.
delete from public.project_members a using public.project_members b
where a.project_id = b.project_id and a.user_id = b.user_id and a.id <> b.id
  and ((b.status = 'approved' and a.status <> 'approved') or (b.status = a.status and a.id < b.id));
delete from public.task_members a using public.task_members b
where a.task_id = b.task_id and a.user_id = b.user_id and a.id <> b.id
  and ((b.status = 'approved' and a.status <> 'approved') or (b.status = a.status and a.id < b.id));
create unique index if not exists project_members_project_user_uidx on public.project_members (project_id, user_id);
create unique index if not exists task_members_task_user_uidx on public.task_members (task_id, user_id);

create index if not exists projects_department_idx on public.projects(department, created_at desc);
create index if not exists project_members_user_status_idx on public.project_members(user_id, status);
create index if not exists tasks_project_idx on public.tasks(project_id, status, due_date);
create index if not exists task_members_user_status_idx on public.task_members(user_id, status);
create index if not exists events_department_date_idx on public.events(department, event_date);
create index if not exists reports_created_idx on public.reports(created_at desc);

-- ---------------------------------------------------------------------------
-- UPGRADE STEP 2 — clear leftovers of older versions.
-- A stale trigger or function with a different name/signature is invisible to
-- `create or replace` yet can silently block updates (e.g. an old guard trigger
-- that rejects is_active changes) or make `create or replace` fail outright
-- ("cannot change return type of existing function"). Everything below is
-- re-created in full afterwards, so nothing of value is lost.
-- ---------------------------------------------------------------------------
do $cleanup$
declare r record;
begin
  -- all RLS policies on NOWERA tables
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('profiles', 'projects', 'project_members', 'tasks', 'task_members', 'events', 'reports')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- all non-internal triggers on NOWERA tables
  for r in select c.relname, t.tgname
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and c.relname in ('profiles', 'projects', 'project_members', 'tasks', 'task_members', 'events', 'reports')
             and not t.tgisinternal
  loop
    execute format('drop trigger %I on public.%I', r.tgname, r.relname);
  end loop;

  -- the signup trigger on auth.users — only triggers that call OUR function, whatever they are named
  for r in select t.tgname
           from pg_trigger t
           join pg_proc p on p.oid = t.tgfoid
           join pg_namespace pn on pn.oid = p.pronamespace
           where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
             and pn.nspname = 'public' and p.proname = 'handle_new_user'
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
  end loop;

  -- every overload of NOWERA's own functions (so a changed signature/return type cannot block re-creation)
  for r in select p.oid::regprocedure::text as sig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('is_super_admin', 'is_active_user', 'my_department', 'can_manage_department',
                               'is_project_member', 'can_access_task', 'can_update_task', 'deactivate_member',
                               'reactivate_member', 'change_member_department', 'delete_member_permanently',
                               'assign_project_member', 'assign_task_member', 'remove_project_member',
                               'remove_task_member', 'is_assignable_member', 'handle_new_user', 'guard_profile_privileges',
                               'guard_task_member_updates', 'touch_updated_at', 'list_public_members',
                               'my_profile_phone')
  loop
    begin
      execute 'drop function ' || r.sig;
    exception when dependent_objects_still_exist then
      raise notice 'Kept % (still referenced by an object outside NOWERA); it will be replaced in place.', r.sig;
    end;
  end loop;
end
$cleanup$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true); $$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true); $$;

-- Remove a person from the active directory without destroying audit history.
-- Security-definer avoids silent zero-row UPDATEs caused by policy/schema drift;
-- authorization is re-checked inside the function on every call.
create or replace function public.deactivate_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Member id is required' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own account' using errcode = '42501';
  end if;

  select * into target from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if target.role = 'super_admin' then
    raise exception 'A super admin account cannot be removed from this panel' using errcode = '42501';
  end if;
  if not public.is_super_admin() and not (
    target.role = 'member'
    and exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.is_active = true
        and actor.role = 'department_admin' and actor.department = target.department
    )
  ) then
    raise exception 'Only the super admin or the target department admin can remove this member' using errcode = '42501';
  end if;

  -- Idempotent: repeated requests leave an already deactivated account unchanged.
  if not target.is_active then
    return;
  end if;

  update public.profiles set is_active = false where id = p_user_id;
  if not found then
    raise exception 'Member state could not be updated' using errcode = 'P0001';
  end if;

  -- Their unanswered requests are noise for managers now; approved history stays.
  delete from public.project_members where user_id = p_user_id and status = 'pending';
  delete from public.task_members where user_id = p_user_id and status = 'pending';
end;
$$;

-- Bring a deactivated member back. Same scope rules as deactivate_member.
create or replace function public.reactivate_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if target.role = 'super_admin' then raise exception 'A super admin account cannot be moved from this panel' using errcode = '42501'; end if;
  if not public.is_super_admin() and not (
    target.role = 'member' and exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.is_active = true and actor.role = 'department_admin' and actor.department = target.department
    )
  ) then
    raise exception 'Only the super admin or the target department admin can restore this member' using errcode = '42501';
  end if;
  if target.is_active then return; end if;
  update public.profiles set is_active = true where id = p_user_id;
  if not found then raise exception 'Member state could not be updated' using errcode = 'P0001'; end if;
end;
$$;

-- The super admin can move a member to another division.
-- A department admin loses the admin role when moved, because that role is scoped to one division.
create or replace function public.change_member_department(p_user_id uuid, p_department text)
returns void language plpgsql security definer set search_path = public
as $$
declare target public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.is_super_admin() then raise exception 'Only the super admin can move members between departments' using errcode = '42501'; end if;
  if p_department not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen') then raise exception 'Unknown department' using errcode = '22023'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if target.role = 'super_admin' then raise exception 'A super admin account cannot be moved from this panel' using errcode = '42501'; end if;
  if target.department = p_department then return; end if;
  update public.profiles
  set department = p_department,
      role = case when target.role = 'department_admin' then 'member' else target.role end
  where id = p_user_id;
  if not found then raise exception 'Member state could not be updated' using errcode = 'P0001'; end if;
end;
$$;

-- v1.4: PERMANENT removal (super admin only, and only for an already deactivated member).
-- Deleting the Auth user frees the phone number so the person may register again.
-- Records the member created (projects / tasks / events) are handed to the acting
-- super admin so nothing is lost; approvals/reviews they made are detached; reports
-- they filed are deleted with them (ON DELETE CASCADE).
create or replace function public.delete_member_permanently(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.is_super_admin() then raise exception 'Only the super admin can permanently delete a member' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'Member id is required' using errcode = '22023'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove your own account' using errcode = '42501'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if target.role = 'super_admin' then raise exception 'A super admin account cannot be removed from this panel' using errcode = '42501'; end if;
  if target.is_active then raise exception 'Deactivate the member first, then delete permanently' using errcode = '22023'; end if;

  update public.projects set created_by = auth.uid() where created_by = p_user_id;
  update public.tasks    set created_by = auth.uid() where created_by = p_user_id;
  update public.events   set created_by = auth.uid() where created_by = p_user_id;
  update public.project_members set decided_by = null where decided_by = p_user_id;
  update public.task_members    set decided_by = null where decided_by = p_user_id;
  update public.reports set reviewed_by = null where reviewed_by = p_user_id;
  update public.reports set target_admin_id = null where target_admin_id = p_user_id;

  -- profiles.id → auth.users(id) ON DELETE CASCADE, so this removes the profile and memberships too.
  delete from auth.users where id = p_user_id;
  if exists (select 1 from public.profiles where id = p_user_id) then
    -- Fallback if Auth refused the delete: at least remove the profile row itself.
    delete from public.profiles where id = p_user_id;
  end if;
end;
$$;

create or replace function public.my_department()
returns text language sql stable security definer set search_path = public
as $$ select p.department from public.profiles p where p.id = auth.uid() and p.is_active = true limit 1; $$;

create or replace function public.can_manage_department(p_department text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
      and (p.role = 'super_admin' or (p.role = 'department_admin' and p.department = p_department))
  );
$$;

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = p_user_id and pm.status = 'approved')
    and exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active = true);
$$;

-- Managers can directly assign active members without requiring a prior request.
-- These SECURITY DEFINER RPCs enforce the same department scope as the RLS policies.
create or replace function public.assign_project_member(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_department text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select department into project_department from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this project' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and is_active = true and role = 'member') then
    raise exception 'Only an active team member can be assigned' using errcode = '22023';
  end if;
  insert into public.project_members (project_id, user_id, status, decided_by, decided_at)
  values (p_project_id, p_user_id, 'approved', auth.uid(), now())
  on conflict (project_id, user_id) do update
    set status = 'approved', decided_by = auth.uid(), decided_at = now();
end;
$$;

-- v1.4: assigning a task also enrols the member in the task's project when needed,
-- so a manager no longer has to do a separate "add to project" step first
-- (that hidden prerequisite is why the task member picker used to look empty).
create or replace function public.assign_task_member(p_task_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_id_value uuid; project_department text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select t.project_id, p.department into project_id_value, project_department
  from public.tasks t join public.projects p on p.id = t.project_id where t.id = p_task_id;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this task' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and is_active = true and role = 'member') then
    raise exception 'Only an active team member can be assigned' using errcode = '22023';
  end if;
  insert into public.project_members (project_id, user_id, status, decided_by, decided_at)
  values (project_id_value, p_user_id, 'approved', auth.uid(), now())
  on conflict (project_id, user_id) do update
    set status = 'approved', decided_by = auth.uid(), decided_at = now();
  insert into public.task_members (task_id, user_id, status, decided_by, decided_at)
  values (p_task_id, p_user_id, 'approved', auth.uid(), now())
  on conflict (task_id, user_id) do update
    set status = 'approved', decided_by = auth.uid(), decided_at = now();
end;
$$;

-- Removing is idempotent: removing someone who is already gone is a success, not an error.
create or replace function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_department text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select department into project_department from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this project' using errcode = '42501'; end if;
  delete from public.task_members tm using public.tasks t
  where tm.task_id = t.id and t.project_id = p_project_id and tm.user_id = p_user_id;
  delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_task_member(p_task_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_department text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select p.department into project_department from public.tasks t join public.projects p on p.id = t.project_id where t.id = p_task_id;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this task' using errcode = '42501'; end if;
  delete from public.task_members where task_id = p_task_id and user_id = p_user_id;
end;
$$;

create or replace function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tasks t join public.projects pr on pr.id = t.project_id
    where t.id = p_task_id and (
      public.can_manage_department(pr.department) or public.is_project_member(pr.id, auth.uid())
    )
  );
$$;

create or replace function public.can_update_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_active_user() and (
    exists (select 1 from public.tasks t join public.projects pr on pr.id = t.project_id where t.id = p_task_id and public.can_manage_department(pr.department))
    or exists (select 1 from public.task_members tm where tm.task_id = p_task_id and tm.user_id = auth.uid() and tm.status = 'approved')
  );
$$;

-- v1.4.2: used by the policies below so a manager can assign members through plain table
-- writes even if the API layer cannot see the RPC functions above.
create or replace function public.is_assignable_member(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active = true and p.role = 'member'); $$;

-- Create each profile from the submitted phone metadata (SMS verification is intentionally not used).
-- v1.4: never RAISES. A raise here makes Supabase reject the whole signup (and the
-- Dashboard → Authentication → "Add user" button) with a vague "Database error".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare
  phone_value text;
  dept text;
  display_name text;
begin
  phone_value := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.phone), '')
  );
  -- The web app signs up with the alias phone-98912…@login.nowera.invalid.
  if phone_value is null and new.email ~ '^phone-[0-9]+@login\.nowera\.invalid$' then
    phone_value := '+' || substring(new.email from '^phone-([0-9]+)@');
  end if;
  if phone_value is null then
    phone_value := 'unset-' || new.id::text;   -- e.g. user added by hand in the Supabase dashboard
  end if;

  dept := coalesce(new.raw_user_meta_data ->> 'department', 'Technoplus');
  if dept not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen') then dept := 'Technoplus'; end if;
  display_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'عضو جدید'), 100);
  if char_length(display_name) < 2 then display_name := 'عضو جدید'; end if;

  begin
    insert into public.profiles (id, full_name, phone, department, role, is_active)
    values (new.id, display_name, phone_value, dept, 'member', true)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Same phone already on another profile: keep the signup working with a distinct value.
    insert into public.profiles (id, full_name, phone, department, role, is_active)
    values (new.id, display_name, phone_value || '#' || left(new.id::text, 8), dept, 'member', true)
    on conflict (id) do nothing;
  end;
  -- The owner's number is always the super admin (also if the account is ever re-created).
  if regexp_replace(phone_value, '\D', '', 'g') ~ '9333167279$' then
    update public.profiles set role = 'super_admin', is_active = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nowera on auth.users;
create trigger on_auth_user_created_nowera
after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill auth users that have no profile (legacy Phone provider or the no-SMS email alias).
-- Row by row, so one odd row can never abort the whole script.
do $backfill$
declare
  u record;
  phone_value text;
  dept text;
  display_name text;
begin
  for u in
    select au.* from auth.users au left join public.profiles p on p.id = au.id where p.id is null
  loop
    phone_value := coalesce(nullif(trim(u.raw_user_meta_data ->> 'phone'), ''), nullif(trim(u.phone), ''));
    if phone_value is null and u.email ~ '^phone-[0-9]+@login\.nowera\.invalid$' then
      phone_value := '+' || substring(u.email from '^phone-([0-9]+)@');
    end if;
    if phone_value is null then continue; end if;   -- not a NOWERA account (no phone anywhere): leave it alone
    dept := coalesce(u.raw_user_meta_data ->> 'department', 'Technoplus');
    if dept not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen') then dept := 'Technoplus'; end if;
    display_name := left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'عضو جدید'), 100);
    if char_length(display_name) < 2 then display_name := 'عضو جدید'; end if;
    begin
      insert into public.profiles (id, full_name, phone, department, role, is_active)
      values (u.id, display_name, phone_value, dept, 'member', true) on conflict (id) do nothing;
    exception when unique_violation then
      insert into public.profiles (id, full_name, phone, department, role, is_active)
      values (u.id, display_name, phone_value || '#' || left(u.id::text, 8), dept, 'member', true) on conflict (id) do nothing;
    end;
  end loop;
end
$backfill$;

-- Prevent a user from self-promoting or changing their phone/section.
-- A department admin may only deactivate/restore a normal member in their own department.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;

  -- Keep an already-authorized super-admin from demoting/deactivating itself.
  -- Admin profiles can only be changed through trusted database administration.
  if old.role = 'super_admin' then
    if auth.uid() = old.id then
      new.role := old.role;
      new.department := old.department;
      new.phone := old.phone;
      new.is_active := old.is_active;
      return new;
    end if;
    raise exception 'Super-admin profiles cannot be modified through the application';
  end if;

  if auth.uid() <> old.id and public.is_super_admin() and new.role = 'super_admin' then
    raise exception 'A second super-admin cannot be assigned through the application';
  end if;

  if auth.uid() = old.id and not public.is_super_admin() then
    new.role := old.role;
    new.department := old.department;
    new.phone := old.phone;
    new.is_active := old.is_active;
  elsif auth.uid() <> old.id and not public.is_super_admin() then
    if not (
      old.role = 'member'
      and public.can_manage_department(old.department)
      and new.id = old.id
      and new.role = old.role
      and new.department = old.department
      and new.phone = old.phone
    ) then
      raise exception 'Insufficient privileges to change this profile';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges_trigger on public.profiles;
create trigger guard_profile_privileges_trigger before update on public.profiles
for each row execute procedure public.guard_profile_privileges();

-- Keep timestamps fresh after edits.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects for each row execute procedure public.touch_updated_at();

-- Task assignees may update progress/status only; task details remain manager-controlled.
create or replace function public.guard_task_member_updates()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  task_department text;
begin
  if auth.uid() is null then return new; end if;
  select p.department into task_department
  from public.projects p where p.id = old.project_id;
  if not public.can_manage_department(task_department) then
    if not exists (select 1 from public.task_members tm where tm.task_id = old.id and tm.user_id = auth.uid() and tm.status = 'approved') then
      raise exception 'Only approved task members can update task progress';
    end if;
    new.project_id := old.project_id;
    new.title := old.title;
    new.description := old.description;
    new.priority := old.priority;
    new.due_date := old.due_date;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_guard_member_updates on public.tasks;
create trigger tasks_guard_member_updates before update on public.tasks for each row execute procedure public.guard_task_member_updates();

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at before update on public.tasks for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_members enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;

-- Profiles / members directory
drop policy if exists "active users can view active directory" on public.profiles;
create policy "active users can view active directory" on public.profiles
for select to authenticated using (
  id = auth.uid()
  or public.can_manage_department(department)
  or (
    public.is_active_user() and is_active = true and (
      public.is_super_admin()
      or department = public.my_department()
      or exists (
        select 1 from public.project_members pm
        join public.projects pr on pr.id = pm.project_id
        where pm.user_id = profiles.id and public.can_manage_department(pr.department)
      )
      or exists (
        select 1 from public.task_members tm
        join public.tasks t on t.id = tm.task_id
        join public.projects pr on pr.id = t.project_id
        where tm.user_id = profiles.id and public.can_manage_department(pr.department)
      )
    )
  )
);
drop policy if exists "users edit own public profile" on public.profiles;
create policy "users edit own public profile" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_super_admin() or (role = 'member' and public.can_manage_department(department)))
with check (id = auth.uid() or public.is_super_admin() or (role = 'member' and public.can_manage_department(department)));
-- Profiles are intentionally deactivated through the guarded RPC; direct DELETE is not part of the client API.
drop policy if exists "super admin can delete profiles" on public.profiles;

-- Projects are discoverable to active members so people can request to join.
drop policy if exists "active users view projects" on public.projects;
create policy "active users view projects" on public.projects
for select to authenticated using (public.is_active_user());
drop policy if exists "department admins create projects" on public.projects;
create policy "department admins create projects" on public.projects
for insert to authenticated with check (public.can_manage_department(department) and created_by = auth.uid());
drop policy if exists "department admins update projects" on public.projects;
create policy "department admins update projects" on public.projects
for update to authenticated using (public.can_manage_department(department)) with check (public.can_manage_department(department));
drop policy if exists "department admins delete projects" on public.projects;
create policy "department admins delete projects" on public.projects
for delete to authenticated using (public.can_manage_department(department));

-- Project participation: own requests are pending only; only managers decide.
drop policy if exists "view own or managed project requests" on public.project_members;
create policy "view own or managed project requests" on public.project_members
for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department))
  or (status = 'approved' and public.is_active_user())
);
drop policy if exists "request to join a project" on public.project_members;
create policy "request to join a project" on public.project_members
for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and public.is_active_user());
drop policy if exists "managers decide project requests" on public.project_members;
create policy "managers decide project requests" on public.project_members
for update to authenticated using (exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department)));
drop policy if exists "managers remove project participants" on public.project_members;
create policy "managers remove project participants" on public.project_members
for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department)) or user_id = auth.uid());

-- Tasks are available only to approved project members and the department's admins.
drop policy if exists "project members and managers view tasks" on public.tasks;
create policy "project members and managers view tasks" on public.tasks
for select to authenticated using (public.can_access_task(id));
drop policy if exists "department admins create tasks" on public.tasks;
create policy "department admins create tasks" on public.tasks
for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department))
);
drop policy if exists "project members and managers update tasks" on public.tasks;
create policy "project members and managers update tasks" on public.tasks
for update to authenticated using (public.can_update_task(id)) with check (public.can_update_task(id));
drop policy if exists "department admins delete tasks" on public.tasks;
create policy "department admins delete tasks" on public.tasks
for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department)));

drop policy if exists "view own or managed task requests" on public.task_members;
create policy "view own or managed task requests" on public.task_members
for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.can_manage_department(p.department))
  or exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid()))
);
drop policy if exists "approved project members request tasks" on public.task_members;
create policy "approved project members request tasks" on public.task_members
for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending'
  and exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid()))
);
drop policy if exists "managers decide task requests" on public.task_members;
create policy "managers decide task requests" on public.task_members
for update to authenticated using (
  exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.can_manage_department(p.department))
) with check (
  exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.can_manage_department(p.department))
);
drop policy if exists "managers or users remove task requests" on public.task_members;
create policy "managers or users remove task requests" on public.task_members
for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.can_manage_department(p.department))
);


-- v1.4.2: managers may enrol an ACTIVE team member directly (same rule the assign_* RPCs enforce).
-- Members still cannot approve themselves: their own insert policy only allows status = 'pending'.
drop policy if exists "managers assign project participants" on public.project_members;
create policy "managers assign project participants" on public.project_members
for insert to authenticated with check (
  public.is_assignable_member(user_id)
  and exists (select 1 from public.projects p where p.id = project_id and public.can_manage_department(p.department))
);
drop policy if exists "managers assign task participants" on public.task_members;
create policy "managers assign task participants" on public.task_members
for insert to authenticated with check (
  public.is_assignable_member(user_id)
  and exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.can_manage_department(p.department))
);

-- Separate calendars, scoped for writes to the appropriate department admin.
drop policy if exists "active users view events" on public.events;
create policy "active users view events" on public.events
for select to authenticated using (public.is_active_user());
drop policy if exists "department admins create events" on public.events;
create policy "department admins create events" on public.events
for insert to authenticated with check (public.can_manage_department(department) and created_by = auth.uid());
drop policy if exists "department admins update events" on public.events;
create policy "department admins update events" on public.events
for update to authenticated using (public.can_manage_department(department)) with check (public.can_manage_department(department));
drop policy if exists "department admins delete events" on public.events;
create policy "department admins delete events" on public.events
for delete to authenticated using (public.can_manage_department(department));

-- Reports are private to reporter and main admin; local admins cannot read complaints about themselves.
drop policy if exists "reporter and super admin view reports" on public.reports;
create policy "reporter and super admin view reports" on public.reports
for select to authenticated using (reporter_id = auth.uid() or public.is_super_admin());
drop policy if exists "active users submit reports" on public.reports;
create policy "active users submit reports" on public.reports
for insert to authenticated with check (reporter_id = auth.uid() and public.is_active_user());
drop policy if exists "super admin reviews reports" on public.reports;
create policy "super admin reviews reports" on public.reports
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "super admin deletes reports" on public.reports;
create policy "super admin deletes reports" on public.reports
for delete to authenticated using (public.is_super_admin());

-- Restrict table access to authenticated sessions; all authorization remains in RLS.
grant usage on schema public to anon, authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_members to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
revoke delete on public.profiles from authenticated, anon;

-- Helper functions used inside RLS policies must be executable by the signed-in role.
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.my_department() from public, anon;
revoke execute on function public.can_manage_department(text) from public, anon;
revoke execute on function public.is_project_member(uuid, uuid) from public, anon;
revoke execute on function public.can_access_task(uuid) from public, anon;
revoke execute on function public.can_update_task(uuid) from public, anon;
revoke execute on function public.is_assignable_member(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_department() to authenticated;
grant execute on function public.can_manage_department(text) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.can_access_task(uuid) to authenticated;
grant execute on function public.can_update_task(uuid) to authenticated;
grant execute on function public.is_assignable_member(uuid) to authenticated;

-- RPCs called by the web app: signed-in users only (authorization is re-checked inside each function).
revoke all on function public.deactivate_member(uuid) from public, anon, authenticated;
revoke all on function public.reactivate_member(uuid) from public, anon, authenticated;
revoke all on function public.change_member_department(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_member_permanently(uuid) from public, anon, authenticated;
revoke all on function public.assign_project_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.assign_task_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_project_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_task_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.deactivate_member(uuid) to authenticated;
grant execute on function public.reactivate_member(uuid) to authenticated;
grant execute on function public.change_member_department(uuid, text) to authenticated;
grant execute on function public.delete_member_permanently(uuid) to authenticated;
grant execute on function public.assign_project_member(uuid, uuid) to authenticated;
grant execute on function public.assign_task_member(uuid, uuid) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
grant execute on function public.remove_task_member(uuid, uuid) to authenticated;

-- Public landing-page directory: deliberately omits phone numbers and other private fields.
create or replace function public.list_public_members()
returns table (id uuid, full_name text, department text, role text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.department, p.role, p.created_at
  from public.profiles p
  where p.is_active = true
  order by p.created_at desc
  limit 60;
$$;
grant execute on function public.list_public_members() to anon, authenticated;

-- Keep phone numbers private. Authenticated clients can read directory fields only;
-- an RPC exposes the phone number to its owner alone (for their profile settings).
create or replace function public.my_profile_phone()
returns text language sql stable security definer set search_path = public
as $$ select p.phone from public.profiles p where p.id = auth.uid() and p.is_active = true limit 1; $$;
revoke select on table public.profiles from authenticated;
grant select (id, full_name, department, role, is_active, avatar_url, created_at) on public.profiles to authenticated;
grant execute on function public.my_profile_phone() to authenticated;

-- Owner account: 0933 316 7279 is the super admin (matches +98…, 98… and 0… spellings).
update public.profiles
set role = 'super_admin', is_active = true
where regexp_replace(coalesce(phone, ''), '\D', '', 'g') ~ '9333167279$';

revoke execute on function public.my_profile_phone() from public, anon;

-- Make PostgREST (the Supabase Data API) notice the new/changed functions immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- FINAL CHECKLIST — the result of this last statement is what the SQL Editor shows.
-- Every row must say OK. Rows that say MISSING are listed first.
-- (The same query is saved as supabase/verify.sql so you can re-run it any time.)
-- ---------------------------------------------------------------------------
with checks(area, item, ok) as (
  select 'table', t, to_regclass('public.' || t) is not null
    from unnest(array['profiles','projects','project_members','tasks','task_members','events','reports']) t
  union all
  select 'column', c, exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = split_part(c, '.', 1) and column_name = split_part(c, '.', 2))
    from unnest(array['profiles.is_active','profiles.role','profiles.avatar_url','projects.created_by','tasks.created_by',
                      'project_members.decided_by','project_members.decided_at','task_members.decided_by','task_members.decided_at']) c
  union all
  select 'rpc (exists + executable by signed-in users)', f,
         to_regprocedure('public.' || f) is not null and has_function_privilege('authenticated', 'public.' || f, 'execute')
    from unnest(array['deactivate_member(uuid)','reactivate_member(uuid)','change_member_department(uuid,text)',
                      'delete_member_permanently(uuid)','assign_project_member(uuid,uuid)','assign_task_member(uuid,uuid)',
                      'remove_project_member(uuid,uuid)','remove_task_member(uuid,uuid)','my_profile_phone()','list_public_members()']) f
  union all
  select 'rls helper (executable by signed-in users)', f,
         to_regprocedure('public.' || f) is not null and has_function_privilege('authenticated', 'public.' || f, 'execute')
    from unnest(array['is_super_admin()','is_active_user()','my_department()','can_manage_department(text)',
                      'is_project_member(uuid,uuid)','can_access_task(uuid)','can_update_task(uuid)','is_assignable_member(uuid)']) f
  union all
  select 'row level security', t, coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.' || t)), false)
    from unnest(array['profiles','projects','project_members','tasks','task_members','events','reports']) t
  union all
  select 'policies exist', t, (select count(*) from pg_policies where schemaname = 'public' and tablename = t) > 0
    from unnest(array['profiles','projects','project_members','tasks','task_members','events','reports']) t
  union all
  select 'unique index (needed by assign RPCs)', i, to_regclass('public.' || i) is not null
    from unnest(array['project_members_project_user_uidx','task_members_task_user_uidx']) i
  union all
  select 'trigger', 'signup → profile (auth.users)',
         exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created_nowera')
  union all
  select 'trigger', 'profile privilege guard',
         exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'guard_profile_privileges_trigger')
  union all
  select 'data', 'at least one active super admin',
         exists (select 1 from public.profiles where role = 'super_admin' and is_active)
  union all
  select 'data', 'owner phone 09333167279 is super admin',
         exists (select 1 from public.profiles where role = 'super_admin' and is_active
                 and regexp_replace(coalesce(phone, ''), '\D', '', 'g') ~ '9333167279$')
  union all
  select 'data', 'every NOWERA auth user has a profile',
         not exists (select 1 from auth.users u left join public.profiles p on p.id = u.id
                     where p.id is null and (u.raw_user_meta_data ? 'phone' or u.email like 'phone-%@login.nowera.invalid'))
)
select area, item, case when ok then 'OK' else 'MISSING  <<<' end as status
from checks
order by ok, area, item;
