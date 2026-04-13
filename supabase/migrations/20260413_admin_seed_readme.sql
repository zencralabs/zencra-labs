-- ─────────────────────────────────────────────────────────────────────────
-- ACCOUNT ROLE SETUP
-- zencralabs@gmail.com → admin  (hub dashboard, all data)
-- iamjuzjai@gmail.com  → user   (member dashboard, test account)
--
-- Run in Supabase SQL Editor after both accounts have signed up.
-- ─────────────────────────────────────────────────────────────────────────

-- zencralabs@gmail.com = THE admin
update public.profiles
set role = 'admin', plan = 'pro', credits = 99999, updated_at = now()
where id = (
  select id from auth.users where email = 'zencralabs@gmail.com' limit 1
);

-- iamjuzjai@gmail.com = member/test account (regular user)
update public.profiles
set role = 'user', plan = 'pro', credits = 500, updated_at = now()
where id = (
  select id from auth.users where email = 'iamjuzjai@gmail.com' limit 1
);

-- Verify both
select u.email, p.role, p.plan, p.credits
from public.profiles p
join auth.users u on u.id = p.id
where u.email in ('zencralabs@gmail.com', 'iamjuzjai@gmail.com');
