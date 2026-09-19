/**
 * Deterministic overall scoring (owner spec 2026-09-15, Parts 3 / 5 / 6).
 *
 * Pure module, no IO: the server route computes the overall score in code (the
 * model no longer returns it), and this module is the single definition of the
 * weighted mean, the banded score values, and the abstain rules.
 *
 *  - Banded scoring (owner rubric calibration 2026-09-18, Part 1): the scale
 *    collapsed from nine values to FIVE wide bands [20, 40, 60, 80, 95]; the
 *    model must return one of BANDED_SCORES, and anything else is snapped to
 *    the nearest permitted value (ties round UP, so 30 -> 40 and 70 -> 80).
 *  - Weighted mean: overall = round( Σ(score_i × w_i) / Σ(w_i) ) over the
 *    SCORED dimensions only, so a dimension that abstains (insufficientData)
 *    has its weight redistributed proportionally across the others.
 *  - Abstain rather than guess: if 3 or more of the 6 dimensions have no usable
 *    evidence, there is NO overall score at all (score: null).
 */
import { overallBandFor } from "./thresholds";

/** Canonical scored dimension order (6 scored; gtm / launch are reserved). */
export const SCORED_PARAMETER_IDS = [
  "positioning",
  "icp",
  "differentiation",
  "messaging",
  "value-prop",
  "conversion",
] as const;

/** Per-dimension weights for the weighted mean (owner-specified). */
export const DIMENSION_WEIGHTS: Record<string, number> = {
  positioning: 1.3,
  icp: 1.2,
  differentiation: 1.2,
  messaging: 1.0,
  "value-prop": 0.9,
  conversion: 0.9,
};

/** The only score values the rubric permits (owner spec 2026-09-18, Part 1:
 * five wide bands instead of nine, because only four of the nine were ever
 * assigned on real sites and 95 never once in 114 scored cells). */
export const BANDED_SCORES = [20, 40, 60, 80, 95] as const;

/** At or above this many unscored dimensions there is no overall score. */
export const MAX_INSUFFICIENT_BEFORE_NO_SCORE = 3;

/**
 * Snap any number to the nearest permitted band value. Ties snap UP (e.g.
 * 30 -> 40, 50 -> 60, 70 -> 80, 87.5 -> 95) so the result is deterministic for
 * every input and no value can fall between two bands. The midpoint of
 * [20, 40, 60, 80, 95] is 87.5, so 88 also snaps up to 95.
 */
export function snapToBand(n: number): number {
  if (!Number.isFinite(n)) return BANDED_SCORES[0];
  const clamped = Math.min(100, Math.max(0, n));
  let best: number = BANDED_SCORES[0];
  let bestDistance = Infinity;
  for (const band of BANDED_SCORES) {
    const distance = Math.abs(band - clamped);
    // `<=` (not `<`) with an ascending band list: an exact tie keeps the
    // HIGHER band, which is the documented tie rule.
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = band;
    }
  }
  return best;
}

/** The minimum shape this module needs from a dimension. */
export interface ScorableDimension {
  id: string;
  score?: number | null;
  insufficientData?: boolean;
  locked?: boolean;
}

export interface OverallResult {
  /** Weighted-mean overall score, or null when the site could not be read. */
  score: number | null;
  /** Band derived from the unified thresholds, or null with no score. */
  overallBand: string | null;
  /** How many of the 6 scored dimensions actually carried a score. */
  scoredCount: number;
  /** How many of the 6 scored dimensions abstained. */
  insufficientCount: number;
  /** The ids that abstained, in canonical order. */
  insufficientIds: string[];
}

/**
 * Weighted mean over the scored dimensions, with the weights of any abstaining
 * dimension redistributed proportionally (the Σ is over scored dims only).
 */
export function computeOverall(dims: ScorableDimension[]): OverallResult {
  const byId = new Map<string, ScorableDimension>();
  for (const d of dims) {
    if (d && typeof d.id === "string") byId.set(d.id, d);
  }

  const scored: { id: string; score: number; weight: number }[] = [];
  const insufficientIds: string[] = [];
  for (const id of SCORED_PARAMETER_IDS) {
    const d = byId.get(id);
    const usable =
      !!d &&
      d.insufficientData !== true &&
      typeof d.score === "number" &&
      Number.isFinite(d.score);
    if (usable) {
      scored.push({ id, score: d!.score as number, weight: DIMENSION_WEIGHTS[id] ?? 0 });
    } else {
      insufficientIds.push(id);
    }
  }

  const insufficientCount = insufficientIds.length;
  if (insufficientCount >= MAX_INSUFFICIENT_BEFORE_NO_SCORE || scored.length === 0) {
    return {
      score: null,
      overallBand: null,
      scoredCount: scored.length,
      insufficientCount,
      insufficientIds,
    };
  }

  const weightSum = scored.reduce((sum, d) => sum + d.weight, 0);
  const weighted = scored.reduce((sum, d) => sum + d.score * d.weight, 0);
  const score = weightSum > 0 ? Math.round(weighted / weightSum) : 0;
  return {
    score,
    overallBand: overallBandFor(score),
    scoredCount: scored.length,
    insufficientCount,
    insufficientIds,
  };
}
