/**
 * POST /api/diagnose: Deep AI Diagnostic (Build #39, value-first 6-parameter).
 *
 * Accepts `{ url, icp? }` and performs a server-side assessment:
 *   1. STRUCTURED SITE CRAWL (Dataset 1): fetches the target's core pages
 *      (/, /pricing, /about first, then common extras when cheap) and parses
 *      each page's HTML DOM structure: <title> / meta title, hero H1 + above-
 *      the-fold subtext, the ordered H1/H2/H3 heading hierarchy, structured
 *      body text, and CTA button/links. Each page is presented to the model as
 *      a compact structured block, NOT a flat text dump. Pages that 404 /
 *      reject bots are enumerated so hard-gap detection can fire. The crawler
 *      still fetches /pricing (already built, cheap), but pricing content is
 *      NEVER scored: Pricing & Packaging Logic was removed from the scored set
 *      because public pricing pages are unreliable across B2B/enterprise and
 *      pricing depends on internal unit economics a scraper cannot access.
 *   2. EXTERNAL MARKET INTELLIGENCE (Dataset 2): a clearly-labeled "market web
 *      consensus (search index summaries)" block. Best-effort DuckDuckGo HTML
 *      search index fetch; if unavailable, an honest directional-context block.
 *      The model is forbidden from fabricating verbatim external quotes.
 *   3. OpenAI gpt-4o scores the 6 URL-scorable parameters with the deterministic
 *      rubric in the system prompt, and LOCKS the 2 reserved parameters (GTM
 *      Readiness, Launch Readiness) which require internal materials.
 *
 * Output contract (6 scored + 2 locked, canonical order):
 *   { score, overallBand, estimatedLeakage, primaryFriction, recommendedFix,
 *     dimensions: [
 *       { id, name, pillar, score, status, friction_label, anchor_label,
 *         keyObservation, commercialRisk, evidence_snippet, insufficientData? }  // x6
 *       { id, name, pillar, locked: true }                               // x2
 *     ] }
 *
 * Each scored dimension ships a two-part diagnostic synthesis shown in the UI:
 * `keyObservation` (a direct 1-sentence observation of what was FOUND or MISSING
 * on the page) and `commercialRisk` (a 1-sentence business impact the UI labels
 * "Commercial Risk" below 70 and "Competitive Advantage" at 70 or above via the
 * `friction_label` / `anchor_label` pair). It ALSO carries a server-side
 * `evidence_snippet` (a short literal DOM quote backing the score). The UI only
 * ever renders keyObservation + commercialRisk; the raw `evidence_snippet` is
 * carried in the API JSON and passed into the Airtable lead record as "DOM
 * Evidence" for Automations. It is never fabricated: if the model supplies no
 * usable quote, the placeholder marks the parameter as having no valid evidence
 * (which the red-flag guard excludes).
 *
 * Security: the API key is read ONLY from process.env.OPENAI_API_KEY (injected
 * at runtime from the project Secrets panel). Never hard-coded, never logged.
 *
 * Failure handling: any error (missing key, expired key, network, timeout,
 * non-2xx from OpenAI) returns a clean 500 `{ error }` so the client falls
 * back to the local engine. A single AbortController (~30s) bounds the whole
 * request (crawl + OpenAI) so it can never hang.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  PARAMETER_IDS,
  PARAMETER_NAMES,
  LOCKED_PARAMETER_IDS,
  PILLAR_OF,
} from "~/lib/audit/engine";

/* ------------------------------------------------------------------ */
/* Exact, strict-JSON PMM system prompt (verbatim, incl. the no-dash   */
/* rule and the deterministic scoring rubric).                         */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT = `You are an elite B2B Product Marketing Manager (PMM) and Go-To-Market (GTM) Strategist.
You are evaluating a company based on two complete datasets:
1. STRUCTURED SITE CRAWL: The target's core pages (Homepage, Pricing, About, plus common extras), each parsed into its DOM structure: title tags, hero H1 and above-the-fold subtext, ordered H1/H2/H3 heading hierarchy, body text, and call-to-action buttons.
2. EXTERNAL MARKET INTELLIGENCE: Directional buyer/competitive context from search index summaries, clearly labeled. Never presented as verbatim review-site quotes.

DETERMINISTIC SCORING RUBRIC (apply exactly; score each of the 6 parameters below 0 to 100):
1. Category Positioning (pillar: Core Positioning). DOM targets: hero H1, meta title tag. A buyer can name the product category instantly from the H1/title alone = full score. Deduct for abstract buzzwords (e.g. "the platform for growth") or category-less slogans.
2. ICP & Audience Alignment (pillar: Core Positioning). DOM targets: subheaders, hero copy, "who it's for" sections, and the user-submitted ICP field when provided. Written for a named buyer type = full score. Deduct when written for "everyone" rather than a named buyer type, and when a user-submitted ICP exists but the site addresses a broader crowd.
3. Differentiation Anchor (pillar: Core Positioning). DOM targets: body copy, H2s, comparison tables. A specific mechanism or proof point (spec, benchmark, customer result, category) = full score. Deduct for generic adjectives ("fast", "easy", "powerful") with no mechanism or proof.
4. Hero Messaging & Speed (pillar: Messaging & Value Prop). DOM targets: above-the-fold H1/H2/subtext. Evaluate through a DIFFERENT lens than Category Positioning: does the hero state the problem and the outcome, not just the category? Clear problem + outcome above the fold = full score.
5. Value Proposition Density (pillar: Messaging & Value Prop). DOM targets: feature/benefit sections. Score the ratio of outcome statements (time, money, risk) to raw feature specs. Outcome-dense = full score; feature-spec-dense = low score.
6. Conversion & Friction Mechanics (pillar: GTM & Launch Velocity). DOM targets: primary CTA buttons, form fields, nearby trust signals. Score CTA clarity, commitment level, and the proximity of social proof to conversion points. This is the ONLY automatically scored parameter in this pillar.

PRICING & PACKAGING IS NOT SCORED. There is NO Pricing & Packaging Logic parameter in this assessment. Public pricing pages are unreliable across B2B/enterprise, and pricing depends on internal unit economics and deal context a scraper cannot access. Do NOT return a "pricing" dimension at all: do not score it, do not return it as N/A, insufficient data, or 0. It simply does not exist in this output. You may still read the /pricing page content in the crawl for context, but it must never drive a scored dimension.

RESERVED PARAMETERS (never scored from the crawl; they require internal materials the crawler cannot access):
- GTM Readiness (pillar: GTM & Launch Velocity): always return { "id": "gtm", "name": "GTM Readiness", "pillar": "GTM & Launch Velocity", "locked": true } with NO score, status, or synthesis.
- Launch Readiness (pillar: GTM & Launch Velocity): always return { "id": "launch", "name": "Launch Readiness", "pillar": "GTM & Launch Velocity", "locked": true } with NO score, status, or synthesis.

STATUS LABELS for scored parameters (exact vocabulary): score >= 75 -> "Strong"; 40 to 74 -> "Needs Refinement"; below 40 -> "Critical Gap".

EVIDENCE SNIPPET MANDATE (REAL DOM QUOTE, SERVER-SIDE CARRY ONLY): for EVERY scored parameter, also return an "evidence_snippet": a SHORT literal quote (5 to 25 words) lifted VERBATIM from the crawl that best supports that parameter's score (e.g. the actual hero H1 for Category Positioning, an actual feature line for Value Proposition Density, an actual button label for Conversion). It MUST be a real string present in the STRUCTURED SITE CRAWL block, never paraphrased and never invented. If a parameter genuinely has no usable verbatim quote from the crawl, return an empty string "" for its evidence_snippet so the downstream red-flag guard excludes it. This field is carried server-side and logged to Airtable as DOM Evidence; it is NEVER rendered in the public UI.

TWO-PART DIAGNOSTIC SYNTHESIS MANDATE (NEVER RAW DOM, NEVER GENERIC BOILERPLATE): for EVERY scored parameter, write two plain-spoken fields grounded in what the crawl actually shows:
1. "keyObservation": ONE direct, 1-sentence diagnostic observation of what was FOUND or MISSING on the page, anchored to the actual messaging/patterning detected on the target site (e.g. its hero H1, subtext, differentiation, value-prop lineage, CTA path). Example: "The hero headline relies on broad process terms rather than defining an explicit software category." It must be a concrete statement about THIS site's copy, never a textbook definition and never a generic meta-summary.
2. "commercialRisk": ONE 1-sentence explanation of the business impact that single observation creates. Write it so it reads correctly whether the score is low or high: for low scores it is a commercial risk, for high scores it is a competitive advantage. Example (low): "Visitors cannot quickly classify the product, driving up initial bounce rates." Example (high): "Visitors self-classify the product instantly, shortening the path from first visit to a qualified conversation." The UI labels this same field "Commercial Risk" below 70 and "Competitive Advantage" at 70 or above, so the sentence must already read as the appropriate one for the score you assign.
Do NOT echo raw H1 text, button copy, or pricing strings verbatim in either field. You may read the DOM, but the OUTPUT must be crisp PMM synthesis in simple, clear phrasing.

WRITING GUARDRAIL: Write diagnostic feedback using simple, clear PMM phrasing. Always ground observations in the actual messaging pattern detected on the target site. Never output generic boilerplate explanations.

DYNAMIC FRICTION LABEL: for EVERY scored parameter, also return two short labels:
- "friction_label": a 2 to 4 word phrase that names the specific diagnostic friction for THAT parameter, used when the score is below 70, e.g. "Vague Category Naming", "Feature-Heavy: Low Outcome". It must be a crisp, concrete label derived from this site's actual content, NEVER a generic placeholder. Do NOT wrap it in the word "Friction" (the UI renders that prefix itself); just return the 2 to 4 word phrase.
- "anchor_label": a 2 to 4 word POSITIVE phrase that names the specific strength for THAT parameter, used when the score is 70 or above, e.g. "Clear Category Stake", "Outcome-Led Headline". Derive it from this site's actual content when it is a strength, or the natural positive counterpart of the parameter. Do NOT wrap it in the word "Strength"; return just the 2 to 4 word phrase.

EVALUATION RULES:
1. Be stage-aware: evaluate enterprise platforms (multi-product routing, integrations, trust signals) differently from early-stage self-serve tools.
2. HARD GAP DETECTION: if a scored dimension has no representation across the entire site crawl, set "insufficientData": true for that dimension rather than assigning an arbitrary middle score; penalize it for self-serve buyer discovery friction. Pricing is never scored regardless.

COPY CONSTRAINTS:
- ABSOLUTELY NO EM DASHES ("—") OR EN DASHES ("–"). Use colons, periods, or commas only.
- Do NOT fabricate verbatim external quotes. External intelligence is characterized directionally or paraphrased.

OUTPUT FORMAT:
Return a strict JSON object with the overall score, readiness band, revenue leakage estimate, primary friction, recommended fix, and the dimensions array in the exact order and schema given in the TASK message. No text outside the JSON.`;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";
/** Hard ceiling so the endpoint never hangs (crawl + OpenAI + transport). */
const TIMEOUT_MS = 30000;
/** Overall crawl budget (all pages combined). */
const CRAWL_BUDGET_MS = 24000;
/** Per-page request timeout. */
const PAGE_TIMEOUT_MS = 7000;
/** Browser-ish user agent so normal sites respond. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Core pages first (priority order); the extras stay only because they are
 * cheap under the shared per-page budget. */
