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

import { POST } from './unpublish';

describe('admin article unpublish endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    getContentRepository.mockReset();
    invalidateContent.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
    invalidateContent.mockResolvedValue(undefined);
  });

  it('uses the article publication version and invalidates its public cache', async () => {
    const getAdminArticle = vi.fn(async () => ({ id: 'article-id', slug: 'published-article' }));
    const unpublish = vi.fn(async () => ({ article_id: 'article-id', publication_version: 4 }));
    getContentRepository.mockReturnValue({ getAdminArticle });
    getContentJobService.mockReturnValue({ unpublish });
    const request = new Request(
      'https://example.com/api/admin/notion/articles/article-id/unpublish',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedPublicationVersion: 3,
          reason: 'needs revision',
          idempotencyKey: 'unpublish-operation',
        }),
      },
    );
    const context = { request, params: { articleId: 'article-id' } } as never;

    const response = await POST(context);

    expect(unpublish).toHaveBeenCalledWith(
      'article-id',
      'admin-id',
      expect.objectContaining({ expectedPublicationVersion: 3, reason: 'needs revision' }),
    );
    expect(invalidateContent).toHaveBeenCalledWith(context, ['article:published-article']);
    expect(response.status).toBe(200);
  });

  it('does not unpublish an article that no longer exists', async () => {
    const unpublish = vi.fn();
    getContentRepository.mockReturnValue({ getAdminArticle: vi.fn(async () => null) });
    getContentJobService.mockReturnValue({ unpublish });
    const request = new Request('https://example.com/api/admin/notion/articles/missing/unpublish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedPublicationVersion: 1,
        idempotencyKey: 'unpublish-operation',
      }),
    });

    const response = await POST({ request, params: { articleId: 'missing' } } as never);

    expect(response.status).toBe(404);
    expect(unpublish).not.toHaveBeenCalled();
    expect(invalidateContent).not.toHaveBeenCalled();
  });
});
