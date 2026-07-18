begin;

select plan(81);

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
select has_column('public', 'article_working_copies', 'manual_summary', 'Working copies keep an Admin-authored summary separate from Notion content');
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
select has_function(
  'public',
  'set_featured_article',
  array['uuid', 'boolean', 'uuid'],
  'Featured article selection is exposed through a server-only RPC'
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

select is(
  (select (public.save_article_with_policy(
    null, 'manual-review-defaults', 'Manual review defaults',
    'A sufficiently long description for the new manual review article.',
    'Body from manual review', null, 'Body from manual review', 'draft', now(),
    'legal-articles', 'legal-practice', '{}'::text[], false, null,
    null, null, null, 'manual_review'
  )).privacy_reviewed),
  false,
  'A new manual-review article defaults privacy review to false'
);

update public.articles
set privacy_reviewed = true, legal_reviewed = false
where slug = 'manual-review-defaults';

select is(
  (select (public.save_article_with_policy(
    (select id from public.articles where slug = 'manual-review-defaults'),
    'manual-review-defaults', 'Manual review defaults',
    'A sufficiently long description for the new manual review article.',
    'Body from manual review', null, 'Body from manual review', 'draft', now(),
    'legal-articles', 'legal-practice', '{}'::text[], false, null,
    null, null, null, 'manual_review'
  )).legal_reviewed),
  false,
  'Existing manual-review approvals are preserved rather than fabricated'
);

select is(
  (select privacy_reviewed from public.articles where slug = 'manual-review-defaults'),
  true,
  'Existing manual-review privacy approval remains true after save'
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

insert into auth.users (id) values
  ('90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003');

select throws_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000001'),
    0,
    null
  )$$,
  '28000',
  null,
  'Finalization fails closed when the publication actor is missing'
);

select throws_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000001'),
    1,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  '40001',
  null,
  'Finalization rejects a stale candidate publication version'
);

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000001'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'A due Notion-direct candidate finalizes without review attestations'
);

select is(
  (select state from public.publication_candidates
   where working_copy_id = '30000000-0000-0000-0000-000000000001'),
  'published',
  'Direct finalization publishes the candidate'
);

select is(
  (select publication_policy from public.articles where slug = 'notion-unbound-article'),
  'notion_direct',
  'Direct finalization persists the explicit Notion-direct policy'
);

select is(
  (select privacy_reviewed from public.articles where slug = 'notion-unbound-article'),
  false,
  'Direct finalization does not fabricate a privacy approval'
);

select is(
  (select legal_reviewed from public.articles where slug = 'notion-unbound-article'),
  false,
  'Direct finalization does not fabricate a legal approval'
);

select is(
  (select actor_id from public.content_audit_log
   where event_type = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'notion-unbound-article')
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000003'::uuid,
  'The publication audit record uses the explicit finalization actor'
);

select is(
  (select payload ->> 'actor_id' from public.content_outbox
   where topic = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'notion-unbound-article')
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000003',
  'The publication outbox payload carries the explicit finalization actor'
);

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000001'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'Retrying an already-published candidate is idempotent'
);

select is(
  (select count(*) from public.content_audit_log
   where event_type = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'notion-unbound-article')),
  1::bigint,
  'An idempotent retry does not duplicate the publication audit event'
);

select is(
  (select count(*) from public.content_outbox
   where topic = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'notion-unbound-article')),
  1::bigint,
  'An idempotent retry does not duplicate the publication outbox event'
);

insert into public.article_sources (id, external_id, state)
values ('10000000-0000-0000-0000-000000000002', 'legacy-manual-candidate', 'onboarding');

insert into public.article_source_revisions (
  id, source_id, external_revision, content_hash, source_hash, render_hash,
  raw_payload, normalized_payload
) values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'revision-1', repeat('c', 64), repeat('c', 64), repeat('d', 64),
  '{}'::jsonb, '{}'::jsonb
);

insert into public.article_working_copies (
  id, source_id, source_revision_id, slug, title, description,
  body_markdown, content_type_slug, category_slug
) values (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'legacy-manual-candidate', 'Legacy manual candidate',
  'A sufficiently long description for the legacy manual candidate.',
  'Body from the legacy manual candidate', 'legal-articles', 'legal-practice'
);

