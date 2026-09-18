/**
 * Coerced-diagnostic response cache for /api/diagnose (owner protocol Part 2.2).
 *
 * WHY THIS EXISTS (diagnosis: /home/team/shared/determinism-investigation/REPORT.md
 * §4 and §8): with a byte-identical request body — same crawl block, same user
 * message, same `seed`, same `system_fingerprint` — OpenAI still returned a
 * DIFFERENT raw completion, which moved one parameter by 30 points
 * (linear positioning 75 -> 45) and flipped figma's value-prop between
 * scored-65 and abstained. `temperature 0` + `top_p 1` + `seed` do not make
 * /v1/chat/completions a pure function, so the only way to make "the same site
 * scores the same every run" true BY CONSTRUCTION is to stop using the second
 * completion at all: cache the FINAL COERCED payload under a hash of the
 * deterministic request body and serve that.
 *
 * Store: the same mechanism as the parsed-crawl cache in ./crawl.ts — a
 * module-level in-process `Map` with a TTL — which is the store PROVEN to
 * persist across separate invocations in this deployment (see REPORT.md §4: two
 * invocations against the same dev process were served the identical cached
 * crawl, proven with a byte-identical-response probe at zero API cost).
 *
 * Consequences to keep in mind:
 *   - In-process only: a server restart (deploy, crash, TTL) clears it. The
 *     first submission after a restart calls the model once and is then stable
 *     again for the next 30 days of that process's life.
 *   - The key includes the crawl block, so a refreshed/changed crawl produces a
 *     different key: old entries simply age out by TTL, nothing to invalidate.
 *   - Concurrent misses on a serverless platform may each call the model before
 *     either writes. That is accepted: the first stored entry then fixes every
 *     subsequent read, and the un-cached window is one cold request per process.
 */

/** Coerced diagnostics are reused for this long (owner spec: 30 days, NOT 24h). */
export const DIAGNOSE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface ResponseCacheEntry {
  /** The exact coerced JSON object the route served to the client. */
  payload: unknown;
  at: number;
}

const responseCache = new Map<string, ResponseCacheEntry>();

/** Read a cached coerced payload. Expired entries are dropped (miss). */
export function readDiagnoseResponse<T>(
  key: string,
  now: number = Date.now(),
): T | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (now - hit.at > DIAGNOSE_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return hit.payload as T;
}

/** Store a coerced payload under its request-hash key. */
export function writeDiagnoseResponse(
  key: string,
  payload: unknown,
  now: number = Date.now(),
): void {
  responseCache.set(key, { payload, at: now });
}

/** Test/inspection helpers (mirror the crawl-cache helpers). */
export function diagnoseResponseCacheSize(): number {
  return responseCache.size;
}

export function clearDiagnoseResponseCache(): void {
  responseCache.clear();
}

/** Seed an entry with an explicit timestamp (used by TTL tests). */
export function primeDiagnoseResponse(
  key: string,
  payload: unknown,
  at: number,
): void {
  responseCache.set(key, { payload, at });
}
