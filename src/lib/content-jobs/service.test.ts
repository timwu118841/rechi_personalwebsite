import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  buildNotionRevisionInsert,
  ContentJobService,
  mergeNotionSourceConfiguration,
  notionWorkingCopyText,
  shouldSyncNotionPage,
} from './service';

function clientWith(overrides: {
  from?: (table: string) => unknown;
  rpc?: (name: string, input: Record<string, unknown>) => unknown;
}): SupabaseClient {
  return {
    from: overrides.from ?? vi.fn(),
    rpc: overrides.rpc ?? vi.fn(),
  } as unknown as SupabaseClient;
}

describe('ContentJobService idempotency and unbound-source behavior', () => {
  it('skips unchanged canonical Notion timestamps but fails open for missing or malformed metadata', () => {
    const configuration = {
      editorial_mode: 'shadow',
      notion_last_edited_time: '2026-07-15T00:00:00.000Z',
    };
    expect(shouldSyncNotionPage(configuration, '2026-07-15T00:00:00.000Z')).toBe(false);
    expect(shouldSyncNotionPage(configuration, '2026-07-15T00:00:01.000Z')).toBe(true);
    expect(shouldSyncNotionPage({}, '2026-07-15T00:00:00.000Z')).toBe(true);
    expect(shouldSyncNotionPage(configuration, null)).toBe(true);
    expect(
      shouldSyncNotionPage({ notion_last_edited_time: 'not-a-date' }, '2026-07-15T00:00:00.000Z'),
    ).toBe(true);
  });

  it('merges canonical timestamp without dropping existing source configuration', () => {
    expect(
      mergeNotionSourceConfiguration(
        { editorial_mode: 'shadow', notion_last_edited_time: 'old' },
        '2026-07-15T00:00:00.000Z',
      ),
    ).toEqual({ editorial_mode: 'shadow', notion_last_edited_time: '2026-07-15T00:00:00.000Z' });
    expect(mergeNotionSourceConfiguration({ editorial_mode: 'shadow' }, null)).toEqual({
      editorial_mode: 'shadow',
    });
  });

  it('enqueues a dedicated root sync job without exposing the configured root page id', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const service = new ContentJobService(clientWith({ rpc }));

    await service.enqueueRootSync({ actorId: 'admin-id', idempotencyKey: 'root-operation' });

    expect(rpc).toHaveBeenCalledWith(
      'enqueue_content_job',
      expect.objectContaining({
        p_job_type: 'sync_root',
        p_dedupe_key: 'sync_root:root-operation',
        p_payload: { requested_by: 'admin-id' },
      }),
    );
  });

  it('uses the same active-job dedupe key when a source sync request is retried', async () => {
    const rpc = vi.fn(async (...args: [string, Record<string, unknown>]) => {
      void args;
      return { data: null, error: null };
    });
    const service = new ContentJobService(clientWith({ rpc }));
    const request = {
      pageId: 'notion-page',
      actorId: 'admin-id',
      idempotencyKey: 'operation-id',
    };

    await service.enqueueSourceSync(request);
    await service.enqueueSourceSync(request);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([, input]) => input)).toEqual([
      expect.objectContaining({
        p_job_type: 'sync_source',
        p_dedupe_key: 'sync_source:notion-page:operation-id',
      }),
      expect.objectContaining({
        p_job_type: 'sync_source',
        p_dedupe_key: 'sync_source:notion-page:operation-id',
      }),
    ]);
  });

  it('prepares an unbound working copy with publication version zero without reading articles', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ id: 'candidate-id', article_id: null, expected_publication_version: 0 }],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'articles') throw new Error('articles must not be read for an unbound copy');
      if (table === 'article_source_revisions') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { normalized_payload: {} }, error: null }),
            }),
          }),
        };
      }
      expect(table).toBe('article_working_copies');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'working-copy-id', version: 3, article_id: null },
              error: null,
            }),
          }),
        }),
      };
    });
    const service = new ContentJobService(clientWith({ from, rpc }));

    await expect(service.prepareCandidate('source-id', 'admin-id')).resolves.toMatchObject({
      article_id: null,
      expected_publication_version: 0,
    });
    expect(rpc).toHaveBeenCalledWith('prepare_publication_candidate', {
      p_working_copy_id: 'working-copy-id',
      p_expected_working_copy_version: 3,
      p_expected_publication_version: 0,
      p_prepared_by: 'admin-id',
    });
  });

  it('upserts promoted media references by candidate and logical reference key', async () => {
    const referenceWrites: Array<{ value: unknown; options: unknown }> = [];
    const rpc = vi.fn(async () => ({
      data: [{ id: 'candidate-id', source_revision_id: 'revision-id' }],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'article_working_copies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'working-copy-id', version: 1, article_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'article_source_revisions') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  normalized_payload: {
                    promoted_media: [{ asset_id: 'asset-id', block_id: 'block-id' }],
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      expect(table).toBe('content_media_references');
      return {
        upsert(value: unknown, options: unknown) {
          referenceWrites.push({ value, options });
          return Promise.resolve({ error: null });
        },
      };
    });
    const service = new ContentJobService(clientWith({ from, rpc }));

    await service.prepareCandidate('source-id', 'admin-id');

    expect(referenceWrites).toEqual([
      {
        value: [
          {
            candidate_id: 'candidate-id',
            asset_id: 'asset-id',
            reference_key: 'asset://notion/block-id',
            usage_kind: 'inline',
            required: true,
          },
        ],
        options: { onConflict: 'candidate_id,reference_key' },
      },
    ]);
  });

  it('derives valid metadata for a new working copy when optional Notion fields are empty', () => {
    expect(
      notionWorkingCopyText({
        pageId: 'page-1',
        sourceState: 'active',
        lastEditedTime: null,
        url: null,
        properties: {
          title: '新文章',
          description: '',
          tags: ['法律', '法律', ''],
          slug: null,
          values: {},
        },
        document: { version: 1, blocks: [], searchText: '', mediaSourceRefs: [] },
      }),
    ).toMatchObject({
      title: '新文章',
      tags: ['法律'],
      bodyMarkdown: '新文章',
      description: expect.stringMatching(/^.{20,180}$/u),
    });
  });

  it('builds a complete immutable revision before insertion and dedupes by render content', () => {
    const snapshot = {
      pageId: 'page-1',
      sourceState: 'active' as const,
      lastEditedTime: '2026-07-15T00:00:00.000Z',
      url: 'https://notion.so/page-1',
      properties: { title: '文章', description: '', tags: [], slug: null, values: {} },
      document: { version: 1 as const, blocks: [], searchText: '文章', mediaSourceRefs: [] },
    };
    const input = {
      sourceId: 'source-id',
      snapshot,
      sourceHash: 'a'.repeat(64),
      renderHash: 'b'.repeat(64),
      promotedMedia: [
        {
          blockId: 'block-id',
          assetId: 'asset-id',
          publicUrl: 'https://cdn.example.com/image.png',
          publicObjectPath: 'notion/source/image.png',
          digest: 'c'.repeat(64),
        },
      ],
    };

    const first = buildNotionRevisionInsert(input);
    const replay = buildNotionRevisionInsert(input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      source_id: 'source-id',
      content_hash: 'b'.repeat(64),
      source_hash: 'a'.repeat(64),
      render_hash: 'b'.repeat(64),
      normalized_payload: {
        promoted_media: [
          {
            block_id: 'block-id',
            asset_id: 'asset-id',
            public_url: 'https://cdn.example.com/image.png',
            digest: 'c'.repeat(64),
          },
        ],
      },
    });
    expect(first.external_revision).toContain('b'.repeat(64));
    expect(first.raw_payload).not.toHaveProperty('promoted_media');
  });

  it('links every promoted media asset to the inserted revision within the same source', async () => {
    const writes: unknown[] = [];
    const client = clientWith({
      from: (table: string) => {
        expect(table).toBe('content_media_assets');
        return {
          update(value: unknown) {
            writes.push(value);
            return {
              eq(column: string, value: string) {
                expect([column, value]).toEqual(['source_id', 'source-id']);
                return {
                  in(assetColumn: string, assetIds: string[]) {
                    expect([assetColumn, assetIds]).toEqual(['id', ['asset-1', 'asset-2']]);
                    return {
                      select: async () => ({
                        data: [{ id: 'asset-1' }, { id: 'asset-2' }],
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    });
    const service = new ContentJobService(client);
    const media = (assetId: string) => ({
      blockId: `block-${assetId}`,
      assetId,
      publicUrl: `https://cdn.example.com/${assetId}.png`,
      publicObjectPath: `notion/source/${assetId}.png`,
      digest: 'c'.repeat(64),
    });

    await service.linkPromotedMediaToRevision('source-id', 'revision-id', [
      media('asset-1'),
      media('asset-2'),
      media('asset-1'),
    ]);

    expect(writes).toEqual([{ source_revision_id: 'revision-id' }]);
  });

  it('uses the same active-job dedupe key when publication is requested again', async () => {
    const candidate = {
      id: 'candidate-id',
      source_revision_id: 'revision-id',
      working_copy_version: 4,
      candidate_hash: 'candidate-hash',
      activation_at: '2026-07-15T00:00:00.000Z',
    };
    const from = vi.fn((table: string) => {
      if (table === 'publication_candidates') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: candidate, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const rpc = vi.fn(async () => ({ data: { id: 'job-id' }, error: null }));
    const service = new ContentJobService(clientWith({ from, rpc }));
    const request = {
      expectedRevisionId: 'revision-id',
      expectedMetadataVersion: 4,
      expectedCandidateHash: 'candidate-hash',
      idempotencyKey: 'publish-operation',
    };

    await service.requestPublish('candidate-id', 'admin-id', request);
    await service.requestPublish('candidate-id', 'admin-id', request);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual([
      'enqueue_content_job',
      expect.objectContaining({
        p_job_type: 'finalize_candidate',
        p_dedupe_key: 'finalize_candidate:candidate-id:publish-operation',
        p_candidate_id: 'candidate-id',
        p_priority: 1,
      }),
    ]);
  });

  it('queues an already-reviewed due candidate immediately with the existing dedupe key', async () => {
    const candidate = {
      id: 'candidate-id',
      source_revision_id: 'revision-id',
      working_copy_version: 4,
      candidate_hash: 'candidate-hash',
      state: 'ready_to_activate',
      activation_at: '2020-01-01T00:00:00.000Z',
    };
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: candidate, error: null }) }),
      }),
    }));
    let queuedInput: Record<string, unknown> | undefined;
    const rpc = vi.fn(async (_name: string, input: Record<string, unknown>) => {
      queuedInput = input;
      return { data: { id: 'job-id' }, error: null };
    });
    const service = new ContentJobService(clientWith({ from, rpc }));
    const request = {
      expectedRevisionId: 'revision-id',
      expectedMetadataVersion: 4,
      expectedCandidateHash: 'candidate-hash',
      idempotencyKey: 'publish-now-operation',
    };

    await service.requestPublish('candidate-id', 'admin-id', request, { immediate: true });

    expect(rpc).toHaveBeenCalledWith(
      'enqueue_content_job',
      expect.objectContaining({
        p_job_type: 'finalize_candidate',
        p_dedupe_key: 'finalize_candidate:candidate-id:publish-now-operation',
        p_run_after: expect.any(String),
      }),
    );
    const queuedAt = String(queuedInput?.p_run_after);
    expect(Date.parse(queuedAt)).toBeGreaterThan(Date.parse(candidate.activation_at));

    candidate.state = 'prepared';
    await service.requestPublish(
      'candidate-id',
      'admin-id',
      { ...request, idempotencyKey: 'publish-prepared-now-operation' },
      { immediate: true },
    );
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('does not bypass review readiness or a future activation for immediate publication', async () => {
    const candidate = {
      id: 'candidate-id',
      source_revision_id: 'revision-id',
      working_copy_version: 4,
      candidate_hash: 'candidate-hash',
      state: 'prepared',
      activation_at: '2999-01-01T00:00:00.000Z',
    };
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: candidate, error: null }) }),
      }),
    }));
    const rpc = vi.fn();
    const service = new ContentJobService(clientWith({ from, rpc }));
    const request = {
      expectedRevisionId: 'revision-id',
      expectedMetadataVersion: 4,
      expectedCandidateHash: 'candidate-hash',
      idempotencyKey: 'publish-now-operation',
    };

    await expect(
      service.requestPublish('candidate-id', 'admin-id', request, { immediate: true }),
    ).rejects.toMatchObject({ code: '409' });
    expect(rpc).not.toHaveBeenCalled();

    candidate.state = 'ready_to_activate';
    await expect(
      service.requestPublish('candidate-id', 'admin-id', request, { immediate: true }),
    ).rejects.toMatchObject({ code: '409' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
