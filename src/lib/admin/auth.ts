import { createClient } from '@supabase/supabase-js';
import { HttpRequestError } from '@/lib/admin/http';
import { hasGoogleIdentity } from '@/lib/admin/identity';
import { getSupabaseEnvironment, normalizeAdminEmail } from '@/lib/content/env';

export interface AdminIdentity {
  id: string;
  email: string;
}

export async function requireAdmin(request: Request): Promise<AdminIdentity> {
  const environment = getSupabaseEnvironment();
  if (!environment) throw new Response('管理資料庫尚未設定。', { status: 503 });
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new Response('請先登入。', { status: 401 });
  const authClient = createClient(environment.url, environment.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  const user = data.user;
  const email = user?.email ? normalizeAdminEmail(user.email) : undefined;
  if (error || !user || !email) throw new Response('登入已失效，請重新登入。', { status: 401 });
  if (!user.email_confirmed_at) {
    throw new Response('管理帳號的電子郵件尚未驗證。', { status: 403 });
  }
  // The console only offers Google sign-in, so an account without a Google
  // identity must never reach the admin API. The code lets the console drop
  // that unusable session instead of retrying it. (A password signup that later
  // linked Google keeps `provider: 'email'`, which is why the linked provider
  // list decides this, not `app_metadata.provider`.)
  if (!hasGoogleIdentity(user)) {
    throw new HttpRequestError(403, '請使用 Google 帳號登入。', 'google_identity_required');
  }
  const adminClient = createClient(environment.url, environment.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: admin, error: adminError } = await adminClient
    .from('admin_users')
    .select('user_id, auth_user_id, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();
  if (adminError) {
    throw new Response('管理權限資料庫尚未完成設定。', { status: 503 });
  }
  if (!admin) {
    throw new Response('這個帳號沒有管理權限。', { status: 403 });
  }
  // Email is the stable, normalized identity key. When a row has an explicit
  // Auth identity (or the legacy user_id), require it to match as well so a
  // reused/changed email can never inherit another account's access.
  const linkedUserId = admin.auth_user_id ?? admin.user_id;
  if (linkedUserId && linkedUserId !== user.id) {
    throw new Response('這個帳號沒有管理權限。', { status: 403 });
  }
  return { id: user.id, email };
}
