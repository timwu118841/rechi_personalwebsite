import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentJobService } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentJobService: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content-jobs/service', () => ({ getContentJobService }));

import { POST } from './publish';

describe('admin Notion candidate publish endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentJobService.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('always requests immediate publication without a scheduling mode', async () => {
    const requestPublish = vi.fn(async () => ({ id: 'job-id' }));
    getContentJobService.mockReturnValue({ requestPublish });
    const request = new Request(
      'https://example.com/api/admin/notion/candidates/candidate-id/publish',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedRevisionId: 'revision-id',
          expectedMetadataVersion: 4,
          expectedCandidateHash: 'candidate-hash',
          idempotencyKey: 'publish-now-operation',
        }),
      },
    );

    const response = await POST({ request, params: { candidateId: 'candidate-id' } } as never);

    expect(requestPublish).toHaveBeenCalledWith(
      'candidate-id',
      'admin-id',
      expect.objectContaining({ idempotencyKey: 'publish-now-operation' }),
    );
    expect(response.status).toBe(202);
  });
});
