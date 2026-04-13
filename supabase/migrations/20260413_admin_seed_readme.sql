-- ─────────────────────────────────────────────────────────────────────────
-- ADMIN ROLE SETUP
-- Run this in Supabase SQL Editor AFTER creating accounts via seed-admins.ts
-- OR use this to promote any existing user to admin manually.
-- ─────────────────────────────────────────────────────────────────────────

-- Promote zencralabs@gmail.com to admin
update public.profiles
set role = 'admin', plan = 'Agency', credits = 99999, updated_at = now()
where id = (
  select id from auth.users where email = 'zencralabs@gmail.com' limit 1
);

-- Promote iamjuzjai@gmail.com to admin
update public.profiles
set role = 'admin', plan = 'Agency', credits = 99999, updated_at = now()
where id = (
  select id from auth.users where email = 'iamjuzjai@gmail.com' limit 1
);

-- Verify
select p.id, u.email, p.role, p.plan, p.credits
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