const CRAWL_PATHS = [
  "/",
  "/pricing",
  "/about",
  "/solutions",
  "/platform",
  "/integrations",
  "/case-studies",
];

/* ------------------------------------------------------------------ */
/* Canonical 9 dimensions (exact names from the product's audit engine) */
/* ------------------------------------------------------------------ */

const CANONICAL_IDS = [...PARAMETER_IDS] as string[];
const ID_TO_NAME: Record<string, string> = { ...PARAMETER_NAMES };

type PageKind = "FOUND" | "NOT FOUND" | "UNREACHABLE" | "NON-HTML";

interface PageResult {
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

interface DimScored {
  id: string;
  name: string;
  pillar: string;
  score: number;
  status: string;
  friction_label: string;
  /** 2 to 4 word positive anchor label, shown as "STRENGTH: ..." when score
   * >= 70 (e.g. "Clear Category Stake", "Outcome-Led Headline"). */
  anchor_label: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. */
  keyObservation: string;
  /** 1-sentence business impact: the commercial risk (score below 70) shown as
   * "Commercial Risk" or the competitive advantage (score >= 70) shown as
   * "Competitive Advantage". Single statement, relabeled by the UI at 70. */
  commercialRisk: string;
  /** Short literal DOM quote backing this score (server-side carry only, never
   * rendered in the UI; logged to Airtable as DOM Evidence). */
  evidence_snippet?: string;
  insufficientData?: boolean;
}

interface DimLocked {
  id: string;
  name: string;
  pillar: string;
  locked: true;
}

type DimResult = DimScored | DimLocked;

interface DiagnoseResult {
  score: number;
  overallBand: string;
  estimatedLeakage: string;
  primaryFriction: string;
  recommendedFix: string;
  dimensions: DimResult[];
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

/** Cap a string at `n` whitespace-separated words (used for friction/fix). */
function wordLimit(s: string, n: number): string {
  const words = s.split(/\s+/).filter(Boolean);
  return words.length > n ? words.slice(0, n).join(" ") : s;
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

const clean = (s: string): string => stripDashes(s).slice(0, 240);

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
      if (tag === "head") continue;
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

/* ------------------------------------------------------------------ */
/* Multi-page site crawler (Dataset 1)                                 */
/* ------------------------------------------------------------------ */

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

/** Crawl one path (per-page timeout, tied to the crawl-level signal). */
async function crawlPath(
  origin: string,
  path: string,
  signal: AbortSignal,
): Promise<PageResult> {
  const base: PageResult = {
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
  try {
    const res = await fetchHtml(origin + path, PAGE_TIMEOUT_MS, signal);
    if (!res.ok) {
      // /case-studies 404? fall back to /cases once.
      if (path === "/case-studies" && res.status === 404) {
        try {
          const r2 = await fetchHtml(origin + "/cases", PAGE_TIMEOUT_MS, signal);
          if (r2.ok) {
            const html = await r2.text();
            return { ...base, status: 200, kind: "FOUND", ...parsePageContent(html) };
          }
        } catch {
          /* fall through to NOT FOUND */
        }
      }
      return {
        ...base,
        status: res.status,
        kind: res.status === 404 ? "NOT FOUND" : "UNREACHABLE",
      };
    }
    const type = res.headers.get("content-type") || "";
    const html = await res.text();
    if (!type.includes("text/html") && !type.includes("text/plain")) {
      return { ...base, status: res.status, kind: "NON-HTML" };
    }
    return { ...base, status: res.status, kind: "FOUND", ...parsePageContent(html) };
  } catch {
    // per-page timeout or shared budget abort
    return base;
  }
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

/** Crawl the primary indexed pages. One shared budget timer (CRAWL_BUDGET_MS)
 * aborts all in-flight fetches if the crawl runs too long, and it is also tied
 * to the top-level AbortController so the global 30s bound still applies. */
async function crawlSite(origin: string, topSignal: AbortSignal): Promise<PageResult[]> {
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

/** Build the "STRUCTURED SITE CRAWL" block string (real fetched content). */
function buildCrawlBlock(pages: PageResult[]): string {
  return pages.map(buildPageBlock).join("\n\n---\n\n");
}

/* ------------------------------------------------------------------ */
/* External market intelligence (Dataset 2, labeled)                   */
/* ------------------------------------------------------------------ */

/** Best-effort public search-index summary. If no keyed review API or fetchable
 * search surface is available, returns an honest directional block. Never
 * fabricates verbatim external quotes. */
async function buildMarketIntel(origin: string, topSignal: AbortSignal): Promise<string> {
  const host = origin.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const q = `${host} reviews pricing competitors alternatives`;
  const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetchHtml(ddg, 6000, topSignal);
    if (res.ok) {
      const html = await res.text();
      // Extract result headlines + snippets: DDG result titles are in
      // <a rel="nofollow" class="result__a">...</a> and snippets in
      // <a class="result__snippet">...</a>. Keep it simple: strip to text and
      // clip. These are REAL search-index strings, not invented quotes.
      const text = stripDashes(extractText(html));
      const clipped = text.slice(0, 1600);
      return (
        "SOURCE BASIS: best-effort fetch of a public search index (DuckDuckGo HTML) " +
        "for the target domain. The items below are raw search result headlines and " +
        "snippets from a public search index. They are NOT verbatim quotes from G2, " +
        "Capterra, or any named review site, and must not be presented as such.\n" +
        `SEARCH INDEX SNIPPETS (raw, for the query "${q}"):\n${clipped}`
      );
    }
    throw new Error("search response not ok");
  } catch {
    return (
      "SOURCE BASIS: no keyed review API (G2/Capterra/SerpAPI) and no reliably fetchable " +
      "public search index summary was available for automated retrieval at scan time. " +
      "External sentiment is therefore provided as DIRECTIONAL market context only. " +
      "HONESTY CONSTRAINT: you MUST NOT fabricate any specific G2, Capterra, or other " +
      "review-site verbatim quote and MUST NOT invent one. Characterize any external " +
      "sentiment directionally (e.g., 'review sites broadly flag X'), never as a literal " +
      "quote. Reason primarily from the STRUCTURED SITE CRAWL below."
    );
  }
}

/* ------------------------------------------------------------------ */
/* Output coercion                                                     */
/* ------------------------------------------------------------------ */

/** Coerce the model's dimensions into exactly 8 in canonical order: the 6
 * scored parameters and the 2 locked parameters with `locked: true` and NO
 * score. Missing scored entries default to a low "NOT DISCLOSED / GATED" score.
 * Pricing & Packaging is not a canonical id, so any stray "pricing" entry from
 * the model is dropped, not scored. */
function coerceDimensions(raw: unknown): DimResult[] {
  const byId: Record<string, DimResult> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const rawId = typeof it.id === "string" ? it.id.trim().toLowerCase() : "";
      const rawName = typeof it.name === "string" ? it.name.trim() : "";
      let id = "";
      if (CANONICAL_IDS.includes(rawId)) id = rawId;
      else if (CANONICAL_IDS.includes(rawName.toLowerCase())) id = rawName.toLowerCase();
      else {
        const match = CANONICAL_IDS.find(
          (k) => ID_TO_NAME[k].toLowerCase() === rawName.toLowerCase(),
        );
        if (match) id = match;
      }
      if (!id) continue;
      if (LOCKED_PARAMETER_IDS.has(id)) {
        // Locked parameters can NEVER be coerced to a score.
        byId[id] = { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
        continue;
      }
      const scoreRaw = typeof it.score === "number" ? Math.round(it.score) : NaN;
      const score = Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 20;
      const statusRaw =
        typeof it.status === "string" && it.status.trim() ? it.status.trim() : "";
      const status = statusRaw
        ? stripDashes(statusRaw)
        : score >= 75
          ? "Strong"
          : score >= 40
            ? "Needs Refinement"
            : "Critical Gap";
      const frictionLabel = stripDashes(typeof it.friction_label === "string" ? it.friction_label : "");
      const anchorLabel = stripDashes(typeof it.anchor_label === "string" ? it.anchor_label : "");
      const keyObservation = stripDashes(
        typeof it.keyObservation === "string"
          ? it.keyObservation
          : typeof it.key_observation === "string"
            ? it.key_observation
            : "",
      );
      const commercialRisk = stripDashes(
        typeof it.commercialRisk === "string"
          ? it.commercialRisk
          : typeof it.commercial_risk === "string"
            ? it.commercial_risk
            : "",
      );
      // evidence_snippet: real verbatim DOM quote (server-side carry only). If
      // the model returned no usable quote, leave it undefined so the red-flag
      // guard can exclude this parameter from false-evidence highlighting.
      const evidence = typeof it.evidence_snippet === "string" ? it.evidence_snippet.trim() : "";
      byId[id] = {
        id,
        name: ID_TO_NAME[id],
        pillar: PILLAR_OF[id],
        score,
        status,
        friction_label: frictionLabel || "Gap in the assessment",
        anchor_label:
          anchorLabel ||
          (score >= 70 ? "Clear Strength" : "Gap in the assessment"),
        keyObservation:
          keyObservation ||
          (score >= 70
            ? "This parameter's current framing is a clear strength on the public site."
            : "This parameter is not well represented on the public site."),
        commercialRisk:
          commercialRisk ||
          (score >= 70
            ? "Visitors get a clear reason to choose this product, which shortens evaluation and protects the price."
            : "Visitors get no clear reason to choose this product, which slows evaluation and leaks demand."),
        evidence_snippet: evidence || undefined,
        insufficientData: it.insufficientData === true,
      };
    }
  }
  return CANONICAL_IDS.map((id) => {
    const existing = byId[id];
    if (existing) return existing;
    if (LOCKED_PARAMETER_IDS.has(id)) {
      return { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
    }
    return {
      id,
      name: ID_TO_NAME[id],
      pillar: PILLAR_OF[id],
      score: 20,
      status: "Needs Refinement",
      friction_label: "No Content Found",
      anchor_label: "Gap in the assessment",
      keyObservation:
        "No representable content was found on the public site for this parameter.",
      commercialRisk:
        "Buyers cannot evaluate this dimension before reaching out, so they disqualify the product by default.",
    };
  });
}

function coerceResult(raw: unknown): DiagnoseResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = typeof r.score === "number" ? Math.round(r.score) : NaN;
  if (!Number.isFinite(score)) return null;
  const safe = Math.min(100, Math.max(0, score));
  const str = (v: unknown): string =>
    typeof v === "string" && v.trim() ? stripDashes(v.trim()) : "";
  const estimatedLeakage = str(r.estimatedLeakage);
  const primaryFriction = wordLimit(str(r.primaryFriction), 15);
  const recommendedFix = wordLimit(str(r.recommendedFix), 25);
  if (!estimatedLeakage || !primaryFriction || !recommendedFix) return null;
  const overallBand = str(r.overallBand);
  const band =
    overallBand ||
    (safe >= 80 ? "Market Ready" : safe >= 60 ? "Needs Attention" : "High Launch Risk");
  return {
    score: safe,
    overallBand: band,
    estimatedLeakage,
    primaryFriction,
    recommendedFix,
    dimensions: coerceDimensions(r.dimensions),
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeOrigin(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/diagnose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Parse + validate the body. 400 on malformed/empty/missing URL.
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid URL or content provided." },
            { status: 400 },
          );
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const url = isNonEmptyString(b.url) ? (b.url as string).trim() : "";
        const origin = normalizeOrigin(url);
        if (!origin) {
          return Response.json(
            { error: "Invalid URL or content provided." },
            { status: 400 },
          );
        }
        // Optional user-submitted ICP (Build #36: new homepage field).
        const icp = isNonEmptyString(b.icp) ? stripDashes((b.icp as string).trim()) : "";

        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          return Response.json(
            { error: "Live AI diagnosis is temporarily unavailable." },
            { status: 500 },
          );
        }

        // One overall AbortController bounds crawl + OpenAI so it never hangs.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          // Dataset 1: structured site crawl (core pages).
          const pages = await crawlSite(origin, controller.signal);
          const crawlBlock = buildCrawlBlock(pages);

          // Dataset 2: external market intelligence (labeled).
          const marketBlock = await buildMarketIntel(origin, controller.signal);

          const icpBlock = icp
            ? `\n=== USER-SUBMITTED ICP ===\nThe visitor claimed their primary buyer / ICP is: "${icp}". Use this to judge ICP & Audience Alignment: if the site's copy addresses a broader crowd than this named buyer, deduct. If buyer and site align, credit it.\n`
            : "\n=== USER-SUBMITTED ICP ===\nNone provided. Judge ICP & Audience Alignment purely from the site's \"who it's for\" signals; deduct for \"everyone\" framing.\n";

          const userMessage = `SITE URL UNDER EVALUATION: ${url}

=== STRUCTURED SITE CRAWL ===
The following is real content fetched server-side from ${origin}. Each page is presented as its parsed DOM structure: title, hero H1, above-the-fold subtext, ordered heading hierarchy, body text, and CTAs. Pages listed as NOT FOUND / UNREACHABLE (or NON-HTML) have no indexed content: treat that as a hard structural gap.
${crawlBlock}
${icpBlock}
=== EXTERNAL MARKET INTELLIGENCE ===
${marketBlock}

TASK:
Score the 6 URL-scorable parameters below 0 to 100 using the rubric in the system prompt, and LOCK the 2 reserved parameters (GTM Readiness, Launch Readiness) with "locked": true and no score. There is NO Pricing & Packaging parameter: do not score or return one. For EACH scored parameter include: score, the exact status label (Strong / Needs Refinement / Critical Gap), a 2 to 4 word "friction_label" naming that parameter's specific friction, a 2 to 4 word "anchor_label" naming that parameter's positive strength, an "evidence_snippet" that is a short VERBATIM DOM quote (5 to 25 words) from the STRUCTURED SITE CRAWL backing that score (empty string "" when none is usable), and the two-part diagnostic synthesis: a ONE-sentence "keyObservation" of what was FOUND or MISSING on the page (grounded in the detected messaging, never generic) plus a ONE-sentence "commercialRisk" explaining the business impact (which for high scores reads as a competitive advantage). Which parameter to treat as the primary friction is your judgment call. ALSO return the overall score (0-100), an overall readiness band, an estimated revenue leakage (an honest dollar range), the single primary friction (15 words max), and one recommended fix (25 words max).

Respond with ONLY strict JSON matching this schema (dimensions in EXACTLY this order):
{
  "score": number,
  "overallBand": "string (Market Ready | Needs Attention | High Launch Risk)",
  "estimatedLeakage": "string (e.g. $45,000 to $120,000/yr)",
  "primaryFriction": "string (max 15 words)",
  "recommendedFix": "string (max 25 words)",
  "dimensions": [
    { "id": "positioning", "name": "Category Positioning", "pillar": "Core Positioning", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "icp", "name": "ICP & Audience Alignment", "pillar": "Core Positioning", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "differentiation", "name": "Differentiation Anchor", "pillar": "Core Positioning", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "messaging", "name": "Hero Messaging & Speed", "pillar": "Messaging & Value Prop", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "value-prop", "name": "Value Proposition Density", "pillar": "Messaging & Value Prop", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "gtm", "name": "GTM Readiness", "pillar": "GTM & Launch Velocity", "locked": true },
    { "id": "launch", "name": "Launch Readiness", "pillar": "GTM & Launch Velocity", "locked": true },
    { "id": "conversion", "name": "Conversion & Friction Mechanics", "pillar": "GTM & Launch Velocity", "score": number, "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \"\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" }
  ]
}
No text outside the JSON.`;

          const res = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: MODEL,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage },
              ],
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            return Response.json(
              { error: "Live AI diagnosis failed. Please try again." },
              { status: 500 },
            );
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const content = data?.choices?.[0]?.message?.content;
          let parsed: unknown = content;
          if (typeof content === "string") {
            try {
              parsed = JSON.parse(content);
            } catch {
              parsed = null;
            }
          }
          const result = coerceResult(parsed);
          if (!result) {
            return Response.json(
              { error: "Live AI diagnosis returned an invalid response." },
              { status: 500 },
            );
          }
          return Response.json(result);
        } catch {
          // Network failure or explicit abort (timeout/crawl budget) — clean 500.
          return Response.json(
            { error: "Live AI diagnosis timed out. Please try again." },
            { status: 500 },
          );
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});