/**
 * Owner spec 2026-09-15 + the owner's rubric calibration 2026-09-18 (Parts 1,
 * 2, 4): the client-side normalization contract.
 *
 * Guards: no estimatedLeakage, a nullable overall score (no invented number),
 * five-value band snapping on the client mirror, abstain-instead-of-default-20,
 * the unified 80 / 40 status labels, and NO code-generated abstain boilerplate
 * (the model's own keyObservation survives untouched; an empty one stays empty).
 */
import { describe, test, expect } from "bun:test";
import { toAIResult, toUnreadableResult } from "./ai";
import {
  UNREADABLE_BODY_FIRST_IDENTICAL_SHELL,
  UNREADABLE_BODY_FIRST_LOW_CONTENT,
  unreadableBody,
} from "./readability";

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
    score: 61,
    overallBand: "Needs Attention",
    primaryFriction: "The pricing page never names the buyer.",
    recommendedFix: "Add a named-buyer line above the fold.",
    dimensions: [
      dim("positioning", 80),
      dim("icp", 60),
      dim("differentiation", 60),
      dim("messaging", 95),
      dim("value-prop", 40),
      { id: "gtm", name: "GTM Readiness", locked: true },
      { id: "launch", name: "Launch Readiness", locked: true },
      dim("conversion", 80),
    ],
    ...overrides,
  };
}

describe("toAIResult", () => {
  test("parses the live contract, keeps locked dimensions, drops leakage", () => {
    const result = toAIResult(response({ estimatedLeakage: "$400,000/yr" }));
    expect(result).not.toBeNull();
    expect(result!.score).toBe(61);
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

  test("a numeric score snaps to the nearest of the FIVE permitted values", () => {
    expect(toAIResult(response({ score: 71 }))!.score).toBe(71); // overall is not banded
    const snapped = toAIResult(
      response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 88) : d)) }),
    )!;
    // 88 is past the 87.5 midpoint, so it snaps up to 95.
    expect(snapped.dimensions.find((d) => d.id === "icp")!.score).toBe(95);
    // 82 is nearer 80, and a tie (30) rounds up to 40.
    const lower = toAIResult(
      response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 82) : d)) }),
    )!;
    expect(lower.dimensions.find((d) => d.id === "icp")!.score).toBe(80);
    const tie = toAIResult(
      response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 30) : d)) }),
    )!;
    expect(tie.dimensions.find((d) => d.id === "icp")!.score).toBe(40);
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
        d.id === "value-prop" ? { ...dim("value-prop", 40), insufficientData: true } : d,
      ),
    })!;
    const valueProp = result.dimensions.find((d) => d.id === "value-prop")!;
    expect(valueProp.score).toBeUndefined();
    expect(valueProp.insufficientData).toBe(true);
  });

  test("status labels follow the unified thresholds (80 / 40)", () => {
    const result = toAIResult(response())!;
    const byId = Object.fromEntries(result.dimensions.map((d) => [d.id, d]));
    expect(byId.positioning.status).toBe("Strong"); // 80
    expect(byId.icp.status).toBe("Needs Refinement"); // 60
    expect(byId["value-prop"].status).toBe("Needs Refinement"); // 40
    expect(byId.conversion.status).toBe("Strong"); // 80
    // 65 snaps to 60 (a refinement) and 29 snaps to 20 (a critical gap).
    expect(toAIResult(response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 65) : d)) }))!.dimensions.find((d) => d.id === "icp")!.status).toBe("Needs Refinement");
    expect(toAIResult(response({ dimensions: response().dimensions.map((d) => (d.id === "icp" ? dim("icp", 29) : d)) }))!.dimensions.find((d) => d.id === "icp")!.status).toBe("Critical Gap");
  });

  test("an abstained dimension keeps the MODEL's site-specific keyObservation", () => {
    const raw = response();
    const result = toAIResult({
      ...raw,
      dimensions: raw.dimensions.map((d) =>
        d.id === "value-prop"
          ? { id: "value-prop", insufficientData: true, keyObservation: "Looked for outcome claims in the H2s and CTA labels; found capability names only." }
          : d,
      ),
    })!;
    const valueProp = result.dimensions.find((d) => d.id === "value-prop")!;
    expect(valueProp.insufficientData).toBe(true);
    expect(valueProp.score).toBeUndefined();
    expect(valueProp.keyObservation).toBe(
      "Looked for outcome claims in the H2s and CTA labels; found capability names only.",
    );
  });

  test("no code-generated abstain boilerplate anywhere in the payload (Part 4)", () => {
    // Model omits the dimension entirely AND its sibling carries an empty string.
    const raw = response();
    const result = toAIResult({
      ...raw,
      dimensions: raw.dimensions
        .filter((d) => d.id !== "differentiation")
        .map((d) => (d.id === "value-prop" ? { ...dim("value-prop", 40), keyObservation: "" } : d)),
    })!;
    const differentiation = result.dimensions.find((d) => d.id === "differentiation")!;
    const valueProp = result.dimensions.find((d) => d.id === "value-prop")!;
    expect(differentiation.insufficientData).toBe(true);
    expect(differentiation.keyObservation).toBeUndefined();
    // No code-generated impact sentence on an abstain either.
    expect(differentiation.commercialRisk).toBeUndefined();
    expect(valueProp.keyObservation).toBeUndefined();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("not well represented");
    expect(serialized).not.toContain("Not enough signal in the public crawl");
    expect(serialized).not.toContain("clear strength on the public site");
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
    // low_content: the character-count explanation is the honest one.
    expect(result.body).toContain("renders its content with JavaScript");
    expect(result.body).toContain("fewer than 300 characters");
    expect(result.body).toBe(unreadableBody("low_content"));
    expect(result.body).not.toContain(UNREADABLE_BODY_FIRST_IDENTICAL_SHELL);
    expect(result.ctaLabel).toBe("Book a Call");
    expect(result.ctaHref).toBe("https://cal.com/wasani-probasco");
  });
  /* The first paragraph branches by reason: a shell that cleared the character
     threshold must NOT be told its text was under 300 characters. */
  test("the body fallback branches by reason", () => {
    const low = toUnreadableResult({
      readable: false,
      reason: "low_content",
      usableChars: 12,
    })!;
    expect(low.body.startsWith(UNREADABLE_BODY_FIRST_LOW_CONTENT)).toBe(true);
    expect(low.body).toContain("fewer than 300 characters");
    expect(low.body).not.toContain(UNREADABLE_BODY_FIRST_IDENTICAL_SHELL);

    const shell = toUnreadableResult({
      readable: false,
      reason: "identical_shell",
      usableChars: 888,
      shellDetected: true,
    })!;
    expect(shell.body.startsWith(UNREADABLE_BODY_FIRST_IDENTICAL_SHELL)).toBe(true);
    expect(shell.body).toContain("Every page I fetched returned the same empty shell");
    // The wrong sentence for this rule: usableChars is 888, not under 300.
    expect(shell.body).not.toContain("fewer than 300 characters");
    // Paragraphs 2 and 3 are byte-identical across both reasons.
    expect(shell.body.slice(UNREADABLE_BODY_FIRST_IDENTICAL_SHELL.length)).toBe(
      low.body.slice(UNREADABLE_BODY_FIRST_LOW_CONTENT.length),
    );
    expect(shell.body.split("\n\n")).toHaveLength(3);
    expect(shell.body).toBe(unreadableBody("identical_shell"));
  });
});
