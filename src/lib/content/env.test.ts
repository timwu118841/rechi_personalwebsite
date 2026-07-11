import { afterEach, describe, expect, it } from 'vitest';
import { getSupabaseEnvironment, isPasswordLoginEnabled, normalizeAdminEmail } from './env';

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

describe('Supabase admin environment', () => {
  it('normalizes exact allowlist values deterministically', () => {
    expect(normalizeAdminEmail('  Admin@Example.COM ')).toBe('admin@example.com');
    process.env.PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable';
    process.env.SUPABASE_SECRET_KEY = 'secret';
    expect(getSupabaseEnvironment()?.passwordLoginEnabled).toBe(true);
  });

  it('keeps password fallback enabled by default and supports explicit disablement', () => {
    delete process.env.PUBLIC_ADMIN_PASSWORD_LOGIN;
    expect(isPasswordLoginEnabled()).toBe(true);
    process.env.PUBLIC_ADMIN_PASSWORD_LOGIN = 'false';
    expect(isPasswordLoginEnabled()).toBe(false);
    process.env.PUBLIC_ADMIN_PASSWORD_LOGIN = 'true';
    expect(isPasswordLoginEnabled()).toBe(true);
  });
});
