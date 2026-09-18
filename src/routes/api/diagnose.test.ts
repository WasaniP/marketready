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
      modelDim("positioning", "Category Positioning", "Core Positioning", 75),
      modelDim("icp", "ICP & Audience Alignment", "Core Positioning", 65),
      modelDim("differentiation", "Differentiation Anchor", "Core Positioning", 55),
      modelDim("messaging", "Hero Messaging & Speed", "Messaging & Value Prop", 85),
      modelDim("value-prop", "Value Proposition Density", "Messaging & Value Prop", 45),
      { id: "gtm", name: "GTM Readiness", pillar: "GTM & Launch Velocity", locked: true },
      { id: "launch", name: "Launch Readiness", pillar: "GTM & Launch Velocity", locked: true },
      modelDim("conversion", "Conversion & Friction Mechanics", "GTM & Launch Velocity", 75),
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
    // The rubric states the unified vocabulary.
    expect(system).toContain('70 -> "Strong"');
    expect(system).toContain('45 to 69 -> "Needs Refinement"');
    expect(system).toContain("15, 25, 35, 45, 55, 65, 75, 85, 95");
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
    // 97.5 + 78 + 66 + 85 + 40.5 + 67.5 = 434.5 over weights 6.5 -> 66.8 -> 67
    expect(body.score).toBe(67);
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

describe("banded coercion (Part 5)", () => {
  test("any number is snapped to the nearest permitted value", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "positioning" ? { ...d, score: 88 } : d.id === "icp" ? { ...d, score: 20 } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const byId = Object.fromEntries(dims.map((d) => [d.id, d]));
    expect(byId.positioning.score).toBe(85);
    expect(byId.icp.score).toBe(15);
    expect(byId.positioning.status).toBe("Strong");
    expect(byId.icp.status).toBe("Critical Gap");
  });

  test("status labels always come from the unified thresholds", async () => {
    mock({
      ...fullPayload(),
      dimensions: fullPayload().dimensions.map((d) =>
        d.id === "messaging" ? { ...d, score: 65, status: "Strong" } : d,
      ),
    });
    const { body } = await post();
    const dims = body.dimensions as Record<string, unknown>[];
    const messaging = dims.find((d) => d.id === "messaging") as Record<string, unknown>;
    expect(messaging.score).toBe(65);
    expect(messaging.status).toBe("Needs Refinement");
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
    // 97.5 + 78 + 66 + 85 = 326.5 over 4.7 -> 69.47 -> 69 (weights redistributed)
    expect(body.score).toBe(69);
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

  test("a dimension the model omits entirely abstains (never a default 20)", async () => {
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
    expect(system).toContain("Category Positioning, ICP & Audience Alignment, and Differentiation Anchor");
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
        d.id === "positioning" ? { ...d, score: 15 } : d,
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
    expect(fresh.body.score).toBe(67);
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
