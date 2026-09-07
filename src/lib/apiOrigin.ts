/**
 * Canonical API origin for client-side POSTs.
 *
 * Root cause it fixes: getmarketready.co (apex) 308-redirects every path —
 * including /api/* — to www.getmarketready.co. A relative fetch("/api/...",
 * { method: "POST", body }) issued from a page served on the bare apex
 * resolves to the apex origin, hits the 308, and per the fetch spec the
 * redirected request may be re-issued as GET (body dropped). The lead/intake
 * POST then never reaches the API route, so no Airtable row and no results
 * email — even though the same code works fine on hosts without the redirect
 * (platform host, www, localhost).
 *
 * Fix: every client-side API POST targets the canonical origin, so the
 * request never crosses the apex 308. On any other host (www, platform,
 * preview, localhost) the current origin is returned and relative stays
 * correct. The canonical domain is only ever used when the page itself was
 * served from the getmarketready.co apex — never hardcoded for other hosts.
 *
 * Pure + SSR-safe: `resolveApiOrigin` is a pure mapping (unit-tested);
 * `apiOrigin`/`apiUrl` guard `typeof window` so server rendering gets "".
 */

export const CANONICAL_ORIGIN = "https://www.getmarketready.co";
const APEX_HOST = "getmarketready.co";

/**
 * Pure mapping: bare-apex hostname → canonical www origin, everything else →
 * the page's own origin.
 */
export function resolveApiOrigin(hostname: string, origin: string): string {
  if (hostname.trim().toLowerCase() === APEX_HOST) return CANONICAL_ORIGIN;
  return origin;
}

/** The origin client-side API POSTs should target on this page. */
export function apiOrigin(): string {
  if (typeof window === "undefined") return "";
  return resolveApiOrigin(window.location.hostname, window.location.origin);
}

/** Build a same-API absolute URL (e.g. apiUrl("/api/leads")). */
export function apiUrl(path: string): string {
  return `${apiOrigin()}${path}`;
}
