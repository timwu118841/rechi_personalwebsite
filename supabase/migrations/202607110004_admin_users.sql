-- Server-managed administrator membership. Provision rows only after the
-- corresponding Supabase Auth user has been created.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- The browser must never be able to enumerate administrator membership.
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to service_role;
grant insert, update, delete on public.admin_users to service_role;

