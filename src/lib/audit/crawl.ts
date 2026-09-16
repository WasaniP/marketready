/**
 * Multi-page site crawler + DOM extraction for /api/diagnose.
 *
 * Extracted from the route (owner spec 2026-09-15) so the crawl behaviour is
 * unit-testable in isolation: the path set, the per-page timeout, the single
 * retry with backoff, the crawl budget, and the 24h parsed-page cache.
 *
 * Owner spec changes in this module:
 *   2.3 exactly 3 paths (/, /pricing, /about); per-page 10s; budget 30s; ONE
 *       retry per page on timeout OR non-200 after a 500ms backoff.
 *   2.4 the parsed PageResult[] is cached per normalized origin for 24h, so a
 *       repeat submission of the same origin scores against the identical
 *       crawl block (a determinism source, not just a speed-up).
 */

/** Per-page request timeout. */
export const PAGE_TIMEOUT_MS = 10000;
/** Overall crawl budget (all pages combined). */
export const CRAWL_BUDGET_MS = 30000;
/** One retry per page, after this backoff. */
export const RETRY_BACKOFF_MS = 500;
/** Parsed crawls are reused for this long, keyed by normalized origin. */
export const CRAWL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Core pages, in priority order. Exactly these three (owner spec Part 2.3). */
export const CRAWL_PATHS = ["/", "/pricing", "/about"];

/** Browser-ish user agent so normal sites respond. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type PageKind = "FOUND" | "NOT FOUND" | "UNREACHABLE" | "NON-HTML";

export interface PageResult {
  path: string;
  status: number;
  kind: PageKind;
  title: string;
  metaTitle: string;
  heroH1: string;
  heroSub: string;
  headings: { level: number; text: string }[];
  bodyText: string;
  ctas: string[];
  text: string;
}

/* ------------------------------------------------------------------ */
/* Structural DOM extraction (tolerant, zero-dependency HTML parser)    */
/* ------------------------------------------------------------------ */

/** Strip any em/en dashes defensively (honors the no-dash constraint even if
 * the model slips one in) and collapse leftover whitespace. */
function stripDashes(s: string): string {
  return s
    .replace(/\u2014|\u2013|\u2012|\u2015|—|–/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const clean = (s: string): string => stripDashes(s).slice(0, 240);

/** Elements whose content is hidden from the rendered page. */
const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "math",
  "iframe",
  "object",
  "canvas",
  "textarea",
  "select",
  "option",
  "head",
]);

/** Site chrome (nav/header/footer/aside) excluded from hero/headings/body
 * extraction so the model sees the page's message structure, not the shell. */
const CHROME_TAGS = new Set(["nav", "header", "footer", "aside"]);

const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/** Block-level tags that make up the page's readable body copy. */
const BODY_TAGS = new Set(["p", "li", "blockquote", "td", "th", "dd", "dt", "figcaption", "cite"]);

/** Caps so the prompt stays compact. */
const HERO_H1_CAP = 200;
const HERO_SUB_CAP = 240;
const HEADING_TEXT_CAP = 140;
const MAX_HEADINGS = 14;
const BODY_CHARS = 1600;
const MAX_CTAS = 8;
const CTA_TEXT_CAP = 80;
const FULL_TEXT_CAP = 1800;

interface StackEl {
  tag: string;
  text: string;
  attrs: Record<string, string>;
  skip: boolean;
}

/** Void elements that carry no text content. */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);

/** Parse `<...>` tag tokens (start/end/self-closing), comments, doctype, and
 * text. The doctype/PI branches exist so `<!DOCTYPE html>` is consumed and
 * skipped instead of leaking into the text branch. */
const TOKEN_RE =
  /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|<!DOCTYPE[^>]*>|<\?[^>]*\?>|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|[^<]+/g;

