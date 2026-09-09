/**
 * Test suite for the Knock "instant results" email pipeline
 * (src/lib/knockEmail.ts + POST /api/leads in src/routes/api/leads.ts).
 *
 * The regression this suite guards: the email trigger used to be fire-and-
 * forget AFTER the Airtable write, so on a cold/slow serverless instance the
 * platform froze the background promise once the response flushed and the
 * email silently dropped. The fix AWAITS a bounded trigger BEFORE the handler
 * returns (in parallel with the Airtable write, so latency stays max() not
 * sum()). These tests prove:
 *
 *   1. triggerResultsEmail() never throws / never rejects, and bounds its
 *      total budget to ~2 × attempt timeout (the ~8s PR #6 bound).
 *   2. Failures are observable: every failure path console.warn's with the
 *      recipient + lead identity (+ workflow run id on success).
 *   3. The data-key contract (buildResultsEmailData) is unchanged — every key
 *      the Knock template uses is present, locked params excluded.
 *   4. POST /api/leads still responds {ok:true} and the email trigger has
 *      COMPLETED before the response resolves (the cold-start fix), with
 *      Airtable independence + retry logic intact.
 *
 * Runs with `bun test` (Bun 1.3.14, no extra dependencies). The file is
 * excluded from the app tsconfig: it runs under Bun's runtime, not the Vite
 * build, and `bun:test` types aren't part of the build's type surface.
 */
import { describe, test, expect, beforeAll, afterEach, mock, spyOn } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import * as path from "node:path";
import {
  buildResultsEmailData,
  buildBookingConfirmationData,
  triggerResultsEmail,
  triggerBookingConfirmation,
  type KnockEmailLead,
  type KnockBookingConfirmation,
} from "./knockEmail";
import {
  Route as LeadsRoute,
} from "../routes/api/leads";

/* ------------------------------------------------------------------ */
/* Fixtures + helpers                                                  */
/* ------------------------------------------------------------------ */

/** Full diagnostic payload as sent by the homepage calculator. */
const DIAGNOSTIC_PAYLOAD = {
  score: 77,
  overallBand: "Needs Attention",
  generatedAt: "2026-09-07T12:00:00.000Z",
  url: "https://getmarketready.co",
  dimensions: [
    {
      id: "hero",
      name: "Hero Messaging",
      pillar: "Messaging & Value Prop",
      score: 41,
      status: "at-risk",
      keyObservation: "The hero headline buries the outcome.",
      evidence_snippet: "<h1>Clear Positioning.</h1>",
    },
    { id: "value", name: "Value Proposition", pillar: "Messaging & Value Prop", score: 66, status: "ok" },
    { id: "differentiation", name: "Differentiation", pillar: "Core Positioning", score: 58, status: "ok" },
    { id: "gtm", name: "GTM Readiness", pillar: "GTM & Launch Velocity", locked: true },
  ],
};

/** Minimal lead shape both triggerResultsEmail and the route accept. */
const BASE_LEAD: KnockEmailLead = {
  firstName: "Test",
  workEmail: "test+leads@mr.test",
  company: "mr-test",
  websiteUrl: "https://mr.test",
  icp: "",
  score: 77,
  readiness: "Needs Attention",
  primaryFriction: "Messaging",
  prescription: "14-Day Positioning Sprint ($7,500)",
  keyObservation: "The hero headline buries the outcome.",
  commercialRisk: "Buyers keep alternatives in the running.",
  frictionLabel: "Unclear Value Prop",
  anchorLabel: "",
  domEvidence: "<h1>Clear Positioning.</h1>",
  answersBreakdown: "",
  source: "Homepage Calculator",
  capturedAt: "2026-09-07T12:00:00.000Z",
  payload: DIAGNOSTIC_PAYLOAD,
};

const KNOCK_WORKFLOW_URL =
  "https://api.knock.app/v1/workflows/marketready-diagnostic-results/trigger";
const CONFIRMATION_WORKFLOW_URL =
  "https://api.knock.app/v1/workflows/marketready-booking-confirmation/trigger";

/** Minimal booking request as normalized by POST /api/booking. */
const BASE_BOOKING: KnockBookingConfirmation = {
  name: "Ada Lovelace",
  workEmail: "ada@analyticalengines.test",
  company: "Analytical Engines",
  websiteUrl: "https://analyticalengines.test",
  serviceInterest: "MarketReady Sprint",
  source: "booking_modal",
  capturedAt: "2026-09-07T12:00:00.000Z",
  message: "",
};

/** Save the real fetch so every test's mock is fully restored. */
const ORIGINAL_FETCH = globalThis.fetch;

