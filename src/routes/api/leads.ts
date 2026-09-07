/**
 * POST /api/leads : MarketReady diagnostic lead capture (Airtable-backed).
 *
 * Both diagnostic surfaces POST here with the same JSON shape:
 *   - Homepage calculator (Source "Homepage Calculator"): first name, work
 *     email, company inferred from the submitted URL's domain, website URL,
 *     ICP, teaser score, red-flag detail, and the full diagnostic payload.
 *   - Gated 5-dimension assessment (Source "Full Assessment"): first name,
 *     work email, company/URL/ICP when known, computed score, readiness band,
 *     primary friction, prescribed offer, and an answers breakdown.
 *
 * Server behavior:
 *   1. Reads ONLY process.env.AIRTABLE_API_TOKEN / AIRTABLE_BASE_ID /
 *      AIRTABLE_TABLE_NAME (never hard-coded, never logged, never returned).
 *   2. If any of the three is missing: persists the lead to the local
 *      fallback (.data/leads.jsonl, same store the site has always used) with
 *      marker airtable:"failed" + the error, and responds
 *      { ok:false, error } (HTTP 200, no crash).
 *   3. Otherwise POSTs { records:[{ fields }] } to
 *      https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME} (table name URL
 *      encoded: "Free diagnostic" contains a space).
 *   4. On Airtable success responds { ok:true }. On Airtable failure still
 *      persists to the JSONL fallback with airtable:"failed" + the Airtable
 *      error message, and responds { ok:false, error }.
 *   5. Only a malformed body / missing name / invalid email returns non-2xx.
 *
 * The Airtable column mapping lives in ONE constant (AIRTABLE_FIELD_MAP):
 * remapping a column later means editing that constant and nothing else.
 * Client-side scoring stays the single source of truth for the score value:
 * this route never recomputes a score, it only carries what the client sent.
 */

import { createFileRoute } from "@tanstack/react-router";
import { mkdir, appendFile } from "node:fs/promises";
import * as path from "node:path";

const AIRTABLE_API = "https://api.airtable.com/v0";
const AIRTABLE_META_API = "https://api.airtable.com/v0/meta";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ */
/* AIRTABLE COLUMN MAP: the ONLY place Airtable column names live.     */
/* To remap a column later, edit the string on the right and nothing   */
/* else. Keys are the internal lead fields; values are the Airtable    */
/* column names (match the owner's "Free diagnostic" table exactly).   */
/* NOTE: "First Name" / "Company" columns may not exist in the owner's   */
/* table yet. They are included in this map anyway so rows flow the moment */
/* they are added: toAirtableFields() whitelists its output against the    */
/* live table schema and drops unknown columns instead of failing the      */
/* whole write. "Revenue Leakage ($)" stays unmapped until a leakage value */
/* exists in the client payload.                                           */
/* ------------------------------------------------------------------ */
const AIRTABLE_FIELD_MAP = {
  firstName: "First Name",
  company: "Company",
  websiteUrl: "Submitted URL",
  email: "Contact Email",
  score: "PMM Diagnostic Score",
  readiness: "Readiness Band",
  primaryFriction: "Primary Friction",
  prescription: "Prescription",
  breakdown: "Full Breakdown",
  source: "From Source",
  dateSubmitted: "Timestamp",
} as const;

/** The 9 columns that existed before First Name / Company were wired.
 * Used as the safe fallback set when the metadata (schema) fetch fails:
 * in that case First Name / Company are skipped rather than risking an
 * UNKNOWN_FIELD_NAME rejection for columns the owner hasn't added yet. */
const ORIGINAL_FIELD_NAMES: ReadonlySet<string> = new Set([
  "Submitted URL",
  "Contact Email",
  "PMM Diagnostic Score",
  "Readiness Band",
  "Primary Friction",
  "Prescription",
  "Full Breakdown",
  "From Source",
  "Timestamp",
]);

/** Exact allowed values of the Readiness Band single-select column. */
const VALID_READINESS_BANDS: ReadonlySet<string> = new Set([
  "Market Ready",
  "Needs Attention",
  "High Launch Risk",
]);

/** Exact allowed values of the Primary Friction single-select column. */
const PRIMARY_FRICTION_OPTIONS = [
  "Positioning",
  "Messaging",
  "GTM Path",
  "Acquisition Efficiency",
  "Conversion",
] as const;

