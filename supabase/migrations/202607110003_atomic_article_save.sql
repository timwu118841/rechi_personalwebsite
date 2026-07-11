-- Keep article writes and redirect history in one transaction.
create or replace function public.save_article(
  p_article_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_body_markdown text,
  p_body_json jsonb,
  p_body_html text,
  p_status text,
  p_published_at timestamptz,
  p_content_type_slug text,
  p_category_slug text,
  p_tags text[],
  p_featured boolean,
  p_cover jsonb,
  p_seo_title text,
  p_seo_description text,
  p_canonical_url text,
  p_privacy_reviewed boolean,
  p_legal_reviewed boolean
)
returns public.articles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article public.articles%rowtype;
  v_old_slug text;
  v_redirect_owner uuid;
  v_lock_a text;
  v_lock_b text;
begin
  if not public.is_valid_article_slug(p_slug) then
    raise exception '網址代稱不可為空。' using errcode = '22023', detail = 'slug';
  end if;

  if p_body_json is not null and p_body_html is null then
    raise exception '富編輯器文章必須先產生 HTML。' using errcode = '22023', detail = 'body_html';
  end if;

  if p_article_id is not null then
    select slug
      into v_old_slug
      from public.articles
     where id = p_article_id
     for update;
    if not found then
      raise exception '找不到文章。' using errcode = 'P0002';
    end if;
  end if;

  v_lock_a := lower(p_slug);
  v_lock_b := case when v_old_slug is not null and v_old_slug <> p_slug then lower(v_old_slug) else null end;
  if v_lock_b is null or v_lock_a = v_lock_b then
    perform pg_advisory_xact_lock(hashtext(v_lock_a), 0);
  elsif v_lock_a < v_lock_b then
    perform pg_advisory_xact_lock(hashtext(v_lock_a), 0);
    perform pg_advisory_xact_lock(hashtext(v_lock_b), 0);
  else
    perform pg_advisory_xact_lock(hashtext(v_lock_b), 0);
    perform pg_advisory_xact_lock(hashtext(v_lock_a), 0);
  end if;

  if exists (
    select 1
      from public.article_slug_redirects
     where old_slug = p_slug
  ) then
    raise exception '網址代稱已被使用，請更換後再儲存。' using errcode = '23505', detail = 'slug';
  end if;

  if exists (
    select 1
      from public.articles
     where lower(slug) = lower(p_slug)
       and (p_article_id is null or id <> p_article_id)
  ) then
    raise exception '網址代稱已被使用，請更換後再儲存。' using errcode = '23505', detail = 'slug';
  end if;

  if p_article_id is null then
    insert into public.articles (
      slug,
      title,
      description,
      body_markdown,
      body_json,
      body_html,
      status,
      published_at,
      content_type_slug,
      category_slug,
      tags,
      featured,
      cover,
      seo_title,
      seo_description,
      canonical_url,
      privacy_reviewed,
      legal_reviewed,
      updated_at
    ) values (
      p_slug,
      p_title,
      p_description,
      p_body_markdown,
      p_body_json,
      p_body_html,
      p_status,
      p_published_at,
      p_content_type_slug,
      p_category_slug,
      coalesce(p_tags, '{}'::text[]),
      coalesce(p_featured, false),
      p_cover,
      p_seo_title,
      p_seo_description,
      p_canonical_url,
      coalesce(p_privacy_reviewed, false),
      coalesce(p_legal_reviewed, false),
      now()
    )
    returning * into v_article;
  else
    update public.articles
       set slug = p_slug,
           title = p_title,
           description = p_description,
           body_markdown = p_body_markdown,
           body_json = p_body_json,
           body_html = p_body_html,
           status = p_status,
           published_at = p_published_at,
           content_type_slug = p_content_type_slug,
           category_slug = p_category_slug,
           tags = coalesce(p_tags, '{}'::text[]),
           featured = coalesce(p_featured, false),
           cover = p_cover,
           seo_title = p_seo_title,
           seo_description = p_seo_description,
           canonical_url = p_canonical_url,
           privacy_reviewed = coalesce(p_privacy_reviewed, false),
           legal_reviewed = coalesce(p_legal_reviewed, false),
           updated_at = now()
     where id = p_article_id
     returning * into v_article;
  end if;

  if p_article_id is not null and v_old_slug is not null and v_old_slug <> v_article.slug then
    insert into public.article_slug_redirects (old_slug, article_id)
    values (v_old_slug, p_article_id)
    on conflict (old_slug) do nothing;

    select article_id
      into v_redirect_owner
      from public.article_slug_redirects
     where old_slug = v_old_slug;

    if v_redirect_owner is distinct from p_article_id then
      raise exception '舊網址已被其他文章使用。' using errcode = '23505', detail = 'old_slug';
    end if;
  end if;

  return v_article;
end;
$$;

grant execute on function public.save_article(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  text,
  text,
  text[],
  boolean,
  jsonb,
  text,
  text,
  text,
  boolean,
  boolean
) to service_role;

revoke execute on function public.save_article(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  text,
  text,
  text[],
  boolean,
  jsonb,
  text,
  text,
  text,
  boolean,
  boolean
) from public, anon, authenticated;