/** Replace globalThis.fetch with a mock that routes by URL. */
function setFetchMock(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const fetchMock = mock((url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {}),
  );
  Object.defineProperty(globalThis, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
  return fetchMock;
}

/** Capture console.warn / console.info calls for assertions. */
function captureLogs() {
  const logs: { level: "warn" | "info"; text: string }[] = [];
  const warn = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    logs.push({ level: "warn", text: args.map(String).join(" ") });
  });
  const info = spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    logs.push({ level: "info", text: args.map(String).join(" ") });
  });
  return { logs, warn, info };
}

beforeAll(() => {
  // Ensure the JSONL fallback dir exists for route tests.
  mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
});

afterEach(() => {
  // Restore console spies.
  const warn = console.warn as unknown as { mockRestore?: () => void };
  const info = console.info as unknown as { mockRestore?: () => void };
  warn.mockRestore?.();
  info.mockRestore?.();
  // Restore the real fetch.
  Object.defineProperty(globalThis, "fetch", {
    value: ORIGINAL_FETCH,
    writable: true,
    configurable: true,
  });
  // Reset env so tests don't leak into each other.
  delete process.env.KNOCK_API_KEY;
  delete process.env.KNOCK_WORKFLOW;
  delete process.env.AIRTABLE_API_TOKEN;
  delete process.env.AIRTABLE_BASE_ID;
  delete process.env.AIRTABLE_TABLE_NAME;
  // Clean the temp JSONL written by route fallback paths.
  const f = path.join(process.cwd(), ".data", "leads.jsonl");
  if (existsSync(f)) rmSync(f, { force: true });
});

/* ------------------------------------------------------------------ */
/* buildResultsEmailData — the data-key contract                       */
/* ------------------------------------------------------------------ */
describe("buildResultsEmailData (template data-key contract)", () => {
  const fullBreakdown = "Score: 77/100 (Needs Attention)\nFull Diagnostic JSON: …";

  test("emits every documented key with the exact payload values", () => {
    const data = buildResultsEmailData(BASE_LEAD, fullBreakdown);
    const expectedKeys = [
      "firstName", "workEmail", "company", "websiteUrl", "icp",
      "score", "readiness", "overallBand", "lowestParameter", "primaryFriction",
      "frictionLabel", "anchorLabel", "keyObservation", "commercialRisk",
      "prescription", "domEvidence", "source", "capturedAt", "fullBreakdown",
      "parameterScores",
    ];
    for (const k of expectedKeys) {
      expect(data, `missing data key: ${k}`).toHaveProperty(k);
    }
    expect(data.firstName).toBe("Test");
    expect(data.workEmail).toBe("test+leads@mr.test");
    expect(data.score).toBe(77);
    expect(data.readiness).toBe("Needs Attention");
    expect(data.overallBand).toBe("Needs Attention");
    expect(data.lowestParameter).toBe("Messaging");
    expect(data.primaryFriction).toBe("Messaging");
    expect(data.source).toBe("Homepage Calculator");
    expect(data.fullBreakdown).toContain("Score: 77/100");
    // Locked dimensions (GTM Readiness) are excluded from parameterScores.
    expect(data.parameterScores).toHaveLength(3);
    expect(data.parameterScores[0]).toEqual({
      name: "Hero Messaging",
      score: 41,
      status: "at-risk",
    });
  });

  test("score is null when the lead has no numeric score", () => {
    const data = buildResultsEmailData({ ...BASE_LEAD, score: NaN }, "");
    expect(data.score).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* triggerResultsEmail — fail-open, bounded, observable                */
/* ------------------------------------------------------------------ */
describe("triggerResultsEmail (fail-open, bounded, observable)", () => {
  test("skips silently when KNOCK_API_KEY is unset (fail-open)", async () => {
    delete process.env.KNOCK_API_KEY;
    const { logs } = captureLogs();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 50 });
    expect(outcome).toEqual({ ok: false, reason: "skipped", attempted: 0, elapsedMs: 0 });
    expect(logs).toHaveLength(0); // an expected skip is NOT a failure to log
  });

  test("returns ok:true with runId on a 2xx trigger and logs success + recipient", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    setFetchMock(async () =>
      new Response(JSON.stringify({ workflow_run_id: "run-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { logs } = captureLogs();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 50 });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.runId).toBe("run-123");
    const infoLine = logs.find((l) => l.level === "info");
    expect(infoLine?.text).toContain("runId=run-123");
    expect(infoLine?.text).toContain("lead=test+leads@mr.test");
  });

  test("never throws on a non-2xx rejection and logs HTTP status + recipient", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    setFetchMock(async () => new Response("unknown workflow", { status: 404 }));
    const { logs } = captureLogs();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 50 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("rejected");
    const warnLine = logs.find((l) => l.level === "warn");
    expect(warnLine?.text).toContain("reason=rejected");
    expect(warnLine?.text).toContain("HTTP 404");
    expect(warnLine?.text).toContain("lead=test+leads@mr.test");
  });

  test("never throws on a network failure and logs the error (observability)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    setFetchMock(async () => {
      throw new TypeError("fetch failed");
    });
    const { logs } = captureLogs();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 50 });
    expect(outcome.ok).toBe(false);
    const warnLine = logs.find((l) => l.level === "warn");
    expect(warnLine?.text).toContain("reason=failed");
    expect(warnLine?.text).toContain("fetch failed");
    expect(warnLine?.text).toContain("lead=test+leads@mr.test");
  });

  test("retries ONCE on a transient timeout and succeeds on attempt 2 (bounded budget)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    let calls = 0;
    setFetchMock(async (_url, init) => {
      calls++;
      if (calls === 1) {
        // Simulate the cold/slow instance: first attempt hangs until its
        // AbortSignal timeout fires (real fetch aborts the request; the mock
        // must honor init.signal the same way).
        const signal = init.signal as AbortSignal | undefined;
        await new Promise<never>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          const timer = setTimeout(() => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          }, 10_000);
          signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }
      return new Response(JSON.stringify({ workflow_run_id: "run-retried" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const { logs } = captureLogs();
    const started = Date.now();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 150 });
    const elapsed = Date.now() - started;
    // Total budget is bounded: ~2 × 150ms, not a 10s hang.
    expect(elapsed).toBeLessThan(2_000);
    expect(calls).toBe(2);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.runId).toBe("run-retried");
    // First-attempt timeout must be visible even though the retry succeeded.
    const retryLine = logs.find((l) => l.level === "warn" && l.text.includes("retrying"));
    expect(retryLine?.text).toContain("reason=timeout");
    expect(retryLine?.text).toContain("lead=test+leads@mr.test");
    expect(logs.some((l) => l.level === "info" && l.text.includes("runId=run-retried"))).toBe(true);
  });

  test("exhausts both attempts on a persistent hang and returns timeout (still never throws)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    setFetchMock(async (_url, init) => {
      // Always hangs until the AbortSignal timeout fires — honors the signal
      // the same way real fetch does.
      const signal = init.signal as AbortSignal | undefined;
      await new Promise<never>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        const timer = setTimeout(() => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, 10_000);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const { logs } = captureLogs();
    const started = Date.now();
    const outcome = await triggerResultsEmail(BASE_LEAD, "", { attemptTimeoutMs: 150 });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(2_500); // ~300ms total, not a 10s or 20s hang
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("timeout");
    const warnLines = logs.filter((l) => l.level === "warn");
    expect(warnLines.length).toBeGreaterThanOrEqual(1);
    expect(warnLines[0].text).toContain("lead=test+leads@mr.test");
  });
});