/** Parse an attribute string into a name → value map. */
function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][a-zA-Z0-9:_.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

/** True for anchor tags styled as buttons (class contains btn/cta/button) or
 * clearly pointing at a primary conversion action. */
const CTA_LINK_RE = /(^|\s)(btn|cta|button|primary|signup|sign-up)(\s|$)/i;
const CTA_HREF_RE = /(signup|sign-up|buy|purchase|trial|demo|book|start|download-free|get-started)/i;

/** Parse one HTML document into its structural parts. */
export function parseDocument(html: string): Omit<PageResult, "path" | "status" | "kind"> {
  const out: Omit<PageResult, "path" | "status" | "kind"> = {
    title: "",
    metaTitle: "",
    heroH1: "",
    heroSub: "",
    headings: [],
    bodyText: "",
    ctas: [],
    text: "",
  };
  const stack: StackEl[] = [];
  let skipDepth = 0;
  let chromeDepth = 0;
  let rootText = "";

  const pushText = (raw: string) => {
    const t = stripDashes(raw);
    if (!t) return;
    if (skipDepth > 0) return; // inside script/style/etc: drop entirely
    if (stack.length > 0 && !stack[stack.length - 1].skip) {
      stack[stack.length - 1].text += (stack[stack.length - 1].text ? " " : "") + t;
    } else if (stack.length === 0) {
      rootText += (rootText ? " " : "") + t;
    }
  };

  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(html))) {
    const token = m[0];
    if (token.startsWith("<!--") || token.startsWith("<![CDATA[") || token.startsWith("<!") || token.startsWith("<?")) {
      continue; // comment / CDATA / doctype / processing instruction
    }
    if (!token.startsWith("<")) {
      pushText(token);
      continue;
    }
    const isEnd = token.startsWith("</");
    const rawTag = m[1] ?? "";
    const tag = rawTag.toLowerCase();
    const attrsStr = m[2] ?? "";
    const selfClose = (m[3] ?? "") === "/" || VOID_TAGS.has(tag);
    if (!tag) continue; // stray '<' or doctype-ish token

    if (isEnd) {
      const el = stack.pop();
      if (!el || el.tag !== tag) {
        // Mismatched close: cheap tolerance, just continue.
        continue;
      }
      if (SKIP_TAGS.has(el.tag)) skipDepth = Math.max(0, skipDepth - 1);
      if (CHROME_TAGS.has(el.tag)) chromeDepth = Math.max(0, chromeDepth - 1);
      if (skipDepth === 0) collectElement(el, out, chromeDepth);
      if (el.text && !SKIP_TAGS.has(el.tag)) {
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          parent.text += (parent.text ? " " : "") + el.text;
        } else {
          rootText += (rootText ? " " : "") + el.text;
        }
      }
      continue;
    }

    const attrs = parseAttrs(attrsStr);
    // meta tags: read title/description at push time.
    if (tag === "meta" && skipDepth === 0) {
      const name = (attrs.name || attrs.property || "").toLowerCase();
      const content = attrs.content || attrs.value || "";
      if (name === "description" && !out.title) out.title = clean(content);
      if ((name === "og:title" || name === "twitter:title") && !out.metaTitle) {
        out.metaTitle = clean(content);
      }
    }
    if (tag === "head" || tag === "meta" || tag === "link" || tag === "base" || tag === "br") {
      // Never pushed to the stack; meta/link read above.
      continue;
    }
    const el: StackEl = { tag, text: "", attrs, skip: SKIP_TAGS.has(tag) };
    if (el.skip) skipDepth++;
    else if (CHROME_TAGS.has(tag)) chromeDepth++;
    if (selfClose) continue; // void/self-closing: no text content to collect
    stack.push(el);
  }

  if (!out.title && out.metaTitle) out.title = out.metaTitle;
  out.text = stripDashes(rootText).slice(0, FULL_TEXT_CAP);
  return out;
}

/** Collect a closed element's structured text into the page result. */
function collectElement(
  el: StackEl,
  out: Omit<PageResult, "path" | "status" | "kind">,
  chromeDepth: number,
) {
  const tag = el.tag;
  const text = clean(el.text);
  if (!text) return;
  const inChrome = chromeDepth > 0;
  if (tag === "title" && !out.title) {
    out.title = text;
    return;
  }
  if (tag === "button") {
    // CTA buttons matter everywhere (header CTAs included): conversion signal.
    if (out.ctas.length < MAX_CTAS) out.ctas.push(text.slice(0, CTA_TEXT_CAP));
    return;
  }
  if (tag === "a") {
    const cls = el.attrs.class || "";
    const href = el.attrs.href || "";
    if (
      CTA_LINK_RE.test(cls) ||
      CTA_HREF_RE.test(href) ||
      /(get-a-.+|start-.+|capture-the-.+)/i.test(text)
    ) {
      if (out.ctas.length < MAX_CTAS) out.ctas.push(text.slice(0, CTA_TEXT_CAP));
    }
    return;
  }
  if (inChrome) return; // skip hero/headings/body inside nav/footer/header/aside
  const level = HEADING_LEVELS[tag];
  if (level && level <= 4) {
    if (level === 1 && !out.heroH1) {
      out.heroH1 = text.slice(0, HERO_H1_CAP);
    } else if (level >= 2 && !out.heroSub && out.heroH1) {
      out.heroSub = text.slice(0, HERO_SUB_CAP);
    }
    if (out.headings.length < MAX_HEADINGS) {
      const last = out.headings[out.headings.length - 1];
      const short = text.slice(0, HEADING_TEXT_CAP);
      if (!last || last.text !== short) {
        out.headings.push({ level, text: short });
      }
    }
    return;
  }
  if (BODY_TAGS.has(tag)) {
    const body = out.bodyText;
    if (body.length < BODY_CHARS) {
      out.bodyText = body ? `${body}\n  ${text}` : text;
    }
  }
}

