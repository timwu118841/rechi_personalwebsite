import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({
  getSupabaseEnvironment: vi.fn(() => ({
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
    secretKey: 'secret',
  })),
  isProductionRuntime: vi.fn(() => true),
}));
vi.mock('./fixture-repository', () => ({
  FixtureContentRepository: class FixtureContentRepository {},
}));

import { FixtureContentRepository } from './fixture-repository';
import { getContentRepository, resetContentRepositoryForTests } from './repository';

describe('getContentRepository', () => {
  afterEach(() => {
    delete process.env.ALLOW_FIXTURE_CONTENT;
    resetContentRepositoryForTests();
  });

  it('uses fixture content explicitly even when Supabase credentials exist', () => {
    process.env.ALLOW_FIXTURE_CONTENT = 'true';
    expect(getContentRepository()).toBeInstanceOf(FixtureContentRepository);
  });
});