/* ------------------------------------------------------------------ */
/* buildBookingConfirmationData — the template data-key contract        */
/* ------------------------------------------------------------------ */
describe("buildBookingConfirmationData (template data-key contract)", () => {
  test("emits every documented key with the exact booking values", () => {
    const data = buildBookingConfirmationData(BASE_BOOKING);
    const expectedKeys = [
      "firstName", "fullName", "workEmail", "company", "websiteUrl",
      "serviceInterest", "source", "message", "capturedAt",
    ];
    for (const k of expectedKeys) {
      expect(data, `missing data key: ${k}`).toHaveProperty(k);
    }
    expect(data.firstName).toBe("Ada");
    expect(data.fullName).toBe("Ada Lovelace");
    expect(data.workEmail).toBe("ada@analyticalengines.test");
    expect(data.company).toBe("Analytical Engines");
    expect(data.websiteUrl).toBe("https://analyticalengines.test");
    expect(data.serviceInterest).toBe("MarketReady Sprint");
    expect(data.source).toBe("booking_modal");
    expect(data.message).toBe("");
    expect(data.capturedAt).toBe("2026-09-07T12:00:00.000Z");
  });

  test("firstName is the first token of the full name; empty name -> empty firstName", () => {
    const data = buildBookingConfirmationData({ ...BASE_BOOKING, name: "Grace Hopper" });
    expect(data.firstName).toBe("Grace");
    const empty = buildBookingConfirmationData({ ...BASE_BOOKING, name: "   " });
    expect(empty.firstName).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* triggerBookingConfirmation — fail-open, bounded, right workflow      */
/* ------------------------------------------------------------------ */
describe("triggerBookingConfirmation (confirmation workflow, fail-open)", () => {
  test("uses KNOCK_CONFIRMATION_WORKFLOW env when set, else the default key", async () => {
    process.env.KNOCK_API_KEY = "sk_test_conf";
    const requested: string[] = [];
    setFetchMock(async (url) => {
      requested.push(url);
      return new Response(JSON.stringify({ workflow_run_id: "run-conf-env" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    // Default key.
    delete process.env.KNOCK_CONFIRMATION_WORKFLOW;
    await triggerBookingConfirmation(BASE_BOOKING, { attemptTimeoutMs: 50 });
    expect(requested[0]).toBe(CONFIRMATION_WORKFLOW_URL);

    // Env override.
    requested.length = 0;
    process.env.KNOCK_CONFIRMATION_WORKFLOW = "custom-confirmation-workflow";
    await triggerBookingConfirmation(BASE_BOOKING, { attemptTimeoutMs: 50 });
    expect(requested[0]).toBe(
      "https://api.knock.app/v1/workflows/custom-confirmation-workflow/trigger",
    );
    delete process.env.KNOCK_CONFIRMATION_WORKFLOW;
  });

  test("sends to the submitter with name + full booking data map, logs the run id", async () => {
    process.env.KNOCK_API_KEY = "sk_test_conf";
    let knockBody = "";
    setFetchMock(async (_url, init) => {
      knockBody = String(init.body);
      return new Response(JSON.stringify({ workflow_run_id: "run-conf-ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const { logs } = captureLogs();
    const outcome = await triggerBookingConfirmation(BASE_BOOKING, { attemptTimeoutMs: 50 });
    expect(outcome.ok).toBe(true);
    const sent = JSON.parse(knockBody) as {
      recipients: { id: string; email: string; name: string }[];
      data: Record<string, unknown>;
    };
    expect(sent.recipients[0].email).toBe("ada@analyticalengines.test");
    expect(sent.recipients[0].id).toBe("ada@analyticalengines.test");
    expect(sent.recipients[0].name).toBe("Ada Lovelace");
    expect(sent.data.source).toBe("booking_modal");
    const infoLine = logs.find((l) => l.level === "info");
    expect(infoLine?.text).toContain("workflow=marketready-booking-confirmation");
    expect(infoLine?.text).toContain("runId=run-conf-ok");
    expect(infoLine?.text).toContain("lead=ada@analyticalengines.test");
  });

  test("never fires the diagnostic-results workflow", async () => {
    process.env.KNOCK_API_KEY = "sk_test_conf";
    const requested: string[] = [];
    setFetchMock(async (url) => {
      requested.push(url);
      return new Response(JSON.stringify({ workflow_run_id: "run-any" }), { status: 200 });
    });
    await triggerBookingConfirmation({ ...BASE_BOOKING, source: "contact_form" }, { attemptTimeoutMs: 50 });
    expect(requested.every((u) => u.includes("marketready-booking-confirmation"))).toBe(true);
    expect(requested.some((u) => u.includes("marketready-diagnostic-results"))).toBe(false);
  });

  test("skips silently when KNOCK_API_KEY is unset (fail-open)", async () => {
    delete process.env.KNOCK_API_KEY;
    const { logs } = captureLogs();
    const outcome = await triggerBookingConfirmation(BASE_BOOKING, { attemptTimeoutMs: 50 });
    expect(outcome).toEqual({ ok: false, reason: "skipped", attempted: 0, elapsedMs: 0 });
    expect(logs).toHaveLength(0);
  });

  test("never throws on a non-2xx rejection and logs the workflow + recipient", async () => {
    process.env.KNOCK_API_KEY = "sk_test_conf";
    setFetchMock(async () => new Response("unknown workflow", { status: 404 }));
    const { logs } = captureLogs();
    const outcome = await triggerBookingConfirmation(BASE_BOOKING, { attemptTimeoutMs: 50 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("rejected");
    const warnLine = logs.find((l) => l.level === "warn");
    expect(warnLine?.text).toContain("workflow=marketready-booking-confirmation");
    expect(warnLine?.text).toContain("HTTP 404");
    expect(warnLine?.text).toContain("lead=ada@analyticalengines.test");
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/leads — AWAITS the email before responding (cold-start)   */
/* ------------------------------------------------------------------ */
describe("POST /api/leads (AWAITS the email before responding)", () => {
  const leadsPOST = LeadsRoute.options.server.handlers.POST;

  async function postLead(body: Record<string, unknown>): Promise<Response> {
    return leadsPOST({
      request: new Request("http://localhost/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  }

  /** Standard mocked environment: Airtable configured and succeeding, Knock
   * responding through the same mocked fetch (routed by URL). */
  function mockAirtableAndKnock(knock: () => Response | Promise<Response>) {
    setFetchMock((url, _init) => {
      if (url.includes("api.airtable.com")) {
        return Promise.resolve(
          new Response(JSON.stringify({ records: [{ id: "rec1" }] }), { status: 200 }),
        );
      }
      return knock();
    });
  }

  test("responds {ok:true} and the email trigger COMPLETES before the response resolves (cold-start fix)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    process.env.AIRTABLE_API_TOKEN = "pat_mock";
    process.env.AIRTABLE_BASE_ID = "base_mock";
    process.env.AIRTABLE_TABLE_NAME = "Free diagnostic";

    let emailCompleted = false;
    mockAirtableAndKnock(async () => {
      // Knock resolves on a later macrotask — the assertion below proves the
      // response did NOT resolve until this had settled.
      await new Promise((r) => setTimeout(r, 30));
      emailCompleted = true;
      return new Response(JSON.stringify({ workflow_run_id: "run-cold-start" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const { logs } = captureLogs();

    const res = await postLead({
      firstName: "Test",
      workEmail: "test+leads@mr.test",
      websiteUrl: "https://mr.test",
      source: "Homepage Calculator",
      overallScore: 77,
      lowestParameter: "Messaging",
      diagnosticPayload: DIAGNOSTIC_PAYLOAD,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    // THE fix: by the time the handler returned, the bounded email trigger
    // had settled. The old fire-and-forget code could NOT satisfy this.
    expect(emailCompleted).toBe(true);
    expect(logs.some((l) => l.text.includes("runId=run-cold-start"))).toBe(true);
    expect(logs.some((l) => l.text.includes("lead=test+leads@mr.test"))).toBe(true);
  });

  test("still responds {ok:true} and never 5xx when the email send FAILS (fail-open)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    process.env.AIRTABLE_API_TOKEN = "pat_mock";
    process.env.AIRTABLE_BASE_ID = "base_mock";
    process.env.AIRTABLE_TABLE_NAME = "Free diagnostic";
    mockAirtableAndKnock(async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new TypeError("fetch failed")), 20));
      return new Response("never", { status: 500 });
    });
    const { logs } = captureLogs();
    const res = await postLead({
      firstName: "Test",
      workEmail: "test+failopen@mr.test",
      websiteUrl: "https://mr.test",
      source: "Homepage Calculator",
      overallScore: 77,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(logs.some((l) => l.level === "warn" && l.text.includes("reason=failed"))).toBe(true);
  });

  test("defaults the workflow key to marketready-diagnostic-results", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    process.env.AIRTABLE_API_TOKEN = "pat_mock";
    process.env.AIRTABLE_BASE_ID = "base_mock";
    process.env.AIRTABLE_TABLE_NAME = "Free diagnostic";
    let requestedUrl = "";
    mockAirtableAndKnock(async () => {
      // Capture the workflow URL via closure in the outer handler instead:
      return new Response(JSON.stringify({ workflow_run_id: "run-default" }), { status: 200 });
    });
    // Re-mock to also capture the URL.
    setFetchMock((url, _init) => {
      if (url.includes("api.airtable.com")) {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      requestedUrl = url;
      return Promise.resolve(new Response(JSON.stringify({ workflow_run_id: "run-default" }), {
        status: 200,
      }));
    });
    captureLogs();
    await postLead({
      firstName: "Test",
      workEmail: "test+default@mr.test",
      websiteUrl: "https://mr.test",
      source: "Full Assessment",
      overallScore: 82,
    });
    expect(requestedUrl).toBe(KNOCK_WORKFLOW_URL);
  });

  test("the Airtable write stays independent of the email (write ok even when email keeps failing)", async () => {
    process.env.KNOCK_API_KEY = "sk_test_ok";
    process.env.AIRTABLE_API_TOKEN = "pat_mock";
    process.env.AIRTABLE_BASE_ID = "base_mock";
    process.env.AIRTABLE_TABLE_NAME = "Free diagnostic";
    setFetchMock((url, _init) => {
      if (url.includes("api.airtable.com")) {
        return Promise.resolve(new Response(JSON.stringify({ records: [{ id: "rec1" }] }), {
          status: 200,
        }));
      }
      return Promise.reject(new TypeError("socket connection was closed unexpectedly"));
    });
    captureLogs();
    const res = await postLead({
      firstName: "Test",
      workEmail: "test+indep@mr.test",
      websiteUrl: "https://mr.test",
      source: "Homepage Calculator",
      overallScore: 70,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});