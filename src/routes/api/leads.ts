/**
 * POST /api/leads : the homepage diagnostic PDF-capture-bar lead capture.
 *
 * Writes a diagnostic lead (value-first: no blur-gate; the PDF capture bar is
 * the single capture point) to the owner's Airtable base using ONLY
 * process.env.AIRTABLE_API_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_TABLE_NAME
 * (never hard-coded, never logged). The record carries the first name, work
 * email, company (inferred from the submitted URL's domain, not a user field),
 * the website URL, the optional ICP, the lowest-scoring parameter, its
 * 2-part diagnostic synthesis (Key Observation + Commercial Risk) with its
 * friction/anchor labels, its raw DOM evidence quote, and the full 6-param
 * diagnostic payload as both a JSON blob and flattened per-parameter fields
 * (scores, friction labels, anchor labels, observations, commercial risk, and
 * per-parameter DOM evidence), so Airtable Automations can reference scores,
 * observations, and raw evidence directly (Email 1 immediate, Day 2, Day 4).
 *
 * domEvidence is a raw literal site quote, carried server-side only and logged
 * to the "DOM Evidence" Airtable column for Automations; it is never rendered
 * in the public UI (which shows only Key Observation + Commercial Risk).
 *
 * Failure handling (must NEVER block the client's optimistic PDF download):
 *   - If any AIRTABLE_* secret is absent, fall back to appending the lead to
 *     .data/leads.jsonl (consistent with how intake.ts falls back to
 *     .data/intakes.jsonl when Neon is not connected) and STILL return success.
 *   - If the Airtable POST itself throws or returns non-2xx, do the same
 *     JSONL fallback and still return success.
 *   - Only an unparseable body / invalid required fields returns non-2xx, so
 *     a genuinely malformed request is surfaced, but a valid lead is never
 *     shown as failed to the user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { mkdir, appendFile } from "node:fs/promises";
import * as path from "node:path";

const AIRTABLE_API = "https://api.airtable.com/v0";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One diagnostic parameter as captured from the results dashboard. */
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
  /** Raw literal DOM quote backing this parameter (server-side carry only). */
  evidence_snippet?: string;
  /** Legacy alias kept for continuity; the UI now sends keyObservation. */
  strategicImpact?: string;
  locked?: boolean;
  insufficientData?: boolean;
}
/** The full diagnostic payload the client serializes (6 scored parameters). */
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
  overallScore?: unknown;
  lowestParameter?: unknown;
  keyObservation?: unknown;
  commercialRisk?: unknown;
  frictionLabel?: unknown;
  anchorLabel?: unknown;
  /** Legacy alias kept for continuity (mapped to the red-flag observation). */
  strategicImpact?: unknown;
  diagnosticTakeaway?: unknown;
  domEvidence?: unknown;
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

function validPayload(v: unknown): DiagnosticPayload | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const score = typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null;
  if (score == null) return null;
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
        evidence_snippet: typeof dd.evidence_snippet === "string" ? dd.evidence_snippet : undefined,
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

