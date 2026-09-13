export interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
  secretKey: string;
  passwordLoginEnabled: boolean;
}

export interface PublicSupabaseEnvironment {
  url: string;
  publishableKey: string;
  passwordLoginEnabled: boolean;
}

export function normalizeAdminEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

function read(name: string): string {
  const meta = (import.meta.env as Record<string, string | undefined>)[name];
  return (meta ?? process.env[name] ?? '').trim();
}

export function getPublicSupabaseConfig() {
  const url = read('PUBLIC_SUPABASE_URL');
  const publishableKey = read('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return url && publishableKey
    ? { url, publishableKey, passwordLoginEnabled: isPasswordLoginEnabled() }
    : null;
}

export function getPublicSupabaseEnvironment(): PublicSupabaseEnvironment | null {
  return getPublicSupabaseConfig();
}

export function isNotionEditorialEnabled(): boolean {
  return read('NOTION_EDITORIAL_ENABLED') === 'true';
}

export type NotionPublicationMode = 'legacy' | 'shadow' | 'notion';

export function getNotionPublicationMode(): NotionPublicationMode {
  const value = read('NOTION_PUBLICATION_MODE');
  return value === 'shadow' || value === 'notion' ? value : 'legacy';
}

export function getContentPublicReadMode(): 'service' | 'publishable' {
  return read('CONTENT_PUBLIC_READ_MODE') === 'publishable' ? 'publishable' : 'service';
}

export function getNotionConfig() {
  if (!isNotionEditorialEnabled()) return null;
  const token = read('NOTION_TOKEN');
  const dataSourceId = read('NOTION_DATA_SOURCE_ID');
  return token && dataSourceId
    ? {
        token,
        dataSourceId,
        version: '2026-03-11' as const,
      }
    : null;
}

/**
 * Names the environment variables that keep `getNotionConfig()` from returning a
 * config, so a failed sync can say which value is missing instead of failing
 * with an opaque server error. Never returns values, only variable names.
 */
export function describeNotionConfigGap(): string[] {
  const missing: string[] = [];
  if (!isNotionEditorialEnabled()) missing.push('NOTION_EDITORIAL_ENABLED=true');
  if (!read('NOTION_TOKEN')) missing.push('NOTION_TOKEN');
  if (!read('NOTION_DATA_SOURCE_ID')) missing.push('NOTION_DATA_SOURCE_ID');
  return missing;
}

export function getCronSecret(): string {
  return read('CRON_SECRET');
}

export function isPasswordLoginEnabled(): boolean {
  return read('PUBLIC_ADMIN_PASSWORD_LOGIN') !== 'false';
}

export function getSupabaseEnvironment(): SupabaseEnvironment | null {
  const publicConfig = getPublicSupabaseConfig();
  const secretKey = read('SUPABASE_SECRET_KEY');
  if (!publicConfig || !secretKey) return null;
  return {
    ...publicConfig,
    secretKey,
    passwordLoginEnabled: isPasswordLoginEnabled(),
  };
}

export function isProductionRuntime(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}
