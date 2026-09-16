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
  assessReadability,
  buildPageBlock,
  countUsableChars,
  crawlCacheSize,
  crawlPath,
  crawlSite,
  clearCrawlCache,
  emptyStaticMetadata,
  hashHtml,
  parseDocument,
  primeCrawlCache,
  readCrawlCache,
} from "./crawl";
import type { PageResult } from "./crawl";
import { MIN_USABLE_CHARS } from "./readability";

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
        static: emptyStaticMetadata(),
        heroH1: "stale",
        heroSub: "",
        headings: [],
        bodyText: "",
        ctas: [],
        text: "",
        htmlHash: "stale",
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

/* ------------------------------------------------------------------ */
/* Part C: static-text fallback                                        */
/* ------------------------------------------------------------------ */

/** A JS-rendered shell exactly like onyxx.app's: <title> BEFORE the meta
 * description, an empty #root, rich meta/OG/JSON-LD/noscript text. */
const SHELL_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Onyxx</title>
<meta name="description" content="Every creative deserves an agent. Onyxx is the AI booking manager for independent creatives." />
<meta property="og:title" content="Onyxx: the AI booking manager" />
<meta property="og:description" content="Get booked, get paid, keep your independence." />
<meta property="og:site_name" content="Onyxx" />
<meta name="twitter:title" content="Onyxx" />
<meta name="twitter:description" content="The AI booking manager for independent creatives." />
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "SoftwareApplication",
  "name": "Onyxx", "applicationCategory": "BusinessApplication",
  "slogan": "Every creative deserves an agent",
  "description": "An AI booking manager that runs scheduling and payments for creatives." }
</script>
</head><body><div id="root"></div>
<noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

/** A page with rendered copy AND metadata (the normal case). */
const RICH_HTML = `<!doctype html><html><head><title>Acme: category-defining widgets</title>
<meta name="description" content="Acme is the widget platform for logistics teams.">
</head><body><h1>Acme is the widget platform for logistics teams</h1>
<h2>Cut onboarding time</h2><p>Teams ship 40% faster.</p>
<a class="btn" href="/signup">Start free</a></body></html>`;

function page(path: string, html: string, over: Partial<PageResult> = {}): PageResult {
  return {
    path,
    status: 200,
    kind: "FOUND",
    htmlHash: hashHtml(html),
    ...parseDocument(html),
    ...over,
  };
}

describe("Part C: static-text fallback extraction", () => {
  test("the meta description is captured ALONGSIDE the title, never discarded", () => {
    const parsed = parseDocument(SHELL_HTML);
    // The onyxx bug: <title> came first, so the description was dropped.
    expect(parsed.title).toBe("Onyxx");
    expect(parsed.static.description).toBe(
      "Every creative deserves an agent. Onyxx is the AI booking manager for independent creatives.",
    );
  });

  test("meta description still wins when there is no <title> at all", () => {
    const parsed = parseDocument(
      `<html><head><meta name="description" content="Text-only fallback copy."></head><body></body></html>`,
    );
    expect(parsed.title).toBe("");
    expect(parsed.static.description).toBe("Text-only fallback copy.");
  });

  test("og:, twitter:, JSON-LD and noscript are first-class fields", () => {
    const st = parseDocument(SHELL_HTML).static;
    expect(st.ogTitle).toBe("Onyxx: the AI booking manager");
    expect(st.ogDescription).toBe("Get booked, get paid, keep your independence.");
    expect(st.ogSiteName).toBe("Onyxx");
    expect(st.twitterTitle).toBe("Onyxx");
    expect(st.twitterDescription).toBe("The AI booking manager for independent creatives.");
    expect(st.jsonLdName).toBe("Onyxx");
    expect(st.jsonLdApplicationCategory).toBe("BusinessApplication");
    expect(st.jsonLdSlogan).toBe("Every creative deserves an agent");
    expect(st.jsonLdDescription).toContain("AI booking manager");
    expect(st.noscript).toBe("You need to enable JavaScript to run this app.");
  });

  test("malformed JSON-LD is skipped without breaking the parse", () => {
    const parsed = parseDocument(
      `<html><head><title>T</title><script type="application/ld+json">{ not json </script></head><body><p>hi</p></body></html>`,
    );
    expect(parsed.static.jsonLdName).toBe("");
    expect(parsed.bodyText).toBe("hi");
  });

  test("JSON-LD inside an @graph is read too", () => {
    const parsed = parseDocument(
      `<html><head><script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Graphly","description":"Graph Organization."}]}</script></head><body><p>x</p></body></html>`,
    );
    expect(parsed.static.jsonLdName).toBe("Graphly");
    expect(parsed.static.jsonLdDescription).toBe("Graph Organization.");
  });

  test("the crawl block carries a labelled STATIC METADATA section (Part C3)", () => {
    const block = buildPageBlock(page("/", SHELL_HTML));
    expect(block).toContain("STATIC METADATA:");
    expect(block).toContain('META DESCRIPTION: "Every creative deserves an agent.');
    expect(block).toContain('OG SITE NAME: "Onyxx"');
    expect(block).toContain('JSON-LD APPLICATION CATEGORY: "BusinessApplication"');
    expect(block).toContain('NOSCRIPT: "You need to enable JavaScript to run this app."');
  });

  test("a page with no static metadata emits no STATIC METADATA section", () => {
    const parsed = parseDocument(`<html><head><title>Bare</title></head><body><p>x</p></body></html>`);
    expect(parsed.static).toEqual(emptyStaticMetadata());
    expect(buildPageBlock(page("/", `<html><head><title>Bare</title></head><body><p>x</p></body></html>`))).not.toContain(
      "STATIC METADATA:",
    );
  });

  test("rendered copy is still emitted before the metadata section", () => {
    const block = buildPageBlock(page("/", RICH_HTML));
    expect(block.indexOf("HERO H1:")).toBeLessThan(block.indexOf("STATIC METADATA:"));
    expect(block).toContain('META DESCRIPTION: "Acme is the widget platform for logistics teams."');
  });
});

