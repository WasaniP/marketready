/**
 * Knock transactional email: the optional "instant results" email sent to a
 * lead the moment their full diagnostic report is unlocked.
 *
 * Called from POST /api/leads (src/routes/api/leads.ts). The trigger runs IN
 * PARALLEL with the Airtable write — independent of its outcome (success OR
 * failure — the email never depends on Airtable) — and is AWAITED with a
 * bounded budget BEFORE the lead response returns. On a serverless host the
 * platform freezes background work once the response is flushed, so the old
 * fire-and-forget promise started after the write was cut off on cold/slow
 * requests and the email silently dropped. Awaiting a bounded trigger moves
 * the send inside the request's lifetime without letting it block the
 * response indefinitely.
 *
 * FAIL-OPEN for the user: `triggerResultsEmail` NEVER throws and its outcome
 * never alters the lead response. All failures (missing config, network
 * error, non-2xx, timeout) are surfaced as a returned outcome AND
 * console.warn'ed with the run id / recipient / lead timestamp so a missed
 * email is debuggable in logs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER-SIDE SETUP (Knock dashboard — this code NEVER creates the workflow or
 * template; wiring here only TRIGGERS a workflow that already exists):
 *
 *   Required env vars:
 *     KNOCK_API_KEY    Knock SERVER-side secret API key ("sk_test_..." for
 *                      development, "sk_..." for production). When missing or
 *                      empty the email is skipped entirely (fail-open) and the
 *                      lead response is unaffected.
 *     KNOCK_WORKFLOW   Optional. The key of the email workflow in the Knock
 *                      dashboard. Defaults to "marketready-diagnostic-results".
 *
 *   In Knock: create a workflow whose key matches the above (or set
 *   KNOCK_WORKFLOW), add an Email channel step, and reference the data keys
 *   below with Liquid syntax, e.g. {{ data.first_name }} … Knock templates use
 *   the EXACT keys passed here (camelCase as listed):
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DATA KEYS the Knock email template can reference (the `data` map of the
 * trigger call — every key below is always present unless noted):
 *
 *   firstName        string          lead's first name
 *   workEmail        string          lead's work email (also the recipient)
 *   company          string          company, inferred from the URL domain
 *                                    when not supplied ("" when unknown)
 *   websiteUrl       string          the audited website URL
 *   icp              string          target customer, when supplied ("" if not)
 *   score            number | null   overall diagnostic score /100 (null when
 *                                    no numeric score was sent)
 *   readiness        string          readiness band, e.g. "Needs Attention"
 *   overallBand      string          alias of `readiness`
 *   lowestParameter  string          primary friction source (raw parameter
 *                                    name as sent by the calculator)
 *   primaryFriction  string          alias of `lowestParameter`
 *   frictionLabel    string          human label of the friction, when sent
 *   anchorLabel      string          anchor label, when sent
 *   keyObservation   string          the single most important finding
 *   commercialRisk   string          the cost of leaving it unfixed
 *   prescription     string          recommended next step / offer
 *   domEvidence      string          raw quote from the audited page, when
 *                                    captured ("" if not)
 *   source           string          "Homepage Calculator" | "Full Assessment"
 *   capturedAt       string          ISO-8601 timestamp of the submission
 *   fullBreakdown    string          multi-line human-readable breakdown —
 *                                    the SAME text written to the Airtable
 *                                    "Full Breakdown" column
 *   parameterScores  { name, score, status }[]
 *                                    scored, non-locked parameters (empty
 *                                    array when no diagnostic payload sent)
 *
 * FAIL-OPEN CONTRACT (enforced below):
 *   1. No KNOCK_API_KEY -> triggerResultsEmail() resolves { ok:false,
 *      reason:"skipped" } before any network work.
 *   2. triggerResultsEmail() never throws: missing config, network error,
 *      non-2xx, and timeout are all caught and surfaced as an outcome (and
 *      console.warn'ed with the run id / recipient / lead timestamp so a
 *      missed email is debuggable in logs).
 *   3. The trigger is bounded: up to 2 attempts, each with a 4s AbortSignal
 *      timeout, so the total send budget is ~8s (the same bound PR #6 used)
 *      and a hung Knock call can never pin the request handler.
 *   The lead response is identical whether the email succeeds, fails, or is
 *   skipped.
 */

const KNOCK_API_BASE = "https://api.knock.app/v1";
const DEFAULT_WORKFLOW_KEY = "marketready-diagnostic-results";
/** Per-attempt ceiling on the trigger call. Two bounded attempts keep the
 * total send budget at ~8s (the PR #6 bound) while still surviving a flaky
 * first attempt on a cold/slow instance. */
const ATTEMPT_TIMEOUT_MS = 4_000;
/** Max trigger attempts. A second attempt fires only on a transient network
 * failure or timeout — a non-2xx rejection from Knock is permanent and never
 * retried. */
