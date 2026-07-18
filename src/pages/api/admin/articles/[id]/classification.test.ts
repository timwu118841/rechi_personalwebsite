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

import { PATCH } from './classification';

describe('admin article classification endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
    invalidateContent.mockResolvedValue(undefined);
  });

  it('updates category and tags and invalidates reader-facing content', async () => {
    const article = { id: 'article-id', slug: 'article-slug' };
    const updateArticleClassification = vi.fn(async () => ({
      ...article,
      category_slug: 'legal-practice',
      tags: ['勞動法'],
    }));
    getContentRepository.mockReturnValue({ getAdminArticle: vi.fn(async () => article) });
    getContentJobService.mockReturnValue({ updateArticleClassification });
    const request = new Request(
      'https://example.com/api/admin/articles/article-id/classification',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'legal-practice', tags: ['勞動法'] }),
      },
    );
    const context = { request, params: { id: 'article-id' } } as never;

    const response = await PATCH(context);

    expect(response.status).toBe(200);
    expect(updateArticleClassification).toHaveBeenCalledWith(
      'article-id',
      'legal-practice',
      ['勞動法'],
      'admin-id',
    );
    expect(invalidateContent).toHaveBeenCalledWith(context, ['article:article-slug', 'taxonomies']);
  });
});
