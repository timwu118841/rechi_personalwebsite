-- Article slugs are restricted to lowercase English letters, digits and hyphens.
--
-- The existing `is_valid_article_slug` check still accepts legacy unicode slugs,
-- so rows that already exist keep working. The trigger below only validates the
-- canonical `articles.slug` when it is inserted or changed; working copies,
-- candidates and redirects may still carry a legacy slug bound to an existing
-- article, and editing unrelated columns must not fail.

create or replace function public.is_english_article_slug(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    value is not null
    and char_length(value) between 1 and 120
    and value ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
$$;

create or replace function public.enforce_english_article_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.is_english_article_slug(new.slug) then
    raise exception '網址代稱只能使用小寫英文字母、數字與連字號。' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists articles_slug_english on public.articles;
create trigger articles_slug_english
before insert or update of slug on public.articles
for each row execute function public.enforce_english_article_slug();

