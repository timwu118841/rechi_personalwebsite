-- Unicode article slugs and one-hop SEO redirects.
alter table public.articles drop constraint if exists articles_slug_check;
alter table public.articles add constraint articles_slug_unicode_check check (
  char_length(slug) between 1 and 120 and slug !~ '[[:space:][:cntrl:]/?#%]' and
  slug !~ '(^-|-$)' and translate(slug, U&'\200B\200C\200D\2060\FEFF', '') = slug
);
create unique index if not exists articles_slug_lower_unique on public.articles (lower(slug));

create table if not exists public.article_slug_redirects (
  old_slug text primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint article_slug_redirects_old_slug_check check (
    char_length(old_slug) between 1 and 120 and
    old_slug !~ '[[:space:][:cntrl:]/?#%]' and
    old_slug !~ '(^-|-$)' and translate(old_slug, U&'\200B\200C\200D\2060\FEFF', '') = old_slug
  )
);
alter table public.article_slug_redirects enable row level security;
grant select on public.article_slug_redirects to anon, authenticated, service_role;
grant insert, update, delete on public.article_slug_redirects to service_role;
drop policy if exists "public reads article slug redirects" on public.article_slug_redirects;
create policy "public reads article slug redirects" on public.article_slug_redirects for select using (true);
