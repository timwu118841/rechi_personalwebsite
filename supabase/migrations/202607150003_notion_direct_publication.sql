-- Explicit direct-publication policy for the Notion editorial pipeline.
-- Legacy article saves and candidates remain manual-review by default.

alter table public.articles
  add column if not exists publication_policy text not null default 'manual_review';
alter table public.articles
  drop constraint if exists articles_publication_policy_check;
alter table public.articles
  add constraint articles_publication_policy_check
  check (publication_policy in ('manual_review', 'notion_direct'));

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.articles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status <> ''published''%';
  if constraint_name is not null then
    execute format('alter table public.articles drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.articles
  add constraint articles_published_policy_check
  check (status <> 'published' or publication_policy = 'notion_direct' or (privacy_reviewed and legal_reviewed));

alter table public.publication_candidates
  add column if not exists publication_policy text not null default 'manual_review';
alter table public.publication_candidates
  drop constraint if exists publication_candidates_publication_policy_check;
alter table public.publication_candidates
  add constraint publication_candidates_publication_policy_check
  check (publication_policy in ('manual_review', 'notion_direct'));

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
  v_policy text := coalesce(nullif(btrim(p_publication_policy), ''), 'manual_review');
begin
  if v_policy not in ('manual_review', 'notion_direct') then
    raise exception 'unknown publication policy' using errcode = '22023';
  end if;
  if p_article_id is not null then
    select privacy_reviewed, legal_reviewed into v_privacy, v_legal
    from public.articles where id = p_article_id;
  end if;
  -- Save as draft first so the legacy save function remains unchanged and the
  -- policy/status check sees the explicit policy on the final update.
  select * into v_article from public.save_article(
    p_article_id, p_slug, p_title, p_description, p_body_markdown, p_body_json,
    p_body_html, case when p_status = 'published' then 'draft' else p_status end,
    coalesce(p_published_at, now()), p_content_type_slug, p_category_slug, p_tags,
    p_featured, p_cover, p_seo_title, p_seo_description, p_canonical_url,
    case when p_article_id is null then false else v_privacy end,
    case when p_article_id is null then false else v_legal end
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

create or replace function public.finalize_publication_candidate(
  p_candidate_id uuid,
  p_expected_publication_version bigint,
  p_actor_id uuid default null
)
returns table (candidate_id uuid, candidate_state text, article_id uuid, publication_version bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_candidate public.publication_candidates%rowtype;
  v_article public.articles%rowtype;
  v_privacy text;
  v_legal text;
  v_has_pending_media boolean;
  v_has_failed_media boolean;
begin
  if p_actor_id is null then raise exception 'publication actor is required' using errcode = '28000'; end if;
  select * into v_candidate from public.publication_candidates where id = p_candidate_id for update;
  if not found then raise exception 'publication candidate not found' using errcode = 'P0002'; end if;
  if v_candidate.state not in ('prepared', 'media_failed', 'ready_to_activate') then raise exception 'candidate cannot be finalized in state %', v_candidate.state using errcode = '22023'; end if;
  if v_candidate.expected_publication_version <> p_expected_publication_version then raise exception 'candidate publication version conflict' using errcode = '40001'; end if;
  if v_candidate.activation_at > now() then raise exception 'candidate is not due for activation' using errcode = '55P03'; end if;
  if v_candidate.publication_policy = 'manual_review' then
    select decision into v_privacy from public.publication_review_attestations where candidate_id = v_candidate.id and review_kind = 'privacy' order by id desc limit 1;
    select decision into v_legal from public.publication_review_attestations where candidate_id = v_candidate.id and review_kind = 'legal' order by id desc limit 1;
    if v_privacy is distinct from 'approved' or v_legal is distinct from 'approved' then raise exception 'current privacy and legal approvals are required' using errcode = '23514'; end if;
  elsif v_candidate.publication_policy <> 'notion_direct' then
    raise exception 'unknown publication policy' using errcode = '22023';
  end if;
  select coalesce(bool_or(a.state in ('pending', 'processing')), false), coalesce(bool_or(a.state in ('failed', 'cancelled')), false)
    into v_has_pending_media, v_has_failed_media from public.content_media_references r join public.content_media_assets a on a.id = r.asset_id where r.candidate_id = v_candidate.id and r.required;
  if v_has_failed_media then
    update public.publication_candidates set state = 'media_failed', failure_reason = 'required media failed' where id = v_candidate.id;
    return query select v_candidate.id, 'media_failed'::text, v_candidate.article_id, null::bigint; return;
  end if;
  if v_has_pending_media then
    update public.publication_candidates set state = 'prepared', failure_reason = null where id = v_candidate.id;
    return query select v_candidate.id, 'prepared'::text, v_candidate.article_id, null::bigint; return;
  end if;
  update public.publication_candidates set state = 'publishing', failure_reason = null where id = v_candidate.id;
  if v_candidate.article_id is not null then
    perform 1 from public.articles a where a.id = v_candidate.article_id and a.publication_version = p_expected_publication_version for update;
    if not found then raise exception 'article publication version conflict' using errcode = '40001'; end if;
  elsif p_expected_publication_version <> 0 then raise exception 'new article publication version must be zero' using errcode = '40001'; end if;
  select * into v_article from public.save_article_with_policy(
    v_candidate.article_id, v_candidate.slug, v_candidate.title, v_candidate.description,
    v_candidate.body_markdown, v_candidate.body_json, v_candidate.body_html, 'published',
    v_candidate.activation_at, v_candidate.content_type_slug, v_candidate.category_slug,
    v_candidate.tags, v_candidate.featured, v_candidate.cover, v_candidate.seo_title,
    v_candidate.seo_description, v_candidate.canonical_url, v_candidate.publication_policy);
  update public.articles set publication_version = p_expected_publication_version + 1, updated_at = now()
    where id = v_article.id and publication_version = p_expected_publication_version returning * into v_article;
  if not found then raise exception 'article publication version conflict' using errcode = '40001'; end if;
  update public.publication_candidates set state = 'superseded' where article_id = v_article.id and state = 'published' and id <> v_candidate.id;
  update public.publication_candidates set state = 'published', article_id = v_article.id, activated_at = now(), failure_reason = null where id = v_candidate.id;
  update public.article_sources set article_id = v_article.id, state = case when state = 'onboarding' then 'active' else state end, last_error = null where id = v_candidate.source_id;
  update public.article_working_copies set article_id = v_article.id where id = v_candidate.working_copy_id and article_id is null;
  insert into public.content_audit_log (event_type, aggregate_type, aggregate_id, actor_id, payload)
    values ('article.published', 'article', v_article.id, p_actor_id, jsonb_build_object('candidate_id', v_candidate.id, 'publication_version', v_article.publication_version));
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
    values ('article.published', 'article', v_article.id, jsonb_build_object('article_id', v_article.id, 'candidate_id', v_candidate.id, 'publication_version', v_article.publication_version, 'actor_id', p_actor_id));
  return query select v_candidate.id, 'published'::text, v_article.id, v_article.publication_version;
end;
$$;

revoke execute on function public.save_article_with_policy(uuid,text,text,text,text,jsonb,text,text,timestamptz,text,text,text[],boolean,jsonb,text,text,text,text) from public, anon, authenticated;
grant execute on function public.save_article_with_policy(uuid,text,text,text,text,jsonb,text,text,timestamptz,text,text,text[],boolean,jsonb,text,text,text,text) to service_role;
revoke execute on function public.prepare_publication_candidate(uuid,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.prepare_publication_candidate(uuid,bigint,bigint,uuid) to service_role;
revoke execute on function public.finalize_publication_candidate(uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.finalize_publication_candidate(uuid,bigint,uuid) to service_role;
