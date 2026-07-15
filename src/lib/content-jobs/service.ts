import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getNotionConfig, getSupabaseEnvironment } from '@/lib/content/env';
import {
  NotionClient,
  downloadNotionImage,
  renderNotionMarkdown,
  resolveNotionAssetUrls,
  validatedMediaUrl,
  validatedPublicMediaUrl,
  type MediaSourceRef,
  type NotionSourceSnapshot,
} from '@/lib/notion';
import { computeNotionHashes } from '@/lib/notion/hash';
import { normalizeSlug, slugFromTitle, withCollisionSuffix } from '@/lib/content/slug';
import type {
  AttestationRequest,
  PublishRequest,
  UnpublishRequest,
} from '@/lib/content-jobs/validation';

const WORKER_JOB_LIMIT = 5;
const WORKER_BUDGET_MS = 45_000;
const JOB_LEASE_SECONDS = 120;
const NOTION_LAST_EDITED_TIME_KEY = 'notion_last_edited_time';

type DatabaseRecord = Record<string, any>;

export interface WorkerResult {
  claimed: number;
  completed: number;
  failed: number;
  exhaustedBudget: boolean;
}

function throwIfError(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

function record(value: unknown): DatabaseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DatabaseRecord)
    : null;
}

function rpcRecord(value: unknown): DatabaseRecord | null {
  return record(Array.isArray(value) && value.length === 1 ? value[0] : value);
}

function rows(value: unknown): DatabaseRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const itemRecord = record(item);
    return itemRecord ? [itemRecord] : [];
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function validNotionTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function mergeNotionSourceConfiguration(
  configuration: unknown,
  lastEditedTime: string | null,
): DatabaseRecord {
  const current = record(configuration) ?? {};
  return lastEditedTime ? { ...current, [NOTION_LAST_EDITED_TIME_KEY]: lastEditedTime } : current;
}

export function shouldSyncNotionPage(
  configuration: unknown,
  lastEditedTime: string | null,
): boolean {
  // Missing, malformed, or unavailable timestamps fail open: a source is synced
  // rather than risking stale content due to incomplete metadata.
  if (!validNotionTimestamp(lastEditedTime)) return true;
  const current = record(configuration)?.[NOTION_LAST_EDITED_TIME_KEY];
  return !validNotionTimestamp(current) || current !== lastEditedTime;
}

export interface PromotedMedia {
  blockId: string;
  assetId: string;
  publicUrl: string;
  publicObjectPath: string;
  digest: string;
}

export function notionWorkingCopyText(snapshot: NotionSourceSnapshot): {
  title: string;
  description: string;
  bodyMarkdown: string;
  tags: string[];
} {
  const title = (snapshot.properties.title.trim() || '未命名 Notion 文章').slice(0, 120);
  const bodyMarkdown = renderNotionMarkdown(snapshot.document).trim() || title;
  let description = snapshot.properties.description.trim().replace(/\s+/g, ' ');
  if (description.length < 20)
    description = snapshot.document.searchText.trim().replace(/\s+/g, ' ');
  if (description.length < 20) description = `${title}的文章內容、實務重點與相關說明整理。`;
  description = description.slice(0, 180);
  const tags = snapshot.properties.tags
    .map((tag) => tag.trim())
    .filter(
      (tag, index, values) => Boolean(tag) && tag.length <= 40 && values.indexOf(tag) === index,
    )
    .slice(0, 20);
  return { title, description, bodyMarkdown, tags };
}

export function buildNotionRevisionInsert(input: {
  sourceId: string;
  snapshot: NotionSourceSnapshot;
  sourceHash: string;
  renderHash: string;
  promotedMedia: PromotedMedia[];
}): DatabaseRecord {
  const rawPayload = {
    page_id: input.snapshot.pageId,
    properties: input.snapshot.properties,
    document: input.snapshot.document,
  };
  return {
    source_id: input.sourceId,
    external_revision: `${input.snapshot.lastEditedTime || input.sourceHash}:${input.renderHash}`,
    content_hash: input.renderHash,
    source_hash: input.sourceHash,
    render_hash: input.renderHash,
    raw_payload: rawPayload,
    normalized_payload: {
      ...rawPayload,
      promoted_media: input.promotedMedia.map((media) => ({
        block_id: media.blockId,
        asset_id: media.assetId,
        public_url: media.publicUrl,
        digest: media.digest,
      })),
    },
    source_updated_at: input.snapshot.lastEditedTime,
  };
}

