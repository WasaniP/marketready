/**
 * Owner spec 2026-09-15, Parts 3 / 4 / 5 / 6, updated by the owner's rubric
 * calibration 2026-09-18 (Parts 1 / 2 / 5): the shared, pure scoring rules.
 *
 * Guards: the five-value band scale and nearest-value snapping (ties up), the
 * weighted mean, proportional weight redistribution when a dimension abstains,
 * the no-score rule at 3+ abstains, and the single unified threshold set (80 /
 * 40) that every surface imports.
 */
import { describe, test, expect } from "bun:test";
import {
  BANDED_SCORES,
  DIMENSION_WEIGHTS,
  MAX_INSUFFICIENT_BEFORE_NO_SCORE,
  SCORED_PARAMETER_IDS,
  computeOverall,
  snapToBand,
} from "./scoring";
import {
  REFINEMENT_MIN,
  SCORE_COLORS,
  STRONG_MIN,
  impactLabel,
  overallBandFor,
  paramStatus,
  riskLabel,
  scoreColor,
  statusFor,
} from "./thresholds";

const dim = (id: string, score?: number, insufficientData?: boolean) => ({
  id,
  score,
  insufficientData,
});

describe("unified thresholds (Part 1, calibrated)", () => {
  test("one constant set: 80 / 40", () => {
    expect(STRONG_MIN).toBe(80);
    expect(REFINEMENT_MIN).toBe(40);
  });

  test("per-parameter status labels", () => {
    expect(paramStatus(95)).toBe("Strong");
    expect(paramStatus(80)).toBe("Strong");
    expect(paramStatus(79)).toBe("Needs Refinement");
    expect(paramStatus(40)).toBe("Needs Refinement");
    expect(paramStatus(39)).toBe("Critical Gap");
    expect(paramStatus(0)).toBe("Critical Gap");
  });

  test("overall bands", () => {
    expect(overallBandFor(80)).toBe("Market Ready");
    expect(overallBandFor(79)).toBe("Needs Attention");
    expect(overallBandFor(40)).toBe("Needs Attention");
    expect(overallBandFor(39)).toBe("High Launch Risk");
    expect(riskLabel(80)).toBe("Market Ready");
    expect(riskLabel(39)).toBe("High Launch Risk");
  });

  test("UI label flip uses the same cutoff", () => {
    expect(impactLabel(95)).toBe("Competitive Advantage");
    expect(impactLabel(80)).toBe("Competitive Advantage");
    expect(impactLabel(79)).toBe("Commercial Risk");
    expect(impactLabel(40)).toBe("Commercial Risk");
  });

  test("colors use the same cutoffs as the labels", () => {
    expect(scoreColor(80)).toBe(SCORE_COLORS.high);
    expect(scoreColor(79)).toBe(SCORE_COLORS.mid);
    expect(scoreColor(40)).toBe(SCORE_COLORS.mid);
    expect(scoreColor(39)).toBe(SCORE_COLORS.low);
    expect(statusFor(80)).toBe("STRONG");
    expect(statusFor(40)).toBe("NEEDS REFINEMENT");
    expect(statusFor(39)).toBe("CRITICAL GAP");
  });
});

describe("five-value band scale (Part 1)", () => {
  test("permitted values are exactly the five bands", () => {
    expect([...BANDED_SCORES]).toEqual([20, 40, 60, 80, 95]);
  });

  test("snaps any number to the nearest permitted value", () => {
    expect(snapToBand(0)).toBe(20);
    expect(snapToBand(19)).toBe(20);
    expect(snapToBand(31)).toBe(40);
    expect(snapToBand(39)).toBe(40);
    expect(snapToBand(41)).toBe(40);
    expect(snapToBand(59)).toBe(60);
    expect(snapToBand(82)).toBe(80);
    expect(snapToBand(88)).toBe(95);
    expect(snapToBand(95)).toBe(95);
    expect(snapToBand(100)).toBe(95);
    expect(snapToBand(-20)).toBe(20);
    expect(snapToBand(120)).toBe(95);
    expect(snapToBand(Number.NaN)).toBe(20);
  });

  test("the five permitted values are idempotent", () => {
    for (const band of BANDED_SCORES) expect(snapToBand(band)).toBe(band);
  });

  test("ties round UP, deterministically (midpoints 30 / 50 / 70 / 87.5)", () => {
    expect(snapToBand(30)).toBe(40);
    expect(snapToBand(50)).toBe(60);
    expect(snapToBand(70)).toBe(80);
    expect(snapToBand(87.5)).toBe(95);
  });
});

