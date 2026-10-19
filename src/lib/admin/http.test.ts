import { describe, expect, it, vi } from 'vitest';
import { errorResponse, HttpRequestError, readJsonBody } from '@/lib/admin/http';

describe('admin HTTP security boundaries', () => {
  it('does not expose unexpected server error details to clients', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await errorResponse(
      new Error('password authentication failed for internal_db'),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: '伺服器暫時無法完成操作。' });
  });

  it('turns a thrown response into the JSON shape the console reads', async () => {
    const response = await errorResponse(
      new Response('請使用 Google 帳號登入。', { status: 403, statusText: 'Forbidden' }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    await expect(response.json()).resolves.toEqual({ message: '請使用 Google 帳號登入。' });
  });

  it('carries the machine-readable code of a request error', async () => {
    const response = await errorResponse(
      new HttpRequestError(403, '請使用 Google 帳號登入。', 'google_identity_required'),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: '請使用 Google 帳號登入。',
      code: 'google_identity_required',
    });
  });

  it('rejects JSON bodies larger than the configured limit', async () => {
    const request = new Request('https://example.com/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(1_024) }),
    });

    await expect(readJsonBody(request, 256)).rejects.toMatchObject({ status: 413 });
  });

  it('rejects unsupported content types and malformed JSON without parser details', async () => {
    const textRequest = new Request('https://example.com/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    const malformedRequest = new Request('https://example.com/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    await expect(readJsonBody(textRequest)).rejects.toMatchObject({ status: 415 });
    await expect(readJsonBody(malformedRequest)).rejects.toMatchObject({ status: 400 });
  });
});
