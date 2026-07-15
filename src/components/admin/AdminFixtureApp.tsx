import type { Session } from '@supabase/supabase-js';
import { Dashboard } from './AdminApp';

import '@/styles/admin.css';

/** Test-only mount for the real dashboard; the page route is runtime guarded. */
export default function AdminFixtureApp() {
  const session = {
    access_token: 'playwright-fixture-token',
    refresh_token: 'playwright-fixture-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'playwright-fixture-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'fixture@example.test',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      email_confirmed_at: new Date(0).toISOString(),
    },
  } as unknown as Session;

  return <Dashboard session={session} onSignOut={async () => undefined} />;
}