function safeSourceUrl(value: string): string {
  const url = validatedMediaUrl(value);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export class ContentJobService {
  constructor(private readonly client: SupabaseClient) {}

  private async enqueueJob(input: {
    jobType: string;
    dedupeKey?: string | null;
    sourceId?: string | null;
    candidateId?: string | null;
    payload?: DatabaseRecord;
    runAfter?: string;
    priority?: number;
    maxAttempts?: number;
  }): Promise<DatabaseRecord | null> {
    const { data, error } = await this.client.rpc('enqueue_content_job', {
      p_job_type: input.jobType,
      p_dedupe_key: input.dedupeKey ?? null,
      p_source_id: input.sourceId ?? null,
      p_candidate_id: input.candidateId ?? null,
      p_payload: input.payload ?? {},
      p_run_after: input.runAfter ?? new Date().toISOString(),
      p_priority: input.priority ?? 100,
      p_max_attempts: input.maxAttempts ?? 5,
    });
    throwIfError(error);
    return rpcRecord(data);
  }

  async enqueueSourceSync(input: {
    sourceId?: string;
    pageId?: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<DatabaseRecord | null> {
    const target = input.sourceId ?? input.pageId;
    if (!target) throw new Error('A source or page identifier is required.');
    return this.enqueueJob({
      jobType: 'sync_source',
      sourceId: input.sourceId,
      dedupeKey: `sync_source:${target}:${input.idempotencyKey}`,
      payload: {
        source_id: input.sourceId ?? null,
        notion_page_id: input.pageId ?? null,
        requested_by: input.actorId,
      },
    });
  }

  async enqueueRootSync(input: {
    actorId: string;
    idempotencyKey: string;
  }): Promise<DatabaseRecord | null> {
    return this.enqueueJob({
      jobType: 'sync_root',
      dedupeKey: `sync_root:${input.idempotencyKey}`,
      payload: { requested_by: input.actorId },
    });
  }

  async listSourceStatus(limit: number, articleId?: string): Promise<DatabaseRecord[]> {
    let query = this.client
      .from('article_sources')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (articleId) query = query.eq('article_id', articleId);
    const { data, error } = await query;
    throwIfError(error);
    const sources = rows(data);
    if (!sources.length) return sources;
    const { data: workingCopies, error: workingError } = await this.client
      .from('article_working_copies')
      .select('id,source_id,version')
      .in(
        'source_id',
        sources.map((source) => String(source.id)),
      );
    throwIfError(workingError);
    const bySource = new Map(rows(workingCopies).map((copy) => [String(copy.source_id), copy]));
    return sources.map((source) => ({
      ...source,
      working_copy_id: bySource.get(String(source.id))?.id ?? null,
      working_copy_version: bySource.get(String(source.id))?.version ?? null,
    }));
  }

  async getSourceStatus(sourceId: string): Promise<DatabaseRecord | null> {
    const { data, error } = await this.client
      .from('article_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();
    throwIfError(error);
    return record(data);
  }

  async bindSource(sourceId: string, articleId: string): Promise<DatabaseRecord> {
    const source = await this.getSourceStatus(sourceId);
    if (!source) throw new Error('Source not found.');
    const [
      { data: article, error: articleError },
      { data: revision, error: revisionError },
      { data: existingWorkingCopy, error: existingWorkingError },
    ] = await Promise.all([
      this.client.from('articles').select('*').eq('id', articleId).maybeSingle(),
      this.client
        .from('article_source_revisions')
        .select('*')
        .eq('source_id', sourceId)
        .order('observed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from('article_working_copies')
        .select('*')
        .eq('source_id', sourceId)
        .maybeSingle(),
    ]);
    throwIfError(articleError);
    throwIfError(revisionError);
    throwIfError(existingWorkingError);
    if (!article) throw new Error('Article not found.');
    if (!revision) throw new Error('Sync the Notion source before binding it.');
    const normalized = record(revision.normalized_payload);
    const document = record(normalized?.document);
    const searchText = stringValue(document?.searchText);
    const current = record(existingWorkingCopy);
    const { error: sourceError } = await this.client
      .from('article_sources')
      .update({ article_id: articleId, state: 'active', last_error: null })
      .eq('id', sourceId);
    throwIfError(sourceError);
    const { data: workingCopy, error: workingError } = await this.client
      .from('article_working_copies')
      .upsert(
        {
          source_id: sourceId,
          source_revision_id: revision.id,
          article_id: articleId,
          slug: article.slug,
          title: current?.title || article.title,
          description: current?.description || article.description,
          body_markdown:
            current?.body_markdown || article.body_markdown || searchText || article.title,
          body_json: null,
          body_html: null,
          published_at: article.published_at,
          content_type_slug: article.content_type_slug,
          category_slug: article.category_slug,
          tags: current?.tags || article.tags,
          featured: article.featured,
          cover: article.cover,
          seo_title: article.seo_title,
          seo_description: article.seo_description,
          canonical_url: article.canonical_url,
        },
        { onConflict: 'source_id' },
      )
      .select('*')
      .single();
    throwIfError(workingError);
    return record(workingCopy) || {};
  }

  async prepareCandidate(
    sourceId: string,
    actorId: string,
    expectedWorkingCopyVersion?: number,
    expectedPublicationVersion?: number,
  ): Promise<unknown> {
    const { data: workingCopy, error: workingError } = await this.client
      .from('article_working_copies')
      .select('id,version,article_id')
      .eq('source_id', sourceId)
      .maybeSingle();
    throwIfError(workingError);
    if (!workingCopy)
      throw new Error('Bind the source to an article before preparing a candidate.');
    let publicationVersion = expectedPublicationVersion;
    if (publicationVersion === undefined && workingCopy.article_id) {
      const { data: article, error } = await this.client
        .from('articles')
        .select('publication_version')
        .eq('id', workingCopy.article_id)
        .single();
      throwIfError(error);
      if (!article) throw new Error('Article not found.');
      publicationVersion = Number(article.publication_version);
    }
    const { data, error } = await this.client.rpc('prepare_publication_candidate', {
      p_working_copy_id: workingCopy.id,
      p_expected_working_copy_version:
        expectedWorkingCopyVersion === undefined
          ? Number(workingCopy.version)
          : expectedWorkingCopyVersion,
      p_expected_publication_version: publicationVersion ?? 0,
      p_prepared_by: actorId,
    });
    throwIfError(error);
    const candidate = rpcRecord(data);
    if (!candidate?.id) throw new Error('Publication candidate could not be created.');
    try {
      await this.attachCandidateMedia(candidate);
    } catch (mediaError) {
      const { error: cancelError } = await this.client
        .from('publication_candidates')
        .update({
          state: 'cancelled',
          cancelled_at: new Date().toISOString(),
          failure_reason: 'media_reference_creation_failed',
        })
        .eq('id', candidate.id);
      throwIfError(cancelError);
      throw mediaError;
    }
    return candidate;
  }

  async listCandidateStatus(limit: number, articleId?: string): Promise<DatabaseRecord[]> {
    let query = this.client
      .from('publication_candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (articleId) query = query.eq('article_id', articleId);
    const { data, error } = await query;
    throwIfError(error);
    return rows(data);
  }

  async getCandidateStatus(candidateId: string): Promise<DatabaseRecord | null> {
    const { data, error } = await this.client
      .from('publication_candidates')
      .select('*')
      .eq('id', candidateId)
      .maybeSingle();
    throwIfError(error);
    return record(data);
  }

  async getJobStatus(jobId: string): Promise<DatabaseRecord | null> {
    const { data, error } = await this.client
      .from('content_jobs')
      .select(
        'id, job_type, candidate_id, state, attempts, max_attempts, run_after, started_at, completed_at, last_error',
      )
      .eq('id', jobId)
      .maybeSingle();
    throwIfError(error);
    return record(data);
  }

  async attestReview(
    candidateId: string,
    actorId: string,
    input: AttestationRequest,
  ): Promise<unknown> {
    const candidate = await this.getCandidateStatus(candidateId);
    if (!candidate) throw new Error('Publication candidate not found.');
    if (candidate.candidate_hash !== input.candidateHash) {
      throw Object.assign(new Error('Candidate changed; reload before reviewing.'), {
        code: '409',
      });
    }
    const { data, error } = await this.client.rpc('attest_publication_candidate', {
      p_candidate_id: candidateId,
      p_review_kind: input.reviewType,
      p_decision: input.action === 'attest' ? 'approved' : 'rejected',
      p_notes: input.reason,
      p_attested_by: actorId,
    });
    throwIfError(error);
    return Array.isArray(data) && data.length === 1 ? data[0] : data;
  }

  async requestPublish(
    candidateId: string,
    actorId: string,
    input: PublishRequest,
    options: { immediate?: boolean } = {},
  ): Promise<DatabaseRecord> {
    const candidate = await this.getCandidateStatus(candidateId);
    if (!candidate) throw new Error('Publication candidate not found.');
    if (
      candidate.source_revision_id !== input.expectedRevisionId ||
      Number(candidate.working_copy_version) !== input.expectedMetadataVersion ||
      candidate.candidate_hash !== input.expectedCandidateHash
    ) {
      throw Object.assign(new Error('Publication candidate changed; reload before publishing.'), {
        code: '409',
      });
    }
    if (options.immediate) {
      if (!['prepared', 'ready_to_activate'].includes(String(candidate.state))) {
        throw Object.assign(
          new Error('Only due prepared or ready-to-activate candidates can publish immediately.'),
          { code: '409' },
        );
      }
      const activationAt = Date.parse(String(candidate.activation_at));
      if (!Number.isFinite(activationAt) || activationAt > Date.now()) {
        throw Object.assign(
          new Error('Scheduled publication cannot be published immediately before activation.'),
          { code: '409' },
        );
      }
    }
    const data = await this.enqueueJob({
      jobType: 'finalize_candidate',
      candidateId,
      dedupeKey: `finalize_candidate:${candidateId}:${input.idempotencyKey}`,
      payload: { requested_by: actorId, candidate_id: candidateId },
      runAfter: options.immediate ? undefined : candidate.activation_at || undefined,
      priority: 1,
    });
    return (
      data || {
        candidate_id: candidateId,
        job_id: null,
        state: 'queued',
        run_after: candidate.activation_at,
      }
    );
  }

  async unpublish(articleId: string, actorId: string, input: UnpublishRequest): Promise<unknown> {
    const { data, error } = await this.client.rpc('unpublish_article', {
      p_article_id: articleId,
      p_expected_publication_version: input.expectedPublicationVersion,
      p_actor_id: actorId,
    });
    throwIfError(error);
    return Array.isArray(data) && data.length === 1 ? data[0] : data;
  }

  private async attachCandidateMedia(candidate: DatabaseRecord): Promise<void> {
    const { data: revision, error } = await this.client
      .from('article_source_revisions')
      .select('normalized_payload')
      .eq('id', candidate.source_revision_id)
      .single();
    throwIfError(error);
    const normalized = record(revision?.normalized_payload);
    const promoted = rows(normalized?.promoted_media);
    if (!promoted.length) return;
    const references = promoted.map((media) => {
      const assetId = stringValue(media.asset_id);
      const blockId = stringValue(media.block_id);
      if (!assetId || !blockId) throw new Error('Promoted Notion media metadata is incomplete.');
      return {
        candidate_id: candidate.id,
        asset_id: assetId,
        reference_key: `asset://notion/${blockId}`,
        usage_kind: 'inline',
        required: true,
      };
    });
    const { error: referenceError } = await this.client
      .from('content_media_references')
      .upsert(references, { onConflict: 'candidate_id,reference_key' });
    throwIfError(referenceError);
  }

  async runWorker(options: { limit?: number; budgetMs?: number } = {}): Promise<WorkerResult> {
    const limit = Math.min(Math.max(options.limit ?? WORKER_JOB_LIMIT, 1), WORKER_JOB_LIMIT);
    const budgetMs = Math.min(Math.max(options.budgetMs ?? WORKER_BUDGET_MS, 1), WORKER_BUDGET_MS);
    const workerId = `vercel:${randomUUID()}`;
    const { data: leaseData, error: leaseError } = await this.client.rpc('acquire_worker_lease', {
      p_worker_id: workerId,
      p_ttl_seconds: JOB_LEASE_SECONDS,
      p_capabilities: ['sync_root', 'sync_source', 'finalize_candidate'],
      p_metadata: { runtime: 'vercel-cron' },
    });
    throwIfError(leaseError);
    const lease = rpcRecord(leaseData);
    const leaseToken = stringValue(lease?.lease_token);
    if (!leaseToken) throw new Error('Worker lease was not acquired.');

    const startedAt = Date.now();
    let claimed = 0;
    let completed = 0;
    let failed = 0;
    while (claimed < limit && Date.now() - startedAt < budgetMs) {
      const { data, error } = await this.client.rpc('claim_content_job', {
        p_worker_id: workerId,
        p_lease_token: leaseToken,
        p_job_types: ['sync_root', 'sync_source', 'finalize_candidate'],
      });
      throwIfError(error);
      const job = rpcRecord(data);
      if (!job?.id || !job.job_type) break;
      claimed += 1;
      try {
        await this.dispatchJob(job);
        await this.completeJob(String(job.id), workerId, leaseToken, true);
        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Content job failed.';
        await this.completeJob(String(job.id), workerId, leaseToken, false, message.slice(0, 1000));
        failed += 1;
      }
    }
    return { claimed, completed, failed, exhaustedBudget: Date.now() - startedAt >= budgetMs };
  }

  private notionClient(): NotionClient {
    const config = getNotionConfig();
    if (!config) throw new Error('Notion editorial integration is not configured.');
    return new NotionClient({ token: config.token });
  }

  private async dispatchJob(job: DatabaseRecord): Promise<void> {
    if (job.job_type === 'sync_root') return this.syncRoot(job);
    if (job.job_type === 'sync_source') return this.syncSource(job);
    if (job.job_type === 'finalize_candidate')
      return this.finalizeCandidate(String(job.candidate_id), record(job.payload));
    throw new Error(`Unsupported content job type: ${String(job.job_type)}`);
  }

  private async syncRoot(job: DatabaseRecord): Promise<void> {
    const config = getNotionConfig();
    if (!config) throw new Error('Notion editorial integration is not configured.');
    const requestedBy = stringValue(record(job.payload)?.requested_by);
    if (!requestedBy) throw new Error('Content job is missing its requesting actor.');
    const childPages = await this.notionClient().listChildPages(config.rootPageId);
    if (!childPages.length) return;
    const { data: existingSources, error } = await this.client
      .from('article_sources')
      .select('id,external_id,configuration')
      .eq('provider', 'notion')
      .in(
        'external_id',
        childPages.map((page) => page.id),
      );
    throwIfError(error);
    const byPageId = new Map(
      rows(existingSources).map((source) => [String(source.external_id), source]),
    );
    for (const page of childPages) {
      const source = byPageId.get(page.id);
      if (source && !shouldSyncNotionPage(source.configuration, page.lastEditedTime)) continue;
      await this.enqueueSourceSync({
        pageId: page.id,
        actorId: requestedBy,
        idempotencyKey: `root:${String(job.id)}:${page.id}`,
      });
    }
  }

  private async syncSource(job: DatabaseRecord): Promise<void> {
    const payload = record(job.payload) || {};
    let sourceId = stringValue(payload.source_id) || stringValue(job.source_id);
    let pageId = stringValue(payload.notion_page_id);
    if (sourceId && !pageId) {
      const source = await this.getSourceStatus(sourceId);
      pageId = stringValue(source?.external_id);
    }
    if (!pageId) throw new Error('A Notion page id is required for source sync.');

    const snapshot = await this.notionClient().readSourceSnapshot(pageId);
    let source: DatabaseRecord | null = sourceId ? await this.getSourceStatus(sourceId) : null;
    if (!sourceId) {
      const { data, error } = await this.client
        .from('article_sources')
        .upsert(
          {
            provider: 'notion',
            external_id: pageId,
            source_url: snapshot.url,
            state: snapshot.sourceState === 'archived' ? 'archived' : 'onboarding',
            configuration: mergeNotionSourceConfiguration({}, snapshot.lastEditedTime),
          },
          { onConflict: 'provider,external_id' },
        )
        .select('*')
        .single();
      throwIfError(error);
      source = record(data);
      sourceId = stringValue(source?.id);
    }
    if (!sourceId) throw new Error('Source could not be created.');

    let promotedMedia: PromotedMedia[];
    try {
      promotedMedia = await this.promoteMedia(sourceId, null, snapshot.document.mediaSourceRefs);
    } catch (error) {
      const { error: sourceFailure } = await this.client
        .from('article_sources')
        .update({
          state: 'error',
          last_error: error instanceof Error ? error.message : 'media_failed',
        })
        .eq('id', sourceId);
      throwIfError(sourceFailure);
      throw error;
    }
    const hashes = computeNotionHashes({
      properties: snapshot.properties,
      document: snapshot.document,
      stagedMediaDigests: promotedMedia.map((media) => media.digest),
    });
    const revisionInsert = buildNotionRevisionInsert({
      sourceId,
      snapshot,
      sourceHash: hashes.sourceHash,
      renderHash: hashes.renderHash,
      promotedMedia,
    });
    const { error: revisionError } = await this.client
      .from('article_source_revisions')
      .upsert(revisionInsert, {
        onConflict: 'source_id,content_hash',
        ignoreDuplicates: true,
      });
    throwIfError(revisionError);
    const { data: revision, error: revisionLookupError } = await this.client
      .from('article_source_revisions')
      .select('id')
      .eq('source_id', sourceId)
      .eq('content_hash', hashes.renderHash)
      .single();
    throwIfError(revisionLookupError);
    const revisionId = stringValue(revision?.id);
    if (!revisionId) throw new Error('Synced revision could not be found.');
    await this.linkPromotedMediaToRevision(sourceId, revisionId, promotedMedia);

    const logicalMarkdown = renderNotionMarkdown(snapshot.document);
    const bodyMarkdown = resolveNotionAssetUrls(
      logicalMarkdown,
      new Map(promotedMedia.map((media) => [media.blockId, media.publicUrl])),
    );
    await this.upsertWorkingCopy(sourceId, revisionId, source, snapshot, bodyMarkdown);
    const { error: sourceError } = await this.client
      .from('article_sources')
      .update({
        source_url: snapshot.url,
        configuration: mergeNotionSourceConfiguration(
          source?.configuration,
          snapshot.lastEditedTime,
        ),
        state: snapshot.sourceState === 'archived' ? 'archived' : 'active',
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', sourceId);
    throwIfError(sourceError);
  }

  async linkPromotedMediaToRevision(
    sourceId: string,
    revisionId: string,
    promotedMedia: PromotedMedia[],
  ): Promise<void> {
    const assetIds = [...new Set(promotedMedia.map((media) => media.assetId))];
    if (!assetIds.length) return;
    const { data, error } = await this.client
      .from('content_media_assets')
      .update({ source_revision_id: revisionId })
      .eq('source_id', sourceId)
      .in('id', assetIds)
      .select('id');
    throwIfError(error);
    const linkedIds = new Set(rows(data).map((asset) => String(asset.id)));
    if (assetIds.some((assetId) => !linkedIds.has(assetId))) {
      throw new Error('Promoted Notion media could not be linked to its source revision.');
    }
  }

  private async promoteMedia(
    sourceId: string,
    revisionId: string | null,
    refs: MediaSourceRef[],
  ): Promise<PromotedMedia[]> {
    const promoted: PromotedMedia[] = [];
    for (const ref of refs) promoted.push(await this.promoteMediaRef(sourceId, revisionId, ref));
    return promoted;
  }

  private async promoteMediaRef(
    sourceId: string,
    revisionId: string | null,
    ref: MediaSourceRef,
  ): Promise<PromotedMedia> {
    let downloaded;
    try {
      downloaded = await downloadNotionImage(ref);
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Notion image download failed.';
      const failureFingerprint = `${ref.blockId}:failed:${createHash('sha256')
        .update(ref.canonicalRef)
        .digest('hex')}`;
      const failureAsset = {
        source_id: sourceId,
        source_revision_id: revisionId,
        source_url: safeSourceUrl(ref.fetchUrl),
        source_fingerprint: failureFingerprint,
        alt_text: ref.caption,
        state: 'failed',
        failure_reason: failureReason.slice(0, 1000),
      };
      const { data: existingFailure, error: failureLookupError } = await this.client
        .from('content_media_assets')
        .select('id')
        .eq('source_id', sourceId)
        .eq('source_fingerprint', failureFingerprint)
        .maybeSingle();
      throwIfError(failureLookupError);
      const failureRequest = existingFailure?.id
        ? this.client.from('content_media_assets').update(failureAsset).eq('id', existingFailure.id)
        : this.client.from('content_media_assets').insert(failureAsset);
      const { error: assetError } = await failureRequest;
      throwIfError(assetError);
      throw error;
    }
    const fingerprint = `${ref.blockId}:${downloaded.digest}`;
    const { data: existing, error: existingError } = await this.client
      .from('content_media_assets')
      .select('*')
      .eq('source_id', sourceId)
      .eq('source_fingerprint', fingerprint)
      .maybeSingle();
    throwIfError(existingError);
    const existingAsset = record(existing);
    if (existingAsset?.state === 'ready' && stringValue(existingAsset.public_object_path)) {
      const publicObjectPath = String(existingAsset.public_object_path);
      const { data } = this.client.storage.from('site-media').getPublicUrl(publicObjectPath);
      const publicUrl = validatedPublicMediaUrl(data.publicUrl).toString();
      return {
        blockId: ref.blockId,
        assetId: String(existingAsset.id),
        publicUrl,
        publicObjectPath,
        digest: downloaded.digest,
      };
    }
    const publicObjectPath = `notion/${sourceId}/${downloaded.digest}-${ref.blockId}.${downloaded.extension}`;
    const assetPatch = {
      source_id: sourceId,
      source_revision_id: revisionId,
      source_url: safeSourceUrl(ref.fetchUrl),
      source_fingerprint: fingerprint,
      public_object_path: publicObjectPath,
      mime_type: downloaded.mimeType,
      byte_size: downloaded.byteSize,
      alt_text: ref.caption,
      state: 'processing',
      failure_reason: null,
    };
    const assetRequest = existingAsset?.id
      ? this.client.from('content_media_assets').update(assetPatch).eq('id', existingAsset.id)
      : this.client.from('content_media_assets').insert(assetPatch);
    const { data: asset, error: assetError } = await assetRequest.select('*').single();
    throwIfError(assetError);
    const assetId = stringValue(asset?.id);
    if (!assetId) throw new Error('Notion media asset could not be created.');
    const { error: uploadError } = await this.client.storage
      .from('site-media')
      .upload(publicObjectPath, downloaded.bytes, {
        contentType: downloaded.mimeType,
        cacheControl: '31536000',
        upsert: false,
      });
    if (uploadError && !String(uploadError.message).toLowerCase().includes('already exists')) {
      await this.client
        .from('content_media_assets')
        .update({ state: 'failed', failure_reason: uploadError.message.slice(0, 1000) })
        .eq('id', assetId);
      throw uploadError;
    }
    const { data: publicData } = this.client.storage
      .from('site-media')
      .getPublicUrl(publicObjectPath);
    const publicUrl = validatedPublicMediaUrl(publicData.publicUrl).toString();
    const { error: readyError } = await this.client
      .from('content_media_assets')
      .update({ state: 'ready', failure_reason: null })
      .eq('id', assetId);
    throwIfError(readyError);
    return {
      blockId: ref.blockId,
      assetId,
      publicUrl,
      publicObjectPath,
      digest: downloaded.digest,
    };
  }

  private async upsertWorkingCopy(
    sourceId: string,
    revisionId: string,
    source: DatabaseRecord | null,
    snapshot: NotionSourceSnapshot,
    bodyMarkdown: string,
  ): Promise<void> {
    const text = notionWorkingCopyText(snapshot);
    const { data: current, error: currentError } = await this.client
      .from('article_working_copies')
      .select('*')
      .eq('source_id', sourceId)
      .maybeSingle();
    throwIfError(currentError);
    if (current) {
      const { error } = await this.client
        .from('article_working_copies')
        .update({
          source_revision_id: revisionId,
          title: text.title,
          description: text.description,
          body_markdown: bodyMarkdown,
          body_json: null,
          body_html: null,
          tags: text.tags,
        })
        .eq('source_id', sourceId);
      throwIfError(error);
      return;
    }

    const articleId = stringValue(source?.article_id);
    let article: DatabaseRecord | null = null;
    if (articleId) {
      const { data, error } = await this.client
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();
      throwIfError(error);
      article = record(data);
    }
    const taxonomies = article ? null : await this.defaultTaxonomies();
    const slug = article
      ? String(article.slug)
      : await this.availableSlug(snapshot.properties.slug, text.title);
    const { error } = await this.client.from('article_working_copies').insert({
      source_id: sourceId,
      source_revision_id: revisionId,
      article_id: articleId,
      slug,
      title: text.title,
      description: text.description,
      body_markdown: bodyMarkdown || text.bodyMarkdown,
      body_json: null,
      body_html: null,
      published_at: article?.published_at ?? null,
      content_type_slug: article?.content_type_slug ?? taxonomies!.contentTypeSlug,
      category_slug: article?.category_slug ?? taxonomies!.categorySlug,
      tags: text.tags,
      featured: Boolean(article?.featured),
      cover: article?.cover ?? null,
      seo_title: article?.seo_title ?? null,
      seo_description: article?.seo_description ?? null,
      canonical_url: article?.canonical_url ?? null,
    });
    throwIfError(error);
  }

  private async defaultTaxonomies(): Promise<{ contentTypeSlug: string; categorySlug: string }> {
    const [{ data: contentType, error: typeError }, { data: category, error: categoryError }] =
      await Promise.all([
        this.client.from('content_types').select('slug').order('name').limit(1).maybeSingle(),
        this.client
          .from('categories')
          .select('slug')
          .eq('visible', true)
          .order('display_order')
          .order('name')
          .limit(1)
          .maybeSingle(),
      ]);
    throwIfError(typeError);
    throwIfError(categoryError);
    const contentTypeSlug = stringValue(contentType?.slug);
    const categorySlug = stringValue(category?.slug);
    if (!contentTypeSlug || !categorySlug)
      throw new Error('Article taxonomies are not configured.');
    return { contentTypeSlug, categorySlug };
  }

  private async availableSlug(requestedSlug: string | null, title: string): Promise<string> {
    const base = requestedSlug ? normalizeSlug(requestedSlug) : slugFromTitle(title, 'article');
    const [{ data: articles, error: articleError }, { data: workingCopies, error: workingError }] =
      await Promise.all([
        this.client.from('articles').select('slug').ilike('slug', `${base}%`),
        this.client.from('article_working_copies').select('slug').ilike('slug', `${base}%`),
      ]);
    throwIfError(articleError);
    throwIfError(workingError);
    const taken = new Set(
      [...rows(articles), ...rows(workingCopies)].map((row) =>
        String(row.slug).toLocaleLowerCase(),
      ),
    );
    if (!taken.has(base.toLocaleLowerCase())) return base;
    let index = 2;
    while (taken.has(withCollisionSuffix(base, index).toLocaleLowerCase())) index += 1;
    return withCollisionSuffix(base, index);
  }

  private async finalizeCandidate(candidateId: string, payload: DatabaseRecord | null): Promise<void> {
    const actorId = stringValue(payload?.requested_by);
    if (!actorId) throw new Error('Publication job is missing its requesting actor.');
    const candidate = await this.getCandidateStatus(candidateId);
    if (!candidate) throw new Error('Publication candidate not found.');
    const source = await this.getSourceStatus(String(candidate.source_id));
    const pageId = stringValue(source?.external_id);
    if (!pageId) throw new Error('Publication source is missing its Notion page id.');
    const snapshot = await this.notionClient().readSourceSnapshot(pageId);
    const downloadedMedia = await Promise.all(
      snapshot.document.mediaSourceRefs.map((ref) => downloadNotionImage(ref)),
    );
    const hashes = computeNotionHashes({
      properties: snapshot.properties,
      document: snapshot.document,
      stagedMediaDigests: downloadedMedia.map((media) => media.digest),
    });
    if (
      snapshot.sourceState === 'archived' ||
      hashes.sourceHash !== candidate.source_hash ||
      hashes.renderHash !== candidate.render_hash
    ) {
      await this.cancelStaleCandidate(candidateId, `source_changed:${hashes.sourceHash}`, actorId);
      throw new Error('source_changed');
    }
    const { error } = await this.client.rpc('finalize_publication_candidate', {
      p_candidate_id: candidateId,
      p_expected_publication_version: Number(candidate.expected_publication_version),
      p_actor_id: actorId,
    });
    throwIfError(error);
  }

  private async cancelStaleCandidate(
    candidateId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    const { data: candidate, error: readError } = await this.client
      .from('publication_candidates')
      .select('source_id')
      .eq('id', candidateId)
      .maybeSingle();
    throwIfError(readError);
    const { error } = await this.client
      .from('publication_candidates')
      .update({
        state: 'cancelled',
        cancelled_at: new Date().toISOString(),
        failure_reason: reason,
      })
      .eq('id', candidateId)
      .in('state', ['prepared', 'publishing', 'media_failed', 'ready_to_activate']);
    throwIfError(error);
    const sourceId = stringValue(record(candidate)?.source_id);
    if (sourceId) {
      await this.enqueueSourceSync({
        sourceId,
        actorId,
        idempotencyKey: `source-changed:${candidateId}:${reason}`,
      });
    }
  }

  private async completeJob(
    jobId: string,
    workerId: string,
    leaseToken: string,
    succeeded: boolean,
    errorMessage?: string,
  ): Promise<void> {
    if (succeeded) {
      const { error } = await this.client.rpc('complete_content_job', {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_lease_token: leaseToken,
      });
      throwIfError(error);
      return;
    }
    const { error } = await this.client.rpc('fail_content_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_error: errorMessage || 'Content job failed.',
      p_retry_delay_seconds: 60,
    });
    throwIfError(error);
  }
}

export function getContentJobService(): ContentJobService {
  const environment = getSupabaseEnvironment();
  if (!environment) throw new Response('Editorial database is not configured.', { status: 503 });
  return new ContentJobService(
    createClient(environment.url, environment.secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}
