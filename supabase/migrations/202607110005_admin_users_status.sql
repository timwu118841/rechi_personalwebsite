-- Extend the server-managed administrator membership with explicit lifecycle
-- state and a normalized identity key. This migration is additive and safe to
-- apply after 202607110004_admin_users.sql.
alter table public.admin_users
  add column if not exists is_active boolean not null default true,
  add column if not exists display_name text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

-- Existing rows use user_id as their Auth identity. Keep that relationship
-- intact while allowing future provisioning to record auth_user_id explicitly.
update public.admin_users
set auth_user_id = user_id
where auth_user_id is null;

create unique index if not exists admin_users_normalized_email_key
  on public.admin_users (lower(btrim(email)));

create unique index if not exists admin_users_auth_user_id_key
  on public.admin_users (auth_user_id)
  where auth_user_id is not null;

alter table public.admin_users
  drop constraint if exists admin_users_email_normalized,
  add constraint admin_users_email_normalized
    check (email = lower(btrim(email)));

comment on column public.admin_users.is_active is
  'Whether this account may access the admin API; revocation is fail-closed.';
comment on column public.admin_users.auth_user_id is
  'Optional explicit Supabase Auth identity; user_id remains supported for legacy rows.';