/** Best-effort JSONL append (never throws). Consistent with intake.ts. */
async function appendJsonl(record: unknown): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "leads.jsonl");
  await mkdir(dir, { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

/** Airtable fields object: overall + flattened per-parameter + full JSON blob. */
function toAirtableFields(
  firstName: string,
  workEmail: string,
  company: string,
  websiteUrl: string,
  icp: string,
  overallScore: number,
  lowestParameter: string,
  keyObservation: string,
  commercialRisk: string,
  frictionLabel: string,
  anchorLabel: string,
  domEvidence: string,
  payload: DiagnosticPayload,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    "First Name": firstName,
    "Work Email": workEmail,
    "Company": company || inferCompany(websiteUrl),
    "Website URL": websiteUrl,
    "ICP": icp,
    "Overall Score": Number.isFinite(overallScore) ? overallScore : payload.score,
    "Readiness Band": payload.overallBand,
    "Generated At": payload.generatedAt,
    "Lowest Parameter": lowestParameter,
    "Key Observation": keyObservation,
    "Commercial Risk": commercialRisk,
    "Friction Label": frictionLabel,
    "Anchor Label": anchorLabel,
    "DOM Evidence": domEvidence,
    "Diagnostic Payload": JSON.stringify(payload),
  };
  for (const d of payload.dimensions) {
    if (d.locked) {
      // Locked params are reserved: record the flag, no score.
      fields[`${d.id} locked`] = true;
      continue;
    }
    if (typeof d.score === "number") {
      fields[`${d.id} score`] = d.score;
    }
    if (d.status) fields[`${d.id} status`] = d.status;
    if (d.friction_label) fields[`${d.id} friction`] = d.friction_label;
    if (d.anchor_label) fields[`${d.id} anchor`] = d.anchor_label;
    if (d.keyObservation) fields[`${d.id} observation`] = d.keyObservation;
    if (d.commercialRisk) fields[`${d.id} risk`] = d.commercialRisk;
    // Legacy continuity column: the old strategic-impact synthesis may still be
    // present in older payloads.
    if (d.strategicImpact) fields[`${d.id} impact`] = d.strategicImpact;
    if (d.evidence_snippet) fields[`${d.id} dom_evidence`] = d.evidence_snippet;
    if (d.insufficientData) fields[`${d.id} insufficient_data`] = true;
  }
  return fields;
}

/** POST a record to Airtable. Returns true on 2xx, false on any failure. */
async function writeAirtable(fields: Record<string, unknown>): Promise<boolean> {
  const token = process.env.AIRTABLE_API_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME;
  if (!token || !base || !table) return false;
  try {
    const res = await fetch(`${AIRTABLE_API}/${encodeURIComponent(base)}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[leads] Airtable write failed, falling back to JSONL", err);
    return false;
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
        const b = (body ?? {}) as LeadRequestBody;
        const firstName = asString(b.firstName);
        const workEmail = asString(b.workEmail);
        if (!firstName) {
          return Response.json({ ok: false, error: "First name is required." }, { status: 400 });
        }
        if (!EMAIL_RE.test(workEmail)) {
          return Response.json(
            { ok: false, error: "A valid work email is required." },
            { status: 400 },
          );
        }
        const websiteUrl = asString(b.websiteUrl);
        const icp = asString(b.icp);
        const lowestParameter = asString(b.lowestParameter);
        // New 2-part diagnostic fields (red-flag parameter); legacy aliases
        // are still accepted for continuity.
        const keyObservation =
          asString(b.keyObservation) || asString(b.strategicImpact) || asString(b.diagnosticTakeaway);
        const commercialRisk = asString(b.commercialRisk);
        const frictionLabel = asString(b.frictionLabel);
        const anchorLabel = asString(b.anchorLabel);
        const domEvidence = asString(b.domEvidence);
        const overallScoreRaw = typeof b.overallScore === "number" ? b.overallScore : NaN;
        const overallScore = Number.isFinite(overallScoreRaw)
          ? Math.round(Math.min(100, Math.max(0, overallScoreRaw)))
          : NaN;
        const payload = validPayload(b.diagnosticPayload);
        if (!payload) {
          return Response.json(
            { ok: false, error: "A valid diagnostic payload is required." },
            { status: 400 },
          );
        }
        const company = asString(b.company) || inferCompany(websiteUrl);
        const fields = toAirtableFields(
          firstName,
          workEmail,
          company,
          websiteUrl,
          icp,
          Number.isFinite(overallScore) ? overallScore : payload.score,
          lowestParameter,
          keyObservation,
          commercialRisk,
          frictionLabel,
          anchorLabel,
          domEvidence,
          payload,
        );

        // Layer 1: Airtable when all secrets are present. Never logged.
        const wroteAirtable = await writeAirtable(fields);
        if (wroteAirtable) {
          return Response.json({ ok: true, source: "airtable" });
        }

        // Layer 2: JSONL file fallback (also the path when secrets are absent).
        // Never surface failure to the client: a valid unlock always resolves ok.
        const logRecord = {
          firstName,
          workEmail,
          company,
          websiteUrl,
          icp,
          overallScore: Number.isFinite(overallScore) ? overallScore : payload.score,
          lowestParameter,
          keyObservation,
          commercialRisk,
          frictionLabel,
          anchorLabel,
          domEvidence,
          source: "pdf-capture-bar",
          capturedAt: new Date().toISOString(),
          diagnostic: payload,
        };
        try {
          await appendJsonl(logRecord);
        } catch (err) {
          console.warn("[leads] JSONL append failed", err);
        }
        return Response.json({ ok: true, source: "jsonl" });
      },
    },
  },
});
