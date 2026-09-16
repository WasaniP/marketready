/**
 * Owner spec 2026-09-15: the client-side normalization contract.
 *
 * Guards: no estimatedLeakage, a nullable overall score (no invented number),
 * banded snapping on the client mirror, abstain-instead-of-default-20, and the
 * unified status labels.
 */
import { describe, test, expect } from "bun:test";
import { toAIResult, toUnreadableResult } from "./ai";

const dim = (id: string, score: number) => ({
  id,
  name: id,
  score,
  status: "Strong",
  keyObservation: "obs",
  commercialRisk: "risk",
});

function response(overrides: Record<string, unknown> = {}) {
  return {
    score: 67,
    overallBand: "Needs Attention",
    primaryFriction: "The pricing page never names the buyer.",
    recommendedFix: "Add a named-buyer line above the fold.",
    dimensions: [
      dim("positioning", 75),
      dim("icp", 65),
      dim("differentiation", 55),
      dim("messaging", 85),
      dim("value-prop", 45),
      { id: "gtm", name: "GTM Readiness", locked: true },
      { id: "launch", name: "Launch Readiness", locked: true },
      dim("conversion", 75),
    ],
    ...overrides,
  };
}

describe("toAIResult", () => {
  test("parses the live contract, keeps locked dimensions, drops leakage", () => {
    const result = toAIResult(response({ estimatedLeakage: "$400,000/yr" }));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(67);
    expect(result!.overallBand).toBe("Needs Attention");
    expect(result!.dimensions).toHaveLength(8);
    expect(result!.dimensions.filter((d) => d.locked).map((d) => d.id)).toEqual(["gtm", "launch"]);
    expect("estimatedLeakage" in (result as object)).toBe(false);
  });

  test("a null score is accepted (site could not be read well enough)", () => {
    const result = toAIResult(response({ score: null, overallBand: null }));
    expect(result).not.toBeNull();
    expect(result!.score).toBeNull();
    expect(result!.overallBand).toBeNull();
  });

  test("a numeric score snaps to the permitted bands", () => {
    expect(toAIResult(response({ score: 71 }))!.score).toBe(71); // overall is not banded
    const snapped = toAIResult(
      response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 88) : d)) }),
    )!;
    expect(snapped.dimensions.find((d) => d.id === "icp")!.score).toBe(85);
  });

  test("a missing dimension abstains with no score (never a default 20)", () => {
    const raw = response();
    const result = toAIResult({
      ...raw,
      dimensions: raw.dimensions.filter((d) => d.id !== "differentiation"),
    })!;
    const differentiation = result.dimensions.find((d) => d.id === "differentiation")!;
    expect(differentiation.insufficientData).toBe(true);
    expect(differentiation.score).toBeUndefined();
    expect(differentiation.friction).toBe("Not enough signal to score");
  });

  test("an insufficientData dimension keeps no score even if one was sent", () => {
    const raw = response();
    const result = toAIResult({
      ...raw,
      dimensions: raw.dimensions.map((d) =>
        d.id === "value-prop" ? { ...dim("value-prop", 45), insufficientData: true } : d,
      ),
    })!;
    const valueProp = result.dimensions.find((d) => d.id === "value-prop")!;
    expect(valueProp.score).toBeUndefined();
    expect(valueProp.insufficientData).toBe(true);
  });

  test("status labels follow the unified thresholds", () => {
    const result = toAIResult(response())!;
    const byId = Object.fromEntries(result.dimensions.map((d) => [d.id, d]));
    expect(byId.positioning.status).toBe("Strong");
    expect(byId.icp.status).toBe("Needs Refinement");
    expect(byId["value-prop"].status).toBe("Needs Refinement");
    expect(byId.conversion.status).toBe("Strong");
  });

  test("a response without a friction or fix is rejected", () => {
    expect(toAIResult(response({ primaryFriction: "" }))).toBeNull();
    expect(toAIResult(response({ recommendedFix: "   " }))).toBeNull();
    expect(toAIResult(null)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Owner readability fix, Part D: the unreadable response is not a     */
/* scorecard.                                                          */
/* ------------------------------------------------------------------ */
describe("toUnreadableResult", () => {
  const UNREADABLE = {
    readable: false,
    reason: "identical_shell",
    usableChars: 412,
    shellDetected: true,
    heading: "I couldn't read this site.",
    body: "First paragraph.\n\nSecond paragraph.",
    cta: { label: "Book a Call", href: "https://cal.com/wasani-probasco" },
  };

  test("normalizes the unreadable payload", () => {
    const result = toUnreadableResult(UNREADABLE)!;
    expect(result.readable).toBe(false);
    expect(result.reason).toBe("identical_shell");
    expect(result.usableChars).toBe(412);
    expect(result.shellDetected).toBe(true);
    expect(result.heading).toBe("I couldn't read this site.");
    expect(result.body.split("\n\n")).toHaveLength(2);
    expect(result.ctaHref).toBe("https://cal.com/wasani-probasco");
    expect(result.ctaLabel).toBe("Book a Call");
  });

  test("a scorecard response is NOT the unreadable state", () => {
    expect(toUnreadableResult(response())).toBeNull();
    expect(toUnreadableResult(null)).toBeNull();
    expect(toUnreadableResult({ readable: true })).toBeNull();
    expect(toUnreadableResult({ readable: false, reason: "something_else" })).toBeNull();
  });

  test("toAIResult refuses to build a scorecard from the unreadable state", () => {
    expect(toAIResult(UNREADABLE)).toBeNull();
  });

  test("missing copy falls back to the shared constants (never blank)", () => {
    const result = toUnreadableResult({
      readable: false,
      reason: "low_content",
      usableChars: "nonsense",
    })!;
    expect(result.usableChars).toBe(0);
    expect(result.shellDetected).toBe(false);
    expect(result.heading).toBe("I couldn't read this site.");
    expect(result.body).toContain("renders its content with JavaScript");
    expect(result.body).toContain("fewer than 300 characters");
    expect(result.ctaLabel).toBe("Book a Call");
    expect(result.ctaHref).toBe("https://cal.com/wasani-probasco");
  });
});
