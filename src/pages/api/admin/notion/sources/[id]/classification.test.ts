import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { PATCH } from './classification';

describe('admin source classification endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('updates category and tags with working-copy version protection', async () => {
    const updateSourceClassification = vi.fn(async () => ({ id: 'copy-id', version: 6 }));
    getContentJobService.mockReturnValue({ updateSourceClassification });
    const request = new Request(
      'https://example.com/api/admin/notion/sources/source-id/classification',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: 'legal-practice',
          tags: ['勞動法'],
          expectedWorkingCopyVersion: 5,
        }),
      },
    );

    const response = await PATCH({ request, params: { id: 'source-id' } } as never);

    expect(response.status).toBe(200);
    expect(updateSourceClassification).toHaveBeenCalledWith('source-id', 5, 'legal-practice', [
      '勞動法',
    ]);
  });
});
