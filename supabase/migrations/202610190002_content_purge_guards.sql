-- Fix the admin cleanup functions so they can pass the append-only guards.
--
-- `article_source_revisions` and `publication_review_attestations` reject DELETE,
-- and `publication_candidates.article_id` is immutable. The cleanup RPCs need to
-- remove those rows, so the guards now honour a transaction-local purge flag that
-- only the SECURITY DEFINER cleanup functions set.
--
-- Run this after 202610190001_admin_content_cleanup.sql.

-- ---------------------------------------------------------------------------
-- Append-only guard: allow deletes while a purge is in progress.
-- ---------------------------------------------------------------------------
create or replace function public.reject_immutable_content_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.content_purge', true) = 'on' then
    return old;
  end if;
  raise exception '% rows are append-only', tg_table_name using errcode = '55000';
end;
$$;

-- ---------------------------------------------------------------------------
-- Candidate guard: allow detaching/removing candidates while purging.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_publication_candidate_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if row(
    new.source_id, new.source_revision_id, new.working_copy_id, new.working_copy_version,
    new.expected_publication_version, new.source_hash, new.render_hash, new.candidate_hash,
    new.slug, new.title,
    new.description, new.body_markdown, new.body_json, new.body_html, new.activation_at,
    new.content_type_slug, new.category_slug, new.tags, new.featured, new.cover,
    new.seo_title, new.seo_description, new.canonical_url
  ) is distinct from row(
    old.source_id, old.source_revision_id, old.working_copy_id, old.working_copy_version,
    old.expected_publication_version, old.source_hash, old.render_hash, old.candidate_hash,
    old.slug, old.title,
    old.description, old.body_markdown, old.body_json, old.body_html, old.activation_at,
    old.content_type_slug, old.category_slug, old.tags, old.featured, old.cover,
    old.seo_title, old.seo_description, old.canonical_url
  ) then
    raise exception 'publication candidate snapshot is immutable' using errcode = '55000';
  end if;

  if new.article_id is distinct from old.article_id
    and current_setting('app.content_purge', true) is distinct from 'on'
    and not (
      old.article_id is null and new.article_id is not null
      and old.state = 'publishing' and new.state = 'published'
    ) then
    raise exception 'publication candidate article binding is immutable' using errcode = '55000';
  end if;

  if new.state <> old.state and not (
    (old.state = 'prepared' and new.state in ('publishing', 'media_failed', 'ready_to_activate', 'cancelled')) or
    (old.state = 'media_failed' and new.state in ('prepared', 'ready_to_activate', 'cancelled')) or
    (old.state = 'ready_to_activate' and new.state in ('prepared', 'publishing', 'media_failed', 'cancelled')) or
    (old.state = 'publishing' and new.state in ('published', 'media_failed', 'prepared', 'cancelled')) or
    (old.state = 'published' and new.state = 'superseded')
  ) then
    raise exception 'invalid publication candidate transition: % -> %', old.state, new.state
      using errcode = '22023';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete retired sources (now allowed past the append-only guards).
-- ---------------------------------------------------------------------------
create or replace function public.delete_article_sources(
  p_source_ids uuid[],
  p_actor_id uuid default null
)
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if p_source_ids is null or array_length(p_source_ids, 1) is null then
    raise exception 'at least one source id is required' using errcode = '22023';
  end if;
  if array_length(p_source_ids, 1) > 200 then
    raise exception 'at most 200 sources can be deleted at once' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_source_ids) as candidate(id) where candidate.id is null) then
    raise exception 'source ids must not contain null' using errcode = '22023';
  end if;

  v_ids := (select array_agg(distinct candidate.id) from unnest(p_source_ids) as candidate(id));

  if exists (
    select 1 from unnest(v_ids) as candidate(id)
    where not exists (select 1 from public.article_sources where article_sources.id = candidate.id)
  ) then
    raise exception 'source not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.article_sources
    where id = any(v_ids) and ignored_at is null
  ) then
    raise exception 'source must be ignored before deletion' using errcode = '22023';
  end if;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  )
  select
    'article_source.deleted',
    'article_source',
    source.id,
    p_actor_id,
    jsonb_build_object(
      'provider', source.provider,
      'external_id', source.external_id,
      'article_id', source.article_id,
      'source_url', source.source_url
    )
  from public.article_sources as source
  where source.id = any(v_ids);

  -- Transaction-local, so the append-only guards are restored on commit.
  perform set_config('app.content_purge', 'on', true);

  delete from public.publication_review_attestations
  where candidate_id in (
      select id from public.publication_candidates where source_id = any(v_ids)
    )
    or candidate_source_revision_id in (
      select id from public.article_source_revisions where source_id = any(v_ids)
    );

  delete from public.content_media_references
  where candidate_id in (
    select id from public.publication_candidates where source_id = any(v_ids)
  );

  delete from public.content_jobs where source_id = any(v_ids);
  delete from public.publication_candidates where source_id = any(v_ids);
  delete from public.article_working_copies where source_id = any(v_ids);
  delete from public.article_source_revisions where source_id = any(v_ids);
  delete from public.article_sources where id = any(v_ids);

  perform set_config('app.content_purge', 'off', true);

  return query select unnest(v_ids);
end;
$$;

revoke execute on function public.delete_article_sources(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.delete_article_sources(uuid[], uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Delete an unpublished article (history rows removed with the same flag).
-- ---------------------------------------------------------------------------
create or replace function public.delete_unpublished_article(
  p_article_id uuid,
  p_expected_publication_version bigint,
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
  select * into v_article
  from public.articles
  where id = p_article_id
  for update;

  if not found then
    raise exception 'article not found' using errcode = 'P0002';
  end if;
  if v_article.status <> 'unpublished' then
    raise exception 'only unpublished articles can be deleted' using errcode = '22023';
  end if;
  if v_article.publication_version <> p_expected_publication_version then
    raise exception 'article publication version conflict' using errcode = '40001';
  end if;

  -- Transaction-local, so the append-only guards are restored on commit.
  perform set_config('app.content_purge', 'on', true);

  delete from public.publication_review_attestations
  where candidate_id in (
    select id from public.publication_candidates where article_id = p_article_id
  );

  delete from public.publication_candidates where article_id = p_article_id;
  delete from public.articles where id = p_article_id;

  perform set_config('app.content_purge', 'off', true);

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.deleted', 'article', v_article.id, p_actor_id,
    jsonb_build_object(
      'slug', v_article.slug,
      'title', v_article.title,
      'publication_version', v_article.publication_version
    )
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.deleted', 'article', v_article.id,
    jsonb_build_object('article_id', v_article.id, 'slug', v_article.slug)
  );
  return v_article;
end;
$$;

revoke execute on function public.delete_unpublished_article(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.delete_unpublished_article(uuid, bigint, uuid) to service_role;

notify pgrst, 'reload schema';