/** One diagnostic parameter as sent by the homepage calculator. */
interface PayloadDim {
  id: string;
  name: string;
  pillar: string;
  score?: number;
  status?: string;
  friction_label?: string;
  anchor_label?: string;
  keyObservation?: string;
  commercialRisk?: string;
  /** Legacy alias kept for continuity; the UI now sends keyObservation. */
  strategicImpact?: string;
  /** Raw literal DOM quote backing this parameter (server-side carry only). */
  evidence_snippet?: string;
  locked?: boolean;
  insufficientData?: boolean;
}

/** The full diagnostic payload the homepage calculator serializes. */
interface DiagnosticPayload {
  score: number;
  overallBand: string;
  generatedAt: string;
  url: string;
  dimensions: PayloadDim[];
}

interface LeadRequestBody {
  firstName?: unknown;
  workEmail?: unknown;
  company?: unknown;
  websiteUrl?: unknown;
  icp?: unknown;
  /** Homepage calculator score (teaser headline score). */
  overallScore?: unknown;
  /** Gated-assessment score (single source of truth: src/lib/diagnostic). */
  diagnosticScore?: unknown;
  /** Gated-assessment readiness band (Market Ready / Needs Attention / ...). */
  readiness?: unknown;
  /** Legacy alias for the readiness band. */
  riskLabel?: unknown;
  /** Homepage red-flag parameter name; assessment sends primaryFriction. */
  lowestParameter?: unknown;
  primaryFriction?: unknown;
  /** Gated-assessment prescribed offer label. */
  recommendedPrescription?: unknown;
  prescription?: unknown;
  keyObservation?: unknown;
  commercialRisk?: unknown;
  frictionLabel?: unknown;
  anchorLabel?: unknown;
  /** Legacy alias kept for continuity (mapped to the red-flag observation). */
  strategicImpact?: unknown;
  diagnosticTakeaway?: unknown;
  domEvidence?: unknown;
  /** Gated-assessment human-readable answers summary. */
  scoreBreakdown?: unknown;
  /** Which surface submitted: "Homepage Calculator" | "Full Assessment". */
  source?: unknown;
  diagnosticPayload?: unknown;
}

/** Best-effort company inference from a URL, e.g. https://www.acme.com -> "acme".
 * Mirrors the client's inference so the server never trusts a missing field. */
function inferCompany(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    const label = host.split(".")[0];
    return label && label.length ? label : "";
  } catch {
    return "";
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asFiniteNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

function validPayload(v: unknown): DiagnosticPayload | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const score = asFiniteNumber(p.score);
  if (!Number.isFinite(score)) return null;
  const dims: PayloadDim[] = [];
  if (Array.isArray(p.dimensions)) {
    for (const d of p.dimensions) {
      if (!d || typeof d !== "object") continue;
      const dd = d as Record<string, unknown>;
      const id = typeof dd.id === "string" ? dd.id : "";
      const name = typeof dd.name === "string" ? dd.name : "";
      if (!id || !name) continue;
      dims.push({
        id,
        name,
        pillar: typeof dd.pillar === "string" ? dd.pillar : "",
        score: typeof dd.score === "number" ? Math.round(dd.score) : undefined,
        status: typeof dd.status === "string" ? dd.status : undefined,
        friction_label: typeof dd.friction_label === "string" ? dd.friction_label : undefined,
        anchor_label: typeof dd.anchor_label === "string" ? dd.anchor_label : undefined,
        keyObservation:
          typeof dd.keyObservation === "string"
            ? dd.keyObservation
            : typeof dd.key_observation === "string"
              ? dd.key_observation
              : undefined,
        commercialRisk:
          typeof dd.commercialRisk === "string"
            ? dd.commercialRisk
            : typeof dd.commercial_risk === "string"
              ? dd.commercial_risk
              : undefined,
        strategicImpact:
          typeof dd.strategicImpact === "string"
            ? dd.strategicImpact
            : typeof dd.diagnosticTakeaway === "string"
              ? dd.diagnosticTakeaway
              : undefined,
        evidence_snippet:
          typeof dd.evidence_snippet === "string"
            ? dd.evidence_snippet
            : typeof dd.evidenceSnippet === "string"
              ? dd.evidenceSnippet
              : typeof dd.domEvidence === "string"
                ? dd.domEvidence
                : typeof dd.evidence === "string"
                  ? dd.evidence
                  : undefined,
        locked: dd.locked === true,
        insufficientData: dd.insufficientData === true,
      });
    }
  }
  if (dims.length === 0) return null;
  return {
    score,
    overallBand: typeof p.overallBand === "string" ? p.overallBand : "",
    generatedAt: typeof p.generatedAt === "string" ? p.generatedAt : new Date().toISOString(),
    url: typeof p.url === "string" ? p.url : "",
    dimensions: dims,
  };
}