describe("weighted-mean overall (Part 3)", () => {
  test("weights are the owner-specified set over the 6 scored dimensions", () => {
    expect(SCORED_PARAMETER_IDS).toHaveLength(6);
    expect(DIMENSION_WEIGHTS).toEqual({
      positioning: 1.3,
      icp: 1.2,
      differentiation: 1.2,
      messaging: 1.0,
      "value-prop": 0.9,
      conversion: 0.9,
    });
  });

  test("equals the weight-normalised mean of the scored dimensions", () => {
    const result = computeOverall([
      dim("positioning", 80),
      dim("icp", 40),
      dim("differentiation", 60),
      dim("messaging", 80),
      dim("value-prop", 60),
      dim("conversion", 40),
    ]);
    // 394 / 6.5 = 60.6 -> 61
    expect(result.score).toBe(61);
    expect(result.overallBand).toBe("Needs Attention");
    expect(result.scoredCount).toBe(6);
    expect(result.insufficientCount).toBe(0);
  });

  test("an abstaining dimension has its weight redistributed proportionally", () => {
    const all = computeOverall([
      dim("positioning", 80),
      dim("icp", 40),
      dim("differentiation", 60),
      dim("messaging", 80),
      dim("value-prop", 60),
      dim("conversion", 40),
    ]);
    const withoutConversion = computeOverall([
      dim("positioning", 80),
      dim("icp", 40),
      dim("differentiation", 60),
      dim("messaging", 80),
      dim("value-prop", 60),
      dim("conversion", undefined, true),
    ]);
    // 358 / 5.6 = 63.9 -> 64, i.e. the remaining weights carry the whole mean.
    expect(withoutConversion.scoredCount).toBe(5);
    expect(withoutConversion.insufficientCount).toBe(1);
    expect(withoutConversion.insufficientIds).toEqual(["conversion"]);
    expect(withoutConversion.score).toBe(64);
    expect(withoutConversion.score).not.toBe(all.score);
    expect(withoutConversion.overallBand).toBe("Needs Attention");
  });

  test("a strong site lands in Market Ready on the new bands", () => {
    const strong = computeOverall([
      dim("positioning", 95),
      dim("icp", 95),
      dim("differentiation", 95),
      dim("messaging", 95),
      dim("value-prop", 95),
      dim("conversion", 95),
    ]);
    expect(strong.score).toBe(95);
    expect(strong.overallBand).toBe("Market Ready");
  });

  test("equal scores give that score regardless of abstains", () => {
    const same = SCORED_PARAMETER_IDS.map((id) => dim(id, 80));
    expect(computeOverall(same).score).toBe(80);
    expect(computeOverall(same.map((d, i) => (i === 5 ? dim(d.id, undefined, true) : d))).score).toBe(80);
  });
});

describe("abstain rather than guess (Part 6)", () => {
  test("3+ unscored dimensions -> NO overall score at all", () => {
    expect(MAX_INSUFFICIENT_BEFORE_NO_SCORE).toBe(3);
    const result = computeOverall([
      dim("positioning", 80),
      dim("icp", 80),
      dim("differentiation", 80),
      dim("messaging", undefined, true),
      dim("value-prop", undefined, true),
      dim("conversion", undefined, true),
    ]);
    expect(result.score).toBeNull();
    expect(result.overallBand).toBeNull();
    expect(result.scoredCount).toBe(3);
    expect(result.insufficientCount).toBe(3);
  });

  test("missing dimensions (absent from the payload) count as abstains", () => {
    const result = computeOverall([dim("positioning", 80), dim("icp", 80)]);
    expect(result.insufficientCount).toBe(4);
    expect(result.score).toBeNull();
  });

  test("a locked dimension is never part of the mean", () => {
    const result = computeOverall([
      dim("positioning", 80),
      dim("icp", 80),
      dim("differentiation", 80),
      dim("messaging", 80),
      dim("value-prop", 80),
      dim("conversion", 80),
      { id: "gtm", locked: true },
      { id: "launch", locked: true },
    ]);
    expect(result.score).toBe(80);
    expect(result.scoredCount).toBe(6);
  });
});
