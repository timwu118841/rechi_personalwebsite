export interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
  secretKey: string;
  adminEmails: string[];
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

export function getSupabaseEnvironment(): SupabaseEnvironment | null {
  const publicConfig = getPublicSupabaseConfig();
  const secretKey = read('SUPABASE_SECRET_KEY');
  if (!publicConfig || !secretKey) return null;
  return {
    ...publicConfig,
    secretKey,
    adminEmails: read('ADMIN_EMAILS')
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase())
      .filter(Boolean),
  };
}

export function isProductionRuntime(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}