const MAX_SEND_ATTEMPTS = 2;

/** One diagnostic parameter, as carried in the lead's diagnostic payload. */
interface KnockParameter {
  name: string;
  score?: number;
  status?: string;
  locked?: boolean;
  insufficientData?: boolean;
}

/** The subset of the normalized lead (src/routes/api/leads.ts) the email
 * needs. Structural: NormalizedLead satisfies this without an import cycle. */
export interface KnockEmailLead {
  firstName: string;
  workEmail: string;
  company: string;
  websiteUrl: string;
  icp: string;
  /** NaN when no numeric score was sent (sent to Knock as null). */
  score: number;
  readiness: string;
  primaryFriction: string;
  prescription: string;
  keyObservation: string;
  commercialRisk: string;
  frictionLabel: string;
  anchorLabel: string;
  domEvidence: string;
  answersBreakdown: string;
  source: string;
  capturedAt: string;
  payload: {
    score: number;
    overallBand: string;
    url: string;
    dimensions: KnockParameter[];
  } | null;
}

/** Build the `data` map passed to the Knock workflow trigger. Kept as its own
 * pure function so the template data keys (documented above) have exactly one
 * definition site. */
export function buildResultsEmailData(
  lead: KnockEmailLead,
  fullBreakdown: string,
): Record<string, unknown> {
  const parameterScores = lead.payload
    ? lead.payload.dimensions
        .filter((d) => !d.locked && !d.insufficientData && typeof d.score === "number")
        .map((d) => ({ name: d.name, score: d.score as number, status: d.status ?? "" }))
    : [];
  return {
    firstName: lead.firstName,
    workEmail: lead.workEmail,
    company: lead.company,
    websiteUrl: lead.websiteUrl,
    icp: lead.icp,
    score: Number.isFinite(lead.score) ? lead.score : null,
    readiness: lead.readiness,
    overallBand: lead.readiness,
    lowestParameter: lead.primaryFriction,
    primaryFriction: lead.primaryFriction,
    frictionLabel: lead.frictionLabel,
    anchorLabel: lead.anchorLabel,
    keyObservation: lead.keyObservation,
    commercialRisk: lead.commercialRisk,
    prescription: lead.prescription,
    domEvidence: lead.domEvidence,
    source: lead.source,
    capturedAt: lead.capturedAt,
    fullBreakdown,
    parameterScores,
  };
}

/** True for transient network/socket/DNS failures worth retrying (mirrors the
 * lead-write retry policy in src/routes/api/leads.ts): Bun's "socket connection
 * was closed unexpectedly" / "fetch failed", undici's "sending request failed",
 * Node errno codes (ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED, EAI_AGAIN,
 * EPIPE), and closed/aborted streams. Anything else (e.g. a programming error)
 * is not retried. */
function isTransientNetworkError(msg: string): boolean {
  return /socket connection was closed|fetch failed|sending request failed|econnreset|econnrefused|etimedout|enotfound|eai_again|epipe|network error|aborted|terminated|other side closed/i.test(
    msg,
  );
}

/** Outcome of a trigger attempt, consumed only for observability — never for
 * the lead response. `runId` is Knock's `workflow_run_id` when the trigger was
 * accepted (2xx); `elapsedMs` is the whole send budget consumed. */
export type KnockSendOutcome =
  | { ok: true; runId: string; attempted: number; elapsedMs: number }
  | {
      ok: false;
      reason: "skipped" | "rejected" | "failed" | "timeout";
      attempted: number;
      elapsedMs: number;
      detail?: string;
      runId?: string;
    };

/** Optional knobs for tests only — the site always uses the defaults. */
export interface KnockSendOptions {
  /** Per-attempt AbortSignal timeout in ms (default ATTEMPT_TIMEOUT_MS). */
  attemptTimeoutMs?: number;
}

/** Fire the Knock workflow trigger, AWAITED with a bounded budget so the call
 * completes before the lead response returns (the platform freezes background
 * work after a response flushes on serverless hosts — fire-and-forget drops
 * the email on slow/cold requests). Resolves on ANY outcome (2xx, non-2xx,
 * network error, timeout) — failures are reported via console.warn with the
 * run id / recipient / lead timestamp, never thrown. Never logs or returns the
 * API key. */
