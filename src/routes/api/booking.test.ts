/**
 * Test suite for POST /api/booking (src/routes/api/booking.ts) and the
 * shared Airtable helpers it consumes (src/lib/airtable.ts).
 *
 * The contract under test:
 *   1. Validation: missing name / invalid email / malformed JSON return 4xx
 *     (same EMAIL_RE + fail-fast shape as POST /api/leads).
 *   2. Happy path: one record POSTed to the owner's "Bookings" table (NOT
 *     the diagnostic "Free diagnostic" table), with empty fields dropped.
 *   3. The route NEVER touches Knock: no fetch to any knock.app URL — that
 *     is the reason /api/booking exists as its own endpoint.
 *   4. Fail-open: with Airtable env vars missing the route responds
 *     { ok:true } and appends the request to the JSONL fallback with marker
 *     airtable:"unconfigured"; with a configured-but-failing Airtable it
 *     responds { ok:false, friendly error } and falls back with
 *     airtable:"failed". The token is never logged.
 *
 * Runs with `bun test` (no extra dependencies). Like knockEmail.test.ts this
 * file is excluded from the app tsconfig (bun:test types are not part of the
 * build's type surface). Tests chdir into a temp dir so JSONL fallback
 * writes never touch the repo's .data.
 */
import { describe, test, expect, beforeAll, afterAll, mock, spyOn } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Route as BookingRoute } from "./booking";
import { buildContactBooking } from "~/lib/contactPayload";

const bookingPOST = BookingRoute.options.server.handlers
  .POST as (ctx: { request: Request }) => Promise<Response>;

const META_URL = (base: string) =>
  `https://api.airtable.com/v0/meta/bases/${base}/tables`;
const BOOKINGS_URL = (base: string) =>
  `https://api.airtable.com/v0/${base}/Bookings`;

/** "Bookings" schema exactly as the live metadata API returns it. */
const BOOKINGS_SCHEMA = {
  tables: [
    { name: "Free diagnostic", fields: [{ name: "Submitted URL" }, { name: "Contact Email" }] },
    {
      name: "Bookings",
      fields: [
        { name: "Name" },
        { name: "Work Email" },
        { name: "Company" },
        { name: "Website URL" },
        { name: "Service Interest" },
        { name: "Source" },
        { name: "Timestamp" },
        { name: "Message" },
      ],
    },
  ],
};

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = ["AIRTABLE_API_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE_NAME"] as const;
const ORIGINAL_ENV = ENV_KEYS.map((k) => process.env[k]);

let tmpDir = "";

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "mr-booking-test-"));
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(import.meta.dir);
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  Object.defineProperty(globalThis, "fetch", {
    value: ORIGINAL_FETCH,
    writable: true,
    configurable: true,
  });
});

/** Restore env to its original state (tests mutate it to simulate missing
 * configuration; bun runs tests in a file sequentially). */
function restoreEnv() {
  for (let i = 0; i < ENV_KEYS.length; i++) {
    if (ORIGINAL_ENV[i] === undefined) delete process.env[ENV_KEYS[i]];
    else process.env[ENV_KEYS[i]] = ORIGINAL_ENV[i] as string;
  }
}

function setEnv(token?: string, base?: string, table?: string) {
  restoreEnv();
  // Assign-or-delete (undefined means "remove"): some tests must simulate a
  // host with NO Airtable configuration even though the dev shell has the
  // real vars exported.
  if (token === undefined) delete process.env.AIRTABLE_API_TOKEN;
  else process.env.AIRTABLE_API_TOKEN = token;
  if (base === undefined) delete process.env.AIRTABLE_BASE_ID;
  else process.env.AIRTABLE_BASE_ID = base;
  if (table === undefined) delete process.env.AIRTABLE_TABLE_NAME;
  else process.env.AIRTABLE_TABLE_NAME = table;
}

