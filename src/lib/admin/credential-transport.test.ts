import { describe, expect, it } from 'vitest';
import {
  adminHttpsRedirectTarget,
  checkPasswordLoginTransport,
  isLoopbackHostname,
  isSecureCredentialUrl,
} from '@/lib/admin/credential-transport';

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

  it('rejects hosts where a password would cross the wire in cleartext', () => {
    for (const host of ['example.com', '192.168.1.20', 'supabase.internal', 'notlocalhost']) {
      expect(isLoopbackHostname(host)).toBe(false);
    }
  });
});

describe('isSecureCredentialUrl', () => {
  it('accepts HTTPS anywhere and HTTP on loopback only', () => {
    expect(isSecureCredentialUrl('https://example.com')).toBe(true);
    expect(isSecureCredentialUrl('https://127.0.0.1:54321')).toBe(true);
    expect(isSecureCredentialUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isSecureCredentialUrl('http://localhost:4321')).toBe(true);
    expect(isSecureCredentialUrl('http://example.com')).toBe(false);
    expect(isSecureCredentialUrl('http://192.168.1.20:4321')).toBe(false);
  });

  it('rejects unusable and non-HTTP values', () => {
    expect(isSecureCredentialUrl('')).toBe(false);
    expect(isSecureCredentialUrl('example.com')).toBe(false);
    expect(isSecureCredentialUrl('ws://example.com')).toBe(false);
  });
});

describe('checkPasswordLoginTransport', () => {
  it('allows password login when both hops are protected', () => {
    expect(checkPasswordLoginTransport('https://notes.example', 'https://ref.supabase.co')).toEqual(
      {
        ok: true,
      },
    );
    expect(checkPasswordLoginTransport('http://localhost:4321', 'http://127.0.0.1:54321')).toEqual({
      ok: true,
    });
  });

  it('reports the Supabase hop before the page hop', () => {
    expect(checkPasswordLoginTransport('http://notes.example', 'http://ref.supabase.co')).toEqual({
      ok: false,
      failure: 'supabase',
    });
    expect(checkPasswordLoginTransport('http://notes.example', 'https://ref.supabase.co')).toEqual({
      ok: false,
      failure: 'page',
    });
  });
});

describe('adminHttpsRedirectTarget', () => {
  it('upgrades deployed admin requests over plain HTTP', () => {
    expect(
      adminHttpsRedirectTarget(new URL('http://notes.example/admin?tab=articles'), {
        production: true,
      }),
    ).toBe('https://notes.example/admin?tab=articles');
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
