import { FixtureContentRepository } from './fixture-repository';
import { getPublicSupabaseEnvironment, getSupabaseEnvironment, isProductionRuntime } from './env';
import { SupabaseContentRepository } from './supabase-repository';
import { PublicContentRepository } from './public-supabase-repository';
import type { ContentRepository } from './types';

let repository: ContentRepository | undefined;
let publicRepository: PublicContentRepository | undefined;

export function getContentRepository(): ContentRepository {
  if (repository) return repository;
  if (process.env.ALLOW_FIXTURE_CONTENT === 'true') {
    repository = new FixtureContentRepository();
    return repository;
  }
  const environment = getSupabaseEnvironment();
  if (environment) {
    repository = new SupabaseContentRepository(environment);
    return repository;
  }
  if (isProductionRuntime()) {
    throw new Error(
      '正式環境缺少 PUBLIC_SUPABASE_URL、PUBLIC_SUPABASE_PUBLISHABLE_KEY 或 SUPABASE_SECRET_KEY。',
    );
  }
  repository = new FixtureContentRepository();
  return repository!;
}

export function resetContentRepositoryForTests() {
  repository = undefined;
  publicRepository = undefined;
}

export function getPublicContentRepository(): PublicContentRepository {
  if (publicRepository) return publicRepository;
  if (process.env.ALLOW_FIXTURE_CONTENT === 'true') {
    publicRepository = new FixtureContentRepository() as unknown as PublicContentRepository;
    return publicRepository;
  }
  const environment = getPublicSupabaseEnvironment();
  if (environment) {
    publicRepository = new PublicContentRepository(environment);
    return publicRepository;
  }
  if (isProductionRuntime()) {
    throw new Error('正式環境缺少 PUBLIC_SUPABASE_URL 或 PUBLIC_SUPABASE_PUBLISHABLE_KEY。');
  }
  publicRepository = new FixtureContentRepository() as unknown as PublicContentRepository;
  return publicRepository;
}

export type * from './types';
