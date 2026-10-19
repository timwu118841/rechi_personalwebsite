-- Admin cleanup actions for the content pipeline.
--
-- 1. Permanently remove retired (ignored) Notion sources from this site's
--    database. The Notion page itself is untouched; only the local sync history
--    (revisions, working copies, candidates, reviews, jobs) is removed.
-- 2. Restore an unpublished article without waiting for a fresh Notion sync.
-- 3. Delete an unpublished article from the site database. The Notion page is
--    untouched and can be synced again later.

-- ---------------------------------------------------------------------------
-- Delete retired sources.
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

  -- Deleting is only allowed for sources an editor already retired, so a
  -- destructive action always follows an explicit, reversible ignore step.
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

  -- Publication history references revisions and candidates with
  -- ON DELETE RESTRICT, so remove the dependent rows explicitly and in order.
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

  -- Keep promoted media assets: they live in Storage and may still be
  -- referenced by published article bodies. The foreign keys null out the link
  -- to the deleted source and revision.
  delete from public.article_source_revisions where source_id = any(v_ids);
  delete from public.article_sources where id = any(v_ids);

  return query select unnest(v_ids);
end;
$$;

revoke execute on function public.delete_article_sources(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.delete_article_sources(uuid[], uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Restore an unpublished article without a new Notion sync.
-- ---------------------------------------------------------------------------
create or replace function public.republish_article(
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
  update public.articles
  set status = 'published',
      publication_version = publication_version + 1,
      updated_at = now()
  where id = p_article_id
    and publication_version = p_expected_publication_version
    and status = 'unpublished'
  returning * into v_article;

  if not found then
    if not exists (select 1 from public.articles where id = p_article_id) then
      raise exception 'article not found' using errcode = 'P0002';
    end if;
    raise exception 'article state or publication version conflict' using errcode = '40001';
  end if;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.republished', 'article', v_article.id, p_actor_id,
    jsonb_build_object('publication_version', v_article.publication_version)
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.published', 'article', v_article.id,
    jsonb_build_object('article_id', v_article.id, 'publication_version', v_article.publication_version)
  );
  return v_article;
end;
$$;

revoke execute on function public.republish_article(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.republish_article(uuid, bigint, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Delete an unpublished article from the site database.
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

  -- Candidates keep their source history but must not block the delete.
  update public.publication_candidates
  set article_id = null
  where article_id = p_article_id;

  delete from public.articles where id = p_article_id;

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