select lives_ok(
  $$select public.prepare_publication_candidate(
    '30000000-0000-0000-0000-000000000002', 1, 0,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'A candidate records its explicit preparation actor'
);

update public.publication_candidates
set publication_policy = 'manual_review'
where working_copy_id = '30000000-0000-0000-0000-000000000002';

select is(
  (select prepared_by from public.publication_candidates
   where working_copy_id = '30000000-0000-0000-0000-000000000002'),
  '90000000-0000-0000-0000-000000000001'::uuid,
  'The candidate preserves the preparation actor in the actor chain'
);

select is(
  (select actor_id from public.content_audit_log
   where event_type = 'publication_candidate.prepared'
     and aggregate_id = (select id from public.publication_candidates
       where working_copy_id = '30000000-0000-0000-0000-000000000002')
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000001'::uuid,
  'The candidate preparation audit uses the preparation actor'
);

insert into public.content_media_assets (
  id, source_id, source_revision_id, source_fingerprint, state
) values (
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'notion-file:block-manual', 'pending'
);

insert into public.content_media_references (candidate_id, asset_id, reference_key, required)
select id, '40000000-0000-0000-0000-000000000002', 'asset://notion/block-manual', true
from public.publication_candidates
where working_copy_id = '30000000-0000-0000-0000-000000000002';

select lives_ok(
  $$select public.attest_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002'),
    'legal', 'approved', null, '90000000-0000-0000-0000-000000000002'
  )$$,
  'The legal reviewer can append an approved attestation'
);

insert into public.publication_review_attestations (
  candidate_id, review_kind, decision, candidate_source_revision_id,
  candidate_content_hash, attested_by
)
select id, 'privacy', 'approved', source_revision_id, repeat('f', 64),
  '90000000-0000-0000-0000-000000000001'
from public.publication_candidates
where working_copy_id = '30000000-0000-0000-0000-000000000002';

select throws_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  '23514',
  null,
  'A stale approval for different candidate content cannot authorize publication'
);

select lives_ok(
  $$select public.attest_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002'),
    'privacy', 'approved', null, '90000000-0000-0000-0000-000000000003'
  )$$,
  'The privacy reviewer can append a current approved attestation'
);

select is(
  (select attested_by from public.publication_review_attestations
   where candidate_id = (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002')
     and review_kind = 'privacy'
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000003'::uuid,
  'The latest privacy attestation preserves its reviewer in the actor chain'
);

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'Required pending media defers otherwise-approved manual publication'
);

select is(
  (select state from public.publication_candidates
   where working_copy_id = '30000000-0000-0000-0000-000000000002'),
  'prepared',
  'The media gate keeps the approved candidate prepared'
);

update public.content_media_assets
set state = 'ready', public_object_path = 'notion/manual-ready.png'
where id = '40000000-0000-0000-0000-000000000002';

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000002'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'Current approvals finalize after required media becomes ready'
);

select is(
  (select privacy_reviewed from public.articles where slug = 'legacy-manual-candidate'),
  true,
  'Manual finalization transfers the latest real privacy approval to the article'
);

select is(
  (select legal_reviewed from public.articles where slug = 'legacy-manual-candidate'),
  true,
  'Manual finalization transfers the latest real legal approval to the article'
);

select is(
  (select publication_policy from public.articles where slug = 'legacy-manual-candidate'),
  'manual_review',
  'Manual finalization retains the legacy review policy'
);

select is(
  (select actor_id from public.content_audit_log
   where event_type = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'legacy-manual-candidate')
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000003'::uuid,
  'Manual publication audit records the finalization actor'
);

select is(
  (select payload ->> 'actor_id' from public.content_outbox
   where topic = 'article.published'
     and aggregate_id = (select id from public.articles where slug = 'legacy-manual-candidate')
   order by id desc limit 1),
  '90000000-0000-0000-0000-000000000003',
  'Manual publication outbox records the finalization actor'
);

insert into public.article_sources (id, article_id, external_id, state)
values (
  '10000000-0000-0000-0000-000000000003',
  (select id from public.articles where slug = 'manual-review-defaults'),
  'notion-existing-review-values',
  'active'
);

insert into public.article_source_revisions (
  id, source_id, external_revision, content_hash, source_hash, render_hash,
  raw_payload, normalized_payload
) values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  'revision-1', repeat('1', 64), repeat('1', 64), repeat('2', 64),
  '{}'::jsonb, '{}'::jsonb
);

