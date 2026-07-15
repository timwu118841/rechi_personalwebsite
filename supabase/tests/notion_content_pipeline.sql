begin;

select plan(29);

select has_table('public', 'article_sources', 'Notion source table exists');
select has_table('public', 'article_source_revisions', 'Immutable revision table exists');
select has_table('public', 'publication_candidates', 'Publication candidate table exists');
select has_table('public', 'content_jobs', 'Durable content job table exists');
select has_column('public', 'articles', 'publication_version', 'Articles have a publication CAS version');
select has_column('public', 'articles', 'publication_policy', 'Articles have an explicit publication policy');
select has_column('public', 'article_source_revisions', 'source_hash', 'Revisions persist source hashes');
select has_column('public', 'article_source_revisions', 'render_hash', 'Revisions persist render hashes');
select has_column('public', 'publication_candidates', 'candidate_hash', 'Candidates persist candidate hashes');
select has_column('public', 'publication_candidates', 'publication_policy', 'Candidates persist their publication policy');
select has_function(
  'public',
  'save_article_with_policy',
  array['uuid', 'text', 'text', 'text', 'text', 'jsonb', 'text', 'text', 'timestamptz', 'text', 'text', 'text[]', 'boolean', 'jsonb', 'text', 'text', 'text', 'text'],
  'Policy-aware article finalization is exposed through a dedicated RPC'
);
select has_function(
  'public',
  'finalize_publication_candidate',
  array['uuid', 'bigint', 'uuid'],
  'Finalization is exposed through a dedicated RPC'
);
select has_function(
  'public',
  'claim_content_job',
  array['text', 'uuid', 'text[]'],
  'Job claiming is exposed through a lease-aware RPC'
);
select has_function(
  'public',
  'enqueue_content_job',
  array['text', 'text', 'uuid', 'uuid', 'jsonb', 'timestamptz', 'integer', 'integer'],
  'Job enqueueing is exposed through a partial-index-safe RPC'
);
select is(
  (select public from storage.buckets where id = 'notion-staging'),
  false,
  'Notion media staging is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'notion-staging'),
  26214400::bigint,
  'Notion media staging rejects objects larger than 25 MiB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'notion-staging'),
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'image/svg+xml', 'application/pdf', 'application/octet-stream'
  ]::text[],
  'Notion media staging has an explicit MIME allowlist'
);
select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'article_sources', 'article_source_revisions', 'publication_candidates',
        'publication_review_attestations', 'content_media_assets', 'content_media_references',
        'content_jobs', 'worker_leases', 'content_audit_log', 'content_outbox'
      )
      and grantee in ('anon', 'authenticated')
  ),
  'Editorial pipeline tables are not granted to browser roles'
);

insert into public.article_sources (id, external_id, state)
values ('10000000-0000-0000-0000-000000000001', 'notion-page-without-article', 'onboarding');

insert into public.article_source_revisions (
  id, source_id, external_revision, content_hash, source_hash, render_hash,
  raw_payload, normalized_payload
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'revision-1', repeat('a', 64), repeat('a', 64), repeat('b', 64),
  '{}'::jsonb, '{}'::jsonb
);

insert into public.article_working_copies (
  id, source_id, source_revision_id, article_id, slug, title, description,
  body_markdown, content_type_slug, category_slug
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  null, 'notion-unbound-article', 'Unbound Notion article',
  'A sufficiently long description for the unbound Notion article.',
  'Body from Notion', 'legal-articles', 'legal-practice'
);

select is(
  (select article_id from public.article_working_copies
   where id = '30000000-0000-0000-0000-000000000001'),
  null::uuid,
  'A working copy can be created before an article exists'
);

select lives_ok(
  $$select public.prepare_publication_candidate(
    '30000000-0000-0000-0000-000000000001', 1, 0, null
  )$$,
  'An unbound working copy can prepare a new-article candidate at publication version zero'
);

select is(
  (select article_id from public.publication_candidates
   where working_copy_id = '30000000-0000-0000-0000-000000000001'),
  null::uuid,
  'The prepared new-article candidate remains unbound until finalization'
);

select lives_ok(
  $$select public.enqueue_content_job(
    'sync_source',
    'sync_source:notion-page-without-article:operation-1',
    '10000000-0000-0000-0000-000000000001',
    null,
    '{}'::jsonb,
    now(),
    100,
    5
  )$$,
  'Application enqueue path creates a durable sync job'
);

select isnt(
  (select (public.enqueue_content_job(
    'sync_source',
    'sync_source:notion-page-without-article:operation-1',
    '10000000-0000-0000-0000-000000000001',
    null,
    '{}'::jsonb,
    now(),
    100,
    5
  )).id),
  null::uuid,
  'Application enqueue path always returns the active job'
);

select is(
  (select count(*) from public.content_jobs
   where job_type = 'sync_source'
     and dedupe_key = 'sync_source:notion-page-without-article:operation-1'),
  1::bigint,
  'Active enqueue requests share one durable job'
);

select throws_ok(
  $$insert into public.content_jobs (job_type, dedupe_key)
    values ('sync_source', 'sync_source:notion-page-without-article:operation-1')$$,
  '23505',
  null,
  'Direct inserts still reject an active duplicate idempotency key'
);

update public.content_jobs
set state = 'succeeded', completed_at = now()
where job_type = 'sync_source'
  and dedupe_key = 'sync_source:notion-page-without-article:operation-1';

select lives_ok(
  $$select public.enqueue_content_job(
    'sync_source',
    'sync_source:notion-page-without-article:operation-1',
    '10000000-0000-0000-0000-000000000001',
    null,
    '{}'::jsonb,
    now(),
    100,
    5
  )$$,
  'A completed job releases its active idempotency key for a later run'
);

select is(
  (select count(*) from public.content_jobs
   where job_type = 'sync_source'
     and dedupe_key = 'sync_source:notion-page-without-article:operation-1'),
  2::bigint,
  'Completed keys can be reused by the application enqueue path'
);

insert into public.content_media_assets (
  id, source_id, source_revision_id, source_url, source_fingerprint,
  mime_type, byte_size, state, failure_reason
) values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'https://signed.example/image', 'notion-file:block-1',
  'image/png', 1024, 'failed', 'download_error: upstream timeout'
);

select is(
  (select failure_reason from public.content_media_assets
   where id = '40000000-0000-0000-0000-000000000001'),
  'download_error: upstream timeout',
  'Media download errors can be persisted for worker diagnosis'
);

select throws_ok(
  $$insert into public.content_media_assets (
      source_id, source_revision_id, source_fingerprint, byte_size, state
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'negative-size', -1, 'failed'
    )$$,
  '23514',
  null,
  'Media metadata rejects a negative byte size'
);

select * from finish();
rollback;