export async function triggerResultsEmail(
  lead: KnockEmailLead,
  fullBreakdown: string,
  opts?: KnockSendOptions,
): Promise<KnockSendOutcome> {
  const apiKey = process.env.KNOCK_API_KEY;
  const workflowKey = process.env.KNOCK_WORKFLOW?.trim() || DEFAULT_WORKFLOW_KEY;
  if (!apiKey) {
    // Not configured: nothing to do (fail-open). Silent — this is the normal
    // state until the owner wires the Knock secret, not a failure to log.
    return { ok: false, reason: "skipped", attempted: 0, elapsedMs: 0 };
  }
  const startedAt = Date.now();
  const attemptTimeoutMs = opts?.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS;
  // Lead identity for logs: the recipient email is the unique key; capturedAt
  // is the same timestamp written to the Airtable "Timestamp" column, so a log
  // line maps 1:1 to a stored lead row.
  const leadId = `${lead.workEmail}@${lead.capturedAt}`;
  const url = `${KNOCK_API_BASE}/workflows/${encodeURIComponent(workflowKey)}/trigger`;
  let body: string;
  try {
    body = JSON.stringify({
      // Inline-identified recipient (Knock creates/updates the user from
      // these properties during the run — no separate identify call):
      // stable id = lowercased email, plus name when we have one.
      recipients: [
        {
          id: lead.workEmail.toLowerCase(),
          email: lead.workEmail,
          ...(lead.firstName ? { name: lead.firstName } : {}),
        },
      ],
      data: buildResultsEmailData(lead, fullBreakdown),
    });
  } catch (err) {
    // Programming error in payload assembly: fail-open, never throw to the
    // caller that awaits us.
    const msg = err instanceof Error ? err.message : "unknown error";
    console.warn(
      `[knock][results-email] trigger FAILED reason=failed workflow=${workflowKey} ` +
        `lead=${leadId} attempt=0/0 elapsedMs=0 detail=payload-construction ${msg}`,
    );
    return { ok: false, reason: "failed", attempted: 0, elapsedMs: 0, detail: msg };
  }

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });
      if (res.ok) {
        // 2xx: Knock accepted the run ({ workflow_run_id }) and delivers the
        // email asynchronously.
        const payload = (await res.json().catch(() => null)) as {
          workflow_run_id?: unknown;
        } | null;
        const runId =
          payload && typeof payload.workflow_run_id === "string"
            ? payload.workflow_run_id
            : "";
        const elapsedMs = Date.now() - startedAt;
        console.info(
          `[knock][results-email] triggered ok workflow=${workflowKey} ` +
            `runId=${runId} lead=${leadId} attempt=${attempt}/${MAX_SEND_ATTEMPTS} elapsedMs=${elapsedMs}`,
        );
        return { ok: true, runId, attempted: attempt, elapsedMs };
      }
      // Non-2xx: Knock rejected the trigger (bad key, unknown workflow,
      // payload validation). Permanent — retrying cannot help.
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const elapsedMs = Date.now() - startedAt;
      console.warn(
        `[knock][results-email] trigger FAILED reason=rejected workflow=${workflowKey} ` +
          `lead=${leadId} attempt=${attempt}/${MAX_SEND_ATTEMPTS} HTTP ${res.status}${detail ? ` detail=${detail}` : ""} elapsedMs=${elapsedMs}`,
      );
      return {
        ok: false,
        reason: "rejected",
        attempted: attempt,
        elapsedMs,
        detail: res.statusText,
      };
    } catch (err) {
      // Network/DNS/socket/timeout/abort: message only, never credentials.
      const msg = err instanceof Error ? err.message : "unknown error";
      const errName = err instanceof Error ? err.name : "";
      const isTimeout = errName === "TimeoutError" || errName === "AbortError";
      const transient = isTimeout || isTransientNetworkError(msg);
      if (attempt < MAX_SEND_ATTEMPTS && transient) {
        // Bounded second attempt: cold instances often drop the first socket.
        // Log the retry — a first-attempt timeout on a cold instance is
        // exactly the failure mode this fix exists for, and it must be
        // visible even when the retry succeeds.
        console.warn(
          `[knock][results-email] trigger attempt ${attempt}/${MAX_SEND_ATTEMPTS} failed ` +
            `reason=${isTimeout ? "timeout" : "failed"} workflow=${workflowKey} ` +
            `lead=${leadId} retrying detail=${msg}`,
        );
        continue;
      }
      const elapsedMs = Date.now() - startedAt;
      console.warn(
        `[knock][results-email] trigger FAILED reason=${isTimeout ? "timeout" : "failed"} ` +
          `workflow=${workflowKey} lead=${leadId} attempt=${attempt}/${MAX_SEND_ATTEMPTS} ` +
          `elapsedMs=${elapsedMs} detail=${msg}`,
      );
      return {
        ok: false,
        reason: isTimeout ? "timeout" : "failed",
        attempted: attempt,
        elapsedMs,
        detail: msg,
      };
    }
  }
  // Unreachable: MAX_SEND_ATTEMPTS >= 1 and every path returns above.
  const elapsedMs = Date.now() - startedAt;
  return { ok: false, reason: "failed", attempted: MAX_SEND_ATTEMPTS, elapsedMs };
}