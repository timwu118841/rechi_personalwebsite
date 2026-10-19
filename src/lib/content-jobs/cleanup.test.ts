import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { ContentJobService } from './service';

function clientWith(overrides: {
  rpc?: (name: string, input: Record<string, unknown>) => unknown;
}) {
  return { from: vi.fn(), rpc: overrides.rpc ?? vi.fn() } as unknown as SupabaseClient;
}

describe('admin content cleanup', () => {
  it('deletes retired sources through the database RPC', async () => {
    const rpc = vi.fn(async () => ({ data: ['source-1'], error: null }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteSources(['source-1'], 'admin-id')).resolves.toEqual(['source-1']);
    expect(rpc).toHaveBeenCalledWith('delete_article_sources', {
      p_source_ids: ['source-1'],
      p_actor_id: 'admin-id',
    });
  });

  it('refuses to delete a source that was not ignored first', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '22023', message: 'source must be ignored before deletion' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteSources(['source-1'], 'admin-id')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('explains when the cleanup migration is missing from PostgREST', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'function missing from schema cache' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteSources(['source-1'], 'admin-id')).rejects.toThrow('尚未套用');
  });

  it('republishes an article with the expected publication version', async () => {
    const rpc = vi.fn(async () => ({
      data: { id: 'article-id', status: 'published', publication_version: 4 },
      error: null,
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.republish('article-id', 'admin-id', 3)).resolves.toMatchObject({
      status: 'published',
    });
    expect(rpc).toHaveBeenCalledWith('republish_article', {
      p_article_id: 'article-id',
      p_expected_publication_version: 3,
      p_actor_id: 'admin-id',
    });
  });

  it('reports a publication version conflict when republishing', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '40001', message: 'article state or publication version conflict' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.republish('article-id', 'admin-id', 3)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('deletes only unpublished articles', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '22023', message: 'only unpublished articles can be deleted' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteArticle('article-id', 'admin-id', 3)).rejects.toMatchObject({
      status: 409,
      message: '只有已下架的文章可以永久刪除。',
    });
  });

  it('deletes an unpublished article and returns the removed row', async () => {
    const rpc = vi.fn(async () => ({
      data: { id: 'article-id', slug: 'gone-article' },
      error: null,
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteArticle('article-id', 'admin-id', 3)).resolves.toEqual({
      id: 'article-id',
      slug: 'gone-article',
    });
    expect(rpc).toHaveBeenCalledWith('delete_unpublished_article', {
      p_article_id: 'article-id',
      p_expected_publication_version: 3,
      p_actor_id: 'admin-id',
    });
  });

  it('explains when the purge guard migration has not been applied', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: '55000', message: 'publication_review_attestations rows are append-only' },
    }));
    const service = new ContentJobService(clientWith({ rpc }));

    await expect(service.deleteSources(['source-1'], 'admin-id')).rejects.toMatchObject({
      status: 409,
      message: '資料庫仍啟用唯讀保護，請先套用最新的 Supabase migration。',
    });
    await expect(service.deleteArticle('article-id', 'admin-id', 3)).rejects.toMatchObject({
      status: 409,
    });
  });
});
