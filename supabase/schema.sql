-- NOWERA Management · Supabase / PostgreSQL bootstrap
-- Run this file in Supabase SQL Editor using the project owner. Re-running it is supported.
-- New signups never receive admin privileges from submitted phone metadata; bootstrap the first super-admin through trusted SQL.

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

create index if not exists projects_department_idx on public.projects(department, created_at desc);
create index if not exists project_members_user_status_idx on public.project_members(user_id, status);
create index if not exists tasks_project_idx on public.tasks(project_id, status, due_date);
create index if not exists task_members_user_status_idx on public.task_members(user_id, status);
create index if not exists events_department_date_idx on public.events(department, event_date);
create index if not exists reports_created_idx on public.reports(created_at desc);

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

  select * into target
  from public.profiles
  where id = p_user_id
  for update;

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
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.role = 'department_admin'
        and actor.department = target.department
    )
  ) then
    raise exception 'Only the super admin or the target department admin can remove this member' using errcode = '42501';
  end if;

  -- Idempotent: repeated requests leave an already deactivated account unchanged.
  if not target.is_active then
    return;
  end if;

  update public.profiles
  set is_active = false
  where id = p_user_id;

  if not found then
    raise exception 'Member state could not be updated' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.deactivate_member(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_member(uuid) to authenticated;

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
  if not public.is_project_member(project_id_value, p_user_id) then
    raise exception 'The member must be an approved project participant first' using errcode = '42501';
  end if;
  insert into public.task_members (task_id, user_id, status, decided_by, decided_at)
  values (p_task_id, p_user_id, 'approved', auth.uid(), now())
  on conflict (task_id, user_id) do update
    set status = 'approved', decided_by = auth.uid(), decided_at = now();
end;
$$;

create or replace function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_department text; affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select department into project_department from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this project' using errcode = '42501'; end if;
  delete from public.task_members tm using public.tasks t
  where tm.task_id = t.id and t.project_id = p_project_id and tm.user_id = p_user_id;
  delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Project membership not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.remove_task_member(p_task_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare project_department text; affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select p.department into project_department from public.tasks t join public.projects p on p.id = t.project_id where t.id = p_task_id;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  if not public.can_manage_department(project_department) then raise exception 'You cannot manage this task' using errcode = '42501'; end if;
  delete from public.task_members where task_id = p_task_id and user_id = p_user_id;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Task membership not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.assign_project_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.assign_task_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_project_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_task_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_project_member(uuid, uuid) to authenticated;
grant execute on function public.assign_task_member(uuid, uuid) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
grant execute on function public.remove_task_member(uuid, uuid) to authenticated;


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

-- Create each profile from the submitted phone metadata (SMS verification is intentionally not used).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare
  digits text;
  phone_value text;
  dept text;
begin
  -- The web app authenticates with an internal email alias to avoid SMS.
  -- The actual phone is carried in Auth user metadata and stored in profiles.
  phone_value := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.phone), '')
  );
  digits := regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g');
  if phone_value is null or digits = '' then
    raise exception 'NOWERA signup requires phone metadata';
  end if;
  dept := coalesce(new.raw_user_meta_data ->> 'department', 'Technoplus');
  if dept not in ('Lumen', 'Atlas', 'Technoplus', 'Horizen') then dept := 'Technoplus'; end if;

  insert into public.profiles (id, full_name, phone, department, role, is_active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'عضو جدید'),
    phone_value,
    dept,
    'member',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nowera on auth.users;
create trigger on_auth_user_created_nowera
after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill existing users that have a real phone either in Auth's phone field
-- (legacy Phone provider) or in user metadata (NOWERA's no-SMS email alias).
insert into public.profiles (id, full_name, phone, department, role, is_active)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'عضو جدید'),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'phone'), ''), u.phone),
  case
    when u.raw_user_meta_data ->> 'department' in ('Lumen', 'Atlas', 'Technoplus', 'Horizen')
      then u.raw_user_meta_data ->> 'department'
    else 'Technoplus'
  end,
  'member',
  true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and regexp_replace(coalesce(nullif(trim(u.raw_user_meta_data ->> 'phone'), ''), u.phone, ''), '[^0-9]', '', 'g') <> ''
on conflict (id) do nothing;

-- Prevent a user from self-promoting or changing their phone/section.
-- A department admin may only deactivate a normal member in their own department.
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
      and new.is_active = false
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

-- Intentionally do not assign or repair administrator roles based on phone metadata.
-- Re-running this schema preserves roles already assigned by a trusted administrator.
-- For a fresh instance, create the account, verify its identity out-of-band, then promote
-- its exact profile UUID manually in SQL Editor (see README.md).

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
grant usage on schema public to authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_members to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.reports to authenticated;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_department() to authenticated;
grant execute on function public.can_manage_department(text) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.can_access_task(uuid) to authenticated;
grant execute on function public.can_update_task(uuid) to authenticated;
revoke delete on public.profiles from authenticated, anon;

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
