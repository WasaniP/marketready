/**
 * Owner spec 2026-09-15, Parts 3 / 4 / 5 / 6: the shared, pure scoring rules.
 *
 * Guards: banded snapping, the weighted mean, proportional weight
 * redistribution when a dimension abstains, the no-score rule at 3+ abstains,
 * and the single unified threshold set (which every surface imports).
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

describe("unified thresholds (Part 4)", () => {
  test("one constant set: 70 / 45", () => {
    expect(STRONG_MIN).toBe(70);
    expect(REFINEMENT_MIN).toBe(45);
  });

  test("per-parameter status labels", () => {
    expect(paramStatus(95)).toBe("Strong");
    expect(paramStatus(70)).toBe("Strong");
    expect(paramStatus(69)).toBe("Needs Refinement");
    expect(paramStatus(45)).toBe("Needs Refinement");
    expect(paramStatus(44)).toBe("Critical Gap");
    expect(paramStatus(0)).toBe("Critical Gap");
  });

  test("overall bands", () => {
    expect(overallBandFor(70)).toBe("Market Ready");
    expect(overallBandFor(69)).toBe("Needs Attention");
    expect(overallBandFor(45)).toBe("Needs Attention");
    expect(overallBandFor(44)).toBe("High Launch Risk");
    expect(riskLabel(70)).toBe("Market Ready");
    expect(riskLabel(44)).toBe("High Launch Risk");
  });

  test("UI label flip uses the same cutoff", () => {
    expect(impactLabel(70)).toBe("Competitive Advantage");
    expect(impactLabel(69)).toBe("Commercial Risk");
  });

  test("colors use the same cutoffs as the labels", () => {
    expect(scoreColor(70)).toBe(SCORE_COLORS.high);
    expect(scoreColor(69)).toBe(SCORE_COLORS.mid);
    expect(scoreColor(45)).toBe(SCORE_COLORS.mid);
    expect(scoreColor(44)).toBe(SCORE_COLORS.low);
    expect(statusFor(70)).toBe("STRONG");
    expect(statusFor(45)).toBe("NEEDS REFINEMENT");
    expect(statusFor(44)).toBe("CRITICAL GAP");
  });
});

describe("banded scoring (Part 5)", () => {
  test("permitted values are exactly the 9 bands", () => {
    expect([...BANDED_SCORES]).toEqual([15, 25, 35, 45, 55, 65, 75, 85, 95]);
  });

  test("snaps any number to the nearest permitted value", () => {
    expect(snapToBand(0)).toBe(15);
    expect(snapToBand(17)).toBe(15);
    expect(snapToBand(34)).toBe(35);
    expect(snapToBand(41)).toBe(45);
    expect(snapToBand(88)).toBe(85);
    expect(snapToBand(95)).toBe(95);
    expect(snapToBand(100)).toBe(95);
    expect(snapToBand(-20)).toBe(15);
    expect(snapToBand(120)).toBe(95);
  });

  test("ties snap down, deterministically", () => {
    expect(snapToBand(20)).toBe(15);
    expect(snapToBand(30)).toBe(25);
    expect(snapToBand(70)).toBe(65);
    expect(snapToBand(80)).toBe(75);
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
      dim("positioning", 75),
      dim("icp", 55),
      dim("differentiation", 65),
      dim("messaging", 75),
      dim("value-prop", 85),
      dim("conversion", 45),
    ]);
    // 433.5 / 6.5 = 66.69 -> 67
    expect(result.score).toBe(67);
    expect(result.overallBand).toBe("Needs Attention");
    expect(result.scoredCount).toBe(6);
    expect(result.insufficientCount).toBe(0);
  });

  test("an abstaining dimension has its weight redistributed proportionally", () => {
    const all = computeOverall([
      dim("positioning", 75),
      dim("icp", 55),
      dim("differentiation", 65),
      dim("messaging", 75),
      dim("value-prop", 85),
      dim("conversion", 45),
    ]);
    const withoutConversion = computeOverall([
      dim("positioning", 75),
      dim("icp", 55),
      dim("differentiation", 65),
      dim("messaging", 75),
      dim("value-prop", 85),
      dim("conversion", undefined, true),
    ]);
    // 393 / 5.6 = 70.18 -> 70, i.e. the remaining weights carry the whole mean.
    expect(withoutConversion.scoredCount).toBe(5);
    expect(withoutConversion.insufficientCount).toBe(1);
    expect(withoutConversion.insufficientIds).toEqual(["conversion"]);
    expect(withoutConversion.score).toBe(70);
    expect(withoutConversion.score).not.toBe(all.score);
    expect(withoutConversion.overallBand).toBe("Market Ready");
  });

  test("equal scores give that score regardless of abstains", () => {
    const same = SCORED_PARAMETER_IDS.map((id) => dim(id, 75));
    expect(computeOverall(same).score).toBe(75);
    expect(computeOverall(same.map((d, i) => (i === 5 ? dim(d.id, undefined, true) : d))).score).toBe(75);
  });
});

describe("abstain rather than guess (Part 6)", () => {
  test("3+ unscored dimensions -> NO overall score at all", () => {
    expect(MAX_INSUFFICIENT_BEFORE_NO_SCORE).toBe(3);
    const result = computeOverall([
      dim("positioning", 75),
      dim("icp", 75),
      dim("differentiation", 75),
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
    const result = computeOverall([dim("positioning", 75), dim("icp", 75)]);
    expect(result.insufficientCount).toBe(4);
    expect(result.score).toBeNull();
  });

  test("a locked dimension is never part of the mean", () => {
    const result = computeOverall([
      dim("positioning", 75),
      dim("icp", 75),
      dim("differentiation", 75),
      dim("messaging", 75),
      dim("value-prop", 75),
      dim("conversion", 75),
      { id: "gtm", locked: true },
      { id: "launch", locked: true },
    ]);
    expect(result.score).toBe(75);
    expect(result.scoredCount).toBe(6);
  });
});