/* ------------------------------------------------------------------ */
/* Part D: refuse to score what was not read                           */
/* ------------------------------------------------------------------ */

describe("Part D: usable-character counting and shell detection", () => {
  test("the threshold is 300 usable characters", () => {
    expect(MIN_USABLE_CHARS).toBe(300);
  });

  test("static metadata characters count toward the total (Part C4)", () => {
    const shell = page("/", SHELL_HTML);
    const counts = countUsableChars([shell]);
    // No rendered copy at all on the shell: every counted char is static.
    expect(counts.rendered).toBe(0);
    expect(counts.static).toBeGreaterThan(400);
    expect(counts.total).toBe(counts.rendered + counts.static);
    expect(counts.perPage[0].chars).toBe(counts.total);
    // A shell WITH rich metadata clears the char threshold: only the identical
    // page rule (below) can catch it, which is exactly the onyxx case.
    expect(counts.total).toBeGreaterThanOrEqual(MIN_USABLE_CHARS);
  });

  test("an empty shell with no metadata is under the threshold", () => {
    const bare = page("/", `<html><head><title>App</title></head><body><div id="root"></div></body></html>`);
    const counts = countUsableChars([bare, { ...bare, path: "/pricing" }]);
    expect(counts.total).toBeLessThan(MIN_USABLE_CHARS);
  });

  test("identical pages on every route are an SPA shell (identical_shell)", () => {
    const pages = [
      page("/", SHELL_HTML),
      page("/pricing", SHELL_HTML),
      page("/about", SHELL_HTML),
    ];
    const a = assessReadability(pages);
    expect(a.shellDetected).toBe(true);
    expect(a.reason).toBe("identical_shell");
    expect(a.readable).toBe(false);
    expect(a.identicalPaths).toEqual(["/", "/pricing", "/about"]);
    // Even though the shared document clears the character threshold.
    expect(a.total).toBeGreaterThanOrEqual(MIN_USABLE_CHARS);
  });

  test("distinct pages with real copy are readable", () => {
    const pages = [page("/", RICH_HTML), page("/pricing", RICH_HTML + "<p>Plans start at 20 dollars.</p>")];
    const a = assessReadability(pages);
    expect(a.shellDetected).toBe(false);
    expect(a.reason).toBeNull();
    expect(a.readable).toBe(true);
  });

  test("distinct but empty pages are low_content", () => {
    const bare = (p: string) =>
      page(p, `<html><head><title>App</title></head><body><div id="root" data-p="${p}"></div></body></html>`);
    const a = assessReadability([bare("/"), bare("/pricing"), bare("/about")]);
    expect(a.shellDetected).toBe(false);
    expect(a.reason).toBe("low_content");
    expect(a.readable).toBe(false);
    expect(a.total).toBeLessThan(MIN_USABLE_CHARS);
  });

  test("one readable page among 404s still scores (no shell, enough text)", () => {
    const notFound: PageResult = { ...page("/pricing", "<html></html>"), status: 404, kind: "NOT FOUND" };
    const about: PageResult = { ...page("/about", "<html></html>"), status: 404, kind: "NOT FOUND" };
    // A single real page (as on tldraw.com, where /pricing and /about 404) needs
    // at least MIN_USABLE_CHARS of its own text to be scoreable.
    const rich = page(
      "/",
      RICH_HTML.replace(
        "<p>Teams ship 40% faster.</p>",
        `<p>Teams ship 40% faster on every release, with one shared playbook for positioning, messaging and launch.</p>`,
      ),
    );
    const a = assessReadability([rich, notFound, about]);
    expect(a.total).toBeGreaterThanOrEqual(MIN_USABLE_CHARS);
    expect(a.shellDetected).toBe(false);
    expect(a.readable).toBe(true);
  });

  test("a crawl where nothing was reachable is low_content (no score)", () => {
    const a = assessReadability([
      { ...page("/", ""), status: 0, kind: "UNREACHABLE", htmlHash: "" },
      { ...page("/pricing", ""), status: 0, kind: "UNREACHABLE", htmlHash: "" },
    ]);
    expect(a.total).toBeLessThan(MIN_USABLE_CHARS);
    expect(a.reason).toBe("low_content");
    // Empty hashes must never be mistaken for identical pages.
    expect(a.shellDetected).toBe(false);
  });

  test("hashHtml is stable and length-sensitive", () => {
    expect(hashHtml(SHELL_HTML)).toBe(hashHtml(SHELL_HTML));
    expect(hashHtml("a")).not.toBe(hashHtml("b"));
    expect(hashHtml("ab")).not.toBe(hashHtml("a"));
  });

  test("crawled pages carry their raw-body hash", async () => {
    globalThis.fetch = (async () => html()) as unknown as typeof fetch;
    const pageResult = await crawlPath(ORIGIN, "/", signal());
    expect(pageResult.htmlHash).toBe(hashHtml(HTML));
  });
});
