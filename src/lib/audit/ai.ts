/**
 * Deep AI Diagnostic: shared client-side types + defensive normalization for
 * the /api/diagnose response. Mirrors the server output contract so the
 * homepage + dashboard never assume a perfect model response.
 *
 * 6 scored dimensions (positioning, icp, differentiation, messaging,
 * value-prop, conversion) + 2 LOCKED reserved dimensions (gtm, launch). Pricing
 * & Packaging Logic is NOT scored (internal unit economics / deal context).
 *
 * Owner spec 2026-09-15:
 *   - no estimatedLeakage anywhere (removed, never replaced)
 *   - scores are banded (snapToBand) and the overall score is computed in code
 *     by the server, so it is nullable: a site that could not be read well
 *     enough (3+ dimensions with no evidence) carries NO score
 *   - a dimension with no evidence is insufficientData: true with NO score; it
 *     is never defaulted to an invented number
 *   - status labels + bands come from the one shared threshold set
 */
import { PARAMETER_IDS, PARAMETER_NAMES, LOCKED_PARAMETER_IDS, PILLAR_OF } from "./engine";
import { paramStatus, overallBandFor, STRONG_MIN } from "./thresholds";
import { snapToBand } from "./scoring";

export interface AIDimension {
  id: string;
  name: string;
  pillar: string;
  /** Present for the scored dimensions WITH evidence; absent when the
   * dimension abstained (insufficientData) or is locked. */
  score?: number;
  /** Rubric status label: Strong / Needs Refinement / Critical Gap. */
  status?: string;
  friction?: string;
  /** Short (2 to 4 word) dynamic diagnostic label from the model, e.g.
   * "Vague Category Naming". Distinct from the longer `friction`. Shown as the
   * FRICTION label for scores below 70. */
  frictionLabel?: string;
  /** Short (2 to 4 word) positive anchor label from the model, e.g.
   * "Clear Category Stake". Shown as the STRENGTH label for 70+. */
  anchorLabel?: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. NOT a
   * generic textbook definition. This is what the UI renders in the card body. */
  keyObservation?: string;
  /** 1-sentence business impact (the commercial risk for scores below 70, or
   * the competitive advantage for 70+). Single statement; the UI picks the label
   * at the 70 threshold (impactLabel). */
  commercialRisk?: string;
  /** Short raw DOM quote from the crawl backing this score, as emitted by the
   * model. Server-side carry only: NEVER rendered in the UI. Used by the
   * red-flag guard and logged to Airtable as DOM Evidence. */
  evidence_snippet?: string;
  /** True when the crawl held no usable evidence for this dimension: the card
   * renders "Not enough signal to score" and the dimension is excluded from the
   * weighted mean. */
  insufficientData?: boolean;
  /** Reserved dimensions (gtm, launch): requires internal review, not scored. */
  locked?: boolean;
}

export interface AIResult {
  /** Weighted-mean overall score computed server-side; null when 3 or more of
   * the 6 scored dimensions had no usable evidence. */
  score: number | null;
  /** Readiness band derived from the unified thresholds; null with no score. */
  overallBand: string | null;
  /** The model's single primary friction (max 15 words). */
  primaryFriction: string;
  /** The model's one recommended fix (max 25 words). */
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
 * canonical order: 6 scored + 2 locked. Locked ids can never receive a score,
 * and a dimension with no usable evidence abstains (insufficientData, no score)
 * rather than being given an invented number. */
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
      const insufficientData = it.insufficientData === true;
      const scoreRaw = typeof it.score === "number" ? it.score : NaN;
      // Abstain rather than guess: no score at all when there is no evidence
      // and none when the model simply omitted the number.
      const hasScore = !insufficientData && Number.isFinite(scoreRaw);
      const score = hasScore ? snapToBand(scoreRaw) : undefined;
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
      const strong = typeof score === "number" && score >= STRONG_MIN;
      byId[id] = {
        id,
        name: ID_TO_NAME[id],
        pillar: PILLAR_OF[id],
        score,
        status: typeof score === "number" ? paramStatus(score) : undefined,
        friction: friction || (insufficientData ? "Not enough signal to score" : "Gap in the assessment"),
        frictionLabel: frictionLabel || undefined,
        anchorLabel: anchorLabel || (strong ? "Clear Strength" : undefined),
        keyObservation:
          keyObservation ||
          (strong
            ? "This parameter's current framing is a clear strength on the public site."
            : "This parameter is not well represented on the public site."),
        commercialRisk:
          commercialRisk ||
          (strong
            ? "Visitors get a clear reason to choose this product, which shortens evaluation and protects the price."
            : "Visitors get no clear reason to choose this product, which slows evaluation and leaks demand."),
        evidence_snippet: evidence || undefined,
        insufficientData,
      };
    }
  }
  return CANONICAL_IDS.map((id) => {
    const e = byId[id];
    if (e) return e;
    if (LOCKED_PARAMETER_IDS.has(id)) {
      return { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
    }
    // Nothing from the model for a scored dimension: abstain, never invent.
    return {
      id,
      name: ID_TO_NAME[id],
      pillar: PILLAR_OF[id],
      status: undefined,
      friction: "Not enough signal to score",
      keyObservation: "Not enough signal in the public crawl to score this parameter.",
      insufficientData: true,
    };
  });
}

/** Normalize whatever /api/diagnose returned, or null if it isn't usable. */
export function toAIResult(raw: unknown): AIResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawScore = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : null;
  const score = rawScore == null ? null : Math.min(100, Math.max(0, Math.round(rawScore)));
  const str = (v: unknown): string =>
    typeof v === "string" && v.trim() ? stripDashes(v.trim()) : "";
  const primaryFriction = wordLimit(str(r.primaryFriction), 15);
  const recommendedFix = wordLimit(str(r.recommendedFix), 25);
  if (!primaryFriction || !recommendedFix) return null;
  const declaredBand = str(r.overallBand);
  const band = score == null ? null : declaredBand || overallBandFor(score);
  return {
    score,
    overallBand: band,
    primaryFriction,
    recommendedFix,
    dimensions: coerceDimensions(r.dimensions),
  };
}
