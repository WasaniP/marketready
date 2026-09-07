/**
 * Knock transactional email: the optional "instant results" email sent to a
 * lead the moment their full diagnostic report is unlocked.
 *
 * Called from POST /api/leads AFTER the Airtable write outcome is known
 * (success OR failure — the email never depends on Airtable). Fire-and-forget:
 * the promise is guarded so an email failure can never block or fail the lead
 * response.
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
 *   1. No KNOCK_API_KEY -> queueResultsEmail() returns before any work.
 *   2. sendResultsEmail() never throws: every failure (missing config, network
 *      error, non-2xx, timeout) is caught and console.warn'ed only.
 *   3. queueResultsEmail() additionally guards the promise (void + .catch) so
 *      even a programming error in the send path cannot reject into the
 *      request handler.
 *   The lead response is identical whether the email succeeds, fails, or is
 *   skipped.
 */

const KNOCK_API_BASE = "https://api.knock.app/v1";
const DEFAULT_WORKFLOW_KEY = "marketready-diagnostic-results";
/** Hard ceiling on the trigger call so a hung request can never pin a timer. */
const TRIGGER_TIMEOUT_MS = 8_000;

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

/** Fire the Knock workflow trigger. Resolves on ANY outcome (2xx, non-2xx,
 * network error) — failures are reported via console.warn only, never thrown.
 * Never logs or returns the API key. */
async function sendResultsEmail(lead: KnockEmailLead, fullBreakdown: string): Promise<void> {
  const apiKey = process.env.KNOCK_API_KEY;
  const workflowKey = process.env.KNOCK_WORKFLOW?.trim() || DEFAULT_WORKFLOW_KEY;
  if (!apiKey) return; // Not configured: nothing to do (fail-open).
  try {
    const res = await fetch(
      `${KNOCK_API_BASE}/workflows/${encodeURIComponent(workflowKey)}/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
        signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.warn(
        `[knock] results email workflow rejected (HTTP ${res.status})${detail ? `: ${detail}` : "."}`,
      );
      return;
    }
    // 2xx: Knock accepted the run ({ workflow_run_id }) and delivers the email
    // asynchronously. Nothing to log — success is silent.
  } catch (err) {
    // Network/DNS/timeout/abort: message only, never credentials.
    const msg = err instanceof Error ? err.message : "unknown error";
    console.warn(`[knock] results email trigger failed: ${msg}`);
  }
}

/** Fire-and-forget entry point for POST /api/leads. Skips silently (fail-open)
 * when KNOCK_API_KEY is not configured; otherwise triggers the workflow in the
 * background and GUARDS the promise so no failure can ever reach the caller.
 * `fullBreakdown` is the exact text written to the Airtable "Full Breakdown"
 * column, so the email mirrors the stored record. */
export function queueResultsEmail(lead: KnockEmailLead, fullBreakdown: string): void {
  if (!process.env.KNOCK_API_KEY) return; // Fail-open: no credential, no email.
  void sendResultsEmail(lead, fullBreakdown).catch((err: unknown) => {
    console.warn(
      "[knock] results email trigger crashed (guarded):",
      err instanceof Error ? err.message : err,
    );
  });
}
