-- Fix idempotent publication retries and qualify the return-column candidate_id.
-- The previous deployed function could fail retries with "candidate_id is ambiguous".
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
  v_privacy public.publication_review_attestations%rowtype;
  v_legal public.publication_review_attestations%rowtype;
  v_candidate_content_hash text;
  v_has_pending_media boolean;
  v_has_failed_media boolean;
begin
  if p_actor_id is null then raise exception 'publication actor is required' using errcode = '28000'; end if;
  select * into v_candidate from public.publication_candidates where id = p_candidate_id for update;
  if not found then raise exception 'publication candidate not found' using errcode = 'P0002'; end if;
  if v_candidate.expected_publication_version <> p_expected_publication_version then raise exception 'candidate publication version conflict' using errcode = '40001'; end if;
  if v_candidate.state = 'published' then
    select * into v_article from public.articles where id = v_candidate.article_id;
    if not found or v_article.publication_version <> p_expected_publication_version + 1 then
      raise exception 'published candidate article version conflict' using errcode = '40001';
    end if;
    return query select v_candidate.id, 'published'::text, v_article.id, v_article.publication_version;
    return;
  end if;
  if v_candidate.state not in ('prepared', 'media_failed', 'ready_to_activate') then raise exception 'candidate cannot be finalized in state %', v_candidate.state using errcode = '22023'; end if;
  if v_candidate.activation_at > now() then raise exception 'candidate is not due for activation' using errcode = '55P03'; end if;
  if v_candidate.publication_policy = 'manual_review' then
    select content_hash into v_candidate_content_hash
    from public.article_source_revisions
    where id = v_candidate.source_revision_id and source_id = v_candidate.source_id;
    select * into v_privacy from public.publication_review_attestations where public.publication_review_attestations.candidate_id = v_candidate.id and review_kind = 'privacy' order by id desc limit 1;
    select * into v_legal from public.publication_review_attestations where public.publication_review_attestations.candidate_id = v_candidate.id and review_kind = 'legal' order by id desc limit 1;
    if v_privacy.decision is distinct from 'approved'
       or v_legal.decision is distinct from 'approved'
       or v_privacy.candidate_source_revision_id is distinct from v_candidate.source_revision_id
       or v_legal.candidate_source_revision_id is distinct from v_candidate.source_revision_id
       or v_privacy.candidate_content_hash is distinct from v_candidate_content_hash
       or v_legal.candidate_content_hash is distinct from v_candidate_content_hash then
      raise exception 'current privacy and legal approvals are required' using errcode = '23514';
    end if;
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
    v_candidate.body_markdown, v_candidate.body_json, v_candidate.body_html,
    case when v_candidate.publication_policy = 'manual_review' then 'draft' else 'published' end,
    v_candidate.activation_at, v_candidate.content_type_slug, v_candidate.category_slug,
    v_candidate.tags, v_candidate.featured, v_candidate.cover, v_candidate.seo_title,
    v_candidate.seo_description, v_candidate.canonical_url, v_candidate.publication_policy);
  update public.articles
    set privacy_reviewed = case when v_candidate.publication_policy = 'manual_review' then true else privacy_reviewed end,
        legal_reviewed = case when v_candidate.publication_policy = 'manual_review' then true else legal_reviewed end,
        status = 'published',
        publication_version = p_expected_publication_version + 1,
        updated_at = now()
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


revoke execute on function public.finalize_publication_candidate(uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.finalize_publication_candidate(uuid,bigint,uuid) to service_role;
