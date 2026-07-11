-- Unicode article slugs and one-hop SEO redirects.
alter table public.articles add column if not exists body_json jsonb;
alter table public.articles add column if not exists body_html text;
alter table public.articles drop constraint if exists articles_slug_check;
alter table public.articles add constraint articles_slug_unicode_check check (
  char_length(slug) between 1 and 120 and slug !~ '[[:space:][:cntrl:]/?#%]' and
  slug !~ '(^-|-$)'
);
create unique index if not exists articles_slug_lower_unique on public.articles (lower(slug));

create table if not exists public.article_slug_redirects (
  old_slug text primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.article_slug_redirects enable row level security;
grant select on public.article_slug_redirects to anon, authenticated, service_role;
grant insert, update, delete on public.article_slug_redirects to service_role;
drop policy if exists "public reads article slug redirects" on public.article_slug_redirects;
create policy "public reads article slug redirects" on public.article_slug_redirects for select using (true);
