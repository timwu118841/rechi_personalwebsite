import { describe, expect, it } from 'vitest';
import {
  hasCronSecret,
  isAuthorizedCronRequest,
  missingCronSecretResponse,
  privateResponse,
  unauthorizedCronResponse,
} from './cron-auth';

describe('cron authentication', () => {
  const request = (authorization?: string) =>
    new Request('https://example.test/api/internal/content-worker', {
      headers: authorization ? { authorization } : undefined,
    });

  it('accepts only the exact Bearer credential', () => {
    expect(isAuthorizedCronRequest(request('Bearer cron-secret'), 'cron-secret')).toBe(true);
    expect(isAuthorizedCronRequest(request('bearer cron-secret'), 'cron-secret')).toBe(false);
    expect(isAuthorizedCronRequest(request('Bearer  cron-secret'), 'cron-secret')).toBe(false);
    expect(isAuthorizedCronRequest(request('Bearer wrong'), 'cron-secret')).toBe(false);
    expect(isAuthorizedCronRequest(request(), 'cron-secret')).toBe(false);
  });

  it('fails closed when CRON_SECRET is empty', () => {
    expect(hasCronSecret('')).toBe(false);
    expect(isAuthorizedCronRequest(request(), '')).toBe(false);
    expect(isAuthorizedCronRequest(request('Bearer '), '')).toBe(false);
  });

  it('uses 503 when the server secret itself is missing', () => {
    expect(missingCronSecretResponse().status).toBe(503);
  });

  it('marks worker responses private and non-indexable', () => {
    for (const response of [privateResponse(null, { status: 204 }), unauthorizedCronResponse()]) {
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
  });
});
