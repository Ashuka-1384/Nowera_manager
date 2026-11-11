-- NOWERA · who is who. Read-only. Shows every account with the number it was registered with,
-- so you can see which row is yours and whether it is the owner (is_owner = true → super admin).
select p.full_name,
       p.role,
       p.is_active,
       p.department,
       p.phone,
       u.email as login_alias,
       public.is_owner_account(p.id) as is_owner
from public.profiles p
left join auth.users u on u.id = p.id
order by public.is_owner_account(p.id) desc, p.created_at;
