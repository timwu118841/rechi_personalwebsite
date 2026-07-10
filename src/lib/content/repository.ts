import { FixtureContentRepository } from './fixture-repository';
import { getSupabaseEnvironment, isProductionRuntime } from './env';
import { SupabaseContentRepository } from './supabase-repository';
import type { ContentRepository } from './types';

let repository: ContentRepository | undefined;

export function getContentRepository(): ContentRepository {
  if (repository) return repository;
  const environment = getSupabaseEnvironment();
  if (environment) {
    repository = new SupabaseContentRepository(environment);
    return repository;
  }
  if (isProductionRuntime() && process.env.ALLOW_FIXTURE_CONTENT !== 'true') {
    throw new Error(
      '正式環境缺少 PUBLIC_SUPABASE_URL、PUBLIC_SUPABASE_PUBLISHABLE_KEY 或 SUPABASE_SECRET_KEY。',
    );
  }
  repository = new FixtureContentRepository();
  return repository!;
}

export function resetContentRepositoryForTests() {
  repository = undefined;
}

export type * from './types';
