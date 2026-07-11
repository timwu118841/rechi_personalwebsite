import { createClient } from '@supabase/supabase-js';
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
  if (!environment.passwordLoginEnabled && user.app_metadata?.provider === 'email') {
    throw new Response('密碼登入已停用，請使用 Google 登入。', { status: 403 });
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