/** Replace globalThis.fetch with a URL-routed mock; returns [mock, calls]. */
function setFetchMock(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = mock((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  });
  Object.defineProperty(globalThis, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
  return { fetchMock, calls };
}

function post(body: unknown): Promise<Response> {
  return bookingPOST({
    request: new Request("http://localhost/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

const VALID_BODY = {
  name: "Ada Lovelace",
  workEmail: "ada@analyticalengines.test",
  company: "Analytical Engines",
  websiteUrl: "https://analyticalengines.test",
  serviceInterest: "MarketReady Sprint",
  source: "booking_modal",
  capturedAt: "2026-09-07T12:00:00.000Z",
};

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

describe("POST /api/booking validation", () => {
  test("400 + friendly error when name is missing", async () => {
    const res = await post({ ...VALID_BODY, name: "   " });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/name/i);
  });

  test("400 when work email is missing or malformed (shared EMAIL_RE)", async () => {
    for (const email of ["", "not-an-email", "a@b", "a b@c.io"]) {
      const res = await post({ ...VALID_BODY, workEmail: email });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.error).toMatch(/email/i);
    }
  });

  test("400 on malformed JSON body", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(false);
  });

  test("non-string fields are treated as absent (no crash)", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST"))
        return Response.json(BOOKINGS_SCHEMA);
      return Response.json({}, { status: 200 });
    });
    const res = await post({ ...VALID_BODY, company: 42, websiteUrl: null });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    const write = calls.find((c) => c.url.includes("/Bookings"));
    const fields = (JSON.parse(write!.init.body as string) as { records: { fields: Record<string, unknown> }[] }).records[0].fields;
    expect("Company" in fields).toBe(false);
    expect("Website URL" in fields).toBe(false);
    restoreEnv();
  });
});

/* ------------------------------------------------------------------ */
/* Happy path: writes to "Bookings", never Knock                       */
/* ------------------------------------------------------------------ */

describe("POST /api/booking Airtable write", () => {
  test("ok:true; one record to the Bookings table with modal payload", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      if (url === BOOKINGS_URL("appTEST")) return Response.json({}, { status: 200 });
      throw new Error(`unexpected fetch: ${url}`);
    });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);

    const write = calls.find((c) => c.url === BOOKINGS_URL("appTEST"));
    expect(write).toBeDefined();
    const sent = JSON.parse(write!.init.body as string) as {
      records: { fields: Record<string, unknown> }[];
    };
    expect(sent.records).toHaveLength(1);
    expect(sent.records[0].fields).toEqual({
      Name: "Ada Lovelace",
      "Work Email": "ada@analyticalengines.test",
      Company: "Analytical Engines",
      "Website URL": "https://analyticalengines.test",
      "Service Interest": "MarketReady Sprint",
      Source: "booking_modal",
      Timestamp: "2026-09-07T12:00:00.000Z",
    });
    restoreEnv();
  });

  test("NEVER calls Knock — the whole point of the separate route", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      return Response.json({}, { status: 200 });
    });
    await post(VALID_BODY);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => /knock\.app/i.test(c.url))).toBe(false);
    restoreEnv();
  });

  test("company is inferred from the website domain when omitted", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      return Response.json({}, { status: 200 });
    });
    const res = await post({ ...VALID_BODY, company: "" });
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    const write = calls.find((c) => c.url.includes("/Bookings"))!;
    const fields = (JSON.parse(write.init.body as string) as { records: { fields: Record<string, unknown> }[] }).records[0].fields;
    expect(fields.Company).toBe("analyticalengines");
    restoreEnv();
  });
});

/* ------------------------------------------------------------------ */
/* Fail-open behavior                                                  */
/* ------------------------------------------------------------------ */

