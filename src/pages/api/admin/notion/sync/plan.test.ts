import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { GET } from './plan';

describe('admin Notion sync plan endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('returns only changed or new articles without enqueueing jobs', async () => {
    const planDataSourceSync = vi.fn(async () => ({
      scanned: 3,
      skipped: 1,
      targets: [
        { pageId: 'changed-page', sourceId: 'changed-source', title: '已更新文章' },
        { pageId: 'new-page', sourceId: null, title: '新文章' },
      ],
    }));
    const enqueueDataSourceSync = vi.fn();
    getContentJobService.mockReturnValue({ planDataSourceSync, enqueueDataSourceSync });

    const response = await GET({
      request: new Request('https://example.com/api/admin/notion/sync/plan'),
    } as never);

    expect(response.status).toBe(200);
    expect(planDataSourceSync).toHaveBeenCalledOnce();
    expect(enqueueDataSourceSync).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      plan: {
        scanned: 3,
        skipped: 1,
        targets: [
          { pageId: 'changed-page', sourceId: 'changed-source', title: '已更新文章' },
          { pageId: 'new-page', sourceId: null, title: '新文章' },
        ],
      },
    });
  });
});
