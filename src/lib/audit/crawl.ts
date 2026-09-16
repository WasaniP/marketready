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
 *
 * Owner readability fix (Parts C + D):
 *   C1/C2 static-text fallback: meta[name=description] is captured as a
 *      FIRST-CLASS field on every page (it used to be only a title fallback, so
 *      it was silently discarded on any page with a <title>: the onyxx bug).
 *      og:title/description/site_name, twitter:title/description, JSON-LD
 *      (name/description/slogan/applicationCategory) and <noscript> contents are
 *      captured the same way and surfaced in a labelled STATIC METADATA section
 *      of the crawl block (C3).
 *   D1/D2 refuse to score what was not read: countUsableChars() + the
 *      MIN_USABLE_CHARS threshold and assessReadability() (identical-page hash
 *      detection) let the route return an unreadable state instead of a
 *      scorecard. Both are pure and unit-tested here.
 */

import { MIN_USABLE_CHARS, type UnreadableReason } from "./readability";

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

/** Static (non-rendered) text sources: the head metadata and the `<noscript>`
 * fallback. What a JS-rendered page actually ships in its HTML, and exactly
 * what a search engine / link preview / social scraper sees when it does not
 * run JavaScript. Part C: first-class fields, never dropped. */
export interface StaticMetadata {
  /** meta[name=description] (ALWAYS captured, even alongside a <title>). */
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogSiteName: string;
  twitterTitle: string;
  twitterDescription: string;
  jsonLdName: string;
  jsonLdDescription: string;
  jsonLdSlogan: string;
  jsonLdApplicationCategory: string;
  /** Visible text inside <noscript> blocks (the no-JS fallback copy). */
  noscript: string;
}

/** An all-empty StaticMetadata (same shape everywhere, no undefined checks). */
export function emptyStaticMetadata(): StaticMetadata {
  return {
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogSiteName: "",
    twitterTitle: "",
    twitterDescription: "",
    jsonLdName: "",
    jsonLdDescription: "",
    jsonLdSlogan: "",
    jsonLdApplicationCategory: "",
    noscript: "",
  };
}

export interface PageResult {
  path: string;
  status: number;
  kind: PageKind;
  title: string;
  metaTitle: string;
  /** Static, non-rendered text sources (Part C). */
  static: StaticMetadata;
  heroH1: string;
  heroSub: string;
  headings: { level: number; text: string }[];
  bodyText: string;
  ctas: string[];
  text: string;
  /** Hash of the raw response body. Two pages with the same hash are the same
   * document: a client-rendered SPA answers 200 on every route with one shell
   * (Part D2). Empty for non-FOUND pages. */
  htmlHash: string;
}

/** Everything the parser produces for one FOUND page (the route/crawler adds
 * the path, status, kind and the raw-body hash). */
export type ParsedPage = Omit<PageResult, "path" | "status" | "kind" | "htmlHash">;


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

/** Caps for the static metadata fields (Part C). */
const META_DESC_CAP = 320;
const SITE_NAME_CAP = 120;
const JSON_LD_CAP = 240;
const NOSCRIPT_CAP = 400;

/** `<script type="application/ld+json">...</script>` blocks, however the type
 * attribute is quoted/spaced. */
const JSON_LD_RE =
  /<script[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;

/** `<noscript>...</noscript>` blocks (the no-JS fallback copy). */
const NOSCRIPT_BLOCK_RE = /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi;

/** Strip tags/comments from a fragment and collapse whitespace (no entity
 * decoding, matching the structural parser's behaviour). */
function tagsToText(fragment: string): string {
  return stripDashes(
    fragment
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

/** Pull a value from a JSON-LD node: the first non-empty string found for one
 * of `keys`, searching the node and then one level of `@graph` / nested
 * objects (schema.org allows both shapes). */
function jsonLdField(node: unknown, keys: readonly string[], depth = 0): string {
  if (!node || typeof node !== "object" || depth > 3) return "";
  const obj = node as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v;
    if (Array.isArray(v)) {
      const hit = v.find((x) => typeof x === "string" && x.trim());
      if (typeof hit === "string") return hit;
    }
  }
  const children: unknown[] = [];
  if (Array.isArray(obj["@graph"])) children.push(...(obj["@graph"] as unknown[]));
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") children.push(v);
  }
  for (const child of children) {
    const hit = jsonLdField(child, keys, depth + 1);
    if (hit) return hit;
  }
  return "";
}

/** Extract the JSON-LD fields the rubric can use (name, description, slogan,
 * applicationCategory) from every ld+json block on the page. */
function extractJsonLd(html: string): Pick<
  StaticMetadata,
  "jsonLdName" | "jsonLdDescription" | "jsonLdSlogan" | "jsonLdApplicationCategory"
> {
  const out = {
    jsonLdName: "",
    jsonLdDescription: "",
    jsonLdSlogan: "",
    jsonLdApplicationCategory: "",
  };
  JSON_LD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = JSON_LD_RE.exec(html))) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON-LD is skipped, never fatal
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!out.jsonLdName) out.jsonLdName = clean(jsonLdField(node, ["name"]));
      if (!out.jsonLdDescription) {
        out.jsonLdDescription = jsonLdField(node, ["description"]).slice(0, JSON_LD_CAP).trim();
      }
      if (!out.jsonLdSlogan) out.jsonLdSlogan = clean(jsonLdField(node, ["slogan"]));
      if (!out.jsonLdApplicationCategory) {
        out.jsonLdApplicationCategory = clean(jsonLdField(node, ["applicationCategory"]));
      }
    }
  }
  return out;
}

