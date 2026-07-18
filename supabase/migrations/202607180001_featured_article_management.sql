-- Keep reader-facing featured selection in Admin and enforce one featured article.

with ranked_featured as (
  select
    id,
    row_number() over (
      order by (status = 'published') desc, published_at desc, updated_at desc, id
    ) as position
  from public.articles
  where featured
)
update public.articles as article
set featured = false,
    updated_at = now()
from ranked_featured
where article.id = ranked_featured.id
  and ranked_featured.position > 1;

create unique index if not exists articles_single_featured_key
  on public.articles ((featured))
  where featured;

-- Republishing an existing Notion-backed article must retain the Admin-managed
-- featured value instead of restoring an older candidate snapshot.
create or replace function public.save_article_with_policy(
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
  p_publication_policy text
)
returns public.articles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_article public.articles%rowtype;
  v_privacy boolean := false;
  v_legal boolean := false;
  v_featured boolean := coalesce(p_featured, false);
  v_policy text := coalesce(nullif(btrim(p_publication_policy), ''), 'manual_review');
begin
  if v_policy not in ('manual_review', 'notion_direct') then
    raise exception 'unknown publication policy' using errcode = '22023';
  end if;
  if p_article_id is not null then
    select privacy_reviewed, legal_reviewed, featured
      into v_privacy, v_legal, v_featured
    from public.articles
    where id = p_article_id;
  end if;
  select * into v_article from public.save_article(
    p_article_id, p_slug, p_title, p_description, p_body_markdown, p_body_json,
    p_body_html, case when p_status = 'published' then 'draft' else p_status end,
    coalesce(p_published_at, now()), p_content_type_slug, p_category_slug, p_tags,
    v_featured, p_cover, p_seo_title, p_seo_description, p_canonical_url,
    v_privacy,
    v_legal
  );
  update public.articles
  set publication_policy = v_policy,
      status = p_status,
      published_at = coalesce(p_published_at, published_at),
      updated_at = now()
  where id = v_article.id
  returning * into v_article;
  return v_article;
end;
$$;

create or replace function public.set_featured_article(
  p_article_id uuid,
  p_featured boolean,
  p_actor_id uuid default null
)
returns public.articles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_article public.articles%rowtype;
begin
  if p_actor_id is null then
    raise exception 'featured article actor is required' using errcode = '28000';
  end if;

  -- Serialize concurrent changes so the single-featured invariant remains stable.
  perform pg_advisory_xact_lock(hashtext('rechi.featured_article'));

  select * into v_article
  from public.articles
  where id = p_article_id
  for update;
  if not found then
    raise exception 'article not found' using errcode = 'P0002';
  end if;
  if p_featured and v_article.status <> 'published' then
    raise exception 'only published articles can be featured' using errcode = '22023';
  end if;

  if p_featured then
    update public.articles
    set featured = false,
        updated_at = now()
    where featured
      and id <> p_article_id;
  end if;

  update public.articles
  set featured = p_featured,
      updated_at = now()
  where id = p_article_id
  returning * into v_article;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.featured_changed', 'article', v_article.id, p_actor_id,
    jsonb_build_object('featured', v_article.featured)
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.featured_changed', 'article', v_article.id,
    jsonb_build_object('article_id', v_article.id, 'featured', v_article.featured, 'actor_id', p_actor_id)
  );

  return v_article;
end;
$$;

revoke execute on function public.set_featured_article(uuid,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.set_featured_article(uuid,boolean,uuid)
  to service_role;

-- Make the RPC available to Supabase Data API immediately after this migration commits.
notify pgrst, 'reload schema';
