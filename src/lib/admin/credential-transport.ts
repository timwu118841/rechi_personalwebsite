/**
 * Transport rules for the admin console.
 *
 * Every admin page and admin API request carries a Supabase session, so it must
 * only travel over TLS. Loopback stays exempt so local development keeps
 * working without certificates.
 */

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

/**
 * Admin routes must never be served over plain HTTP in a deployed environment.
 * Returns the HTTPS URL to redirect to, or null when the request needs no
 * redirect.
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