/** Normalized lead: everything downstream (Airtable fields, JSONL fallback,
 * Score Breakdown text) is derived from this one shape. */
interface NormalizedLead {
  firstName: string;
  workEmail: string;
  company: string;
  websiteUrl: string;
  icp: string;
  score: number; // NaN when no numeric score was sent
  readiness: string;
  primaryFriction: string;
  prescription: string;
  keyObservation: string;
  commercialRisk: string;
  frictionLabel: string;
  anchorLabel: string;
  domEvidence: string;
  answersBreakdown: string; // gated-assessment answers summary, when sent
  source: string;
  payload: DiagnosticPayload | null;
  capturedAt: string;
}

function normalizeLead(b: LeadRequestBody): NormalizedLead {
  const websiteUrl = asString(b.websiteUrl);
  const payload = validPayload(b.diagnosticPayload);
  const scoreRaw = asFiniteNumber(b.overallScore);
  const diagScoreRaw = asFiniteNumber(b.diagnosticScore);
  const score = Number.isFinite(scoreRaw)
    ? Math.round(Math.min(100, Math.max(0, scoreRaw)))
    : Number.isFinite(diagScoreRaw)
      ? Math.round(Math.min(100, Math.max(0, diagScoreRaw)))
      : payload
        ? Math.round(payload.score)
        : NaN;
  const sourceRaw = asString(b.source);
  return {
    firstName: asString(b.firstName),
    workEmail: asString(b.workEmail),
    company: asString(b.company) || inferCompany(websiteUrl),
    websiteUrl,
    icp: asString(b.icp),
    score,
    readiness:
      asString(b.readiness) || (payload ? payload.overallBand : "") || asString(b.riskLabel),
    primaryFriction: asString(b.primaryFriction) || asString(b.lowestParameter),
    prescription: asString(b.recommendedPrescription) || asString(b.prescription),
    keyObservation:
      asString(b.keyObservation) || asString(b.strategicImpact) || asString(b.diagnosticTakeaway),
    commercialRisk: asString(b.commercialRisk),
    frictionLabel: asString(b.frictionLabel),
    anchorLabel: asString(b.anchorLabel),
    domEvidence: asString(b.domEvidence),
    answersBreakdown: asString(b.scoreBreakdown),
    source: sourceRaw || (payload ? "Homepage Calculator" : "Unknown"),
    payload,
    capturedAt: new Date().toISOString(),
  };
}

/** Human-readable breakdown for the "Score Breakdown" column: red-flag detail
 * plus the full diagnostic JSON, so Airtable Automations (Day 2 / Day 4) can
 * reference scores, observations, and raw evidence without extra columns. */
function buildScoreBreakdown(lead: NormalizedLead): string {
  const lines: string[] = [];
  if (Number.isFinite(lead.score)) {
    lines.push(
      `Score: ${lead.score}/100${lead.readiness ? ` (${lead.readiness})` : ""}`,
    );
  }
  if (lead.primaryFriction) lines.push(`Primary Friction: ${lead.primaryFriction}`);
  if (lead.prescription) lines.push(`Recommended Prescription: ${lead.prescription}`);
  if (lead.icp) lines.push(`ICP: ${lead.icp}`);
  if (lead.keyObservation) lines.push(`Key Observation: ${lead.keyObservation}`);
  if (lead.commercialRisk) lines.push(`Commercial Risk: ${lead.commercialRisk}`);
  const labels = [lead.frictionLabel, lead.anchorLabel].filter(Boolean);
  if (labels.length) lines.push(`Labels: ${labels.join(" / ")}`);
  if (lead.domEvidence) lines.push(`DOM Evidence: ${lead.domEvidence}`);
  if (lead.answersBreakdown) lines.push(`Answers: ${lead.answersBreakdown}`);
  if (lead.payload) {
    const scored = lead.payload.dimensions
      .filter((d) => !d.locked && typeof d.score === "number")
      .map((d) => `${d.name}: ${d.score}/100`)
      .join("; ");
    if (scored) lines.push(`Parameter Scores: ${scored}`);
    lines.push(`Full Diagnostic JSON: ${JSON.stringify(lead.payload)}`);
  }
  return lines.join("\n");
}