insert into public.article_working_copies (
  id, source_id, source_revision_id, article_id, slug, title, description,
  body_markdown, content_type_slug, category_slug
) values (
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  (select id from public.articles where slug = 'manual-review-defaults'),
  'manual-review-defaults', 'Manual review defaults',
  'A sufficiently long description for the existing direct article.',
  'Updated body from Notion', 'legal-articles', 'legal-practice'
);

select lives_ok(
  $$select public.prepare_publication_candidate(
    '30000000-0000-0000-0000-000000000003', 1, 0,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'A Notion-direct candidate can target an existing article'
);

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000003'),
    0,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'An existing article finalizes through the direct policy'
);

select is(
  (select privacy_reviewed from public.articles where slug = 'manual-review-defaults'),
  true,
  'Direct finalization leaves an existing true privacy value unchanged'
);

select is(
  (select legal_reviewed from public.articles where slug = 'manual-review-defaults'),
  false,
  'Direct finalization leaves an existing false legal value unchanged'
);

select lives_ok(
  $$select public.unpublish_article(
    (select id from public.articles where slug = 'manual-review-defaults'),
    1,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'A published Notion-backed article can be unpublished'
);

select is(
  (select status from public.articles where slug = 'manual-review-defaults'),
  'unpublished',
  'Unpublishing keeps the article as a manageable unpublished record'
);

select lives_ok(
  $$select public.prepare_publication_candidate(
    '30000000-0000-0000-0000-000000000003', 1, 2,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'The retained Notion working copy can prepare a republish candidate'
);

select lives_ok(
  $$select public.finalize_publication_candidate(
    (select id from public.publication_candidates
     where working_copy_id = '30000000-0000-0000-0000-000000000003'
       and state = 'prepared'),
    2,
    '90000000-0000-0000-0000-000000000003'
  )$$,
  'An unpublished article can be republished from its Notion candidate'
);

select is(
  (select status from public.articles where slug = 'manual-review-defaults'),
  'published',
  'Republishing restores the existing article without creating a replacement record'
);

select is(
  (select (public.save_article_with_policy(
    null, 'secondary-featured-article', 'Secondary featured article',
    'A sufficiently long description for the secondary featured article.',
    'Secondary article body', null, 'Secondary article body', 'published', now(),
    'legal-articles', 'legal-practice', '{}'::text[], false, null,
    null, null, null, 'notion_direct'
  )).featured),
  false,
  'A second published article starts without featured status'
);

select lives_ok(
  $$select public.set_featured_article(
    (select id from public.articles where slug = 'manual-review-defaults'),
    true,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'A published article can be selected as featured'
);

select is(
  (select featured from public.articles where slug = 'manual-review-defaults'),
  true,
  'The selected article is featured'
);

select is(
  (select featured from public.article_working_copies
   where id = '30000000-0000-0000-0000-000000000003'),
  false,
  'Featured selection remains Admin metadata rather than rewriting the Notion working copy'
);

select lives_ok(
  $$select public.set_featured_article(
    (select id from public.articles where slug = 'secondary-featured-article'),
    true,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'A different published article can replace the featured selection'
);

select is(
  (select count(*) from public.articles where featured),
  1::bigint,
  'Only one article can be featured'
);

select is(
  (select featured from public.articles where slug = 'manual-review-defaults'),
  false,
  'Selecting another article clears the previous featured article'
);

select is(
  (select featured from public.articles where slug = 'secondary-featured-article'),
  true,
  'The replacement article becomes featured'
);

select is(
  (select (public.save_article_with_policy(
    (select id from public.articles where slug = 'secondary-featured-article'),
    'secondary-featured-article', 'Secondary featured article',
    'A sufficiently long description for the secondary featured article.',
    'Republished article body', null, 'Republished article body', 'published', now(),
    'legal-articles', 'legal-practice', '{}'::text[], false, null,
    null, null, null, 'notion_direct'
  )).featured),
  true,
  'Republishing preserves the Admin-managed featured selection'
);

select lives_ok(
  $$select public.set_featured_article(
    (select id from public.articles where slug = 'secondary-featured-article'),
    false,
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'The featured selection can be cleared'
);

select is(
  (select count(*) from public.articles where featured),
  0::bigint,
  'Clearing the featured selection leaves no featured article'
);

select * from finish();
rollback;
