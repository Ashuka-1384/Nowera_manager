-- NOWERA · read-only health check. Safe to run any time in Supabase → SQL Editor.
-- Every row must say OK. ("at least one active super admin" is MISSING until you promote your account — see README.)

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
  select 'data', 'every NOWERA auth user has a profile',
         not exists (select 1 from auth.users u left join public.profiles p on p.id = u.id
                     where p.id is null and (u.raw_user_meta_data ? 'phone' or u.email like 'phone-%@login.nowera.invalid'))
)
select area, item, case when ok then 'OK' else 'MISSING  <<<' end as status
from checks
order by ok, area, item;