/** Build the structured per-page block for the model prompt. */
export function buildPageBlock(p: PageResult): string {
  if (p.kind !== "FOUND") {
    const label = p.path === "/" ? "Homepage " : p.path;
    return `[${label}] -> ${p.kind}${p.status ? ` (HTTP ${p.status})` : ""}: no content indexed for this dimension. Hard structural gap.`;
  }
  const label = p.path === "/" ? "Homepage " : p.path;
  const lines: string[] = [`[${label}] -> FOUND (HTTP ${p.status})`];
  if (p.title) lines.push(`TITLE: "${p.title}"`);
  if (p.metaTitle && p.metaTitle !== p.title) lines.push(`META TITLE: "${p.metaTitle}"`);
  if (p.heroH1) lines.push(`HERO H1: "${p.heroH1}"`);
  if (p.heroSub) lines.push(`HERO SUBTEXT: "${p.heroSub}"`);
  if (p.headings.length) {
    lines.push("HEADING HIERARCHY:");
    for (const h of p.headings) {
      lines.push(`  ${"H" + h.level}: ${h.text}`);
    }
  }
  if (p.bodyText) {
    lines.push("BODY TEXT:");
    lines.push(`  ${p.bodyText}`);
  }
  if (p.ctas.length) {
    lines.push(`CTAs: ${p.ctas.map((c) => `"${c}"`).join(" | ")}`);
  }
  const block = lines.join("\n");
  return block.slice(0, 3200);
}

