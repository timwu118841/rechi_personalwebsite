import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { POST } from './sync';

describe('admin direct Notion sync endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('synchronizes one page immediately without enqueueing a worker job', async () => {
    const syncSourceNow = vi.fn(async () => ({
      sourceId: 'source-id',
      pageId: 'page-id',
      title: '文章',
      state: 'active',
    }));
    const enqueueSourceSync = vi.fn();
    getContentJobService.mockReturnValue({ syncSourceNow, enqueueSourceSync });

    const response = await POST({
      request: new Request('https://example.com/api/admin/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: 'page-id' }),
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(syncSourceNow).toHaveBeenCalledWith({ pageId: 'page-id' });
    expect(enqueueSourceSync).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      result: { sourceId: 'source-id', pageId: 'page-id', title: '文章', state: 'active' },
    });
  });

  it('rejects a data-source batch because the endpoint only handles one article', async () => {
    getContentJobService.mockReturnValue({ syncSourceNow: vi.fn() });

    const response = await POST({
      request: new Request('https://example.com/api/admin/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSource: true }),
      }),
    } as never);

    expect(response.status).toBe(400);
  });
});
