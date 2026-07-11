export interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
  secretKey: string;
  adminEmails: string[];
  passwordLoginEnabled: boolean;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

function read(name: string): string {
  const meta = (import.meta.env as Record<string, string | undefined>)[name];
  return (meta ?? process.env[name] ?? '').trim();
}

export function getPublicSupabaseConfig() {
  const url = read('PUBLIC_SUPABASE_URL');
  const publishableKey = read('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return url && publishableKey ? { url, publishableKey } : null;
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
    adminEmails: read('ADMIN_EMAILS').split(',').map(normalizeAdminEmail).filter(Boolean),
  };
}

export function isProductionRuntime(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}