/** Map a free-form parameter/red-flag name to the closest Primary Friction
 * single-select option. Order matters: check Acquisition before Messaging so
 * e.g. "Acquisition Efficiency" doesn't match a Messaging pattern first.
 * Returns "" when nothing maps — the caller must omit the field (sending the
 * raw name would make Airtable try to auto-create a new option and 422). */
function mapPrimaryFriction(raw: string): string {
  if (!raw) return "";
  if (/Acquisition|Efficiency|ICP/i.test(raw)) return "Acquisition Efficiency";
  if (/Conversion/i.test(raw)) return "Conversion";
  if (/GTM Path|Launch|Go-to-Market|GTM/i.test(raw)) return "GTM Path";
  if (/Category Positioning|Positioning/i.test(raw)) return "Positioning";
  if (/Hero Messaging|Messaging & Value Prop|Value Proposition|Messaging/i.test(raw))
    return "Messaging";
  // Exact option (any case) still resolves, so future callers that already
  // send a valid option keep flowing.
  const exact = PRIMARY_FRICTION_OPTIONS.find(
    (o) => o.toLowerCase() === raw.trim().toLowerCase(),
  );
  return exact ?? "";
}

/** Map the normalized lead to Airtable columns (via AIRTABLE_FIELD_MAP only).
 * Rules that keep Airtable from 422ing on single-select columns:
 *  - Empty-string values are dropped generically (Airtable would try to
 *    create a new "" select option and reject the whole write).
 *  - Readiness Band: only one of the 3 exact allowed values is sent.
 *  - Primary Friction: only a mapped option is sent; unmapped -> omitted.
 *  - First Name / Company: only when non-empty (existence in the table is
 *    enforced separately by whitelistFields()).
 *  - Numeric score keeps the existing isFinite guard. */
function toAirtableFields(lead: NormalizedLead): Record<string, unknown> {
  const m = AIRTABLE_FIELD_MAP;
  const readiness = VALID_READINESS_BANDS.has(lead.readiness) ? lead.readiness : "";
  const primaryFriction = mapPrimaryFriction(lead.primaryFriction);
  const fields: Record<string, unknown> = {
    [m.firstName]: lead.firstName,
    [m.company]: lead.company,
    [m.email]: lead.workEmail,
    [m.websiteUrl]: lead.websiteUrl,
    [m.readiness]: readiness,
    [m.primaryFriction]: primaryFriction,
    [m.prescription]: lead.prescription,
    [m.breakdown]: buildScoreBreakdown(lead),
    [m.source]: lead.source,
    [m.dateSubmitted]: lead.capturedAt,
  };
  if (Number.isFinite(lead.score)) fields[m.score] = lead.score;
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

/** Cached set of column names that actually exist in the owner's table
 * (from the metadata API). Null = not fetched yet / fetch failed. */
let knownColumns: Set<string> | null = null;
let schemaFetchInFlight: Promise<Set<string> | null> | null = null;

/** Fetch the table schema ONCE (lazily, cached at module level) via the
 * metadata API. Resolves the set of column names, or null on any failure
 * (caller then falls back to ORIGINAL_FIELD_NAMES). Never logs or returns
 * the token. */
function fetchTableSchema(): Promise<Set<string> | null> {
  if (knownColumns) return Promise.resolve(knownColumns);
  if (schemaFetchInFlight) return schemaFetchInFlight;
  schemaFetchInFlight = (async (): Promise<Set<string> | null> => {
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
      const tableName = process.env.AIRTABLE_TABLE_NAME;
      const table = data?.tables?.find((t) => t.name === tableName);
      if (!table || !Array.isArray(table.fields)) return null;
      const names = new Set<string>();
      for (const f of table.fields) {
        if (f && typeof f.name === "string" && f.name) names.add(f.name);
      }
      knownColumns = names;
      return names;
    } catch {
      return null;
    } finally {
      schemaFetchInFlight = null;
    }
  })();
  return schemaFetchInFlight;
}

