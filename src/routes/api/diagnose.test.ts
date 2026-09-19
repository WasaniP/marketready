/**
 * Owner spec 2026-09-15: POST /api/diagnose rework.
 *
 * Guards the route contract end to end with a mocked crawl + mocked OpenAI
 * response:
 *   Part 1: no estimatedLeakage anywhere (request or response)
 *   Part 2: temperature 0, top_p 1, an origin-derived seed, one input (crawl)
 *   Part 3: the overall score + band are COMPUTED IN CODE (model values ignored)
 *   Part 5: every returned number is snapped to a permitted band
 *   Part 6: abstain instead of guessing; 3+ abstains = no overall score at all
 *
 * Owner rubric calibration 2026-09-18 (Parts 1 to 5) adds:
 *   Part 1: the scale is the FIVE values [20, 40, 60, 80, 95] and the 80 / 40
 *           status + band + UI-label cutoffs are one constant set
 *   Part 2: the prompt re-points Value Proposition Density onto body text,
 *           H2-and-below headings and CTA labels, and whitelists static
 *           metadata for it
 *   Part 3: all five band anchors are in the system prompt, verbatim
 *   Part 4: no code-generated abstain boilerplate anywhere in the payload
 *   Part 5: DIAGNOSE_PROMPT_VERSION is 2, so every cached v1 entry is retired
 *
 * Runs with `bun test`. No network: globalThis.fetch is mocked for both the
 * crawl and the OpenAI call.
 */
import { describe, test, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import {
  Route,
  seedFromOrigin,
  buildUserMessage,
  diagnoseCacheKey,
  sha256Hex,
  DIAGNOSE_PROMPT_VERSION,
} from "./diagnose";
import { clearCrawlCache } from "~/lib/audit/crawl";
import { REFINEMENT_MIN, STRONG_MIN } from "~/lib/audit/thresholds";
import {
  DIAGNOSE_CACHE_TTL_MS,
  diagnoseResponseCacheSize,
  clearDiagnoseResponseCache,
  readDiagnoseResponse,
  primeDiagnoseResponse,
} from "~/lib/audit/diagnoseCache";
import {
  UNREADABLE_BODY_FIRST_IDENTICAL_SHELL,
  UNREADABLE_BODY_FIRST_LOW_CONTENT,
  unreadableBody,
} from "~/lib/audit/readability";

const POST = Route.options.server.handlers.POST;

const ORIGIN = "https://acme.example";
const HTML = `<!doctype html><html><head><title>Acme widgets</title>
<meta name="description" content="Acme is the widget platform for logistics teams."></head>
<body><h1>Acme is the widget platform for logistics teams</h1><h2>Ship faster</h2>
<p>Teams cut onboarding by 40%.</p><a class="btn" href="/signup">Start free</a></body></html>`;

/** Per-path HTML: the three crawled paths must NOT be byte-identical, or the
 * crawl is an SPA shell and the route refuses to score it (Part D2). */
function htmlForPath(path: string): string {
  return HTML.replace("</body>", `<p>Path ${path} copy for logistics teams.</p></body>`);
}

let openaiBody: Record<string, unknown> | null = null;
let openaiCalls = 0;

/** Mock both the crawl and the model call. `crawlHtml` overrides the per-path
 * page HTML (used by the unreadable-state tests). */
function mock(modelPayload: unknown, crawlHtml: (path: string) => string = htmlForPath) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).startsWith("https://api.openai.com")) {
      openaiCalls++;
      openaiBody = JSON.parse(String(init?.body ?? "{}"));
      return Response.json({
        choices: [{ message: { content: JSON.stringify(modelPayload) } }],
        // Present on every real OpenAI response; the route logs both fields.
        system_fingerprint: "fp_test",
        usage: { total_tokens: 6107 },
      });
    }
    const path = new URL(String(url)).pathname;
    return new Response(crawlHtml(path), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
}

function modelDim(id: string, name: string, pillar: string, score?: number, insufficientData?: boolean) {
  return insufficientData
    ? { id, name, pillar, insufficientData: true }
    : {
        id,
        name,
        pillar,
        score,
        status: "Strong",
        friction_label: "Vague Category Naming",
        anchor_label: "Clear Category Stake",
        evidence_snippet: "Acme is the widget platform for logistics teams",
        keyObservation: "The hero names the category and the buyer.",
        commercialRisk: "Visitors classify the product instantly.",
      };
}

