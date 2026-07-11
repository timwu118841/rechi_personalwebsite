create extension if not exists pgcrypto;

create table if not exists public.content_types (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 180),
  display_order integer not null default 100 check (display_order >= 0),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  site_title text not null check (char_length(site_title) between 1 and 80),
  short_title text not null check (char_length(short_title) between 1 and 30),
  site_description text not null check (char_length(site_description) between 20 and 180),
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_role text not null check (char_length(author_role) between 1 and 80),
  author_bio text not null check (char_length(author_bio) between 20 and 600),
  author_image jsonb,
  default_social_image jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 20 and 180),
  body_markdown text not null check (char_length(body_markdown) > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  published_at timestamptz not null,
  content_type_slug text not null references public.content_types(slug) on update cascade,
  category_slug text not null references public.categories(slug) on update cascade,
  tags text[] not null default '{}',
  featured boolean not null default false,
  cover jsonb,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 180),
  canonical_url text,
  privacy_reviewed boolean not null default false,
  legal_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (privacy_reviewed and legal_reviewed)),
  check (cover is null or (cover ? 'url' and cover ? 'alt' and cover ? 'width' and cover ? 'height'))
);

create index if not exists articles_publication_idx
  on public.articles (status, published_at desc);
create index if not exists articles_category_idx
  on public.articles (category_slug, status, published_at desc);
create index if not exists articles_tags_idx on public.articles using gin (tags);

alter table public.articles enable row level security;
alter table public.categories enable row level security;
alter table public.content_types enable row level security;
alter table public.site_settings enable row level security;

-- Tables created by a migration executed as `postgres` do not automatically
-- grant table privileges to the roles used by the Supabase API.  Keep these
-- grants explicit so both the public reader and the server-side service role
-- can access the content tables.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.articles, public.categories, public.content_types, public.site_settings
  to anon, authenticated, service_role;
grant insert, update, delete on public.articles, public.categories, public.content_types, public.site_settings
  to service_role;

drop policy if exists "public reads eligible articles" on public.articles;
create policy "public reads eligible articles" on public.articles for select
  using (status = 'published' and published_at <= now());
drop policy if exists "public reads visible categories" on public.categories;
create policy "public reads visible categories" on public.categories for select using (visible);
drop policy if exists "public reads content types" on public.content_types;
create policy "public reads content types" on public.content_types for select using (true);
drop policy if exists "public reads site settings" on public.site_settings;
create policy "public reads site settings" on public.site_settings for select using (true);

insert into public.content_types (slug, name, description) values
  ('legal-articles', '法律文章', '整理法律實務經驗、制度與工作方法。')
on conflict (slug) do nothing;

insert into public.categories (slug, name, description, display_order, visible) values
  ('legal-practice', '法律實務', '從契約、爭議與日常法律工作中整理可帶走的判斷方法。', 10, true),
  ('experience', '經驗分享', '記錄法律工作與職涯現場的觀察。', 20, true),
  ('work-methods', '工作方法', '整理溝通、研究與決策流程。', 30, true)
on conflict (slug) do nothing;

insert into public.site_settings (
  id, site_title, short_title, site_description, author_name, author_role, author_bio,
  default_social_image
) values (
  1,
  '法律實務筆記',
  '法律筆記',
  '從實務現場出發，記錄法律工作、制度觀察與日常生活中的法律思考。',
  'Rechi',
  '法律實務工作者',
  '持續整理法律實務經驗，讓複雜的法律問題更容易被理解。',
  '{"url":"/social-card.svg","alt":"法律實務筆記預設分享圖片","width":1200,"height":630}'::jsonb
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
