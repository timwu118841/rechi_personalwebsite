import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { DELETE } from './index';

describe('admin source cleanup endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('deletes the requested sources for this database only', async () => {
    const deleteSources = vi.fn(async () => ['source-1']);
    getContentJobService.mockReturnValue({ deleteSources });
    const request = new Request('https://example.com/api/admin/notion/sources', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceIds: ['source-1', 'source-1'] }),
    });

    const response = await DELETE({ request } as never);

    expect(deleteSources).toHaveBeenCalledWith(['source-1'], 'admin-id');
    await expect(response.json()).resolves.toEqual({ deletedSourceIds: ['source-1'] });
  });

  it('rejects an empty selection', async () => {
    const deleteSources = vi.fn();
    getContentJobService.mockReturnValue({ deleteSources });
    const request = new Request('https://example.com/api/admin/notion/sources', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceIds: [] }),
    });

    const response = await DELETE({ request } as never);

    expect(response.status).toBe(400);
    expect(deleteSources).not.toHaveBeenCalled();
  });
});