/** Extract the visible text of every <noscript> block (Part C2). */
function extractNoscript(html: string): string {
  const parts: string[] = [];
  NOSCRIPT_BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NOSCRIPT_BLOCK_RE.exec(html))) {
    const text = tagsToText(m[1] ?? "");
    if (text) parts.push(text);
  }
  return parts.join(" ").slice(0, NOSCRIPT_CAP);
}

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
export function parseDocument(html: string): ParsedPage {
  const out: ParsedPage = {
    title: "",
    metaTitle: "",
    static: emptyStaticMetadata(),
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
    // meta tags: every static metadata field is captured FIRST-CLASS, alongside
    // the <title> (Part C1/C2). Nothing here is order-dependent any more: the
    // meta description used to be a title fallback and was discarded whenever a
    // <title> came first in the head, which is how a site that names its own
    // category and buyer in its meta description was reported as category-less.
    if (tag === "meta" && skipDepth === 0) {
      const name = (attrs.name || attrs.property || "").toLowerCase();
      const content = attrs.content || attrs.value || "";
      const st = out.static;
      if (name === "description" && !st.description) st.description = content.trim().slice(0, META_DESC_CAP);
      if (name === "og:title" && !st.ogTitle) st.ogTitle = clean(content);
      if (name === "og:description" && !st.ogDescription) st.ogDescription = clean(content);
      if (name === "og:site_name" && !st.ogSiteName) st.ogSiteName = content.trim().slice(0, SITE_NAME_CAP);
      if (name === "twitter:title" && !st.twitterTitle) st.twitterTitle = clean(content);
      if (name === "twitter:description" && !st.twitterDescription) {
        st.twitterDescription = clean(content);
      }
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
  // Static sources that live outside the element-stack walk (a <script>'s
  // contents are skipped for rendering, but its JSON-LD is real, machine-
  // readable positioning data; <noscript> is the site's own no-JS fallback).
  out.static = { ...out.static, ...extractJsonLd(html), noscript: extractNoscript(html) };
  out.text = stripDashes(rootText).slice(0, FULL_TEXT_CAP);
  return out;
}

/** Collect a closed element's structured text into the page result. */
function collectElement(el: StackEl, out: ParsedPage, chromeDepth: number) {
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

/** Longest per-page block sent to the model (rendered copy first, then the
 * STATIC METADATA section, so a long heading list can never truncate the
 * metadata of a thin, metadata-only page which is exactly where it matters). */
const PAGE_BLOCK_CAP = 4200;

/** The labelled STATIC METADATA lines for one page (Part C3). Only the fields
 * that actually carry text are emitted. */
export function staticMetadataLines(st: StaticMetadata): string[] {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value) lines.push(`  ${label}: "${value}"`);
  };
  push("META DESCRIPTION", st.description);
  push("OG TITLE", st.ogTitle);
  push("OG DESCRIPTION", st.ogDescription);
  push("OG SITE NAME", st.ogSiteName);
  push("TWITTER TITLE", st.twitterTitle);
  push("TWITTER DESCRIPTION", st.twitterDescription);
  push("JSON-LD NAME", st.jsonLdName);
  push("JSON-LD DESCRIPTION", st.jsonLdDescription);
  push("JSON-LD SLOGAN", st.jsonLdSlogan);
  push("JSON-LD APPLICATION CATEGORY", st.jsonLdApplicationCategory);
  push("NOSCRIPT", st.noscript);
  return lines;
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
  const meta = staticMetadataLines(p.static);
  if (meta.length) {
    lines.push(
      "STATIC METADATA:",
      "  (static page-head text and no-JS fallback: what a search engine, AI tool, link preview or social scraper reads when it does not run JavaScript)",
      ...meta,
    );
  }
  const block = lines.join("\n");
  return block.slice(0, PAGE_BLOCK_CAP);
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
function parsePageContent(html: string): ParsedPage {
  try {
    return parseDocument(html);
  } catch {
    // Parser failure must never kill the crawl: fall back to flat text, but
    // still capture the static metadata (that is the whole point of Part C).
    return {
      title: "",
      metaTitle: "",
      static: { ...emptyStaticMetadata(), ...extractJsonLd(html), noscript: extractNoscript(html) },
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
/* Readability: did we actually READ the site? (owner readability fix) */
/* ------------------------------------------------------------------ */

/** FNV-1a hash (32-bit, hex) of the raw response body, plus its length so two
 * different documents are never conflated by a hash collision. */
export function hashHtml(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${body.length.toString(36)}-${h.toString(16).padStart(8, "0")}`;
}

/** Usable-character accounting for one page. `rendered` is the text a browser
 * would show (hero H1 + hero subtext + headings + body + CTA labels); `static`
 * is the non-rendered text (title, meta/OG/Twitter head fields, JSON-LD,
 * noscript). Both feed the threshold (Parts D1 + C4). */
export interface PageCharCount {
  path: string;
  kind: PageKind;
  chars: number;
  rendered: number;
  static: number;
  htmlHash: string;
}

export interface UsableChars {
  total: number;
  rendered: number;
  static: number;
  perPage: PageCharCount[];
}

const len = (s: string | undefined): number => (s ? s.length : 0);

/** Count the usable extracted characters of one page. */
export function pageCharCount(p: PageResult): PageCharCount {
  const st = p.static ?? emptyStaticMetadata();
  const rendered =
    len(p.heroH1) +
    len(p.heroSub) +
    p.headings.reduce((sum, h) => sum + len(h.text), 0) +
    len(p.bodyText) +
    p.ctas.reduce((sum, c) => sum + len(c), 0);
  const staticChars =
    len(p.title) +
    len(p.metaTitle) +
    len(st.description) +
    len(st.ogTitle) +
    len(st.ogDescription) +
    len(st.ogSiteName) +
    len(st.twitterTitle) +
    len(st.twitterDescription) +
    len(st.jsonLdName) +
    len(st.jsonLdDescription) +
    len(st.jsonLdSlogan) +
    len(st.jsonLdApplicationCategory) +
    len(st.noscript);
  return {
    path: p.path,
    kind: p.kind,
    chars: rendered + staticChars,
    rendered,
    static: staticChars,
    htmlHash: p.htmlHash ?? "",
  };
}

/** Total usable extracted characters across every crawled page, with the
 * rendered/static split and the per-page numbers kept for the server log so
 * the threshold can be tuned with real data. */
export function countUsableChars(pages: PageResult[]): UsableChars {
  const perPage = pages.map(pageCharCount);
  return {
    total: perPage.reduce((sum, p) => sum + p.chars, 0),
    rendered: perPage.reduce((sum, p) => sum + p.rendered, 0),
    static: perPage.reduce((sum, p) => sum + p.static, 0),
    perPage,
  };
}

export interface ReadabilityAssessment extends UsableChars {
  /** True when the diagnostic may score this site. */
  readable: boolean;
  /** Why it may not (null when readable). identical_shell takes precedence
   * over low_content: identical pages mean /pricing and /about were never
   * actually read, whatever the shared document's character count. */
  reason: UnreadableReason | null;
  /** True when every FOUND page returned byte-identical content (a
   * client-rendered SPA answers 200 on every route with the same shell). */
  shellDetected: boolean;
  /** The paths that shared one identical document (empty when none). */
  identicalPaths: string[];
}

/**
 * Decide whether the crawl read enough of the site to score it at all.
 *
 *  1. IDENTICAL SHELL (D2): every FOUND page returned the same bytes. A
 *     client-rendered SPA rewrites unknown paths to one shell with HTTP 200, so
 *     /pricing and /about were never really read. Distinct reason so it is
 *     diagnosable which rule fired.
 *  2. LOW CONTENT (D1): the pages yielded fewer than MIN_USABLE_CHARS usable
 *     characters in total (rendered copy plus the Part C static fields).
 *
 * Either way the caller must NOT call the model and must return the unreadable
 * state instead of a scorecard.
 */
export function assessReadability(pages: PageResult[]): ReadabilityAssessment {
  const counts = countUsableChars(pages);
  const found = pages.filter((p) => p.kind === "FOUND" && (p.htmlHash ?? ""));
  const byHash = new Map<string, string[]>();
  for (const p of found) {
    const list = byHash.get(p.htmlHash);
    if (list) list.push(p.path);
    else byHash.set(p.htmlHash, [p.path]);
  }
  let identicalPaths: string[] = [];
  for (const paths of byHash.values()) {
    if (paths.length >= 2 && paths.length === found.length) {
      identicalPaths = paths;
      break;
    }
  }
  const shellDetected = identicalPaths.length >= 2;
  const lowContent = counts.total < MIN_USABLE_CHARS;
  const reason: UnreadableReason | null = shellDetected
    ? "identical_shell"
    : lowContent
      ? "low_content"
      : null;
  return {
    ...counts,
    readable: reason === null,
    reason,
    shellDetected,
    identicalPaths,
  };
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
    static: emptyStaticMetadata(),
    heroH1: "",
    heroSub: "",
    headings: [],
    bodyText: "",
    ctas: [],
    text: "",
    htmlHash: "",
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
    // The raw-body hash is what makes an identical SPA shell detectable
    // (Part D2): every route answering 200 with the same document.
    return {
      page: {
        ...base,
        status: res.status,
        kind: "FOUND",
        htmlHash: hashHtml(html),
        ...parsePageContent(html),
      },
      retry: false,
    };
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
