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
  it('changes the single featured article through the database RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: { id: 'article-id', slug: 'featured-article', featured: true },
      error: null,
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.setFeaturedArticle('article-id', true, 'admin-id')).resolves.toMatchObject(
      {
        id: 'article-id',
        featured: true,
      },
    );
    expect(rpc).toHaveBeenCalledWith('set_featured_article', {
      p_article_id: 'article-id',
      p_featured: true,
      p_actor_id: 'admin-id',
    });
  });

  it('updates published article classification through the database RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: { id: 'article-id', category_slug: 'legal-practice', tags: ['勞動法'] },
      error: null,
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(
      service.updateArticleClassification('article-id', 'legal-practice', ['勞動法'], 'admin-id'),
    ).resolves.toMatchObject({ category_slug: 'legal-practice', tags: ['勞動法'] });
    expect(rpc).toHaveBeenCalledWith('update_article_classification', {
      p_article_id: 'article-id',
      p_category_slug: 'legal-practice',
      p_tags: ['勞動法'],
      p_actor_id: 'admin-id',
    });
  });

  it('explains when the featured article migration is missing from PostgREST', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'function missing from schema cache' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.setFeaturedArticle('article-id', true, 'admin-id')).rejects.toThrow(
      '尚未套用',
    );
  });

  it('skips unchanged canonical Notion timestamps but fails open for missing or malformed metadata', () => {
    const configuration = {
      editorial_mode: 'shadow',
      notion_last_edited_time: '2026-07-15T00:00:00.000Z',
    };
    expect(shouldSyncNotionPage(configuration, '2026-07-15T00:00:00.000Z')).toBe(false);
    expect(shouldSyncNotionPage(configuration, '2026-07-15T00:00:00.000Z', '新頁面')).toBe(true);
    expect(
      shouldSyncNotionPage(
        { ...configuration, notion_page_title: '新頁面' },
        '2026-07-15T00:00:00.000Z',
        '新頁面',
      ),
    ).toBe(false);
    expect(shouldSyncNotionPage(configuration, '2026-07-15T00:00:01.000Z')).toBe(true);
    expect(shouldSyncNotionPage({}, '2026-07-15T00:00:00.000Z')).toBe(true);
    expect(shouldSyncNotionPage(configuration, null)).toBe(true);
    expect(
      shouldSyncNotionPage({ notion_last_edited_time: 'not-a-date' }, '2026-07-15T00:00:00.000Z'),
    ).toBe(true);
    expect(shouldSyncNotionPage(configuration, '2026-07-15T08:00:00+08:00')).toBe(true);
    expect(shouldSyncNotionPage(configuration, '2026-07-15')).toBe(true);
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
    expect(
      mergeNotionSourceConfiguration(
        { editorial_mode: 'shadow', notion_last_edited_time: '2026-07-15T00:00:00.000Z' },
        '2026-07-16T08:00:00+08:00',
      ),
    ).toEqual({
      editorial_mode: 'shadow',
      notion_last_edited_time: '2026-07-15T00:00:00.000Z',
    });
    expect(
      mergeNotionSourceConfiguration(
        { editorial_mode: 'shadow' },
        '2026-07-15T00:00:00.000Z',
        '  Notion page title  ',
      ),
    ).toEqual({
      editorial_mode: 'shadow',
      notion_last_edited_time: '2026-07-15T00:00:00.000Z',
      notion_page_title: 'Notion page title',
    });
  });

  it('uses revision source hashes for source views and keeps actionable candidates active', async () => {
    const sourceRows = [
      { id: 'unchanged', updated_at: '2026-07-15T03:00:00.000Z' },
      { id: 'open', updated_at: '2026-07-15T02:00:00.000Z' },
      { id: 'changed', updated_at: '2026-07-15T01:00:00.000Z' },
    ];
    const workingCopies = sourceRows.map((source, index) => ({
      id: `copy-${source.id}`,
      source_id: source.id,
      version: 1,
      source_revision_id: `revision-${index + 1}`,
      slug: `${source.id}-slug`,
    }));
    const publications = sourceRows.map((source, index) => ({
      source_id: source.id,
      source_revision_id: `revision-${index + 1}`,
      source_hash: `published-${index + 1}`,
      activated_at: `2026-07-15T0${index}:00:00.000Z`,
    }));
    const revisions = [
      { id: 'revision-1', source_hash: 'published-1', content_hash: 'render-1' },
      { id: 'revision-2', source_hash: 'published-2', content_hash: 'render-2' },
      // The render hash deliberately matches the publication source hash. This
      // source is still changed because its source hash does not match.
      { id: 'revision-3', source_hash: 'changed-3', content_hash: 'published-3' },
    ];
    const selectedRevisionColumns: string[] = [];
    let candidateQuery = 0;
    const from = vi.fn((table: string) => {
      if (table === 'article_sources') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: sourceRows, error: null }),
            }),
          }),
        };
      }
      if (table === 'article_working_copies') {
        return {
          select: () => ({
            in: async () => ({ data: workingCopies, error: null }),
          }),
        };
      }
      if (table === 'publication_candidates') {
        candidateQuery += 1;
        if (candidateQuery % 2 === 1) {
          return {
            select: () => ({
              in: () => ({
                eq: () => ({
                  order: async () => ({ data: publications, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            in: () => ({
              in: async () => ({ data: [{ source_id: 'open' }], error: null }),
            }),
          }),
        };
      }
      expect(table).toBe('article_source_revisions');
      return {
        select(columns: string) {
          selectedRevisionColumns.push(columns);
          return { in: async () => ({ data: revisions, error: null }) };
        },
      };
    });
    const service = new ContentJobService(clientWith({ from }));

    await expect(service.listSourceStatus(25, undefined, 'active')).resolves.toEqual([
      expect.objectContaining({ id: 'open', slug: 'open-slug' }),
      expect.objectContaining({ id: 'changed' }),
    ]);
    await expect(service.listSourceStatus(25, undefined, 'history')).resolves.toEqual([
      expect.objectContaining({ id: 'unchanged' }),
    ]);
    expect(selectedRevisionColumns).toEqual(['id,source_hash', 'id,source_hash']);
  });

  it('does not persist a canonical Notion timestamp before the complete source sync succeeds', async () => {
    const priorTimestamp = '2026-07-14T00:00:00.000Z';
    const nextTimestamp = '2026-07-15T00:00:00.000Z';
    const sourceWrites: Array<Record<string, unknown>> = [];
    const source = {
      id: 'source-id',
      article_id: null,
      configuration: { editorial_mode: 'shadow', notion_last_edited_time: priorTimestamp },
    };
    const from = vi.fn((table: string) => {
      if (table === 'article_sources') {
        return {
          upsert(value: Record<string, unknown>) {
            sourceWrites.push(value);
            return {
              select: () => ({ single: async () => ({ data: source, error: null }) }),
            };
          },
          update(value: Record<string, unknown>) {
            sourceWrites.push(value);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      expect(table).toBe('article_source_revisions');
      return {
        upsert: async () => ({ error: { message: 'revision write failed' } }),
      };
    });
    const service = new ContentJobService(clientWith({ from }));
    Object.defineProperty(service, 'notionClient', {
      value: () => ({
        readSourceSnapshot: async () => ({
          pageId: 'page-id',
          sourceState: 'active',
          lastEditedTime: nextTimestamp,
          url: 'https://www.notion.so/page-id',
          properties: { title: '文章', description: '', tags: [], slug: null, values: {} },
          document: { version: 1, blocks: [], searchText: '文章', mediaSourceRefs: [] },
        }),
      }),
    });

    await expect(
      (
        service as unknown as {
          syncSource(job: Record<string, unknown>): Promise<void>;
        }
      ).syncSource({ id: 'job-id', payload: { notion_page_id: 'page-id' } }),
    ).rejects.toThrow('revision write failed');

    expect(sourceWrites).toHaveLength(1);
    expect(sourceWrites[0]).not.toHaveProperty('configuration');
    expect(shouldSyncNotionPage(source.configuration, nextTimestamp)).toBe(true);
  });

  it('persists the canonical Notion timestamp only in the final successful source update', async () => {
    const priorTimestamp = '2026-07-14T00:00:00.000Z';
    const nextTimestamp = '2026-07-15T00:00:00.000Z';
    const events: Array<{ operation: string; value: Record<string, unknown> }> = [];
    const source = {
      id: 'source-id',
      article_id: null,
      configuration: { editorial_mode: 'shadow', notion_last_edited_time: priorTimestamp },
    };
    let revisionRequest = 0;
    const from = vi.fn((table: string) => {
      if (table === 'article_sources') {
        return {
          upsert(value: Record<string, unknown>) {
            events.push({ operation: 'source-upsert', value });
            return {
              select: () => ({ single: async () => ({ data: source, error: null }) }),
            };
          },
          update(value: Record<string, unknown>) {
            events.push({ operation: 'source-update', value });
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'article_source_revisions') {
        revisionRequest += 1;
        if (revisionRequest === 1) {
          return { upsert: async () => ({ error: null }) };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: async () => ({ data: { id: 'revision-id' }, error: null }) }),
            }),
          }),
        };
      }
      expect(table).toBe('article_working_copies');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'working-copy-id',
                description: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
                manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
                tags: ['管理者標籤'],
              },
              error: null,
            }),
          }),
        }),
        update(value: Record<string, unknown>) {
          events.push({ operation: 'working-copy-update', value });
          return { eq: async () => ({ error: null }) };
        },
      };
    });
    const service = new ContentJobService(clientWith({ from }));
    Object.defineProperty(service, 'notionClient', {
      value: () => ({
        readSourceSnapshot: async () => ({
          pageId: 'page-id',
          sourceState: 'active',
          lastEditedTime: nextTimestamp,
          url: 'https://www.notion.so/page-id',
          properties: { title: '文章', description: '', tags: [], slug: null, values: {} },
          document: { version: 1, blocks: [], searchText: '文章', mediaSourceRefs: [] },
        }),
      }),
    });

    await (
      service as unknown as {
        syncSource(job: Record<string, unknown>): Promise<void>;
      }
    ).syncSource({ id: 'job-id', payload: { notion_page_id: 'page-id' } });

    expect(events.map(({ operation }) => operation)).toEqual([
      'source-upsert',
      'working-copy-update',
      'source-update',
    ]);
    expect(events[0]?.value).not.toHaveProperty('configuration');
    expect(events[1]?.value).toMatchObject({
      description: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
      tags: ['管理者標籤'],
    });
    expect(events[2]?.value).toMatchObject({
      configuration: {
        editorial_mode: 'shadow',
        notion_last_edited_time: nextTimestamp,
      },
      state: 'active',
      last_error: null,
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
              data: {
                id: 'working-copy-id',
                version: 3,
                article_id: null,
                manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
              },
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

  it('stores a normalized Admin summary with working-copy compare-and-swap protection', async () => {
    const updates: unknown[] = [];
    const from = vi.fn((table: string) => {
      expect(table).toBe('article_working_copies');
      return {
        update(value: unknown) {
          updates.push(value);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'copy-id',
                      source_id: 'source-id',
                      version: 5,
                      manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      };
    });
    const service = new ContentJobService(clientWith({ from }));

    await expect(
      service.updateSourceSummary(
        'source-id',
        4,
        '  這是一段由管理者手動設定且符合長度限制的文章摘要。  ',
      ),
    ).resolves.toMatchObject({ version: 5 });
    expect(updates).toEqual([
      {
        manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
        description: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
      },
    ]);
  });

  it('stores category and tags on a working copy with compare-and-swap protection', async () => {
    const updates: unknown[] = [];
    const from = vi.fn((table: string) => {
      expect(table).toBe('article_working_copies');
      return {
        update(value: unknown) {
          updates.push(value);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'copy-id',
                      source_id: 'source-id',
                      version: 6,
                      category_slug: 'legal-practice',
                      tags: ['勞動法', '契約'],
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      };
    });
    const service = new ContentJobService(clientWith({ from }));

    await expect(
      service.updateSourceClassification('source-id', 5, 'legal-practice', ['勞動法', '契約']),
    ).resolves.toMatchObject({ version: 6 });
    expect(updates).toEqual([{ category_slug: 'legal-practice', tags: ['勞動法', '契約'] }]);
  });

  it('refuses candidate preparation until an Admin summary has been saved', async () => {
    const from = vi.fn((table: string) => {
      expect(table).toBe('article_working_copies');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'working-copy-id', version: 3, article_id: null, manual_summary: null },
              error: null,
            }),
          }),
        }),
      };
    });
    const service = new ContentJobService(clientWith({ from }));

    await expect(service.prepareCandidate('source-id', 'admin-id')).rejects.toThrow(
      '請先在管理後台設定',
    );
  });

  it('normalizes and persists a non-colliding manual slug before preparing', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'candidate-id' }], error: null }));
    const updates: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'article_working_copies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'copy-id',
                  version: 3,
                  article_id: null,
                  slug: 'old-slug',
                  manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
                },
                error: null,
              }),
            }),
          }),
          update: (value: unknown) => {
            updates.push(value);
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
        };
      }
      if (table === 'articles') {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      }
      if (table === 'article_source_revisions') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { normalized_payload: {} }, error: null }),
            }),
          }),
        };
      }
      if (table === 'publication_candidates') {
        return { update: () => ({ eq: async () => ({ error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const service = new ContentJobService(clientWith({ from, rpc }));

    await service.prepareCandidate('source-id', 'admin-id', undefined, undefined, '  new slug  ');

    expect(updates).toEqual([{ slug: 'new-slug' }]);
    expect(rpc).toHaveBeenCalledWith(
      'prepare_publication_candidate',
      expect.objectContaining({ p_working_copy_id: 'copy-id', p_expected_working_copy_version: 3 }),
    );
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
                data: {
                  id: 'working-copy-id',
                  version: 1,
                  article_id: null,
                  manual_summary: '這是一段由管理者手動設定且符合長度限制的文章摘要。',
                },
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

  it('derives title, body, and tags without deriving a summary from Notion content', () => {
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
    });
    expect(
      notionWorkingCopyText({
        pageId: 'page-1',
        sourceState: 'active',
        lastEditedTime: null,
        url: null,
        properties: {
          title: '新文章',
          description: 'Notion property summary must be ignored',
          tags: [],
          slug: null,
          values: {},
        },
        document: {
          version: 1,
          blocks: [],
          searchText: '正文也不能被自動截取成摘要',
          mediaSourceRefs: [],
        },
      }),
    ).not.toHaveProperty('description');
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
      state: 'prepared',
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

    await service.requestPublish('candidate-id', 'admin-id', request);

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
    await service.requestPublish('candidate-id', 'admin-id', {
      ...request,
      idempotencyKey: 'publish-prepared-now-operation',
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('publishes future legacy activations immediately but still enforces candidate readiness', async () => {
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
    const rpc = vi.fn(async () => ({ data: { id: 'job-id' }, error: null }));
    const service = new ContentJobService(clientWith({ from, rpc }));
    const request = {
      expectedRevisionId: 'revision-id',
      expectedMetadataVersion: 4,
      expectedCandidateHash: 'candidate-hash',
      idempotencyKey: 'publish-now-operation',
    };

    await expect(
      service.requestPublish('candidate-id', 'admin-id', request),
    ).resolves.toMatchObject({
      id: 'job-id',
    });
    expect(rpc).toHaveBeenCalledTimes(1);

    candidate.state = 'publishing';
    await expect(service.requestPublish('candidate-id', 'admin-id', request)).rejects.toMatchObject(
      { code: '409' },
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