/** Drop any field whose column does not exist in the table, so adding new
 * mappings (First Name / Company) can never break writes before the owner
 * adds the columns. When the schema is unknown (metadata fetch failed),
 * falls back to ORIGINAL_FIELD_NAMES (First Name / Company skipped). */
function whitelistFields(
  fields: Record<string, unknown>,
  schema: Set<string> | null,
): Record<string, unknown> {
  const allowed = schema ?? ORIGINAL_FIELD_NAMES;
  return Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.has(k)));
}

/** Best-effort JSONL append (never throws). Consistent with intake.ts. */
async function appendJsonl(record: unknown): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "leads.jsonl");
  await mkdir(dir, { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

/** Names of the required Airtable env vars that are currently missing. */
function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.AIRTABLE_API_TOKEN) missing.push("AIRTABLE_API_TOKEN");
  if (!process.env.AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!process.env.AIRTABLE_TABLE_NAME) missing.push("AIRTABLE_TABLE_NAME");
  return missing;
}

/** POST one record to Airtable. Resolves { ok:true } on 2xx, else
 * { ok:false, error } with the Airtable status + message (never the token). */
async function writeAirtable(
  fields: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.AIRTABLE_API_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME;
  if (!token || !base || !table) {
    return {
      ok: false,
      error: `Airtable is not configured (missing ${missingEnvVars().join(", ")}).`,
    };
  }
  try {
    const res = await fetch(
      `${AIRTABLE_API}/${encodeURIComponent(base)}/${encodeURIComponent(table)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
      },
    );
    if (res.ok) return { ok: true };
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return {
      ok: false,
      error: `Airtable rejected the lead (HTTP ${res.status})${detail ? `: ${detail}` : "."}`,
    };
  } catch (err) {
    // Network / DNS failure: message only, never credentials.
    const msg = err instanceof Error ? err.message : "network error";
    return { ok: false, error: `Airtable request failed: ${msg}` };
  }
}

export const Route = createFileRoute("/api/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be valid JSON." },
            { status: 400 },
          );
        }
        const lead = normalizeLead((body ?? {}) as LeadRequestBody);
        if (!lead.firstName) {
          return Response.json({ ok: false, error: "First name is required." }, { status: 400 });
        }
        if (!EMAIL_RE.test(lead.workEmail)) {
          return Response.json(
            { ok: false, error: "A valid work email is required." },
            { status: 400 },
          );
        }
        if (!Number.isFinite(lead.score) && !lead.payload && !lead.answersBreakdown) {
          return Response.json(
            { ok: false, error: "A diagnostic score or breakdown is required." },
            { status: 400 },
          );
        }

        const fields = whitelistFields(toAirtableFields(lead), await fetchTableSchema());

        // Layer 1: Airtable when configured. The token is never logged.
        const result = await writeAirtable(fields);
        if (result.ok) {
          return Response.json({ ok: true });
        }
        if (missingEnvVars().length > 0) {
          console.warn("[leads] Airtable env vars missing; saving lead locally.");
        } else {
          // Status only: no PII, no credentials in the server log.
          console.warn("[leads] Airtable write failed; saving lead locally.");
        }

        // Layer 2: JSONL fallback with a distinct failure marker so the owner
        // can see exactly which submissions did not reach Airtable.
        const logRecord = {
          firstName: lead.firstName,
          workEmail: lead.workEmail,
          company: lead.company,
          websiteUrl: lead.websiteUrl,
          icp: lead.icp,
          diagnosticScore: Number.isFinite(lead.score) ? lead.score : null,
          readiness: lead.readiness,
          primaryFriction: lead.primaryFriction,
          recommendedPrescription: lead.prescription,
          scoreBreakdown: lead.answersBreakdown || buildScoreBreakdown(lead),
          source: lead.source,
          capturedAt: lead.capturedAt,
          diagnostic: lead.payload,
          airtable: "failed",
          airtableError: result.error,
        };
        try {
          await appendJsonl(logRecord);
        } catch (err) {
          console.warn("[leads] JSONL append failed", err);
        }
        return Response.json({ ok: false, error: result.error });
      },
    },
  },
});
