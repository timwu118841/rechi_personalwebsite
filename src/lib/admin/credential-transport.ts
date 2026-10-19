/**
 * Credential transport rules for the admin console.
 *
 * Password sign-in hands the raw password to Supabase Auth as part of the
 * password grant, so the transport is the only thing keeping it away from
 * anyone on the network path. These helpers keep that requirement explicit:
 * credentials may only travel over TLS, or over loopback during local
 * development (browsers treat loopback as a secure context).
 */

export type CredentialTransportFailure = 'page' | 'supabase';

export type CredentialTransportCheck =
  { ok: true } | { ok: false; failure: CredentialTransportFailure };

const LOOPBACK_HOSTNAMES: Record<string, true> = {
  localhost: true,
  '127.0.0.1': true,
  '::1': true,
  '[::1]': true,
};

export function isLoopbackHostname(hostname: string): boolean {
  const value = hostname.trim().toLowerCase().replace(/\.$/, '');
  return Object.hasOwn(LOOPBACK_HOSTNAMES, value) || value.endsWith('.localhost');
}

/** True when a URL is safe to carry a password: HTTPS, or HTTP on loopback. */
export function isSecureCredentialUrl(value: string | URL): boolean {
  let url: URL;
  if (value instanceof URL) {
    url = value;
  } else {
    try {
      url = new URL(value);
    } catch {
      return false;
    }
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && isLoopbackHostname(url.hostname);
}

/**
 * Checks both hops of the password grant: the page that collects the password
 * and the Supabase endpoint that receives it.
 */
export function checkPasswordLoginTransport(
  pageOrigin: string,
  supabaseUrl: string,
): CredentialTransportCheck {
  if (!isSecureCredentialUrl(supabaseUrl)) return { ok: false, failure: 'supabase' };
  if (!isSecureCredentialUrl(pageOrigin)) return { ok: false, failure: 'page' };
  return { ok: true };
}

/**
 * Admin pages and admin APIs must never be served over plain HTTP in a deployed
 * environment; a browser would happily post credentials there. Returns the
 * HTTPS URL to redirect to, or null when the request needs no redirect.
 */
export function adminHttpsRedirectTarget(
  url: URL,
  options: { production: boolean },
): string | null {
  if (!options.production) return null;
  if (url.protocol !== 'http:') return null;
  if (isLoopbackHostname(url.hostname)) return null;
  const target = new URL(url);
  target.protocol = 'https:';
  return target.toString();
}