describe("POST /api/booking fail-open", () => {
  test("env vars missing -> ok:true + JSONL fallback marker 'unconfigured'", async () => {
    setEnv(undefined, undefined, undefined);
    const { calls } = setFetchMock(() => {
      throw new Error("network must not be touched when env is missing");
    });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(calls).toHaveLength(0); // no Airtable, and never any email call
    const file = path.join(tmpDir, ".data", "bookings.jsonl");
    expect(existsSync(file)).toBe(true);
    const record = JSON.parse(readFileSync(file, "utf8").trim().split("\n").pop()!) as Record<string, unknown>;
    expect(record.airtable).toBe("unconfigured");
    expect(record.workEmail).toBe(VALID_BODY.workEmail);
  });

  test("Airtable HTTP failure -> ok:false + friendly error + JSONL 'failed'", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const warnLines: string[] = [];
    const warn = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnLines.push(args.map(String).join(" "));
    });
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      return Response.json({ error: { message: "INVALID_VALUE" } }, { status: 422 });
    });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/try again/i);
    // No token, no raw Airtable error leakage in logs.
    expect(warnLines.join("\n")).not.toContain("tok");
    expect(warnLines.join("\n")).not.toContain("INVALID_VALUE");
    warn.mockRestore();
    const file = path.join(tmpDir, ".data", "bookings.jsonl");
    const record = JSON.parse(readFileSync(file, "utf8").trim().split("\n").pop()!) as Record<string, unknown>;
    expect(record.airtable).toBe("failed");
    expect(calls.some((c) => /knock\.app/i.test(c.url))).toBe(false);
    restoreEnv();
  });

  test("writeAirtable retries transient network errors (3 attempts)", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    let attempts = 0;
    setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      attempts++;
      throw new Error("The socket connection was closed unexpectedly");
    });
    const res = await post(VALID_BODY);
    expect(attempts).toBe(3);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
    restoreEnv();
  });
});

/* ------------------------------------------------------------------ */
/* Contact form → /api/booking (source "contact_form", Message column) */
/* ------------------------------------------------------------------ */

describe("contact form → POST /api/booking", () => {
  test("buildContactBooking maps fields incl. message and source contact_form", () => {
    const p = buildContactBooking({
      name: "Ada Lovelace",
      workEmail: "ada@analyticalengines.test",
      company: "Analytical Engines",
      message: "We're pre-launch and our positioning is muddy.",
      interest: "Sprint",
    }, "2026-09-08T09:00:00.000Z");
    expect(p).toEqual({
      name: "Ada Lovelace",
      workEmail: "ada@analyticalengines.test",
      company: "Analytical Engines",
      websiteUrl: "not provided",
      serviceInterest: "Contact: Sprint",
      source: "contact_form",
      capturedAt: "2026-09-08T09:00:00.000Z",
      message: "We're pre-launch and our positioning is muddy.",
    });
  });

  test("buildContactBooking handles empty optional company/interest", () => {
    const p = buildContactBooking({
      name: "Grace Hopper",
      workEmail: "grace@compiler.test",
      message: "Questions about the audit.",
    });
    expect(p.company).toBe("");
    expect(p.serviceInterest).toBeUndefined();
    expect(p.source).toBe("contact_form");
    expect(p.websiteUrl).toBe("not provided");
    expect(p.message).toBe("Questions about the audit.");
  });

  test("route writes the contact row to Bookings with Message populated", async () => {
    setEnv("tok", "appTEST", "Free diagnostic");
    const { calls } = setFetchMock((url) => {
      if (url === META_URL("appTEST")) return Response.json(BOOKINGS_SCHEMA);
      if (url === BOOKINGS_URL("appTEST")) return Response.json({}, { status: 200 });
      throw new Error(`unexpected fetch: ${url}`);
    });
    const res = await post({
      name: "Ada Lovelace",
      workEmail: "ada@analyticalengines.test",
      company: "Analytical Engines",
      websiteUrl: "not provided",
      message: "We're pre-launch and our positioning is muddy.",
      source: "contact_form",
      capturedAt: "2026-09-08T09:00:00.000Z",
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    const write = calls.find((c) => c.url === BOOKINGS_URL("appTEST"));
    expect(write).toBeDefined();
    const fields = (JSON.parse(write!.init.body as string) as {
      records: { fields: Record<string, unknown> }[];
    }).records[0].fields;
    expect(fields).toEqual({
      Name: "Ada Lovelace",
      "Work Email": "ada@analyticalengines.test",
      Company: "Analytical Engines",
      "Website URL": "not provided",
      Source: "contact_form",
      Timestamp: "2026-09-08T09:00:00.000Z",
      Message: "We're pre-launch and our positioning is muddy.",
    });
    expect(calls.some((c) => /knock\.app/i.test(c.url))).toBe(false);
    restoreEnv();
  });
});
