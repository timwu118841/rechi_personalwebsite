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

import { PATCH } from './featured';

describe('admin featured article endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    getContentRepository.mockReset();
    invalidateContent.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
    invalidateContent.mockResolvedValue(undefined);
  });

  it('sets a published article as featured and invalidates public content', async () => {
    const article = { id: 'article-id', slug: 'featured-article', status: 'published' };
    const setFeaturedArticle = vi.fn(async () => ({ ...article, featured: true }));
    getContentRepository.mockReturnValue({ getAdminArticle: vi.fn(async () => article) });
    getContentJobService.mockReturnValue({ setFeaturedArticle });
    const request = new Request('https://example.com/api/admin/articles/article-id/featured', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ featured: true }),
    });
    const context = { request, params: { id: 'article-id' } } as never;

    const response = await PATCH(context);

    expect(response.status).toBe(200);
    expect(setFeaturedArticle).toHaveBeenCalledWith('article-id', true, 'admin-id');
    expect(invalidateContent).toHaveBeenCalledWith(context, ['article:featured-article']);
    await expect(response.json()).resolves.toMatchObject({ article: { featured: true } });
  });

  it('rejects a non-boolean featured value before changing data', async () => {
    const setFeaturedArticle = vi.fn();
    getContentRepository.mockReturnValue({
      getAdminArticle: vi.fn(async () => ({ id: 'article-id' })),
    });
    getContentJobService.mockReturnValue({ setFeaturedArticle });
    const request = new Request('https://example.com/api/admin/articles/article-id/featured', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ featured: 'true' }),
    });

    const response = await PATCH({ request, params: { id: 'article-id' } } as never);

    expect(response.status).toBe(400);
    expect(setFeaturedArticle).not.toHaveBeenCalled();
  });
});
