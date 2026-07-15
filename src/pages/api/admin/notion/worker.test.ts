import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { POST } from './worker';

describe('admin Notion worker endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
  });

  it('requires an admin and runs queued jobs on demand', async () => {
    const runWorker = vi.fn(async () => ({
      claimed: 1,
      completed: 1,
      failed: 0,
      exhaustedBudget: false,
    }));
    getContentJobService.mockReturnValue({ runWorker });

    const response = await POST({ request: new Request('https://example.com') } as never);

    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(runWorker).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      result: { claimed: 1, completed: 1, failed: 0, exhaustedBudget: false },
    });
  });

  it('returns the shared admin error response when authorization fails', async () => {
    requireAdmin.mockRejectedValue(new Response('Forbidden', { status: 403 }));

    const response = await POST({ request: new Request('https://example.com') } as never);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
    expect(getContentJobService).not.toHaveBeenCalled();
  });
});
