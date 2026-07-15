-- Additive Notion ingestion and reviewed-publication pipeline.
-- This is an expand-phase migration: the existing save_article RPC remains
-- available while new callers can opt into versioned, review-gated publishing.

alter table public.articles
  add column if not exists publication_version bigint not null default 0
    check (publication_version >= 0);

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete set null,
  provider text not null default 'notion' check (provider in ('notion')),
  external_id text not null check (char_length(btrim(external_id)) > 0),
  state text not null default 'onboarding'
    check (state in ('onboarding', 'active', 'paused', 'error', 'archived')),
  source_url text,
  configuration jsonb not null default '{}'::jsonb
    check (jsonb_typeof(configuration) = 'object'),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create unique index article_sources_article_provider_key
  on public.article_sources (article_id, provider)
  where article_id is not null and state <> 'archived';
create index article_sources_sync_idx
  on public.article_sources (state, last_synced_at nulls first);

create table public.article_source_revisions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.article_sources(id) on delete restrict,
  external_revision text not null check (char_length(btrim(external_revision)) > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  render_hash text not null check (render_hash ~ '^[0-9a-f]{64}$'),
  raw_payload jsonb not null,
  normalized_payload jsonb,
  source_updated_at timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_id, external_revision),
  unique (source_id, content_hash),
  unique (id, source_id)
);

create index article_source_revisions_latest_idx
  on public.article_source_revisions (source_id, observed_at desc, id);

create table public.article_working_copies (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.article_sources(id) on delete cascade,
  source_revision_id uuid not null,
  article_id uuid references public.articles(id) on delete set null,
  version bigint not null default 1 check (version > 0),
  slug text not null check (public.is_valid_article_slug(slug)),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 20 and 180),
  body_markdown text,
  body_json jsonb,
  body_html text,
  published_at timestamptz,
  content_type_slug text not null references public.content_types(slug) on update cascade,
  category_slug text not null references public.categories(slug) on update cascade,
  tags text[] not null default '{}',
  featured boolean not null default false,
  cover jsonb,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 180),
  canonical_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_revision_id, source_id)
    references public.article_source_revisions(id, source_id) on delete restrict,
  check ((body_markdown is not null and char_length(body_markdown) > 0) or body_json is not null),
  check (body_json is null or body_html is not null),
  check (cover is null or (cover ? 'url' and cover ? 'alt' and cover ? 'width' and cover ? 'height'))
);

create index article_working_copies_article_idx
  on public.article_working_copies (article_id) where article_id is not null;

create table public.publication_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.article_sources(id) on delete restrict,
  source_revision_id uuid not null,
  working_copy_id uuid not null references public.article_working_copies(id) on delete restrict,
  working_copy_version bigint not null check (working_copy_version > 0),
  article_id uuid references public.articles(id) on delete restrict,
  expected_publication_version bigint not null check (expected_publication_version >= 0),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  render_hash text not null check (render_hash ~ '^[0-9a-f]{64}$'),
  candidate_hash text not null check (candidate_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'prepared'
    check (state in (
      'prepared', 'publishing', 'media_failed', 'ready_to_activate',
      'published', 'superseded', 'cancelled'
    )),
  slug text not null check (public.is_valid_article_slug(slug)),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 20 and 180),
  body_markdown text,
  body_json jsonb,
  body_html text,
  activation_at timestamptz not null,
  content_type_slug text not null references public.content_types(slug) on update cascade,
  category_slug text not null references public.categories(slug) on update cascade,
  tags text[] not null default '{}',
  featured boolean not null default false,
  cover jsonb,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 180),
  canonical_url text,
  prepared_by uuid references auth.users(id) on delete set null,
  prepared_at timestamptz not null default now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_revision_id, source_id)
    references public.article_source_revisions(id, source_id) on delete restrict,
  check ((body_markdown is not null and char_length(body_markdown) > 0) or body_json is not null),
  check (body_json is null or body_html is not null),
  check (cover is null or (cover ? 'url' and cover ? 'alt' and cover ? 'width' and cover ? 'height')),
  check ((state in ('published', 'superseded')) = (activated_at is not null)),
  check ((state = 'cancelled') = (cancelled_at is not null))
);

