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
 *
 * Owner rubric calibration 2026-09-18 (Parts 1 + 4):
 *   - the scale is FIVE values [20, 40, 60, 80, 95] and any other number snaps
 *     to the nearest permitted one (ties up)
 *   - the 80 / 40 cutoffs, now shared by the API, the coercion and this client
 *   - an abstained dimension carries ONLY the model's own keyObservation: the
 *     client-side boilerplate sentence is gone, so a card with no usable model
 *     text shows the "Not enough signal to score" label alone
 */
import { PARAMETER_IDS, PARAMETER_NAMES, LOCKED_PARAMETER_IDS, PILLAR_OF } from "./engine";
import { paramStatus, overallBandFor, STRONG_MIN } from "./thresholds";
import { snapToBand } from "./scoring";
import {
  BOOK_A_CALL_URL,
  UNREADABLE_CTA_LABEL,
  UNREADABLE_HEADING,
  isUnreadablePayload,
  unreadableBody,
} from "./readability";
import type { UnreadableReason } from "./readability";

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
   * FRICTION label for scores below 80. */
  frictionLabel?: string;
  /** Short (2 to 4 word) positive anchor label from the model, e.g.
   * "Clear Category Stake". Shown as the STRENGTH label for 80+. */
  anchorLabel?: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. NOT a
   * generic textbook definition. This is what the UI renders in the card body. */
  keyObservation?: string;
  /** 1-sentence business impact (the commercial risk for scores below 80, or
   * the competitive advantage for 80+). Single statement; the UI picks the label
   * at the 80 threshold (impactLabel). */
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
        // Owner rubric calibration Part 4: the model's own site-specific
        // sentence, or nothing. The client never manufactures an explanation
        // for an abstained parameter.
        keyObservation: keyObservation || undefined,
        // Part 4 (same rule client-side): an abstained dimension is filled in
        // with the model's own text only, never with a code-generated sentence.
        commercialRisk:
          commercialRisk ||
          (insufficientData
            ? undefined
            : strong
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
    // Nothing from the model for a scored dimension: abstain, never invent a
    // score, and never invent an explanation either (Part 4).
    return {
      id,
      name: ID_TO_NAME[id],
      pillar: PILLAR_OF[id],
      status: undefined,
      friction: "Not enough signal to score",
      insufficientData: true,
    };
  });
}

/** Normalize whatever /api/diagnose returned, or null if it isn't usable. */
export function toAIResult(raw: unknown): AIResult | null {
  // The unreadable state is NOT a scorecard: it must be handled by
  // toUnreadableResult() before this runs (no score, no dimensions).
  if (isUnreadablePayload(raw)) return null;
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

/* ------------------------------------------------------------------ */
/* Unreadable site (owner readability fix, Part D)                     */
/* ------------------------------------------------------------------ */

/** The distinct state the diagnostic returns when the crawl could not read the
 * site: NO score, no band, no dimensions, no friction and no fix. The UI
 * renders this instead of a scorecard (never a scorecard of zeroes). */
export interface UnreadableResult {
  readable: false;
  /** Which rule fired: low_content (< MIN_USABLE_CHARS) or identical_shell. */
  reason: UnreadableReason;
  /** Total usable extracted characters across the crawled pages. */
  usableChars: number;
  /** True when every fetched page returned byte-identical content. */
  shellDetected: boolean;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Normalize the unreadable response, or null when the response is not the
 * unreadable state. Defensive: any missing copy field falls back to the shared
 * constant, so a slightly older/newer server can never render a blank state.
 */
export function toUnreadableResult(raw: unknown): UnreadableResult | null {
  if (!isUnreadablePayload(raw)) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.trim() ? stripDashes(v.trim()) : fallback;
  const cta = (r.cta ?? {}) as Record<string, unknown>;
  const usableChars =
    typeof r.usableChars === "number" && Number.isFinite(r.usableChars)
      ? Math.max(0, Math.round(r.usableChars))
      : 0;
  return {
    readable: false,
    reason: r.reason as UnreadableReason,
    usableChars,
    shellDetected: r.shellDetected === true,
    heading: str(r.heading, UNREADABLE_HEADING),
    // The body is multi-paragraph copy: keep its paragraph breaks. The fallback
    // is reason-dependent (identical_shell and low_content open differently), so
    // a payload that arrives without a body still gets the copy that matches the
    // rule that fired.
    body:
      typeof r.body === "string" && r.body.trim()
        ? r.body.trim()
        : unreadableBody(r.reason as UnreadableReason),
    ctaLabel: str(cta.label, UNREADABLE_CTA_LABEL),
    ctaHref: str(cta.href, BOOK_A_CALL_URL),
  };
}
