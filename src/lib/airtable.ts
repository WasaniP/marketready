/**
 * Shared Airtable helpers for the site's lead-capture write path.
 *
 * Extracted verbatim from src/routes/api/leads.ts so a second route (the
 * booking route, src/routes/api/booking.ts) can reuse the exact proven write
 * pattern — same metadata-schema whitelist, same transient-retry logic, same
 * never-log-the-token discipline — without duplicating it.
 *
 * IMPORTANT: this module contains NO email logic and MUST never import
 * src/lib/knockEmail.ts. The booking route exists precisely so booking
 * requests can be persisted WITHOUT firing the diagnostic "instant results"
 * email that POST /api/leads triggers. Anything that imports from here must
 * stay email-free.
 *
 * Secrets discipline (unchanged from leads.ts): the token is read from
 * process.env only, never hard-coded, never logged, never returned to a
 * client, and never included in an error message.
 */

const AIRTABLE_API = "https://api.airtable.com/v0";
const AIRTABLE_META_API = "https://api.airtable.com/v0/meta";

/** Work-email shape shared by every capture surface (leads + bookings). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Names of the required Airtable env vars that are currently missing. */
export function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.AIRTABLE_API_TOKEN) missing.push("AIRTABLE_API_TOKEN");
  if (!process.env.AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!process.env.AIRTABLE_TABLE_NAME) missing.push("AIRTABLE_TABLE_NAME");
  return missing;
}

/** Tiny inline sleep for retry backoff (no new dependencies). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for transient network/socket/DNS failures worth retrying: Bun's
 * "The socket connection was closed unexpectedly" / "fetch failed", undici's
 * "sending request failed", Node errno codes (ECONNRESET, ETIMEDOUT,
 * ENOTFOUND, ECONNREFUSED, EAI_AGAIN, EPIPE), and closed/aborted streams.
 * Anything else (e.g. a programming error) is not retried. */
function isTransientNetworkError(msg: string): boolean {
  return /socket connection was closed|fetch failed|sending request failed|econnreset|econnrefused|etimedout|enotfound|eai_again|epipe|network error|aborted|terminated|other side closed/i.test(
    msg,
  );
}

/* ------------------------------------------------------------------ */
/* Table schema (metadata API)                                         */
/* ------------------------------------------------------------------ */

/** Cached set of column names that actually exist per table (from the
 * metadata API). Key = table name; a missing key = not fetched yet. */
const knownColumns = new Map<string, Set<string>>();
const schemaFetchInFlight = new Map<string, Promise<Set<string> | null>>();

/** Fetch a table's column schema ONCE (lazily, cached at module level per
 * table) via the metadata API. Resolves the set of column names, or null on
 * any failure (caller then falls back to its own known-good column set).
 * Never logs or returns the token. */
export function fetchTableSchema(tableName: string): Promise<Set<string> | null> {
  const cached = knownColumns.get(tableName);
  if (cached) return Promise.resolve(cached);
  const inFlight = schemaFetchInFlight.get(tableName);
  if (inFlight) return inFlight;
  const promise = (async (): Promise<Set<string> | null> => {
    try {
      const token = process.env.AIRTABLE_API_TOKEN;
      const base = process.env.AIRTABLE_BASE_ID;
      if (!token || !base) return null;
      const res = await fetch(
        `${AIRTABLE_META_API}/bases/${encodeURIComponent(base)}/tables`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return null;
      const data = (await res.json().catch(() => null)) as {
        tables?: { name?: string; fields?: { name?: string }[] }[];
      } | null;
      const table = data?.tables?.find((t) => t.name === tableName);
      if (!table || !Array.isArray(table.fields)) return null;
      const names = new Set<string>();
      for (const f of table.fields) {
        if (f && typeof f.name === "string" && f.name) names.add(f.name);
      }
      knownColumns.set(tableName, names);
      return names;
    } catch {
      return null;
    } finally {
      schemaFetchInFlight.delete(tableName);
    }
  })();
  schemaFetchInFlight.set(tableName, promise);
  return promise;
}

/** Drop any field whose column does not exist in the table, so adding new
 * mappings can never break writes before the owner adds the columns. When
 * the schema is unknown (metadata fetch failed), falls back to `fallback`
 * when provided (callers pass their table's pre-existing column names);
 * with no fallback the fields are passed through untouched. */
export function whitelistFields(
  fields: Record<string, unknown>,
  schema: Set<string> | null,
  fallback?: ReadonlySet<string>,
): Record<string, unknown> {
  const allowed = schema ?? fallback;
  if (!allowed) return fields;
  return Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.has(k)));
}

/* ------------------------------------------------------------------ */
/* Record write (v0 API, with transient-retry)                         */
/* ------------------------------------------------------------------ */

/** POST one record to a table. Resolves { ok:true } on 2xx, else
 * { ok:false, error } with the Airtable status + message (never the token).
 * Transient network failures (socket drops, DNS blips) are retried up to
 * 3 total attempts with a short backoff (~400ms then ~900ms). HTTP
 * responses are never retried: res.ok returns immediately, and a 4xx/5xx
 * rejection is permanent (retrying cannot help).
 *
 * `tableName` defaults to the AIRTABLE_TABLE_NAME env var (the diagnostic
 * "Free diagnostic" table); pass an explicit name to write to another table
 * in the same base (e.g. "Bookings"). */
export async function writeAirtable(
  fields: Record<string, unknown>,
  tableName: string = process.env.AIRTABLE_TABLE_NAME ?? "",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.AIRTABLE_API_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base || !tableName) {
    return {
      ok: false,
      error: `Airtable is not configured (missing ${missingEnvVars().join(", ")}).`,
    };
  }
  const url = `${AIRTABLE_API}/${encodeURIComponent(base)}/${encodeURIComponent(tableName)}`;
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [400, 900] as const;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
      });
      if (res.ok) return { ok: true };
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return {
        ok: false,
        error: `Airtable rejected the record (HTTP ${res.status})${detail ? `: ${detail}` : "."}`,
      };
    } catch (err) {
      // Network / DNS / socket failure: message only, never credentials.
      const msg = err instanceof Error ? err.message : "network error";
      if (attempt < MAX_ATTEMPTS && isTransientNetworkError(msg)) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
        continue;
      }
      return { ok: false, error: `Airtable request failed: ${msg}` };
    }
  }
  return { ok: false, error: "Airtable request failed: network error" };
}
