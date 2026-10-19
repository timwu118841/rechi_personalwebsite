import type { User } from '@supabase/supabase-js';

/**
 * The console only admits Google-linked admins.
 *
 * Supabase links an OAuth identity to an existing user that has the same
 * verified email, and that user keeps the provider of its original identity in
 * `app_metadata.provider` (an email/password signup still reports `email`).
 * The linked provider list and the identities themselves are therefore what
 * decides access, not `app_metadata.provider` alone.
 */
export function hasGoogleIdentity(user: {
  app_metadata?: User['app_metadata'];
  identities?: User['identities'];
}): boolean {
  const providers = new Set<string>();
  const metadata = user.app_metadata ?? {};
  if (typeof metadata.provider === 'string') providers.add(metadata.provider);
  if (Array.isArray(metadata.providers)) {
    for (const provider of metadata.providers) {
      if (typeof provider === 'string') providers.add(provider);
    }
  }
  for (const identity of user.identities ?? []) {
    if (typeof identity?.provider === 'string') providers.add(identity.provider);
  }
  return providers.has('google');
}
