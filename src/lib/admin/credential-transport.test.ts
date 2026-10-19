import { describe, expect, it } from 'vitest';
import { adminHttpsRedirectTarget, isLoopbackHostname } from '@/lib/admin/credential-transport';

describe('isLoopbackHostname', () => {
  it('recognises loopback hosts, including dotted subdomains', () => {
    for (const host of [
      'localhost',
      'LOCALHOST',
      'localhost.',
      'admin.localhost',
      '127.0.0.1',
      '::1',
      '[::1]',
    ]) {
      expect(isLoopbackHostname(host)).toBe(true);
    }
  });

  it('rejects hosts where a session would cross the wire in cleartext', () => {
    for (const host of ['example.com', '192.168.1.20', 'supabase.internal', 'notlocalhost']) {
      expect(isLoopbackHostname(host)).toBe(false);
    }
  });
});

describe('adminHttpsRedirectTarget', () => {
  it('upgrades deployed admin requests over plain HTTP', () => {
    expect(
      adminHttpsRedirectTarget(new URL('http://notes.example/admin?tab=articles'), {
        production: true,
      }),
    ).toBe('https://notes.example/admin?tab=articles');
    expect(
      adminHttpsRedirectTarget(new URL('http://notes.example/api/admin/session'), {
        production: true,
      }),
    ).toBe('https://notes.example/api/admin/session');
  });

  it('leaves HTTPS, loopback and development requests untouched', () => {
    const options = { production: true };
    expect(adminHttpsRedirectTarget(new URL('https://notes.example/admin'), options)).toBeNull();
    expect(adminHttpsRedirectTarget(new URL('http://127.0.0.1:4321/admin'), options)).toBeNull();
    expect(
      adminHttpsRedirectTarget(new URL('http://192.168.1.20:4321/admin'), { production: false }),
    ).toBeNull();
  });
});