create unique index publication_candidates_source_open_key
  on public.publication_candidates (source_id)
  where state in ('prepared', 'publishing', 'media_failed', 'ready_to_activate');
create index publication_candidates_article_idx
  on public.publication_candidates (article_id, created_at desc)
  where article_id is not null;
create index publication_candidates_state_idx
  on public.publication_candidates (state, prepared_at);

create table public.publication_review_attestations (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.publication_candidates(id) on delete restrict,
  review_kind text not null check (review_kind in ('privacy', 'legal', 'editorial')),
  decision text not null check (decision in ('approved', 'rejected')),
  candidate_source_revision_id uuid not null references public.article_source_revisions(id) on delete restrict,
  candidate_content_hash text not null check (candidate_content_hash ~ '^[0-9a-f]{64}$'),
  attested_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index publication_review_latest_idx
  on public.publication_review_attestations (candidate_id, review_kind, id desc);

create table public.content_media_assets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.article_sources(id) on delete set null,
  source_revision_id uuid references public.article_source_revisions(id) on delete set null,
  source_url text,
  source_fingerprint text,
  staging_object_path text,
  public_object_path text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'ready', 'failed', 'cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state <> 'ready' or public_object_path is not null)
);

create unique index content_media_assets_source_fingerprint_key
  on public.content_media_assets (source_id, source_fingerprint)
  where source_id is not null and source_fingerprint is not null;
create index content_media_assets_state_idx
  on public.content_media_assets (state, updated_at);

create table public.content_media_references (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.publication_candidates(id) on delete cascade,
  asset_id uuid not null references public.content_media_assets(id) on delete restrict,
  reference_key text not null check (char_length(btrim(reference_key)) > 0),
  usage_kind text not null default 'inline'
    check (usage_kind in ('cover', 'inline', 'attachment', 'social')),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (candidate_id, reference_key),
  unique (candidate_id, asset_id, usage_kind)
);

create index content_media_references_asset_idx
  on public.content_media_references (asset_id, candidate_id);

create table public.worker_leases (
  worker_id text primary key check (char_length(btrim(worker_id)) between 1 and 160),
  lease_token uuid not null unique,
  capabilities text[] not null default '{}',
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (expires_at > acquired_at)
);

create index worker_leases_expiry_idx on public.worker_leases (expires_at);

create table public.content_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (char_length(btrim(job_type)) > 0),
  dedupe_key text,
  source_id uuid references public.article_sources(id) on delete cascade,
  candidate_id uuid references public.publication_candidates(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority integer not null default 100,
  run_after timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  locked_by text,
  lease_token uuid,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (locked_by) references public.worker_leases(worker_id) on delete set null,
  check (attempts <= max_attempts),
  check ((state = 'running') = (locked_by is not null and lease_token is not null and locked_at is not null)),
  check ((state in ('succeeded', 'failed', 'cancelled')) = (completed_at is not null))
);

create unique index content_jobs_dedupe_key
  on public.content_jobs (job_type, dedupe_key)
  where dedupe_key is not null and state in ('queued', 'running');
create index content_jobs_claim_idx
  on public.content_jobs (priority, run_after, created_at)
  where state = 'queued';
create index content_jobs_running_idx
  on public.content_jobs (locked_by, locked_at) where state = 'running';