/** 6 scored + the 2 locked reserved parameters, banded values. */
function fullPayload() {
  return {
    primaryFriction: "The pricing page never states who the product is for.",
    recommendedFix: "Add a named-buyer line above the fold on pricing.",
    dimensions: [
      modelDim("positioning", "Category Positioning", "Core Positioning", 80),
      modelDim("icp", "ICP & Audience Alignment", "Core Positioning", 60),
      modelDim("differentiation", "Differentiation Anchor", "Core Positioning", 60),
      modelDim("messaging", "Hero Messaging & Speed", "Messaging & Value Prop", 95),
      modelDim("value-prop", "Value Proposition Density", "Messaging & Value Prop", 40),
      { id: "gtm", name: "GTM Readiness", pillar: "GTM & Launch Velocity", locked: true },
      { id: "launch", name: "Launch Readiness", pillar: "GTM & Launch Velocity", locked: true },
      modelDim("conversion", "Conversion & Friction Mechanics", "GTM & Launch Velocity", 80),
    ],
  };
}

async function post(url = ORIGIN) {
  const res = await POST({
    request: new Request("http://localhost/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

const realFetch = globalThis.fetch;
const realKey = process.env.OPENAI_API_KEY;

beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-key";
});
afterAll(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = realKey;
});
beforeEach(() => {
  openaiBody = null;
  openaiCalls = 0;
  clearCrawlCache();
  // The response cache is process-wide state (the point of it), so a test that
  // mocks a different model payload for the same input must start from empty.
  clearDiagnoseResponseCache();
});

describe("determinism knobs (Part 2)", () => {
  test("temperature 0, top_p 1, and an origin-derived seed", async () => {
    mock(fullPayload());
    await post();
    expect(openaiBody?.temperature).toBe(0);
    expect(openaiBody?.top_p).toBe(1);
    expect(openaiBody?.model).toBe("gpt-4o");
    expect(openaiBody?.response_format).toEqual({ type: "json_object" });
    expect(openaiBody?.seed).toBe(seedFromOrigin(ORIGIN));
  });

  test("the seed is stable for an origin and differs per origin", async () => {
    expect(seedFromOrigin(ORIGIN)).toBe(seedFromOrigin(ORIGIN));
    expect(seedFromOrigin(ORIGIN)).not.toBe(seedFromOrigin("https://other.example"));
    expect(Number.isInteger(seedFromOrigin(ORIGIN))).toBe(true);

    // The route normalises the submitted URL to its origin before seeding, so a
    // deep link scores against the same seed as the bare origin.
    mock(fullPayload());
    await post(`${ORIGIN}/some/deep/path?utm_source=newsletter`);
    expect(openaiBody?.seed).toBe(seedFromOrigin(ORIGIN));
  });

  test("the crawl is the ONLY input: no market intelligence, no ICP", async () => {
    mock(fullPayload());
    await post();
    const messages = (openaiBody?.messages ?? []) as { role: string; content: string }[];
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    for (const prompt of [system, user]) {
      expect(prompt).toContain("STRUCTURED SITE CRAWL");
      expect(prompt).not.toContain("EXTERNAL MARKET INTELLIGENCE");
      expect(prompt.toLowerCase()).not.toContain("user-submitted icp");
      expect(prompt.toLowerCase()).not.toContain("leakage");
      expect(prompt).not.toContain("DuckDuckGo");
    }
    // The crawl really happened, for exactly the 3 canonical paths.
    expect(user).toContain("[/pricing] -> FOUND");
    expect(user).toContain("[/about] -> FOUND");
    expect(user).toContain("[Homepage ] -> FOUND");
    // The rubric states the unified vocabulary and the calibrated five-value scale.
    expect(system).toContain('80 -> "Strong"');
    expect(system).toContain('40 to 79 -> "Needs Refinement"');
    expect(system).toContain("20, 40, 60, 80, 95");
    expect(system).not.toContain("15, 25, 35, 45, 55, 65, 75, 85, 95");
  });

  test("the same URL + the same model output score identically on a repeat call", async () => {
    mock(fullPayload());
    const first = await post();
    const second = await post();
    expect(second.body.score).toBe(first.body.score);
    expect(second.body.dimensions).toEqual(first.body.dimensions);
  });
});

describe("overall score computed in code (Part 3)", () => {
  test("serverside weighted mean, and model-supplied score/band are ignored", async () => {
    mock({
      ...fullPayload(),
      score: 12,
      overallBand: "Market Ready",
      estimatedLeakage: "$500,000 to $900,000/yr",
    });
    const { body } = await post();
    // 104 + 72 + 72 + 95 + 36 + 72 = 451 over weights 6.5 -> 69.4 -> 69
    expect(body.score).toBe(69);
    expect(body.overallBand).toBe("Needs Attention");
    expect("estimatedLeakage" in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain("eakage");
  });

  test("the response contract is 6 scored + 2 locked, in canonical order", async () => {
    mock(fullPayload());
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    expect(dims.map((d) => d.id)).toEqual([
      "positioning",
      "icp",
      "messaging",
      "differentiation",
      "value-prop",
      "gtm",
      "launch",
      "conversion",
    ]);
    const locked = dims.filter((d) => d.locked === true);
    expect(locked).toHaveLength(2);
    expect(locked.every((d) => d.score === undefined)).toBe(true);
    expect(body.primaryFriction).toContain("pricing page");
    expect(body.recommendedFix).toContain("named-buyer line");
  });
});

describe("five-value banded coercion (Part 1)", () => {
  test("any number is snapped to the nearest permitted value", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "positioning" ? { ...d, score: 88 } : d.id === "icp" ? { ...d, score: 25 } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const byId = Object.fromEntries(dims.map((d) => [d.id, d]));
    expect(byId.positioning.score).toBe(95); // 88 is past the 87.5 midpoint
    expect(byId.icp.score).toBe(20); // 25 is nearer 20 than 40
    expect(byId.positioning.status).toBe("Strong");
    expect(byId.icp.status).toBe("Critical Gap");
  });

  test("a raw 82 -> 80 Strong, 39 -> 40 Needs Refinement, 95 stays 95", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "positioning"
          ? { ...d, score: 82 }
          : d.id === "icp"
            ? { ...d, score: 39 }
            : d.id === "messaging"
              ? { ...d, score: 95 }
              : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const byId = Object.fromEntries(dims.map((d) => [d.id, d]));
    expect(byId.positioning.score).toBe(80);
    expect(byId.positioning.status).toBe("Strong");
    expect(byId.icp.score).toBe(40);
    expect(byId.icp.status).toBe("Needs Refinement");
    expect(byId.messaging.score).toBe(95);
    expect(byId.messaging.status).toBe("Strong");
  });

  test("every score in the payload is one of the five permitted values", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        typeof d.score === "number" ? { ...d, score: 71 } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    for (const d of dims) {
      if (typeof d.score === "number") expect([20, 40, 60, 80, 95]).toContain(d.score);
    }
  });

  test("status labels always come from the unified thresholds", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "messaging" ? { ...d, score: 79, status: "Strong" } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const messaging = dims.find((d) => d.id === "messaging") as Record<string, unknown>;
    // 79 snaps to 80, so the model's own "Strong" label happens to be right here.
    expect(messaging.score).toBe(80);
    expect(messaging.status).toBe("Strong");

    // A label the code disagrees with is overruled: icp is 60 in the fixture and
    // the model calls it "Strong", so the derived label must win.
    clearDiagnoseResponseCache();
    clearCrawlCache();
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "icp" ? { ...d, score: 60, status: "Strong" } : d,
      ),
    });
    const lower = await post();
    const lowerDims = lower.body.dimensions as Record<string, unknown>[];
    const icp = lowerDims.find((d) => d.id === "icp") as Record<string, unknown>;
    expect(icp.score).toBe(60);
    expect(icp.status).toBe("Needs Refinement");
  });
});

