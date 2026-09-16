/**
 * Owner spec 2026-09-15, Parts 2.3 / 2.4: the crawl contract.
 *
 * Guards: exactly 3 crawl paths, ONE retry per page on timeout or non-200
 * (with the 500ms backoff), no retry on success or non-HTML, the exact
 * UNREACHABLE / NOT FOUND / NON-HTML reporting, and the 24h parsed-crawl cache
 * keyed by origin (a determinism source: a repeat submission scores against an
 * identical crawl block).
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  CRAWL_CACHE_TTL_MS,
  CRAWL_PATHS,
  PAGE_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  crawlCacheSize,
  crawlPath,
  crawlSite,
  clearCrawlCache,
  primeCrawlCache,
  readCrawlCache,
} from "./crawl";

const ORIGIN = "https://acme.example";
const signal = () => new AbortController().signal;

const HTML = `<!doctype html><html><head><title>Acme: category-defining widgets</title></head>
<body><h1>Acme is the widget platform for logistics teams</h1><h2>Cut onboarding time</h2>
<p>Teams ship 40% faster.</p><a class="btn" href="/signup">Start free</a></body></html>`;

function html(body = HTML, status = 200, type = "text/html") {
  return new Response(body, { status, headers: { "content-type": type } });
}

let calls: string[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  clearCrawlCache();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("crawl contract", () => {
  test("crawls exactly /, /pricing and /about", () => {
    expect([...CRAWL_PATHS]).toEqual(["/", "/pricing", "/about"]);
  });

  test("per-page timeout is 10s and the backoff is 500ms", () => {
    expect(PAGE_TIMEOUT_MS).toBe(10000);
    expect(RETRY_BACKOFF_MS).toBe(500);
  });

  test("a successful page is fetched once and parsed", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html();
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/", signal());
    expect(calls).toHaveLength(1);
    expect(page.kind).toBe("FOUND");
    expect(page.title).toContain("Acme");
    expect(page.heroH1).toContain("widget platform");
    expect(page.ctas).toContain("Start free");
  });

  test("a non-200 is retried once, then reported as today", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return calls.length === 1 ? html("nope", 500) : html();
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/pricing", signal());
    expect(calls).toHaveLength(2);
    expect(page.kind).toBe("FOUND");
    expect(page.status).toBe(200);
  });

  test("a 404 after both attempts reports NOT FOUND with the status", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html("missing", 404);
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/about", signal());
    expect(calls).toHaveLength(2);
    expect(page.kind).toBe("NOT FOUND");
    expect(page.status).toBe(404);
  });

  test("a network failure/timeout is retried once, then UNREACHABLE", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      throw new Error("timed out");
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/", signal());
    expect(calls).toHaveLength(2);
    expect(page.kind).toBe("UNREACHABLE");
    expect(page.status).toBe(0);
  });

  test("a recovery on the retry attempt yields the page", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      if (calls.length === 1) throw new Error("timed out");
      return html();
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/", signal());
    expect(calls).toHaveLength(2);
    expect(page.kind).toBe("FOUND");
  });

  test("non-HTML responses are reported without a retry", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html("%PDF-1.4", 200, "application/pdf");
    }) as unknown as typeof fetch;

    const page = await crawlPath(ORIGIN, "/about", signal());
    expect(calls).toHaveLength(1);
    expect(page.kind).toBe("NON-HTML");
  });
});

describe("parsed-crawl cache (24h, keyed by origin)", () => {
  test("a repeat crawl of the same origin reuses the parsed pages", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html();
    }) as unknown as typeof fetch;

    const first = await crawlSite(ORIGIN, signal());
    expect(calls).toHaveLength(CRAWL_PATHS.length);
    expect(first.map((p) => p.path)).toEqual([...CRAWL_PATHS]);

    const second = await crawlSite(ORIGIN, signal());
    expect(calls).toHaveLength(CRAWL_PATHS.length); // no new fetches
    expect(second).toEqual(first);
  });

  test("a different origin is not served from another origin's cache", async () => {
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html();
    }) as unknown as typeof fetch;

    await crawlSite(ORIGIN, signal());
    await crawlSite("https://other.example", signal());
    expect(calls).toHaveLength(CRAWL_PATHS.length * 2);
  });

  test("an entry older than the 24h TTL is a miss and is refreshed", async () => {
    expect(CRAWL_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return html();
    }) as unknown as typeof fetch;

    const stale = [
      {
        path: "/",
        status: 200,
        kind: "FOUND" as const,
        title: "stale",
        metaTitle: "",
        heroH1: "stale",
        heroSub: "",
        headings: [],
        bodyText: "",
        ctas: [],
        text: "",
      },
    ];
    primeCrawlCache(ORIGIN, stale, Date.now() - CRAWL_CACHE_TTL_MS - 1000);
    expect(readCrawlCache(ORIGIN)).toBeNull();

    const pages = await crawlSite(ORIGIN, signal());
    expect(calls).toHaveLength(CRAWL_PATHS.length);
    expect(pages[0].title).toContain("Acme");
  });

  test("a fresh seeded entry is served without any fetch", async () => {
    globalThis.fetch = (async () => {
      throw new Error("should not fetch");
    }) as unknown as typeof fetch;

    primeCrawlCache(ORIGIN, [], Date.now());
    expect(crawlCacheSize()).toBeGreaterThan(0);
    expect(await crawlSite(ORIGIN, signal())).toEqual([]);
  });

  test("a crawl with nothing readable is not cached (Retry can recover)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;

    const pages = await crawlSite(ORIGIN, signal());
    expect(pages.every((p) => p.kind === "UNREACHABLE")).toBe(true);
    expect(readCrawlCache(ORIGIN)).toBeNull();
  });
});