/** Fallback flat text (used only when a page yields no structured content). */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse page HTML into structured parts; fall back to flat text on failure. */
function parsePageContent(html: string): Omit<PageResult, "path" | "status" | "kind"> {
  try {
    return parseDocument(html);
  } catch {
    // Parser failure must never kill the crawl: fall back to flat text.
    return {
      title: "",
      metaTitle: "",
      heroH1: "",
      heroSub: "",
      headings: [],
      bodyText: stripDashes(extractText(html)).slice(0, BODY_CHARS),
      ctas: [],
      text: stripDashes(extractText(html)).slice(0, FULL_TEXT_CAP),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

function emptyPage(path: string): PageResult {
  return {
    path,
    status: 0,
    kind: "UNREACHABLE",
    title: "",
    metaTitle: "",
    heroH1: "",
    heroSub: "",
    headings: [],
    bodyText: "",
    ctas: [],
    text: "",
  };
}

/** Fetch a URL with a per-request timeout, tied to a shared top-level signal
 * (so the global AbortController can cut the whole crawl short). */
async function fetchHtml(
  url: string,
  pageMs: number,
  topSignal: AbortSignal,
): Promise<Response> {
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (topSignal.aborted) c.abort();
  else topSignal.addEventListener("abort", onAbort, { once: true });
  const t = setTimeout(() => c.abort(), pageMs);
  try {
    return await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(t);
    topSignal.removeEventListener("abort", onAbort);
  }
}

/** Sleep, resolving false when the signal aborts first (so an aborted crawl
 * never waits out a backoff). */
function sleepWithSignal(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** One fetch attempt for a path. `retry` marks a failure worth exactly one
 * more try (timeout, network error, or any non-200). */
async function attemptPage(
  origin: string,
  path: string,
  pageMs: number,
  topSignal: AbortSignal,
): Promise<{ page: PageResult; retry: boolean }> {
  const base = emptyPage(path);
  try {
    const res = await fetchHtml(origin + path, pageMs, topSignal);
    if (!res.ok) {
      return {
        page: {
          ...base,
          status: res.status,
          kind: res.status === 404 ? "NOT FOUND" : "UNREACHABLE",
        },
        retry: true,
      };
    }
    const type = res.headers.get("content-type") || "";
    const html = await res.text();
    if (!type.includes("text/html") && !type.includes("text/plain")) {
      return { page: { ...base, status: res.status, kind: "NON-HTML" }, retry: false };
    }
    return { page: { ...base, status: res.status, kind: "FOUND", ...parsePageContent(html) }, retry: false };
  } catch {
    // per-page timeout, network failure, or shared budget abort
    return { page: base, retry: true };
  }
}

/** Crawl ONE path: one attempt, then AT MOST one retry after RETRY_BACKOFF_MS
 * on timeout or non-200. The final outcome is reported exactly as before
 * (UNREACHABLE / NOT FOUND / NON-HTML). */
export async function crawlPath(
  origin: string,
  path: string,
  signal: AbortSignal,
): Promise<PageResult> {
  const first = await attemptPage(origin, path, PAGE_TIMEOUT_MS, signal);
  if (!first.retry || signal.aborted) return first.page;
  const slept = await sleepWithSignal(RETRY_BACKOFF_MS, signal);
  if (!slept || signal.aborted) return first.page;
  const second = await attemptPage(origin, path, PAGE_TIMEOUT_MS, signal);
  return second.page;
}

/** Uncached crawl of the 3 canonical paths. One shared budget timer
 * (CRAWL_BUDGET_MS) aborts all in-flight fetches if the crawl runs too long,
 * and it is also tied to the top-level AbortController so the global request
 * bound still applies. */
export async function crawlOrigin(origin: string, topSignal: AbortSignal): Promise<PageResult[]> {
  const crawlAbort = new AbortController();
  const onTopAbort = () => crawlAbort.abort();
  if (topSignal.aborted) crawlAbort.abort();
  else topSignal.addEventListener("abort", onTopAbort, { once: true });
  const budgetTimer = setTimeout(() => crawlAbort.abort(), CRAWL_BUDGET_MS);
  const results = await Promise.all(
    CRAWL_PATHS.map((path) => crawlPath(origin, path, crawlAbort.signal)),
  );
  clearTimeout(budgetTimer);
  topSignal.removeEventListener("abort", onTopAbort);
  return results;
}

/* ------------------------------------------------------------------ */
/* Parsed-crawl cache (keyed by normalized origin, 24h TTL)             */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  pages: PageResult[];
  at: number;
}

const crawlCache = new Map<string, CacheEntry>();

/** Read a cached crawl. Expired entries are dropped and treated as a miss. */
export function readCrawlCache(origin: string, now: number = Date.now()): PageResult[] | null {
  const hit = crawlCache.get(origin);
  if (!hit) return null;
  if (now - hit.at > CRAWL_CACHE_TTL_MS) {
    crawlCache.delete(origin);
    return null;
  }
  return hit.pages;
}

/** Store a parsed crawl for an origin. */
export function writeCrawlCache(
  origin: string,
  pages: PageResult[],
  now: number = Date.now(),
): void {
  crawlCache.set(origin, { pages, at: now });
}

/** Test/inspection helpers. */
export function crawlCacheSize(): number {
  return crawlCache.size;
}
export function clearCrawlCache(): void {
  crawlCache.clear();
}
/** Seed an entry with an explicit timestamp (used by TTL tests). */
export function primeCrawlCache(origin: string, pages: PageResult[], at: number): void {
  crawlCache.set(origin, { pages, at });
}

/**
 * Crawl the 3 canonical paths for an origin, reusing the cached parse within
 * the TTL so a repeat submission scores against an identical crawl block.
 *
 * A crawl where NOTHING was readable (every path UNREACHABLE: DNS failure,
 * outage, blocked) is deliberately NOT cached: that is a transient failure the
 * user's Retry should be able to recover from, and it yields no score anyway.
 */
export async function crawlSite(origin: string, topSignal: AbortSignal): Promise<PageResult[]> {
  const cached = readCrawlCache(origin);
  if (cached) return cached;
  const pages = await crawlOrigin(origin, topSignal);
  if (pages.some((p) => p.kind === "FOUND")) writeCrawlCache(origin, pages);
  return pages;
}

/** Build the "STRUCTURED SITE CRAWL" block string (real fetched content). */
export function buildCrawlBlock(pages: PageResult[]): string {
  return pages.map(buildPageBlock).join("\n\n---\n\n");
}
