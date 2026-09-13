-- Let an editor retire a synced Notion row without deleting its history. A retired
-- (ignored) source is excluded from discovery synchronization, cannot produce new
-- revisions or publication candidates, and can be restored at any time. Published
-- articles are intentionally untouched: retirement stops syncing, it is not an
-- unpublish.

alter table public.article_sources
  add column if not exists ignored_at timestamptz;

create index if not exists article_sources_ignored_idx
  on public.article_sources (ignored_at)
  where ignored_at is not null;

-- Retire or restore sources in one transaction. All-or-nothing: an unknown id
-- rejects the whole batch so the caller never sees a partially applied change.
create or replace function public.set_article_sources_ignored(
  p_source_ids uuid[],
  p_ignored boolean,
  p_actor_id uuid default null
)
returns setof public.article_sources
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_now timestamptz := now();
begin
  if p_source_ids is null or array_length(p_source_ids, 1) is null then
    raise exception 'at least one source id is required' using errcode = '22023';
  end if;
  if array_length(p_source_ids, 1) > 200 then
    raise exception 'at most 200 sources can be updated at once' using errcode = '22023';
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

  -- Queued work for a retired source must not run: cancel it before the source is
  -- marked so a worker cannot start a job that the guard would reject anyway.
  if p_ignored then
    update public.content_jobs
    set state = 'cancelled', completed_at = v_now
    where source_id = any(v_ids) and state = 'queued';

    update public.publication_candidates
    set state = 'cancelled', cancelled_at = v_now, failure_reason = 'source_ignored'
    where source_id = any(v_ids)
      and state in ('prepared', 'publishing', 'media_failed', 'ready_to_activate');
  end if;

  update public.article_sources
  set ignored_at = case when p_ignored then v_now else null end
  where id = any(v_ids);

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  )
  select
    case when p_ignored then 'article_source.ignored' else 'article_source.restored' end,
    'article_source',
    candidate.id,
    p_actor_id,
    jsonb_build_object('ignored', p_ignored)
  from unnest(v_ids) as candidate(id);

  return query
    select * from public.article_sources
    where article_sources.id = any(v_ids)
    order by article_sources.updated_at desc;
end;
$$;

revoke execute on function public.set_article_sources_ignored(uuid[], boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_article_sources_ignored(uuid[], boolean, uuid) to service_role;

-- Same publish boundary as the existing state check: a retired source must not
-- produce a candidate until it is restored.
create or replace function public.prepare_publication_candidate(
  p_working_copy_id uuid,
  p_expected_working_copy_version bigint,
  p_expected_publication_version bigint,
  p_prepared_by uuid default null
)
returns public.publication_candidates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_working public.article_working_copies%rowtype;
  v_source public.article_sources%rowtype;
  v_revision public.article_source_revisions%rowtype;
  v_candidate public.publication_candidates%rowtype;
  v_article_id uuid;
  v_actual_publication_version bigint;
  v_policy text;
begin
  select * into v_working from public.article_working_copies where id = p_working_copy_id for update;
  if not found then raise exception 'working copy not found' using errcode = 'P0002'; end if;
  if v_working.version <> p_expected_working_copy_version then raise exception 'working copy version conflict' using errcode = '40001'; end if;
  select * into v_source from public.article_sources where id = v_working.source_id for update;
  if v_source.state not in ('onboarding', 'active') then raise exception 'source is not publishable in state %', v_source.state using errcode = '22023'; end if;
  if v_source.ignored_at is not null then raise exception 'source is ignored' using errcode = '22023'; end if;
  select * into v_revision from public.article_source_revisions where id = v_working.source_revision_id and source_id = v_working.source_id;
  if not found then raise exception 'working copy source revision not found' using errcode = 'P0002'; end if;
  if v_working.article_id is not null and v_source.article_id is not null and v_working.article_id <> v_source.article_id then raise exception 'working copy and source target different articles' using errcode = '23514'; end if;
  v_article_id := coalesce(v_working.article_id, v_source.article_id);
  if v_article_id is null then
    if p_expected_publication_version <> 0 then raise exception 'new article publication version must be zero' using errcode = '40001'; end if;
  else
    select publication_version into v_actual_publication_version from public.articles where id = v_article_id for update;
    if not found then raise exception 'article not found' using errcode = 'P0002'; end if;
    if v_actual_publication_version <> p_expected_publication_version then raise exception 'article publication version conflict' using errcode = '40001'; end if;
  end if;
  v_policy := case when v_source.provider = 'notion' then 'notion_direct' else 'manual_review' end;
  insert into public.publication_candidates (
    source_id, source_revision_id, working_copy_id, working_copy_version,
    article_id, expected_publication_version, source_hash, render_hash,
    publication_policy, slug, title, description, body_markdown, body_json, body_html,
    activation_at, content_type_slug, category_slug, tags, featured, cover, seo_title,
    seo_description, canonical_url, prepared_by
  ) values (
    v_working.source_id, v_working.source_revision_id, v_working.id, v_working.version,
    v_article_id, p_expected_publication_version, v_revision.source_hash, v_revision.render_hash,
    v_policy, v_working.slug, v_working.title, v_working.description, v_working.body_markdown,
    v_working.body_json, v_working.body_html, coalesce(v_working.published_at, now()),
    v_working.content_type_slug, v_working.category_slug, v_working.tags, v_working.featured,
    v_working.cover, v_working.seo_title, v_working.seo_description, v_working.canonical_url,
    coalesce(p_prepared_by, auth.uid())
  ) returning * into v_candidate;
  insert into public.content_audit_log (event_type, aggregate_type, aggregate_id, actor_id, payload)
  values ('publication_candidate.prepared', 'publication_candidate', v_candidate.id,
    coalesce(p_prepared_by, auth.uid()), jsonb_build_object('source_id', v_candidate.source_id,
    'source_revision_id', v_candidate.source_revision_id, 'working_copy_version', v_candidate.working_copy_version,
    'expected_publication_version', v_candidate.expected_publication_version,
    'publication_policy', v_candidate.publication_policy));
  return v_candidate;
end;
$$;

revoke execute on function public.prepare_publication_candidate(uuid,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.prepare_publication_candidate(uuid,bigint,bigint,uuid) to service_role;
