import { describe, expect, it } from 'vitest';
import { hasGoogleIdentity } from '@/lib/admin/identity';

describe('hasGoogleIdentity', () => {
  it('accepts a Google-only account', () => {
    expect(
      hasGoogleIdentity({
        app_metadata: { provider: 'google', providers: ['google'] },
        identities: [{ provider: 'google' }] as never,
      }),
    ).toBe(true);
  });

  it('accepts an account that was created with a password and later linked Google', () => {
    expect(
      hasGoogleIdentity({
        app_metadata: { provider: 'email', providers: ['email', 'google'] },
        identities: [{ provider: 'email' }, { provider: 'google' }] as never,
      }),
    ).toBe(true);
  });

  it('accepts an account that only lists the Google identity', () => {
    expect(hasGoogleIdentity({ identities: [{ provider: 'google' }] as never })).toBe(true);
    expect(hasGoogleIdentity({ app_metadata: { providers: ['google'] } })).toBe(true);
  });

  it('rejects password-only accounts and empty metadata', () => {
    expect(
      hasGoogleIdentity({
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email' }] as never,
      }),
    ).toBe(false);
    expect(hasGoogleIdentity({})).toBe(false);
    expect(hasGoogleIdentity({ app_metadata: { providers: [] } })).toBe(false);
  });
});
