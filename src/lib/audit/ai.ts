/**
 * Deep AI Diagnostic (Build #36): shared client-side types + defensive
 * normalization for the /api/diagnose response. Mirrors the server output
 * contract so the homepage + dashboard never assume a perfect model response.
 *
 * Build #39: 6 scored dimensions (positioning, icp, differentiation, messaging,
 * value-prop, conversion) + 2 LOCKED reserved dimensions (gtm, launch). Pricing
 * & Packaging Logic is NOT scored (internal unit economics / deal context).
 * Locked entries carry `locked: true` and are NEVER coerced to a low score;
 * they stay unscored.
 */
import { PARAMETER_IDS, PARAMETER_NAMES, LOCKED_PARAMETER_IDS, PILLAR_OF } from "./engine";

export interface AIDimension {
  id: string;
  name: string;
  pillar: string;
  /** Present for the 6 scored dimensions; absent when locked. */
  score?: number;
  /** Rubric status label: Strong / Needs Refinement / Critical Gap. */
  status?: string;
  friction?: string;
  /** Short (2 to 4 word) dynamic diagnostic label from the model, e.g.
   * "Vague Category Naming". Distinct from the longer `friction`. Shown as the
   * FRICTION label for scores below 70. */
  frictionLabel?: string;
  /** Short (2 to 4 word) positive anchor label from the model, e.g.
   * "Clear Category Stake". Shown as the STRENGTH label for scores >= 70. */
  anchorLabel?: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. NOT a
   * generic textbook definition. This is what the UI renders in the card body. */
  keyObservation?: string;
  /** 1-sentence business impact (the commercial risk for scores below 70, or
   * the competitive advantage for scores >= 70). Single statement; the UI
   * picks the label at the 70 threshold. */
  commercialRisk?: string;
  /** Short raw DOM quote from the crawl backing this score, as emitted by the
   * model. Server-side carry only: NEVER rendered in the UI. Used by the
   * red-flag guard and logged to Airtable as DOM Evidence. */
  evidence_snippet?: string;
  insufficientData?: boolean;
  /** Reserved dimensions (gtm, launch): requires internal review, not scored. */
  locked?: boolean;
}

export interface AIResult {
  score: number;
  overallBand: string;
  estimatedLeakage: string;
  primaryFriction: string;
  recommendedFix: string;
  dimensions: AIDimension[];
}

const CANONICAL_IDS = [...PARAMETER_IDS] as string[];
const ID_TO_NAME: Record<string, string> = { ...PARAMETER_NAMES };

/** Client-side no-dash pass, mirroring the endpoint's coercion. */
function stripDashes(s: string): string {
  return s.replace(/\u2014|\u2013|\u2012|\u2015|—|–/g, " ").replace(/\s+/g, " ").trim();
}

function wordLimit(s: string, n: number): string {
  const words = s.split(/\s+/).filter(Boolean);
  return words.length > n ? words.slice(0, n).join(" ") : s;
}

/** Coerce the model's dimensions into exactly the 8 canonical entries in
 * canonical order: 6 scored + 2 locked. Locked ids can never receive a score. */
function coerceDimensions(raw: unknown): AIDimension[] {
  const byId: Record<string, AIDimension> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const rawId = typeof it.id === "string" ? it.id.trim().toLowerCase() : "";
      const rawName = typeof it.name === "string" ? it.name.trim() : "";
      let id = "";
      if (CANONICAL_IDS.includes(rawId)) id = rawId;
      else if (CANONICAL_IDS.includes(rawName.toLowerCase())) id = rawName.toLowerCase();
      else {
        const match = CANONICAL_IDS.find(
          (k) => ID_TO_NAME[k].toLowerCase() === rawName.toLowerCase(),
        );
        if (match) id = match;
      }
      if (!id) continue;
      if (LOCKED_PARAMETER_IDS.has(id)) {
        byId[id] = { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
        continue;
      }
      const scoreRaw = typeof it.score === "number" ? Math.round(it.score) : NaN;
      const score = Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 20;
      const status =
        typeof it.status === "string" && it.status.trim()
          ? stripDashes(it.status.trim())
          : "Needs Refinement";
      const friction = stripDashes(typeof it.friction === "string" ? it.friction : "");
      const frictionLabel = stripDashes(typeof it.friction_label === "string" ? it.friction_label : "");
      const anchorLabel = stripDashes(typeof it.anchor_label === "string" ? it.anchor_label : "");
      const keyObservation = stripDashes(
        typeof it.keyObservation === "string"
          ? it.keyObservation
          : typeof it.key_observation === "string"
            ? it.key_observation
            : "",
      );
      const commercialRisk = stripDashes(
        typeof it.commercialRisk === "string"
          ? it.commercialRisk
          : typeof it.commercial_risk === "string"
            ? it.commercial_risk
            : "",
      );
      const evidence = typeof it.evidence_snippet === "string" ? it.evidence_snippet.trim() : "";
      byId[id] = {
        id,
        name: ID_TO_NAME[id],
        pillar: PILLAR_OF[id],
        score,
        status,
        friction: friction || "Gap in the assessment",
        frictionLabel: frictionLabel || undefined,
        anchorLabel: anchorLabel || undefined,
        keyObservation:
          keyObservation ||
          (score >= 70
            ? "This parameter's current framing is a clear strength on the public site."
            : "This parameter is not well represented on the public site."),
        commercialRisk:
          commercialRisk ||
          (score >= 70
            ? "Visitors get a clear reason to choose this product, which shortens evaluation and protects the price."
            : "Visitors get no clear reason to choose this product, which slows evaluation and leaks demand."),
        evidence_snippet: evidence || undefined,
        insufficientData: it.insufficientData === true,
      };
    }
  }
  return CANONICAL_IDS.map((id) => {
    const e = byId[id];
    if (e) return e;
    if (LOCKED_PARAMETER_IDS.has(id)) {
      return { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
    }
    return {
      id,
      name: ID_TO_NAME[id],
      pillar: PILLAR_OF[id],
      score: 20,
      status: "Needs Refinement",
      friction: "NOT DISCLOSED / GATED",
      frictionLabel: "No Content Found",
      keyObservation:
        "No representable content was found on the public site for this parameter.",
      commercialRisk:
        "Buyers cannot evaluate this dimension before reaching out, so they disqualify the product by default.",
    };
  });
}

/** Normalize whatever /api/diagnose returned, or null if it isn't usable. */
export function toAIResult(raw: unknown): AIResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = typeof r.score === "number" && Number.isFinite(r.score) ? Math.round(r.score) : NaN;
  if (!Number.isFinite(score)) return null;
  const str = (v: unknown): string =>
    typeof v === "string" && v.trim() ? stripDashes(v.trim()) : "";
  const estimatedLeakage = str(r.estimatedLeakage);
  const primaryFriction = wordLimit(str(r.primaryFriction), 15);
  const recommendedFix = wordLimit(str(r.recommendedFix), 25);
  if (!estimatedLeakage || !primaryFriction || !recommendedFix) return null;
  const safe = Math.min(100, Math.max(0, score));
  const band =
    str(r.overallBand) ||
    (safe >= 80 ? "Market Ready" : safe >= 60 ? "Needs Attention" : "High Launch Risk");
  return {
    score: safe,
    overallBand: band,
    estimatedLeakage,
    primaryFriction,
    recommendedFix,
    dimensions: coerceDimensions(r.dimensions),
  };
}