import { afterEach, describe, expect, it } from 'vitest';
import {
  getNotionConfig,
  getPublicSupabaseConfig,
  getSupabaseEnvironment,
  normalizeAdminEmail,
} from './env';

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
  });

  it('keeps the server-only secret out of the public browser config', () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable';
    process.env.SUPABASE_SECRET_KEY = 'secret';

    expect(getPublicSupabaseConfig()).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'publishable',
    });
    expect(getSupabaseEnvironment()).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'publishable',
      secretKey: 'secret',
    });
  });
});

describe('Notion editorial environment', () => {
  it('returns null when editorial sync is disabled even with complete credentials', () => {
    process.env.NOTION_EDITORIAL_ENABLED = 'false';
    process.env.NOTION_TOKEN = 'token';
    process.env.NOTION_DATA_SOURCE_ID = 'data-source';

    expect(getNotionConfig()).toBeNull();
  });

  it('returns config when editorial sync is enabled with complete credentials', () => {
    process.env.NOTION_EDITORIAL_ENABLED = 'true';
    process.env.NOTION_TOKEN = 'token';
    process.env.NOTION_DATA_SOURCE_ID = 'data-source';

    expect(getNotionConfig()).toEqual({
      token: 'token',
      dataSourceId: 'data-source',
      version: '2026-03-11',
    });
  });
});
