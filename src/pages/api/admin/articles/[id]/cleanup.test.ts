import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService, getContentRepository, invalidateContent } = vi.hoisted(
  () => ({
    requireAdmin: vi.fn(),
    getContentJobService: vi.fn(),
    getContentRepository: vi.fn(),
    invalidateContent: vi.fn(),
  }),
);

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));
vi.mock('@/lib/content/repository', () => ({ getContentRepository }));
vi.mock('@/lib/admin/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/http')>()),
  invalidateContent,
}));

import { POST as republish } from './republish';
import { POST as remove } from './delete';

function request(path: string, body: unknown) {
  return new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin article cleanup endpoints', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    getContentRepository.mockReset();
    invalidateContent.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
    invalidateContent.mockResolvedValue(undefined);
    getContentRepository.mockReturnValue({
      getAdminArticle: vi.fn(async () => ({ id: 'article-id', slug: 'published-article' })),
    });
  });

  it('republishes with the caller publication version and invalidates the article cache', async () => {
    const republishArticle = vi.fn(async () => ({ id: 'article-id', status: 'published' }));
    getContentJobService.mockReturnValue({ republish: republishArticle });
    const context = {
      request: request('/api/admin/articles/article-id/republish', {
        expectedPublicationVersion: 3,
      }),
      params: { id: 'article-id' },
    } as never;

    const response = await republish(context);

    expect(republishArticle).toHaveBeenCalledWith('article-id', 'admin-id', 3);
    expect(invalidateContent).toHaveBeenCalledWith(context, ['article:published-article']);
    expect(response.status).toBe(200);
  });

  it('deletes only after the article exists and invalidates the article cache', async () => {
    const deleteArticle = vi.fn(async () => ({ id: 'article-id', slug: 'published-article' }));
    getContentJobService.mockReturnValue({ deleteArticle });
    const context = {
      request: request('/api/admin/articles/article-id/delete', { expectedPublicationVersion: 3 }),
      params: { id: 'article-id' },
    } as never;

    const response = await remove(context);

    expect(deleteArticle).toHaveBeenCalledWith('article-id', 'admin-id', 3);
    expect(invalidateContent).toHaveBeenCalledWith(context, ['article:published-article']);
    expect(response.status).toBe(200);
  });

  it('rejects an unknown article before touching the database', async () => {
    const deleteArticle = vi.fn();
    getContentJobService.mockReturnValue({ deleteArticle });
    getContentRepository.mockReturnValue({ getAdminArticle: vi.fn(async () => null) });

    const response = await remove({
      request: request('/api/admin/articles/missing/delete', { expectedPublicationVersion: 1 }),
      params: { id: 'missing' },
    } as never);

    expect(response.status).toBe(404);
    expect(deleteArticle).not.toHaveBeenCalled();
    expect(invalidateContent).not.toHaveBeenCalled();
  });

  it('validates the publication version before calling the service', async () => {
    const deleteArticle = vi.fn();
    getContentJobService.mockReturnValue({ deleteArticle });

    const response = await remove({
      request: request('/api/admin/articles/article-id/delete', {}),
      params: { id: 'article-id' },
    } as never);

    expect(response.status).toBe(400);
    expect(deleteArticle).not.toHaveBeenCalled();
  });
});
