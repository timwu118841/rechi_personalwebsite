-- Admin-managed category/tag settings and immediate-only publication.

create or replace function public.update_article_classification(
  p_article_id uuid,
  p_category_slug text,
  p_tags text[],
  p_actor_id uuid default null
)
returns public.articles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_article public.articles%rowtype;
  v_category_slug text := btrim(coalesce(p_category_slug, ''));
  v_tags text[];
begin
  if p_actor_id is null then
    raise exception 'article classification actor is required' using errcode = '28000';
  end if;
  if v_category_slug = '' or not exists (
    select 1 from public.categories where slug = v_category_slug
  ) then
    raise exception 'article category not found' using errcode = '23503';
  end if;
  if cardinality(coalesce(p_tags, '{}'::text[])) > 20 then
    raise exception 'article tags exceed the maximum of 20' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_tags, '{}'::text[])) as raw_tag(value)
    where char_length(btrim(value)) > 40
  ) then
    raise exception 'article tag exceeds 40 characters' using errcode = '22023';
  end if;

  select coalesce(array_agg(tag order by first_position), '{}'::text[])
    into v_tags
  from (
    select btrim(value) as tag, min(position) as first_position
    from unnest(coalesce(p_tags, '{}'::text[])) with ordinality as raw_tag(value, position)
    where btrim(value) <> ''
    group by btrim(value)
  ) normalized_tags;

  select * into v_article
  from public.articles
  where id = p_article_id
  for update;
  if not found then
    raise exception 'article not found' using errcode = 'P0002';
  end if;

  update public.articles
  set category_slug = v_category_slug,
      tags = v_tags,
      updated_at = now()
  where id = p_article_id
  returning * into v_article;

  -- Keep the linked Notion working copy aligned so a later republish does not
  -- restore stale category/tag values.
  update public.article_working_copies
  set category_slug = v_category_slug,
      tags = v_tags
  where article_id = p_article_id
    and (category_slug is distinct from v_category_slug or tags is distinct from v_tags);

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.classification_changed', 'article', v_article.id, p_actor_id,
    jsonb_build_object('category_slug', v_category_slug, 'tags', v_tags)
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.classification_changed', 'article', v_article.id,
    jsonb_build_object(
      'article_id', v_article.id,
      'category_slug', v_category_slug,
      'tags', v_tags,
      'actor_id', p_actor_id
    )
  );

  return v_article;
end;
$$;

revoke execute on function public.update_article_classification(uuid,text,text[],uuid)
  from public, anon, authenticated;
grant execute on function public.update_article_classification(uuid,text,text[],uuid)
  to service_role;

create or replace function public.force_immediate_candidate_activation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.activation_at := now();
  return new;
end;
$$;

drop trigger if exists publication_candidates_force_immediate
  on public.publication_candidates;
create trigger publication_candidates_force_immediate
before insert on public.publication_candidates
for each row execute function public.force_immediate_candidate_activation();

-- Convert old, not-yet-published scheduled candidates to immediate candidates.
-- The candidate hash trigger remains enabled and refreshes their immutable hash.
alter table public.publication_candidates
  disable trigger publication_candidates_enforce_update;
update public.publication_candidates
set activation_at = now()
where state in ('prepared', 'media_failed', 'ready_to_activate')
  and activation_at > now();
alter table public.publication_candidates
  enable trigger publication_candidates_enforce_update;

-- Release any legacy finalize jobs that were already waiting for a future time.
update public.content_jobs
set run_after = now(),
    updated_at = now()
where job_type = 'finalize_candidate'
  and state = 'queued'
  and run_after > now();

revoke execute on function public.force_immediate_candidate_activation()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