create table public.content_audit_log (
  id bigint generated always as identity primary key,
  event_type text not null check (char_length(btrim(event_type)) > 0),
  aggregate_type text not null check (char_length(btrim(aggregate_type)) > 0),
  aggregate_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_audit_aggregate_idx
  on public.content_audit_log (aggregate_type, aggregate_id, id desc);
create index content_audit_created_idx on public.content_audit_log (created_at desc);

create table public.content_outbox (
  id bigint generated always as identity primary key,
  topic text not null check (char_length(btrim(topic)) > 0),
  aggregate_type text not null check (char_length(btrim(aggregate_type)) > 0),
  aggregate_id uuid,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index content_outbox_pending_idx
  on public.content_outbox (available_at, id) where published_at is null;

create or replace function public.populate_revision_hashes()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.source_hash := coalesce(
    nullif(new.source_hash, ''),
    new.content_hash,
    encode(extensions.digest(convert_to(new.raw_payload::text, 'UTF8'), 'sha256'), 'hex')
  );
  new.render_hash := coalesce(
    nullif(new.render_hash, ''),
    encode(extensions.digest(convert_to(coalesce(new.normalized_payload, new.raw_payload)::text, 'UTF8'), 'sha256'), 'hex')
  );
  return new;
end;
$$;

create trigger article_source_revisions_hashes
before insert on public.article_source_revisions
for each row execute function public.populate_revision_hashes();

create or replace function public.populate_candidate_hash()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.candidate_hash := coalesce(
    nullif(new.candidate_hash, ''),
    encode(extensions.digest(convert_to(jsonb_build_object(
      'source_hash', new.source_hash,
      'render_hash', new.render_hash,
      'working_copy_version', new.working_copy_version,
      'expected_publication_version', new.expected_publication_version,
      'slug', new.slug,
      'title', new.title,
      'description', new.description,
      'body_markdown', new.body_markdown,
      'body_json', new.body_json,
      'body_html', new.body_html,
      'activation_at', new.activation_at,
      'content_type_slug', new.content_type_slug,
      'category_slug', new.category_slug,
      'tags', new.tags,
      'featured', new.featured,
      'cover', new.cover,
      'seo_title', new.seo_title,
      'seo_description', new.seo_description,
      'canonical_url', new.canonical_url
    )::text, 'UTF8'), 'sha256'), 'hex')
  );
  return new;
end;
$$;

create trigger publication_candidates_hash
before insert on public.publication_candidates
for each row execute function public.populate_candidate_hash();

create or replace function public.reject_immutable_content_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception '% rows are append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger article_source_revisions_immutable
before update or delete on public.article_source_revisions
for each row execute function public.reject_immutable_content_row();

create trigger publication_review_attestations_immutable
before update or delete on public.publication_review_attestations
for each row execute function public.reject_immutable_content_row();

create trigger content_audit_log_immutable
before update or delete on public.content_audit_log
for each row execute function public.reject_immutable_content_row();

create or replace function public.touch_content_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger article_sources_touch
before update on public.article_sources
for each row execute function public.touch_content_row();
create trigger publication_candidates_touch
before update on public.publication_candidates
for each row execute function public.touch_content_row();
create trigger content_media_assets_touch
before update on public.content_media_assets
for each row execute function public.touch_content_row();
create trigger content_jobs_touch
before update on public.content_jobs
for each row execute function public.touch_content_row();

create or replace function public.version_article_working_copy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.version <> old.version then
    raise exception 'working copy version is managed by the database' using errcode = '22023';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger article_working_copies_version
before update on public.article_working_copies
for each row execute function public.version_article_working_copy();

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

  if new.article_id is distinct from old.article_id and not (
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

drop trigger publication_candidates_touch on public.publication_candidates;
create trigger publication_candidates_enforce_update
before update on public.publication_candidates
for each row execute function public.enforce_publication_candidate_update();

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
begin
  select * into v_working
  from public.article_working_copies
  where id = p_working_copy_id
  for update;
  if not found then
    raise exception 'working copy not found' using errcode = 'P0002';
  end if;
  if v_working.version <> p_expected_working_copy_version then
    raise exception 'working copy version conflict' using errcode = '40001';
  end if;

  select * into v_source
  from public.article_sources
  where id = v_working.source_id
  for update;
  if v_source.state not in ('onboarding', 'active') then
    raise exception 'source is not publishable in state %', v_source.state using errcode = '22023';
  end if;
  select * into v_revision
  from public.article_source_revisions
  where id = v_working.source_revision_id and source_id = v_working.source_id;
  if not found then
    raise exception 'working copy source revision not found' using errcode = 'P0002';
  end if;
  if v_working.article_id is not null and v_source.article_id is not null
     and v_working.article_id <> v_source.article_id then
    raise exception 'working copy and source target different articles' using errcode = '23514';
  end if;

  v_article_id := coalesce(v_working.article_id, v_source.article_id);
  if v_article_id is null then
    if p_expected_publication_version <> 0 then
      raise exception 'new article publication version must be zero' using errcode = '40001';
    end if;
  else
    select publication_version into v_actual_publication_version
    from public.articles where id = v_article_id for update;
    if not found then
      raise exception 'article not found' using errcode = 'P0002';
    end if;
    if v_actual_publication_version <> p_expected_publication_version then
      raise exception 'article publication version conflict' using errcode = '40001';
    end if;
  end if;

  insert into public.publication_candidates (
    source_id, source_revision_id, working_copy_id, working_copy_version,
    article_id, expected_publication_version, source_hash, render_hash,
    slug, title, description,
    body_markdown, body_json, body_html, activation_at, content_type_slug,
    category_slug, tags, featured, cover, seo_title, seo_description,
    canonical_url, prepared_by
  ) values (
    v_working.source_id, v_working.source_revision_id, v_working.id, v_working.version,
    v_article_id, p_expected_publication_version, v_revision.source_hash, v_revision.render_hash,
    v_working.slug, v_working.title,
    v_working.description, v_working.body_markdown, v_working.body_json,
    v_working.body_html, coalesce(v_working.published_at, now()),
    v_working.content_type_slug, v_working.category_slug, v_working.tags,
    v_working.featured, v_working.cover, v_working.seo_title,
    v_working.seo_description, v_working.canonical_url,
    coalesce(p_prepared_by, auth.uid())
  ) returning * into v_candidate;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'publication_candidate.prepared', 'publication_candidate', v_candidate.id,
    coalesce(p_prepared_by, auth.uid()),
    jsonb_build_object(
      'source_id', v_candidate.source_id,
      'source_revision_id', v_candidate.source_revision_id,
      'working_copy_version', v_candidate.working_copy_version,
      'expected_publication_version', v_candidate.expected_publication_version
    )
  );

  return v_candidate;
end;
$$;

create or replace function public.attest_publication_candidate(
  p_candidate_id uuid,
  p_review_kind text,
  p_decision text,
  p_notes text default null,
  p_attested_by uuid default null
)
returns public.publication_review_attestations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.publication_candidates%rowtype;
  v_revision public.article_source_revisions%rowtype;
  v_attestation public.publication_review_attestations%rowtype;
  v_privacy text;
  v_legal text;
  v_has_pending_media boolean;
  v_has_failed_media boolean;
  v_next_state text;
begin
  if p_review_kind not in ('privacy', 'legal', 'editorial') then
    raise exception 'invalid review kind' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;

  select * into v_candidate from public.publication_candidates
  where id = p_candidate_id for update;
  if not found then
    raise exception 'publication candidate not found' using errcode = 'P0002';
  end if;
  if v_candidate.state not in ('prepared', 'media_failed', 'ready_to_activate') then
    raise exception 'candidate cannot be reviewed in state %', v_candidate.state using errcode = '22023';
  end if;

  select * into v_revision from public.article_source_revisions
  where id = v_candidate.source_revision_id;

  insert into public.publication_review_attestations (
    candidate_id, review_kind, decision, candidate_source_revision_id,
    candidate_content_hash, attested_by, notes
  ) values (
    v_candidate.id, p_review_kind, p_decision, v_candidate.source_revision_id,
    v_revision.content_hash, coalesce(p_attested_by, auth.uid()), p_notes
  ) returning * into v_attestation;

  select decision into v_privacy
  from public.publication_review_attestations
  where candidate_id = v_candidate.id and review_kind = 'privacy'
  order by id desc limit 1;
  select decision into v_legal
  from public.publication_review_attestations
  where candidate_id = v_candidate.id and review_kind = 'legal'
  order by id desc limit 1;

  select
    coalesce(bool_or(a.state in ('pending', 'processing')), false),
    coalesce(bool_or(a.state in ('failed', 'cancelled')), false)
  into v_has_pending_media, v_has_failed_media
  from public.content_media_references r
  join public.content_media_assets a on a.id = r.asset_id
  where r.candidate_id = v_candidate.id and r.required;

  v_next_state := case
    when v_has_failed_media then 'media_failed'
    when v_privacy = 'approved' and v_legal = 'approved' and not v_has_pending_media
      then 'ready_to_activate'
    else 'prepared'
  end;
  if v_next_state <> v_candidate.state then
    update public.publication_candidates
    set state = v_next_state,
        failure_reason = case when v_next_state = 'media_failed' then 'required media failed' else null end
    where id = v_candidate.id;
  end if;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'publication_candidate.attested', 'publication_candidate', v_candidate.id,
    coalesce(p_attested_by, auth.uid()),
    jsonb_build_object('review_kind', p_review_kind, 'decision', p_decision, 'attestation_id', v_attestation.id)
  );

  return v_attestation;
end;
$$;

create or replace function public.finalize_publication_candidate(
  p_candidate_id uuid,
  p_expected_publication_version bigint,
  p_actor_id uuid default null
)
returns table (
  candidate_id uuid,
  candidate_state text,
  article_id uuid,
  publication_version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.publication_candidates%rowtype;
  v_article public.articles%rowtype;
  v_privacy text;
  v_legal text;
  v_has_pending_media boolean;
  v_has_failed_media boolean;
begin
  select * into v_candidate from public.publication_candidates
  where id = p_candidate_id for update;
  if not found then
    raise exception 'publication candidate not found' using errcode = 'P0002';
  end if;
  if v_candidate.state not in ('prepared', 'media_failed', 'ready_to_activate') then
    raise exception 'candidate cannot be finalized in state %', v_candidate.state using errcode = '22023';
  end if;
  if v_candidate.expected_publication_version <> p_expected_publication_version then
    raise exception 'candidate publication version conflict' using errcode = '40001';
  end if;
  if v_candidate.activation_at > now() then
    raise exception 'candidate is not due for activation' using errcode = '55P03';
  end if;

  select decision into v_privacy
  from public.publication_review_attestations
  where publication_review_attestations.candidate_id = v_candidate.id and review_kind = 'privacy'
  order by id desc limit 1;
  select decision into v_legal
  from public.publication_review_attestations
  where publication_review_attestations.candidate_id = v_candidate.id and review_kind = 'legal'
  order by id desc limit 1;
  if v_privacy is distinct from 'approved' or v_legal is distinct from 'approved' then
    raise exception 'current privacy and legal approvals are required' using errcode = '23514';
  end if;

  select
    coalesce(bool_or(a.state in ('pending', 'processing')), false),
    coalesce(bool_or(a.state in ('failed', 'cancelled')), false)
  into v_has_pending_media, v_has_failed_media
  from public.content_media_references r
  join public.content_media_assets a on a.id = r.asset_id
  where r.candidate_id = v_candidate.id and r.required;

  if v_has_failed_media then
    if v_candidate.state <> 'media_failed' then
      update public.publication_candidates
      set state = 'media_failed', failure_reason = 'required media failed'
      where id = v_candidate.id;
    end if;
    return query select v_candidate.id, 'media_failed'::text, v_candidate.article_id, null::bigint;
    return;
  end if;
  if v_has_pending_media then
    if v_candidate.state <> 'prepared' then
      update public.publication_candidates
      set state = 'prepared', failure_reason = null where id = v_candidate.id;
    end if;
    return query select v_candidate.id, 'prepared'::text, v_candidate.article_id, null::bigint;
    return;
  end if;

  if v_candidate.state <> 'ready_to_activate' then
    update public.publication_candidates set state = 'ready_to_activate', failure_reason = null
    where id = v_candidate.id;
  end if;
  update public.publication_candidates set state = 'publishing' where id = v_candidate.id;

  if v_candidate.article_id is not null then
    perform 1 from public.articles a
    where a.id = v_candidate.article_id
      and a.publication_version = p_expected_publication_version
    for update;
    if not found then
      raise exception 'article publication version conflict' using errcode = '40001';
    end if;
  elsif p_expected_publication_version <> 0 then
    raise exception 'new article publication version must be zero' using errcode = '40001';
  end if;

  select * into v_article from public.save_article(
    v_candidate.article_id, v_candidate.slug, v_candidate.title,
    v_candidate.description, v_candidate.body_markdown, v_candidate.body_json,
    v_candidate.body_html, 'published', v_candidate.activation_at,
    v_candidate.content_type_slug, v_candidate.category_slug, v_candidate.tags,
    v_candidate.featured, v_candidate.cover, v_candidate.seo_title,
    v_candidate.seo_description, v_candidate.canonical_url, true, true
  );

  update public.articles a
  set publication_version = p_expected_publication_version + 1,
      updated_at = now()
  where a.id = v_article.id and a.publication_version = p_expected_publication_version
  returning a.* into v_article;
  if not found then
    raise exception 'article publication version conflict' using errcode = '40001';
  end if;

  update public.publication_candidates pc
  set state = 'superseded'
  where pc.article_id = v_article.id and pc.state = 'published' and pc.id <> v_candidate.id;

  update public.publication_candidates
  set state = 'published', article_id = v_article.id,
      activated_at = now(), failure_reason = null
  where id = v_candidate.id;

  update public.article_sources
  set article_id = v_article.id,
      state = case when state = 'onboarding' then 'active' else state end,
      last_error = null
  where id = v_candidate.source_id;
  update public.article_working_copies w set article_id = v_article.id
  where w.id = v_candidate.working_copy_id and w.article_id is null;

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.published', 'article', v_article.id, coalesce(p_actor_id, auth.uid()),
    jsonb_build_object('candidate_id', v_candidate.id, 'publication_version', v_article.publication_version)
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.published', 'article', v_article.id,
    jsonb_build_object('article_id', v_article.id, 'candidate_id', v_candidate.id, 'publication_version', v_article.publication_version)
  );

  return query select v_candidate.id, 'published'::text, v_article.id, v_article.publication_version;
end;
$$;

create or replace function public.unpublish_article(
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
  set status = 'unpublished',
      publication_version = publication_version + 1,
      updated_at = now()
  where id = p_article_id
    and publication_version = p_expected_publication_version
    and status = 'published'
  returning * into v_article;

  if not found then
    if not exists (select 1 from public.articles where id = p_article_id) then
      raise exception 'article not found' using errcode = 'P0002';
    end if;
    raise exception 'article state or publication version conflict' using errcode = '40001';
  end if;

  update public.publication_candidates
  set state = 'cancelled',
      cancelled_at = now(),
      failure_reason = 'article_unpublished'
  where article_id = v_article.id
    and state in ('prepared', 'publishing', 'media_failed', 'ready_to_activate');

  insert into public.content_audit_log (
    event_type, aggregate_type, aggregate_id, actor_id, payload
  ) values (
    'article.unpublished', 'article', v_article.id, coalesce(p_actor_id, auth.uid()),
    jsonb_build_object('publication_version', v_article.publication_version)
  );
  insert into public.content_outbox (topic, aggregate_type, aggregate_id, payload)
  values (
    'article.unpublished', 'article', v_article.id,
    jsonb_build_object('article_id', v_article.id, 'publication_version', v_article.publication_version)
  );
  return v_article;
end;
$$;

create or replace function public.acquire_worker_lease(
  p_worker_id text,
  p_ttl_seconds integer default 60,
  p_capabilities text[] default '{}',
  p_metadata jsonb default '{}'::jsonb
)
returns public.worker_leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lease public.worker_leases%rowtype;
begin
  if char_length(btrim(p_worker_id)) not between 1 and 160 then
    raise exception 'invalid worker id' using errcode = '22023';
  end if;
  if p_ttl_seconds not between 10 and 900 then
    raise exception 'lease TTL must be between 10 and 900 seconds' using errcode = '22023';
  end if;

  insert into public.worker_leases (
    worker_id, lease_token, capabilities, acquired_at, heartbeat_at, expires_at, metadata
  ) values (
    btrim(p_worker_id), gen_random_uuid(), coalesce(p_capabilities, '{}'::text[]),
    now(), now(), now() + make_interval(secs => p_ttl_seconds), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (worker_id) do update
    set lease_token = excluded.lease_token,
        capabilities = excluded.capabilities,
        acquired_at = excluded.acquired_at,
        heartbeat_at = excluded.heartbeat_at,
        expires_at = excluded.expires_at,
        metadata = excluded.metadata
    where worker_leases.expires_at <= now()
  returning * into v_lease;

  if not found then
    raise exception 'worker lease is already active' using errcode = '55P03';
  end if;
  return v_lease;
end;
$$;

create or replace function public.renew_worker_lease(
  p_worker_id text,
  p_lease_token uuid,
  p_ttl_seconds integer default 60
)
returns public.worker_leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lease public.worker_leases%rowtype;
begin
  if p_ttl_seconds not between 10 and 900 then
    raise exception 'lease TTL must be between 10 and 900 seconds' using errcode = '22023';
  end if;
  update public.worker_leases
  set heartbeat_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
  where worker_id = p_worker_id and lease_token = p_lease_token and expires_at > now()
  returning * into v_lease;
  if not found then
    raise exception 'worker lease is missing or expired' using errcode = '55P03';
  end if;
  return v_lease;
end;
$$;

create or replace function public.claim_content_job(
  p_worker_id text,
  p_lease_token uuid,
  p_job_types text[] default null
)
returns public.content_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.content_jobs%rowtype;
begin
  if not exists (
    select 1 from public.worker_leases
    where worker_id = p_worker_id and lease_token = p_lease_token and expires_at > now()
  ) then
    raise exception 'worker lease is missing or expired' using errcode = '55P03';
  end if;

  with claimable as (
    select id from public.content_jobs
    where state = 'queued'
      and run_after <= now()
      and attempts < max_attempts
      and (p_job_types is null or job_type = any(p_job_types))
    order by priority asc, run_after asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.content_jobs j
  set state = 'running', attempts = attempts + 1, locked_by = p_worker_id,
      lease_token = p_lease_token, locked_at = now(), last_error = null
  from claimable c where j.id = c.id
  returning j.* into v_job;

  return v_job;
end;
$$;

create or replace function public.complete_content_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns public.content_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.content_jobs%rowtype;
begin
  update public.content_jobs
  set state = 'succeeded', completed_at = now(), locked_by = null,
      lease_token = null, locked_at = null
  where id = p_job_id and state = 'running'
    and locked_by = p_worker_id and lease_token = p_lease_token
  returning * into v_job;
  if not found then
    raise exception 'job claim is missing or no longer owned by worker' using errcode = '40001';
  end if;
  return v_job;
end;
$$;

create or replace function public.fail_content_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error text,
  p_retry_delay_seconds integer default 60
)
returns public.content_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.content_jobs%rowtype;
begin
  if p_retry_delay_seconds not between 0 and 86400 then
    raise exception 'invalid retry delay' using errcode = '22023';
  end if;
  update public.content_jobs
  set state = case when attempts < max_attempts then 'queued' else 'failed' end,
      run_after = case when attempts < max_attempts
        then now() + make_interval(secs => p_retry_delay_seconds) else run_after end,
      completed_at = case when attempts < max_attempts then null else now() end,
      last_error = left(coalesce(p_error, 'worker reported failure'), 4000),
      locked_by = null, lease_token = null, locked_at = null
  where id = p_job_id and state = 'running'
    and locked_by = p_worker_id and lease_token = p_lease_token
  returning * into v_job;
  if not found then
    raise exception 'job claim is missing or no longer owned by worker' using errcode = '40001';
  end if;
  return v_job;
end;
$$;

alter table public.article_sources enable row level security;
alter table public.article_source_revisions enable row level security;
alter table public.article_working_copies enable row level security;
alter table public.publication_candidates enable row level security;
alter table public.publication_review_attestations enable row level security;
alter table public.content_media_assets enable row level security;
alter table public.content_media_references enable row level security;
alter table public.content_jobs enable row level security;
alter table public.worker_leases enable row level security;
alter table public.content_audit_log enable row level security;
alter table public.content_outbox enable row level security;

revoke all on table
  public.article_sources, public.article_source_revisions, public.article_working_copies,
  public.publication_candidates, public.publication_review_attestations,
  public.content_media_assets, public.content_media_references, public.content_jobs,
  public.worker_leases, public.content_audit_log, public.content_outbox
from anon, authenticated;

grant select, insert, update, delete on table
  public.article_sources, public.article_working_copies, public.publication_candidates,
  public.content_media_assets, public.content_media_references, public.content_jobs,
  public.worker_leases, public.content_outbox
to service_role;
grant select, insert on table
  public.article_source_revisions, public.publication_review_attestations,
  public.content_audit_log
to service_role;
grant usage, select on sequence
  public.publication_review_attestations_id_seq,
  public.content_audit_log_id_seq,
  public.content_outbox_id_seq
to service_role;

revoke execute on function public.reject_immutable_content_row() from public, anon, authenticated;
revoke execute on function public.populate_revision_hashes() from public, anon, authenticated;
revoke execute on function public.populate_candidate_hash() from public, anon, authenticated;
revoke execute on function public.touch_content_row() from public, anon, authenticated;
revoke execute on function public.version_article_working_copy() from public, anon, authenticated;
revoke execute on function public.enforce_publication_candidate_update() from public, anon, authenticated;
revoke execute on function public.prepare_publication_candidate(uuid, bigint, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.attest_publication_candidate(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.finalize_publication_candidate(uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.unpublish_article(uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.acquire_worker_lease(text, integer, text[], jsonb) from public, anon, authenticated;
revoke execute on function public.renew_worker_lease(text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.claim_content_job(text, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.complete_content_job(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fail_content_job(uuid, text, uuid, text, integer) from public, anon, authenticated;

grant execute on function public.prepare_publication_candidate(uuid, bigint, bigint, uuid) to service_role;
grant execute on function public.attest_publication_candidate(uuid, text, text, text, uuid) to service_role;
grant execute on function public.finalize_publication_candidate(uuid, bigint, uuid) to service_role;
grant execute on function public.unpublish_article(uuid, bigint, uuid) to service_role;
grant execute on function public.acquire_worker_lease(text, integer, text[], jsonb) to service_role;
grant execute on function public.renew_worker_lease(text, uuid, integer) to service_role;
grant execute on function public.claim_content_job(text, uuid, text[]) to service_role;
grant execute on function public.complete_content_job(uuid, text, uuid) to service_role;
grant execute on function public.fail_content_job(uuid, text, uuid, text, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notion-staging',
  'notion-staging',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'image/svg+xml', 'application/pdf', 'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.articles.publication_version is
  'Monotonic CAS token for reviewed publication and unpublication operations.';
comment on table public.article_source_revisions is
  'Immutable observations from an external content source.';
comment on table public.publication_review_attestations is
  'Append-only review decisions bound to a candidate source revision and hash.';
comment on table public.content_audit_log is
  'Append-only audit trail for content pipeline state changes.';
