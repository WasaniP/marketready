/**
 * Unified score thresholds (owner spec 2026-09-15, Part 4).
 *
 * ONE constant set for every surface: the /api/diagnose system prompt text,
 * the server-side coercion, the client-side ai.ts normalization, the internal
 * engine (scoreColor / statusFor / riskLabel) and the results UI. Nothing
 * anywhere else in the codebase may hard-code a score cutoff.
 *
 * Owner rubric calibration 2026-09-18 (Part 1): with the five-value scale
 * [20, 40, 60, 80, 95] the cutoffs moved to 80 / 40, so a five-band 80 now
 * reads Strong exactly where the top of the scale begins.
 *
 * Per-parameter status:  >= 80 "Strong" | 40 to 79 "Needs Refinement" | < 40 "Critical Gap"
 * Overall band:          >= 80 "Market Ready" | 40 to 79 "Needs Attention" | < 40 "High Launch Risk"
 * UI label flip:         >= 80 "Competitive Advantage" | < 80 "Commercial Risk"
 *
 * SCORE_COLORS uses the same 80 / 40 cutoffs so a card's color always matches
 * its label.
 */
import type { Status } from "./types";

/** Score at or above which a parameter is Strong / Competitive Advantage and
 * an overall result is Market Ready. */
export const STRONG_MIN = 80;
/** Score at or above which a parameter Needs Refinement (and below which it is
 * a Critical Gap) and an overall result Needs Attention. */
export const REFINEMENT_MIN = 40;

/** Exact per-parameter status vocabulary (matches the API status field). */
export type ParamStatusLabel = "Strong" | "Needs Refinement" | "Critical Gap";
/** Exact overall band vocabulary (matches the API overallBand field). */
export type OverallBand = "Market Ready" | "Needs Attention" | "High Launch Risk";

/** Rubric status line, stated verbatim in the /api/diagnose system prompt so
 * the model and the code can never disagree about the vocabulary. */
export const STATUS_RUBRIC_TEXT = `score >= ${STRONG_MIN} -> "Strong"; ${REFINEMENT_MIN} to ${STRONG_MIN - 1} -> "Needs Refinement"; below ${REFINEMENT_MIN} -> "Critical Gap"`;

/** Rubric band line, stated verbatim in the /api/diagnose system prompt. The
 * model no longer returns the band (the server computes it in code). */
export const BAND_RUBRIC_TEXT = `overall >= ${STRONG_MIN} -> "Market Ready"; ${REFINEMENT_MIN} to ${STRONG_MIN - 1} -> "Needs Attention"; below ${REFINEMENT_MIN} -> "High Launch Risk"`;

/** Score -> per-parameter status label (title case, the API vocabulary). */
export function paramStatus(score: number): ParamStatusLabel {
  if (score >= STRONG_MIN) return "Strong";
  if (score >= REFINEMENT_MIN) return "Needs Refinement";
  return "Critical Gap";
}

/** Score -> overall readiness band. */
export function overallBandFor(score: number): OverallBand {
  if (score >= STRONG_MIN) return "Market Ready";
  if (score >= REFINEMENT_MIN) return "Needs Attention";
  return "High Launch Risk";
}

/** Score -> the UI label flip for the business-impact sentence carried on each
 * dimension (the same field reads as a risk below 80 and an advantage at 80+). */
export function impactLabel(score: number): "Competitive Advantage" | "Commercial Risk" {
  return score >= STRONG_MIN ? "Competitive Advantage" : "Commercial Risk";
}

/** Score -> hex color. Same 80 / 40 cutoffs as the labels above. */
export const SCORE_COLORS = {
  high: "#1F4A42", // STRONG_MIN to 100, strong / passing (deep pine)
  mid: "#8A6A1F", //  REFINEMENT_MIN to STRONG_MIN - 1, needs refinement (bronze olive)
  low: "#A15C2B", //   0 to REFINEMENT_MIN - 1, needs work (warm sienna)
} as const;

/** Score -> hex color, exact thresholds from the rubric status labels. */
export function scoreColor(score: number): string {
  if (score >= STRONG_MIN) return SCORE_COLORS.high;
  if (score >= REFINEMENT_MIN) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

/** Score -> uppercase status badge label (homepage Diagnostic Engine
 * vocabulary; mirrors paramStatus). */
export function statusFor(score: number): Status {
  if (score >= STRONG_MIN) return "STRONG";
  if (score >= REFINEMENT_MIN) return "NEEDS REFINEMENT";
  return "CRITICAL GAP";
}

/** Overall score -> readiness band, the same vocabulary as the API's
 * overallBand. (Formerly "Low / Moderate / High Launch Risk".) */
export function riskLabel(overall: number): OverallBand {
  return overallBandFor(overall);
}