describe("abstain rather than guess (Part 6)", () => {
  test("an insufficientData dimension carries NO score, and 2 abstains still score", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "value-prop" || d.id === "conversion" ? { ...d, insufficientData: true } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const valueProp = dims.find((d) => d.id === "value-prop") as Record<string, unknown>;
    expect(valueProp.insufficientData).toBe(true);
    expect(valueProp.score).toBeUndefined();
    // 104 + 72 + 72 + 95 = 343 over 4.7 -> 72.98 -> 73 (weights redistributed)
    expect(body.score).toBe(73);
    expect(body.overallBand).toBe("Needs Attention");
  });

  test("3 abstains mean NO overall score at all", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        ["differentiation", "messaging", "value-prop", "conversion"].includes(d.id)
          ? { ...d, insufficientData: true }
          : d,
      ),
    });
    const { body } = await post();
    expect(body.score).toBeNull();
    expect(body.overallBand).toBeNull();
  });

  test("a dimension the model omits entirely abstains (never a default band)", async () => {
    const payload = fullPayload();
    mock({
      ...payload,
      dimensions: payload.dimensions.filter((d) => d.id !== "differentiation"),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const differentiation = dims.find((d) => d.id === "differentiation") as Record<string, unknown>;
    expect(differentiation.insufficientData).toBe(true);
    expect(differentiation.score).toBeUndefined();
    // Part 4: no invented explanation either.
    expect(differentiation.keyObservation).toBeUndefined();
  });

  test("an abstained dimension keeps the MODEL's site-specific keyObservation (Part 4)", async () => {
    const payload = fullPayload();
    const OBS =
      "Looked for outcome claims across the body text, the H2s and the CTA labels; the copy names capabilities only.";
    mock({
      ...payload,
      dimensions: payload.dimensions.map((d) =>
        d.id === "value-prop"
          ? { id: "value-prop", name: d.name, pillar: d.pillar, insufficientData: true, keyObservation: OBS }
          : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const valueProp = dims.find((d) => d.id === "value-prop") as Record<string, unknown>;
    expect(valueProp.insufficientData).toBe(true);
    expect(valueProp.score).toBeUndefined();
    expect(valueProp.keyObservation).toBe(OBS);
  });

  test("no abstain boilerplate anywhere in the payload (Part 4)", async () => {
    const payload = fullPayload();
    mock({
      ...payload,
      dimensions: payload.dimensions.map((d) =>
        d.id === "value-prop" || d.id === "conversion"
          ? { id: d.id, name: d.name, pillar: d.pillar, insufficientData: true, keyObservation: "" }
          : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    for (const id of ["value-prop", "conversion"]) {
      const d = dims.find((x) => x.id === id) as Record<string, unknown>;
      expect(d.insufficientData).toBe(true);
      expect(d.keyObservation).toBeUndefined();
      // The card label is the ONLY text an abstain renders: no code-generated
      // impact sentence either.
      expect(d.friction_label).toBe("Not Enough Signal");
      expect(d.commercialRisk).toBeUndefined();
    }
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("not well represented");
    expect(serialized).not.toContain("Not enough signal in the public crawl");
    expect(serialized).not.toContain("clear strength on the public site");
  });

  test("a stray pricing dimension is still dropped", async () => {
    const payload = fullPayload();
    mock({
      ...payload,
      dimensions: [
        ...payload.dimensions,
        { id: "pricing", name: "Pricing & Packaging", pillar: "Messaging & Value Prop", score: 95 },
      ],
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    expect(dims.find((d) => d.id === "pricing")).toBeUndefined();
  });

  test("a missing primary friction or fix is rejected (clean 500, no invented score)", async () => {
    mock({ ...fullPayload(), primaryFriction: "" });
    const { res } = await post();
    expect(res.status).toBe(500);
  });

  test("an invalid URL is a 400", async () => {
    mock(fullPayload());
    const { res, body } = await post("not-a-url");
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });
});

/* ------------------------------------------------------------------ */
/* Owner readability fix, Parts C + D                                  */
/* ------------------------------------------------------------------ */

/** A JS-rendered SPA shell: title, rich metadata, empty body. Byte-identical
 * on every route (exactly what onyxx.app serves). */
const SHELL = `<!doctype html><html lang="en"><head>
<title>Onyxx</title>
<meta name="description" content="Every creative deserves an agent. Onyxx is the AI booking manager for independent creatives.">
<meta property="og:title" content="Onyxx: the AI booking manager">
<meta property="og:description" content="Get booked, get paid, keep your independence.">
<meta property="og:site_name" content="Onyxx">
<meta name="twitter:description" content="The AI booking manager for independent creatives.">
<script type="application/ld+json">{"@type":"SoftwareApplication","name":"Onyxx","slogan":"Every creative deserves an agent","applicationCategory":"BusinessApplication","description":"An AI booking manager for creatives."}</script>
</head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

describe("Part C: static metadata reaches the model", () => {
  test("the meta description is in the crawl block alongside the title, in a labelled section", async () => {
    mock(fullPayload());
    await post();
    const messages = (openaiBody?.messages ?? []) as { role: string; content: string }[];
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("STATIC METADATA:");
    expect(user).toContain('TITLE: "Acme widgets"');
    expect(user).toContain('META DESCRIPTION: "Acme is the widget platform for logistics teams."');
    // The system prompt states the evidence rule for the static fields.
    expect(system).toContain("STATIC METADATA (WEAKER EVIDENCE, STILL VALID)");
    expect(system).toContain(
      "Category Positioning, ICP & Audience Alignment, Differentiation Anchor, and Value Proposition Density",
    );
    expect(system).toContain("WEAKER evidence than rendered page copy");
  });

  test("a JS shell with rich metadata is not scored as an empty site when its pages differ", async () => {
    // Same shell, but with a per-page marker so the pages are NOT identical:
    // this is the Part C win (metadata alone can carry a scoreable crawl).
    const paths: string[] = [];
    mock(fullPayload(), (path) => {
      paths.push(path);
      return SHELL.replace("<div id=\"root\"></div>", `<div id="root" data-path="${path}"></div>`);
    });
    const { res, body } = await post();
    expect(res.status).toBe(200);
    expect(body.readable).toBeUndefined();
    expect(typeof body.score).toBe("number");
    const messages = (openaiBody?.messages ?? []) as { role: string; content: string }[];
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    expect(user).toContain("Every creative deserves an agent.");
    expect(paths).toHaveLength(3);
  });
});

describe("Part D: refuse to score what was not read", () => {
  test("identical pages on every route return the unreadable state (identical_shell)", async () => {
    mock(fullPayload(), () => SHELL);
    const { res, body } = await post();
    expect(res.status).toBe(200);
    expect(body.readable).toBe(false);
    expect(body.reason).toBe("identical_shell");
    expect(body.shellDetected).toBe(true);
    // NO scorecard fields at all.
    expect(body.score).toBeUndefined();
    expect(body.overallBand).toBeUndefined();
    expect(body.dimensions).toBeUndefined();
    expect(body.primaryFriction).toBeUndefined();
    expect(body.recommendedFix).toBeUndefined();
    // The exact copy + CTA travel with the response. The first paragraph is the
    // identical_shell variant: every route returned the same shell, so the
    // character-count sentence would be wrong here (this shell is OVER the
    // 300-character threshold, see the usableChars assertion below).
    expect(body.heading).toBe("I couldn't read this site.");
    expect(String(body.body)).toContain(
      UNREADABLE_BODY_FIRST_IDENTICAL_SHELL,
    );
    expect(String(body.body)).toContain("Every page I fetched returned the same empty shell");
    expect(String(body.body)).not.toContain("fewer than 300 characters");
    expect(String(body.body)).not.toContain(UNREADABLE_BODY_FIRST_LOW_CONTENT);
    expect(String(body.body)).toBe(unreadableBody("identical_shell"));
    expect(String(body.body).split("\n\n")).toHaveLength(3);
    expect(body.cta).toEqual({
      label: "Book a Call",
      href: "https://cal.com/wasani-probasco",
    });
    // The reported character count is real and the shell cleared the threshold.
    expect(typeof body.usableChars).toBe("number");
    expect(body.usableChars as number).toBeGreaterThanOrEqual(300);
  });

  test("NO model call is made for an unreadable site", async () => {
    const originalWarn = console.warn;
    const logs: string[] = [];
    console.warn = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      mock(fullPayload(), () => SHELL);
      await post();
      expect(openaiCalls).toBe(0);
      expect(openaiBody).toBeNull();
      // The count and which rule fired are logged server-side for tuning.
      const line = logs.find((l) => l.includes("[diagnose] unreadable site"));
      expect(line).toContain("reason=identical_shell");
      expect(line).toContain("shellDetected=true");
      expect(line).toContain("threshold=300");
      expect(line).toMatch(/usableChars=\d+/);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("a thin crawl of DISTINCT pages returns low_content, with the real count", async () => {
    mock(fullPayload(), (path) => `<html><head><title>App</title></head><body><div id="root" data-p="${path}"></div></body></html>`);
    const { body } = await post();
    expect(body.readable).toBe(false);
    expect(body.reason).toBe("low_content");
    expect(body.shellDetected).toBe(false);
    expect(body.usableChars as number).toBeLessThan(300);
    expect(body.dimensions).toBeUndefined();
    expect(body.score).toBeUndefined();
    // The OTHER branch of the first paragraph: under the threshold, so the
    // character count is the honest explanation, and the shell sentence (which
    // would be wrong: these pages are distinct) must not appear.
    expect(String(body.body)).toContain("renders its content with JavaScript");
    expect(String(body.body)).toContain("fewer than 300 characters");
    expect(String(body.body)).not.toContain(UNREADABLE_BODY_FIRST_IDENTICAL_SHELL);
    expect(String(body.body)).toBe(unreadableBody("low_content"));
  });

  test("the unreadable payload never invents a score, band or dimension", async () => {
    mock(fullPayload(), () => SHELL);
    const { body } = await post();
    const keys = Object.keys(body).sort();
    expect(keys).toEqual(
      ["body", "cta", "heading", "pages", "readable", "reason", "shellDetected", "usableChars"].sort(),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Owner protocol Part 2.2: the response cache (the determinism fix)    */
/* ------------------------------------------------------------------ */

/** A payload no test expects: served only when the cache really hit. */
function markerPayload(friction = "MARKER") {
  return {
    score: 12,
    overallBand: null,
    primaryFriction: friction,
    recommendedFix: friction,
    dimensions: [],
  };
}

describe("Part 2.2: response cache", () => {
  test("a repeat submission is served the stored payload with NO model call", async () => {
    mock(fullPayload());
    const first = await post();
    expect(openaiCalls).toBe(1);
    const firstJson = JSON.stringify(first.body);

    // A second MODEL call would return THIS divergent completion (the exact
    // failure the diagnosis measured: identical input, different output). The
    // cache must never give the model that chance.
    openaiCalls = 0;
    mock({
      ...fullPayload(),
      primaryFriction: "A divergent second completion.",
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "positioning" ? { ...d, score: 20 } : d,
      ),
    });
    const second = await post();
    expect(openaiCalls).toBe(0);
    expect(second.res.status).toBe(200);
    expect(JSON.stringify(second.body)).toBe(firstJson);
  });

  test("the key is sha256(the request body) tagged with DIAGNOSE_PROMPT_VERSION", async () => {
    mock(fullPayload());
    await post();
    expect(openaiCalls).toBe(1);
    // Rebuild the key from the body the route actually sent on the wire.
    const hash = await sha256Hex(JSON.stringify(openaiBody));
    const key = diagnoseCacheKey(hash);
    expect(key).toBe(`v${DIAGNOSE_PROMPT_VERSION}:${hash}`);
    expect(diagnoseResponseCacheSize()).toBe(1);

    // Overwrite exactly that key: the route must read it and skip the model,
    // which is only possible if its derived key is identical.
    clearDiagnoseResponseCache();
    primeDiagnoseResponse(key, markerPayload("MARKER"));
    openaiCalls = 0;
    mock(fullPayload());
    const marked = await post();
    expect(openaiCalls).toBe(0);
    expect(marked.body.primaryFriction).toBe("MARKER");

    // An entry stored under the NEXT prompt version is a different key, so a
    // stale-version entry is never served: the model runs again. This is how a
    // future rubric/prompt edit invalidates cached results automatically.
    clearDiagnoseResponseCache();
    primeDiagnoseResponse(
      `v${DIAGNOSE_PROMPT_VERSION + 1}:${hash}`,
      markerPayload("STALE_VERSION"),
    );
    openaiCalls = 0;
    mock(fullPayload());
    const fresh = await post();
    expect(openaiCalls).toBe(1);
    expect(fresh.body.primaryFriction).not.toBe("STALE_VERSION");
    expect(fresh.body.score).toBe(69);
  });

  test("a different site is a different key and is scored on its own", async () => {
    mock(fullPayload());
    await post(ORIGIN);
    expect(openaiCalls).toBe(1);
    mock({
      ...fullPayload(),
      primaryFriction: "The second site has its own friction.",
    });
    const other = await post("https://other.example");
    expect(openaiCalls).toBe(2);
    expect(other.body.primaryFriction).toContain("second site");
  });

  test("the TTL is 30 days (owner spec, not 24h) and an older entry is a miss", () => {
    expect(DIAGNOSE_CACHE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    const t0 = 1_700_000_000_000;
    clearDiagnoseResponseCache();
    primeDiagnoseResponse("ttl-key", markerPayload(), t0);
    expect(readDiagnoseResponse("ttl-key", t0 + DIAGNOSE_CACHE_TTL_MS)).not.toBeNull();
    expect(readDiagnoseResponse("ttl-key", t0 + DIAGNOSE_CACHE_TTL_MS + 1)).toBeNull();
  });

  test("an unreadable site writes no cache entry (and never reaches the model)", async () => {
    mock(fullPayload(), () => SHELL);
    const { body } = await post();
    expect(body.readable).toBe(false);
    expect(openaiCalls).toBe(0);
    expect(diagnoseResponseCacheSize()).toBe(0);
  });

  test("an error path is never cached", async () => {
    // A malformed generation (no primary friction) is a clean 500 ...
    mock({ ...fullPayload(), primaryFriction: "" });
    const failed = await post();
    expect(failed.res.status).toBe(500);
    expect(diagnoseResponseCacheSize()).toBe(0);
    // ... and the next submission still calls the model and succeeds.
    openaiCalls = 0;
    mock(fullPayload());
    const ok = await post();
    expect(openaiCalls).toBe(1);
    expect(ok.res.status).toBe(200);
    expect(typeof ok.body.score).toBe("number");
  });
});

/* ------------------------------------------------------------------ */
/* Owner protocol Part 2.1(a) + 1.3: origin hygiene + attribution log   */
/* ------------------------------------------------------------------ */

describe("Part 2.1(a) + 1.3: canonical origin and per-call attribution", () => {
  test("the SITE URL UNDER EVALUATION line carries the canonical origin", () => {
    const msg = buildUserMessage("https://acme.example", "CRAWL BLOCK");
    expect(msg.startsWith("SITE URL UNDER EVALUATION: https://acme.example\n")).toBe(true);
    expect(msg).not.toContain("acme.example/");
    expect(msg).toContain("fetched server-side from https://acme.example");
  });

  test("a trailing slash or query string no longer changes the prompt", async () => {
    mock(fullPayload());
    await post(`${ORIGIN}/`);
    const barePrompt = JSON.stringify(openaiBody);
    clearDiagnoseResponseCache();
    clearCrawlCache();
    mock(fullPayload());
    await post(`${ORIGIN}/?utm_source=newsletter`);
    expect(JSON.stringify(openaiBody)).toBe(barePrompt);
  });

  test("ONE log line per model call: fingerprint, body hash, token usage", async () => {
    const originalLog = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      mock(fullPayload());
      await post();
      await post();
    } finally {
      console.log = originalLog;
    }
    const calls = lines.filter((l) => l.includes("[diagnose] model call"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("system_fingerprint=fp_test");
    expect(calls[0]).toMatch(/bodySha256=[0-9a-f]{64}/);
    expect(calls[0]).toContain(`key=v${DIAGNOSE_PROMPT_VERSION}:`);
    expect(calls[0]).toContain("total_tokens=6107");
    expect(calls[0]).not.toContain("STRUCTURED SITE CRAWL"); // never the prompt
    expect(calls[0].split("\n")).toHaveLength(1);
    // The second submission is logged as a cache hit instead.
    expect(lines.filter((l) => l.includes("response cache HIT"))).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Owner rubric calibration 2026-09-18, Parts 1 to 5: the prompt and    */
/* the cache version are the contract, so they are asserted directly.   */
/* ------------------------------------------------------------------ */

/** The system + user prompt the route actually sent to the model. */
async function sentPrompts() {
  mock(fullPayload());
  await post();
  const messages = (openaiBody?.messages ?? []) as { role: string; content: string }[];
  return {
    system: messages.find((m) => m.role === "system")?.content ?? "",
    user: messages.find((m) => m.role === "user")?.content ?? "",
  };
}

describe("Part 5: cache invalidation (prompt version 2)", () => {
  test("DIAGNOSE_PROMPT_VERSION is 2 and the key is prefixed v2:", () => {
    expect(DIAGNOSE_PROMPT_VERSION).toBe(2);
    expect(diagnoseCacheKey("abc")).toBe("v2:abc");
  });

  test("a v1 entry is never served: the version prefix is part of the key", async () => {
    mock(fullPayload());
    await post();
    const hash = await sha256Hex(JSON.stringify(openaiBody));
    expect(diagnoseCacheKey(hash)).toBe(`v2:${hash}`);
    expect(diagnoseCacheKey(hash)).not.toBe(`v1:${hash}`);
  });
});

describe("Part 1: the five-value scale in the prompt", () => {
  test("the permitted list is exactly 20, 40, 60, 80, 95 and no nine-value list survives", async () => {
    const { system, user } = await sentPrompts();
    for (const text of [system, user]) {
      expect(text).toContain("20, 40, 60, 80, 95");
      for (const dead of ["15, 25, 35", "45, 55, 65", "55, 65, 75", "85, 95"]) {
        expect(text).not.toContain(dead);
      }
    }
  });

  test("the status and band cutoffs are the shared 80 / 40 constants", async () => {
    const { system } = await sentPrompts();
    expect(system).toContain(`score >= ${STRONG_MIN} -> "Strong"`);
    expect(system).toContain(`${REFINEMENT_MIN} to ${STRONG_MIN - 1} -> "Needs Refinement"`);
    expect(system).toContain(`below ${REFINEMENT_MIN} -> "Critical Gap"`);
    expect(system).toContain(`overall >= ${STRONG_MIN} -> "Market Ready"`);
    expect(system).toContain(`below ${REFINEMENT_MIN} -> "High Launch Risk"`);
    // The UI label flip is stated with the same threshold the UI uses.
    expect(system).toContain(`below ${STRONG_MIN} and "Competitive Advantage" at ${STRONG_MIN}`);
  });

  test("no stale 'full score' language survives from the nine-value rubric", async () => {
    const { system } = await sentPrompts();
    expect(system).not.toContain("full score");
  });
});

describe("Part 3: band anchors for all six parameters", () => {
  test("every parameter carries all five bands, verbatim", async () => {
    const { system } = await sentPrompts();
    const anchors: Array<[string, string[]]> = [
      [
        "Category Positioning",
        [
          "No product noun anywhere above the fold. The headline is a slogan or a mission statement.",
          "You can tell it's software, but not what kind.",
          "The category is on the page but you have to scroll or infer it.",
          "The H1 names the category plainly. A first-time visitor knows what this is in one read.",
          "Names the category and stakes a position inside it. Not just what it is, but which kind.",
        ],
      ],
      [
        "ICP & Audience Alignment",
        [
          "Written for everyone. No buyer, role, company type, or industry named anywhere.",
          'A vague audience gesture. "Modern teams," "growing companies," "businesses like yours."',
          "An audience is named but broadly. A segment rather than a buyer.",
          "A specific buyer type or role is named and the copy speaks to their situation.",
          "Names the buyer and shows it understands their day. The language is theirs, not the vendor's.",
        ],
      ],
      [
        "Differentiation Anchor",
        [
          "Nothing distinguishing. Swap the logo for a competitor's and nothing reads wrong.",
          "Generic adjectives only. Fast, easy, powerful, intuitive, with no mechanism behind them.",
          "A difference is claimed but not proven. The claim is there, the evidence isn't.",
          "A specific mechanism, spec, or proof point that a competitor can't say.",
          "The difference is named, proven, and structural. Hard to copy, not just hard to match.",
        ],
      ],
      [
        "Hero Messaging & Speed",
        [
          "No problem and no outcome. Abstract concepts or brand language only.",
          "States what the product is, never why it matters. Category without consequence.",
          "A problem or an outcome is present, but not both, and not quickly.",
          "Problem and outcome are both above the fold and land in one read.",
          "Problem and outcome in a single sentence a visitor could repeat to a colleague.",
        ],
      ],
      [
        "Value Proposition Density",
        [
          "Feature list only. Nothing connects any capability to a result.",
          "Mostly features, with occasional benefit language bolted onto specs.",
          "Benefits are present but soft. Better, faster, improved, with no direction or measure.",
          "Most claims tie to a concrete outcome. Time saved, money made, risk avoided.",
          "Outcomes lead and features support them, with specifics rather than adjectives.",
        ],
      ],
      [
        "Conversion & Friction Mechanics",
        [
          "No clear primary action, or the only path is a contact form with no context.",
          "A CTA exists but it's vague, buried, or competing with several others of equal weight.",
          "A clear primary CTA, but high commitment and no proof nearby to justify it.",
          "Clear primary CTA, appropriate commitment level, and trust signals near the conversion point.",
          "A low-friction path to value with proof adjacent, and the CTA matches where the buyer actually is.",
        ],
      ],
    ];
    for (const [name, lines] of anchors) {
      expect(system).toContain(name);
      const values = [20, 40, 60, 80, 95];
      lines.forEach((line, i) => {
        expect(system).toContain(`- ${values[i]}: ${line}`);
      });
    }
  });

  test("the model is told to pick the closest band and return its exact value", async () => {
    const { system } = await sentPrompts();
    expect(system).toContain("BAND ANCHORS");
    expect(system).toContain("MOST CLOSELY matches the evidence");
    expect(system).toContain("return that band's exact value");
  });
});

describe("Part 2: the Value Proposition Density re-point", () => {
  test("its DOM targets are body text, H2-and-below headings and CTA labels", async () => {
    const { system } = await sentPrompts();
    expect(system).toContain(
      "DOM targets: body text, heading hierarchy (H2 and below), and CTA labels.",
    );
    expect(system).not.toContain("feature/benefit sections");
  });

  test("static metadata is valid evidence for it, alongside the other three", async () => {
    const { system, user } = await sentPrompts();
    expect(system).toContain(
      "These fields ARE valid evidence for Category Positioning, ICP & Audience Alignment, Differentiation Anchor, and Value Proposition Density",
    );
    expect(user).toContain(
      "still valid evidence for Category Positioning, ICP & Audience Alignment, Differentiation Anchor, and Value Proposition Density",
    );
  });

  test("it abstains only when the site genuinely has almost no body copy", async () => {
    const { system, user } = await sentPrompts();
    expect(system).toContain("so it must be SCORED on that evidence rather than abstained by default");
    expect(user).toContain("it abstains only when the site genuinely has almost no body copy");
  });

  test("weak evidence on a readable page is a LOW BAND, never an abstain", async () => {
    const { system, user } = await sentPrompts();
    // The rule that keeps the re-point honest: capability-only copy is 20 or 40.
    expect(system).toContain("WEAK IS NOT ABSENT");
    expect(system).toContain("is a LOW BAND, not an abstain");
    expect(system).toContain("is Value Proposition Density 20 (feature list only) or 40 (mostly features)");
    expect(system).toContain(
      '"insufficientData": true for Value Proposition Density is permitted only when the crawl block carries no body copy, no H2s and no CTA labels at all',
    );
    expect(user).toContain("never abstain");
  });
});

describe("Part 4: the abstain rule asks the model for its own observation", () => {
  test("the prompt requires a site-specific keyObservation on an abstained parameter", async () => {
    const { system, user } = await sentPrompts();
    expect(system).toContain("must STILL carry a site-specific \"keyObservation\"");
    expect(user).toContain("you MUST still return its \"keyObservation\"");
    // The old boilerplate sentence must not be quoted back to the model either.
    expect(system).not.toContain("This parameter is not well represented");
    expect(user).not.toContain("This parameter is not well represented");
  });
});
