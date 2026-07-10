import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnvironment } from '@/lib/content/env';

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
  const email = data.user?.email?.toLocaleLowerCase();
  if (error || !data.user || !email)
    throw new Response('登入已失效，請重新登入。', { status: 401 });
  if (!environment.adminEmails.includes(email)) {
    throw new Response('這個帳號沒有管理權限。', { status: 403 });
  }
  return { id: data.user.id, email };
}
