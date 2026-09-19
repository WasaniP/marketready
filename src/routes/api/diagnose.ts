/**
 * POST /api/diagnose: the live URL diagnostic.
 *
 * Accepts `{ url }` and performs a server-side assessment:
 *   1. STRUCTURED SITE CRAWL: fetches the target's core pages (/ , /pricing,
 *      /about), parses each page's HTML DOM structure (title tag, hero H1 +
 *      above-the-fold subtext, ordered H1/H2/H3 hierarchy, body text, CTAs) and
 *      presents it as a compact structured block. Pages that 404 / reject bots
 *      are enumerated so hard-gap detection can fire. The crawl is the ONLY
 *      input: there is no external market-intelligence dataset any more, and
 *      pricing content is never scored.
 *   2. OpenAI gpt-4o scores the 6 URL-scorable parameters with the
 *      deterministic rubric in the system prompt, abstains on parameters with
 *      no evidence, and LOCKS the 2 reserved parameters (GTM Readiness, Launch
 *      Readiness) which require internal materials.
 *
 * Owner spec 2026-09-15 (determinism + accuracy rework):
 *   - estimatedLeakage is REMOVED everywhere, not replaced by a range or band.
 *   - Determinism: temperature 0, top_p 1, seed = stable hash of the normalized
 *     origin (the crawl cache key), one input only (the crawl), and a 24h cache
 *     of the parsed crawl per origin (see src/lib/audit/crawl.ts).
 *   - The overall score and readiness band are COMPUTED IN CODE (weighted mean
 *     over the scored dimensions, src/lib/audit/scoring.ts); the model returns
 *     only primaryFriction, recommendedFix and dimensions[].
 *   - Banded scoring: the model picks one of the five permitted values
 *     [20, 40, 60, 80, 95]; any other number is snapped to the nearest
 *     permitted value here (ties round up).
 *   - Abstain rather than guess: a dimension with no evidence is
 *     `insufficientData: true` with NO score (no default of 20), it is excluded
 *     from the weighted mean, and with 3 or more such dimensions there is no
 *     overall score at all (score: null).
 *   - One threshold set sitewide (src/lib/audit/thresholds.ts).
 *
 * Output contract (6 scored + 2 locked, canonical order):
 *   { score: number | null, overallBand: string | null, primaryFriction,
 *     recommendedFix,
 *     dimensions: [
 *       { id, name, pillar, score, status, friction_label, anchor_label,
 *         keyObservation, commercialRisk, evidence_snippet, insufficientData? }
 *       { id, name, pillar, locked: true }                               // x2
 *     ] }
 *
 * Owner readability fix (Parts C + D, 2026-09-16):
 *   - Static-text fallback (C): every page block now carries a STATIC METADATA
 *     section (meta description captured ALWAYS, og:/twitter: fields, JSON-LD,
 *     noscript), and those characters count toward the usable-text threshold.
 *   - Refuse to score what was not read (D): if the crawl is an identical shell
 *     on every route (identical_shell) or yields fewer than MIN_USABLE_CHARS
 *     usable characters (low_content), the route makes NO model call and
 *     returns a distinct state instead:
 *     { readable: false, reason, usableChars, shellDetected, heading, body, cta }
 *     with no score, band, dimensions, primaryFriction or recommendedFix.
 *
 * Each scored dimension ships a two-part diagnostic synthesis shown in the UI:
 * `keyObservation` (a direct 1-sentence observation of what was FOUND or MISSING
 * on the page) and `commercialRisk` (a 1-sentence business impact the UI labels
 * "Commercial Risk" below 80 and "Competitive Advantage" at 80 or above via the
 * shared impactLabel). It ALSO carries a server-side `evidence_snippet` (a short
 * literal DOM quote backing the score), carried in the API JSON and passed into
 * the Airtable lead record as "DOM Evidence" for Automations. It is never
 * fabricated: with no usable quote the parameter abstains.
 *
 * Security: the API key is read ONLY from process.env.OPENAI_API_KEY (injected
 * at runtime from the project Secrets panel). Never hard-coded, never logged.
 *
 * Owner protocol Part 2 (determinism fix, 2026-09-18), from the completed
 * diagnosis in /home/team/shared/determinism-investigation/REPORT.md (§4, §8):
 * `temperature 0` + `top_p 1` + a stable `seed` do NOT make this endpoint a
 * pure function. With a byte-identical request body and an unchanged
 * `system_fingerprint`, OpenAI still returned a different completion, moving one
 * parameter by 30 points. So:
 *   2.2 RESPONSE CACHE (the fix): the FINAL COERCED payload is cached under
 *       sha256(the whole deterministic request body) x DIAGNOSE_PROMPT_VERSION
 *       for 30 days (src/lib/audit/diagnoseCache.ts), and a repeat submission
 *       of an unchanged site is served that stored payload with NO model call.
 *       A divergent generation can never resurface.
 *   2.1 INPUT HYGIENE (not the fix): the user message interpolates the canonical
 *       `origin`, not the raw submitted string, so `/` and no-`/` no longer
 *       produce two different prompts for the same crawl (buildUserMessage).
 *   1.3 ATTRIBUTION: one server log line per model call carries
 *       `system_fingerprint`, the request-body SHA-256 and `usage.total_tokens`.
 * The rubric, band anchors, value-prop re-point and abstain/boilerplate paths are
 * deliberately untouched by that change; they are replaced by the 2026-09-18
 * rubric calibration immediately below.
 *
 * Failure handling: any error (missing key, expired key, network, timeout,
 * non-2xx from OpenAI) returns a clean 500 `{ error }` and the client shows its
 * explicit "scan could not complete" state; NO score is invented anywhere. One
 * AbortController (~40s) bounds the whole request (crawl + OpenAI).
 *
 * Owner rubric calibration (2026-09-18, Parts 1 to 5):
 *   1. FIVE-VALUE SCALE: nine values became five [20, 40, 60, 80, 95], and the
 *      status/band/UI cutoffs moved to 80 / 40 (one constant set in
 *      src/lib/audit/thresholds.ts, interpolated into this prompt).
 *   2. VALUE-PROP RE-POINT: Value Proposition Density is scored from body text,
 *      heading hierarchy (H2 and below) and CTA labels, and static metadata is
 *      now valid evidence for it too, so it no longer abstains by default.
 *   3. BAND ANCHORS: all five bands, verbatim, for all six parameters.
 *   4. NO ABSTAIN BOILERPLATE: an abstained parameter carries the MODEL's own
 *      site-specific keyObservation; the code-generated sentence is deleted, and
 *      with nothing usable the card shows only the "Not enough signal to score"
 *      label.
 *   5. CACHE INVALIDATION: DIAGNOSE_PROMPT_VERSION 1 -> 2.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  PARAMETER_IDS,
  PARAMETER_NAMES,
  LOCKED_PARAMETER_IDS,
  PILLAR_OF,
  hashString,
} from "~/lib/audit/engine";
import {
  paramStatus,
  STATUS_RUBRIC_TEXT,
  BAND_RUBRIC_TEXT,
  overallBandFor,
  STRONG_MIN,
} from "~/lib/audit/thresholds";
import { BANDED_SCORES, snapToBand, computeOverall } from "~/lib/audit/scoring";
import { crawlSite, buildCrawlBlock, assessReadability } from "~/lib/audit/crawl";
import { buildUnreadablePayload, MIN_USABLE_CHARS } from "~/lib/audit/readability";
import {
  readDiagnoseResponse,
  writeDiagnoseResponse,
} from "~/lib/audit/diagnoseCache";

/* ------------------------------------------------------------------ */
/* Exact, strict-JSON PMM system prompt (verbatim, incl. the no-dash   */
/* rule and the deterministic scoring rubric).                         */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT = `You are an elite B2B Product Marketing Manager (PMM) and Go-To-Market (GTM) Strategist.
You are evaluating a company from ONE complete dataset: the STRUCTURED SITE CRAWL. The target's core pages (Homepage, Pricing, About) are parsed into their DOM structure: title tags, hero H1 and above-the-fold subtext, ordered H1/H2/H3 heading hierarchy, body text, and call-to-action buttons. There is no external dataset: judge only what the crawl shows.

DETERMINISTIC SCORING RUBRIC (apply exactly; score each of the 6 parameters below):
1. Category Positioning (pillar: Core Positioning). DOM targets: hero H1, meta title tag. Deduct for abstract buzzwords (e.g. "the platform for growth") or category-less slogans.
2. ICP & Audience Alignment (pillar: Core Positioning). DOM targets: subheaders, hero copy, "who it's for" sections. Deduct when written for "everyone" rather than a named buyer type.
3. Differentiation Anchor (pillar: Core Positioning). DOM targets: body copy, H2s, comparison tables. Deduct for generic adjectives ("fast", "easy", "powerful") with no mechanism or proof.
4. Hero Messaging & Speed (pillar: Messaging & Value Prop). DOM targets: above-the-fold H1/H2/subtext. Evaluate through a DIFFERENT lens than Category Positioning: does the hero state the problem and the outcome, not just the category?
5. Value Proposition Density (pillar: Messaging & Value Prop). DOM targets: body text, heading hierarchy (H2 and below), and CTA labels. Score the ratio of outcome statements (time, money, risk) to raw feature specs.
6. Conversion & Friction Mechanics (pillar: GTM & Launch Velocity). DOM targets: primary CTA buttons, form fields, nearby trust signals. Score CTA clarity, commitment level, and the proximity of social proof to conversion points. This is the ONLY automatically scored parameter in this pillar.

BAND ANCHORS (every parameter uses the same five bands). Select the band whose description MOST CLOSELY matches the evidence, then return that band's exact value. Do not average bands, do not invent a value between bands, and do not default to a middle band when the evidence is unclear: pick the closest description and commit.

Category Positioning
- 20: No product noun anywhere above the fold. The headline is a slogan or a mission statement.
- 40: You can tell it's software, but not what kind. Terms like "platform," "solution," or "operating system" with no category attached.
- 60: The category is on the page but you have to scroll or infer it. The H1 gestures, the subhead explains.
- 80: The H1 names the category plainly. A first-time visitor knows what this is in one read.
- 95: Names the category and stakes a position inside it. Not just what it is, but which kind.

ICP & Audience Alignment
- 20: Written for everyone. No buyer, role, company type, or industry named anywhere.
- 40: A vague audience gesture. "Modern teams," "growing companies," "businesses like yours."
- 60: An audience is named but broadly. A segment rather than a buyer.
- 80: A specific buyer type or role is named and the copy speaks to their situation.
- 95: Names the buyer and shows it understands their day. The language is theirs, not the vendor's.

Differentiation Anchor
- 20: Nothing distinguishing. Swap the logo for a competitor's and nothing reads wrong.
- 40: Generic adjectives only. Fast, easy, powerful, intuitive, with no mechanism behind them.
- 60: A difference is claimed but not proven. The claim is there, the evidence isn't.
- 80: A specific mechanism, spec, or proof point that a competitor can't say.
- 95: The difference is named, proven, and structural. Hard to copy, not just hard to match.

Hero Messaging & Speed
- 20: No problem and no outcome. Abstract concepts or brand language only.
- 40: States what the product is, never why it matters. Category without consequence.
- 60: A problem or an outcome is present, but not both, and not quickly.
- 80: Problem and outcome are both above the fold and land in one read.
- 95: Problem and outcome in a single sentence a visitor could repeat to a colleague.

Value Proposition Density
- 20: Feature list only. Nothing connects any capability to a result.
- 40: Mostly features, with occasional benefit language bolted onto specs.
- 60: Benefits are present but soft. Better, faster, improved, with no direction or measure.
- 80: Most claims tie to a concrete outcome. Time saved, money made, risk avoided.
- 95: Outcomes lead and features support them, with specifics rather than adjectives.

Conversion & Friction Mechanics
- 20: No clear primary action, or the only path is a contact form with no context.
- 40: A CTA exists but it's vague, buried, or competing with several others of equal weight.
- 60: A clear primary CTA, but high commitment and no proof nearby to justify it.
- 80: Clear primary CTA, appropriate commitment level, and trust signals near the conversion point.
- 95: A low-friction path to value with proof adjacent, and the CTA matches where the buyer actually is.

BANDED SCORING (mandatory): choose the band whose description best fits the evidence, then return that band's SINGLE representative value. The ONLY permitted values are ${BANDED_SCORES.join(", ")}. One of those five numbers and nothing else, ever. A score of ${BANDED_SCORES[BANDED_SCORES.length - 1]} is real and must be used whenever the evidence matches the top band.

PRICING & PACKAGING IS NOT SCORED. There is NO Pricing & Packaging Logic parameter in this assessment. Public pricing pages are unreliable across B2B/enterprise, and pricing depends on internal unit economics and deal context a scraper cannot access. Do NOT return a "pricing" dimension at all: do not score it, do not return it as N/A, insufficient data, or 0. It simply does not exist in this output. You may still read the /pricing page content in the crawl for context, but it must never drive a scored dimension.

STATIC METADATA (WEAKER EVIDENCE, STILL VALID): each page block may carry a "STATIC METADATA:" section holding the page's static, non-rendered text: meta name=description, og:title, og:description, og:site_name, twitter:title, twitter:description, JSON-LD name / description / slogan / applicationCategory, and any <noscript> content. This is the text the page ships in its HTML head and no-JS fallback, so it is exactly what a search engine, an AI tool, a link preview or a social scraper reads when it does not run JavaScript. These fields ARE valid evidence for Category Positioning, ICP & Audience Alignment, Differentiation Anchor, and Value Proposition Density: a meta description that names the product category, the buyer type, or the result the product delivers is real evidence about how the company describes itself. They are WEAKER evidence than rendered page copy, because a visitor does not necessarily see them on the page. So when a dimension is supported ONLY by static metadata, score it on that metadata rather than abstaining, and say plainly in "keyObservation" that the signal comes from the page's static metadata rather than its visible copy. Never invent fields that are not in the crawl block.

RESERVED PARAMETERS (never scored from the crawl; they require internal materials the crawler cannot access):
- GTM Readiness (pillar: GTM & Launch Velocity): always return { "id": "gtm", "name": "GTM Readiness", "pillar": "GTM & Launch Velocity", "locked": true } with NO score, status, or synthesis.
- Launch Readiness (pillar: GTM & Launch Velocity): always return { "id": "launch", "name": "Launch Readiness", "pillar": "GTM & Launch Velocity", "locked": true } with NO score, status, or synthesis.

STATUS LABELS for scored parameters (exact vocabulary, and the ONLY values permitted in the "status" field): ${STATUS_RUBRIC_TEXT}.
READINESS BANDS (context only: you do NOT return a band, the server derives it): ${BAND_RUBRIC_TEXT}.

NO OVERALL SCORE, NO BAND, NO REVENUE ESTIMATE FROM YOU. The server computes the overall score (a weighted mean of the parameter scores) and the readiness band in code, and nothing in this product estimates revenue or dollar impact. Do NOT return "score", "overallBand", or any dollar or revenue figure. Return only "primaryFriction", "recommendedFix" and "dimensions".

EVIDENCE SNIPPET MANDATE (REAL DOM QUOTE, SERVER-SIDE CARRY ONLY): for EVERY scored parameter, also return an "evidence_snippet": a SHORT literal quote (5 to 25 words) lifted VERBATIM from the crawl that best supports that parameter's score (e.g. the actual hero H1 for Category Positioning, an actual feature line for Value Proposition Density, an actual button label for Conversion). It MUST be a real string present in the STRUCTURED SITE CRAWL block, never paraphrased and never invented. If a parameter genuinely has no usable verbatim quote from the crawl, return an empty string "" for its evidence_snippet. This field is carried server-side and logged to Airtable as DOM Evidence; it is NEVER rendered in the public UI.

TWO-PART DIAGNOSTIC SYNTHESIS MANDATE (NEVER RAW DOM, NEVER GENERIC BOILERPLATE): for EVERY scored parameter, write two plain-spoken fields grounded in what the crawl actually shows:
1. "keyObservation": ONE direct, 1-sentence diagnostic observation of what was FOUND or MISSING on the page, anchored to the actual messaging/patterning detected on the target site (e.g. its hero H1, subtext, differentiation, value-prop lineage, CTA path). Example: "The hero headline relies on broad process terms rather than defining an explicit software category." It must be a concrete statement about THIS site's copy, never a textbook definition and never a generic meta-summary.
2. "commercialRisk": ONE 1-sentence explanation of the business impact that single observation creates. Write it so it reads correctly whether the score is low or high: for low scores it is a commercial risk, for high scores it is a competitive advantage. Example (low): "Visitors cannot quickly classify the product, driving up initial bounce rates." Example (high): "Visitors self-classify the product instantly, shortening the path from first visit to a qualified conversation." The UI labels this same field "Commercial Risk" below ${STRONG_MIN} and "Competitive Advantage" at ${STRONG_MIN} or above, so the sentence must already read as the appropriate one for the score you assign.
An ABSTAINED parameter (insufficientData) must STILL carry a site-specific "keyObservation": one sentence naming what you looked for and what you found instead on THIS site, e.g. "Looked for outcome claims across the body text, the H2s and the CTA labels; the copy names capabilities and never a result." Abstaining without that sentence is not acceptable. Omit "commercialRisk", "friction_label" and "anchor_label" for an abstained parameter.
Do NOT echo raw H1 text, button copy, or pricing strings verbatim in either field. You may read the DOM, but the OUTPUT must be crisp PMM synthesis in simple, clear phrasing.

WRITING GUARDRAIL: Write diagnostic feedback using simple, clear PMM phrasing. Always ground observations in the actual messaging pattern detected on the target site. Never output generic boilerplate explanations.

DYNAMIC FRICTION LABEL: for EVERY scored parameter, also return two short labels:
- "friction_label": a 2 to 4 word phrase that names the specific diagnostic friction for THAT parameter, used when the score is below ${STRONG_MIN}, e.g. "Vague Category Naming", "Feature-Heavy: Low Outcome". It must be a crisp, concrete label derived from this site's actual content, NEVER a generic placeholder. Do NOT wrap it in the word "Friction" (the UI renders that prefix itself); just return the 2 to 4 word phrase.
- "anchor_label": a 2 to 4 word POSITIVE phrase that names the specific strength for THAT parameter, used when the score is ${STRONG_MIN} or above, e.g. "Clear Category Stake", "Outcome-Led Headline". Derive it from this site's actual content when it is a strength, or the natural positive counterpart of the parameter. Do NOT wrap it in the word "Strength"; return just the 2 to 4 word phrase.

EVALUATION RULES:
1. Be stage-aware: evaluate enterprise platforms (multi-product routing, integrations, trust signals) differently from early-stage self-serve tools.
2. HARD GAP DETECTION (ABSTAIN, NEVER GUESS): if a scored dimension has no representation across the entire site crawl, you MUST return "insufficientData": true for that dimension and NO score, status, friction_label or anchor_label, PLUS the site-specific "keyObservation" described above. Never assign an arbitrary middle or low score to fill the slot. WEAK IS NOT ABSENT: a parameter that reads badly on a page you can actually see is a LOW BAND, not an abstain. Copy that lists capabilities and never a result is Value Proposition Density 20 (feature list only) or 40 (mostly features), and a category-less slogan is Category Positioning 20 or 40. Abstaining because the evidence looks thin, vague or unpersuasive is a rubric violation. Abstain only when the site genuinely carries almost no body copy: Value Proposition Density in particular is evaluated from body text, heading hierarchy (H2 and below) and CTA labels, so it must be SCORED on that evidence rather than abstained by default. If you can quote any body copy, H2 or CTA label and it names a capability with no result, that IS a Value Proposition Density score: return "insufficientData": false and the low band (20 for a feature list only, 40 when benefit language occasionally appears). "insufficientData": true for Value Proposition Density is permitted only when the crawl block carries no body copy, no H2s and no CTA labels at all. Pricing is never scored regardless.
3. PRIMARY FRICTION: exactly one parameter is the single biggest drag on growth. name it in "primaryFriction" (15 words max) and give the one highest-leverage fix in "recommendedFix" (25 words max).

COPY CONSTRAINTS:
- ABSOLUTELY NO EM DASHES ("—") OR EN DASHES ("–"). Use colons, periods, or commas only.

OUTPUT FORMAT:
Return a strict JSON object with the primary friction, the recommended fix, and the dimensions array in the exact order and schema given in the TASK message. No overall score, no readiness band, no revenue estimate, no text outside the JSON.`;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";
/** Hard ceiling so the endpoint never hangs (crawl + OpenAI + transport). */
const TIMEOUT_MS = 40000;

/** Stable integer seed for the OpenAI call: a hash of the normalized origin,
 * the same input as the crawl cache key, so the same site always gets the same
 * seed (and the same crawl, and therefore the same scores). */
export function seedFromOrigin(origin: string): number {
  return Math.abs(Math.floor(hashString(origin)) % 2147483647);
}

/** Build the single user message sent to the model: PURE, its only inputs are
 * the canonical origin and the crawl block, so the request body (and therefore
 * the response-cache key) is a pure function of the site plus its crawl.
 *
 * Owner protocol Part 2.1(a) hygiene: the "SITE URL UNDER EVALUATION" line
 * carries the canonical `origin`, not the raw submitted string. Before this,
 * `https://linear.app/` and `https://linear.app` produced different prompts for
 * the same crawl and the same seed (REPORT.md §5, last row). */
export function buildUserMessage(origin: string, crawlBlock: string): string {
  return `SITE URL UNDER EVALUATION: ${origin}

=== STRUCTURED SITE CRAWL ===
The following is real content fetched server-side from ${origin}. Each page is presented as its parsed DOM structure: title, hero H1, above-the-fold subtext, ordered heading hierarchy, body text, and CTAs, followed by a STATIC METADATA section (meta description, og:/twitter: fields, JSON-LD, noscript) where present. Static metadata is weaker evidence than rendered copy but is still valid evidence for Category Positioning, ICP & Audience Alignment, Differentiation Anchor, and Value Proposition Density. Pages listed as NOT FOUND / UNREACHABLE (or NON-HTML) have no indexed content: treat that as a hard structural gap.
${crawlBlock}

TASK:
Score the 6 URL-scorable parameters below using the five-band rubric and the band anchors in the system prompt, and LOCK the 2 reserved parameters (GTM Readiness, Launch Readiness) with "locked": true and no score. There is NO Pricing & Packaging parameter: do not score or return one. For EACH scored parameter include: score (one of ${BANDED_SCORES.join(", ")} ONLY, i.e. the exact value of the band whose description most closely matches the evidence), the exact status label (Strong / Needs Refinement / Critical Gap), a 2 to 4 word "friction_label" naming that parameter's specific friction, a 2 to 4 word "anchor_label" naming that parameter's positive strength, an "evidence_snippet" that is a short VERBATIM DOM quote (5 to 25 words) from the STRUCTURED SITE CRAWL backing that score (empty string "" when none is usable), and the two-part diagnostic synthesis: a ONE-sentence "keyObservation" of what was FOUND or MISSING on the page (grounded in the detected messaging, never generic) plus a ONE-sentence "commercialRisk" explaining the business impact (which for high scores reads as a competitive advantage). If a scored parameter has NO representation anywhere in the crawl, return "insufficientData": true for it with NO score, NO status and NO labels, but you MUST still return its "keyObservation": one sentence naming what you looked for and what you found instead on this site. Value Proposition Density is scored from body text, H2-and-below headings and CTA labels, so it abstains only when the site genuinely has almost no body copy (capability-only copy that names no result is band 20 or 40, never abstain, and it may abstain only when there is no body copy, no H2s and no CTA labels at all). Which parameter to treat as the primary friction is your judgment call.

Do NOT return an overall score, a readiness band, or any revenue or dollar figure: the server computes the overall score and band from your parameter scores. Return the single primary friction (15 words max) and one recommended fix (25 words max).

Respond with ONLY strict JSON matching this schema (dimensions in EXACTLY this order). "score" is a number, and it must be one of ${BANDED_SCORES.join(", ")}:
{
  "primaryFriction": "string (max 15 words)",
  "recommendedFix": "string (max 25 words)",
  "dimensions": [
    { "id": "positioning", "name": "Category Positioning", "pillar": "Core Positioning", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "icp", "name": "ICP & Audience Alignment", "pillar": "Core Positioning", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "messaging", "name": "Hero Messaging & Speed", "pillar": "Messaging & Value Prop", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "differentiation", "name": "Differentiation Anchor", "pillar": "Core Positioning", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "value-prop", "name": "Value Proposition Density", "pillar": "Messaging & Value Prop", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" },
    { "id": "gtm", "name": "GTM Readiness", "pillar": "GTM & Launch Velocity", "locked": true },
    { "id": "launch", "name": "Launch Readiness", "pillar": "GTM & Launch Velocity", "locked": true },
    { "id": "conversion", "name": "Conversion & Friction Mechanics", "pillar": "GTM & Launch Velocity", "score": number (one of ${BANDED_SCORES.join(", ")}), "status": "string", "friction_label": "string (2 to 4 words)", "anchor_label": "string (2 to 4 words)", "evidence_snippet": "string (verbatim quote or \\"\\")", "keyObservation": "string (1 sentence)", "commercialRisk": "string (1 sentence)" }
  ]
}
A parameter with no usable evidence still appears in the array in its slot, in this exact shape: { "id": "value-prop", "name": "Value Proposition Density", "pillar": "Messaging & Value Prop", "insufficientData": true, "keyObservation": "string (1 sentence: what you looked for and what you found instead on this site)" }
No text outside the JSON.`;
}

/* ------------------------------------------------------------------ */
/* Response-cache key (owner protocol Part 2.2 + 2.1b)                 */
/* ------------------------------------------------------------------ */

/**
 * Version of the system prompt / scoring rubric that produced a cached payload.
 * ANY future edit to SYSTEM_PROMPT above (including the band anchors, the
 * value-prop wording or the abstain rule it carries) MUST bump this number. It
 * is baked into the response-cache key, so bumping it invalidates every cached
 * result automatically and the next visit re-scores on the model.
 *
 * v2 (2026-09-18): the owner's rubric calibration (Parts 1 to 5) — the scale
 * collapsed to five values [20, 40, 60, 80, 95], a band anchor for every
 * parameter, the value-prop re-point onto body text / H2-and-below / CTA
 * labels, and the removal of the abstain boilerplate. Every v1 entry is
 * therefore stale by definition and this bump retires all of them at once.
 */
export const DIAGNOSE_PROMPT_VERSION = 2;

/** The full response-cache key: rubric/prompt version + the SHA-256 of the
 * ENTIRE deterministic request body (model, system prompt, user message and
 * sampling params), i.e. a superset of model + prompt version + user-message
 * hash. Nothing time-, run- or randomness-derived is in here, so two
 * invocations over the same site and the same crawl produce the same key. */
export function diagnoseCacheKey(requestBodyHash: string): string {
  return `v${DIAGNOSE_PROMPT_VERSION}:${requestBodyHash}`;
}

/** SHA-256 of a string, lowercase hex. WebCrypto rather than `node:crypto` so
 * this module stays safe in every bundle the route appears in. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Canonical dimensions (6 scored + 2 locked)                          */
/* ------------------------------------------------------------------ */

const CANONICAL_IDS = [...PARAMETER_IDS] as string[];
const ID_TO_NAME: Record<string, string> = { ...PARAMETER_NAMES };

interface DimScored {
  id: string;
  name: string;
  pillar: string;
  /** Present only when the crawl held usable evidence; absent on abstain. */
  score?: number;
  status?: string;
  friction_label?: string;
  /** 2 to 4 word positive anchor label, shown as the STRENGTH label at 80+. */
  anchor_label?: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. */
  keyObservation?: string;
  /** 1-sentence business impact: the commercial risk (score below 80) shown as
   * "Commercial Risk" or the competitive advantage (80+) shown as
   * "Competitive Advantage". Single statement, relabeled by the UI at 80. */
  commercialRisk?: string;
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
  /** Weighted-mean overall score computed in code; null when 3 or more of the 6
   * scored dimensions had no usable evidence. */
  score: number | null;
  /** Band derived from the shared thresholds; null with no score. */
  overallBand: string | null;
  primaryFriction: string;
  recommendedFix: string;
  dimensions: DimResult[];
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
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

/* ------------------------------------------------------------------ */
/* Output coercion                                                     */
/* ------------------------------------------------------------------ */

/** Coerce the model's dimensions into exactly 8 in canonical order: the 6
 * scored parameters and the 2 locked parameters with `locked: true` and NO
 * score. Every returned number is snapped to a permitted band value, a
 * dimension marked insufficientData (or missing from the response) carries NO
 * score at all, and status labels come from the shared thresholds. Pricing &
 * Packaging is not a canonical id, so any stray "pricing" entry from the model
 * is dropped. */
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
      const insufficientData = it.insufficientData === true;
      const scoreRaw = typeof it.score === "number" ? it.score : NaN;
      // ABSTAIN RATHER THAN GUESS: no evidence (or no number) means no score.
      const hasScore = !insufficientData && Number.isFinite(scoreRaw);
      const score = hasScore ? snapToBand(scoreRaw) : undefined;
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
      // evidence_snippet: real verbatim DOM quote (server-side carry only).
      const evidence = typeof it.evidence_snippet === "string" ? it.evidence_snippet.trim() : "";
      const strong = typeof score === "number" && score >= STRONG_MIN;
      byId[id] = {
        id,
        name: ID_TO_NAME[id],
        pillar: PILLAR_OF[id],
        score,
        // Status is derived from the unified thresholds so a label can never
        // disagree with its color.
        status: typeof score === "number" ? paramStatus(score) : undefined,
        friction_label:
          frictionLabel ||
          (insufficientData ? "Not Enough Signal" : "Gap in the assessment"),
        anchor_label: anchorLabel || (strong ? "Clear Strength" : undefined),
        // Owner rubric calibration Part 4: the keyObservation is the MODEL's
        // site-specific sentence and nothing else. The code-generated
        // boilerplate ("This parameter is not well represented on the public
        // site.") is GONE: when the model returns nothing usable the field is
        // simply absent and the card shows only the "Not enough signal to
        // score" label, with no explanatory sentence.
        keyObservation: keyObservation || undefined,
        // Part 4, second half: an abstained parameter carries the MODEL's own
        // text only. The code-generated impact sentence is suppressed for it
        // too, so an abstain can never be filled in with vendor prose.
        commercialRisk:
          commercialRisk ||
          (insufficientData
            ? undefined
            : strong
              ? "Visitors get a clear reason to choose this product, which shortens evaluation and protects the price."
              : "Visitors get no clear reason to choose this product, which slows evaluation and leaks demand."),
        evidence_snippet: evidence || undefined,
        insufficientData,
      };
    }
  }
  return CANONICAL_IDS.map((id) => {
    const existing = byId[id];
    if (existing) return existing;
    if (LOCKED_PARAMETER_IDS.has(id)) {
      return { id, name: ID_TO_NAME[id], pillar: PILLAR_OF[id], locked: true };
    }
    // The model returned nothing for a scored dimension: abstain, never invent
    // a score, and never invent an explanation either (Part 4).
    return {
      id,
      name: ID_TO_NAME[id],
      pillar: PILLAR_OF[id],
      friction_label: "Not Enough Signal",
      insufficientData: true,
    };
  });
}

function coerceResult(raw: unknown): DiagnoseResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string =>
    typeof v === "string" && v.trim() ? stripDashes(v.trim()) : "";
  const primaryFriction = wordLimit(str(r.primaryFriction), 15);
  const recommendedFix = wordLimit(str(r.recommendedFix), 25);
  if (!primaryFriction || !recommendedFix) return null;
  const dimensions = coerceDimensions(r.dimensions);
  // Part 3: the overall score and band are computed in code, never taken from
  // the model (which no longer returns them).
  const overall = computeOverall(dimensions);
  return {
    score: overall.score,
    overallBand: overall.overallBand ?? (overall.score == null ? null : overallBandFor(overall.score)),
    primaryFriction,
    recommendedFix,
    dimensions,
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
          // The crawl is the ONLY input (no external market intelligence).
          // Reused from the 24h per-origin cache when available.
          const pages = await crawlSite(origin, controller.signal);
          const crawlBlock = buildCrawlBlock(pages);

          // REFUSE TO SCORE WHAT WAS NOT READ (owner readability fix, Part D).
          // Pre-flight, BEFORE the model call: if the crawl is an identical
          // shell on every route, or yielded fewer than MIN_USABLE_CHARS of
          // usable text in total, the site was not actually read. Returning a
          // scorecard here would report "unclear category / no named buyer"
          // about a site we never saw, so no model call is made at all and the
          // caller gets the distinct unreadable state instead.
          const readability = assessReadability(pages);
          if (!readability.readable) {
            // Server-side, one line, no PII: the character count, which rule
            // fired, and the per-page numbers, so the threshold can be tuned.
            console.warn(
              `[diagnose] unreadable site: origin=${origin} reason=${readability.reason} ` +
              `shellDetected=${readability.shellDetected} usableChars=${readability.total} ` +
              `threshold=${MIN_USABLE_CHARS} ` +
              `(rendered=${readability.rendered} static=${readability.static}) ` +
                `identicalPaths=${readability.identicalPaths.join(",") || "none"} ` +
                `pages=${readability.perPage
                  .map((p) => `${p.path}:${p.kind}:${p.chars}`)
                  .join(" ")}`,
            );
            return Response.json(
              buildUnreadablePayload({
                reason: readability.reason!,
                usableChars: readability.total,
                shellDetected: readability.shellDetected,
                pages: readability.perPage.map((p) => ({
                  path: p.path,
                  kind: p.kind,
                  chars: p.chars,
                })),
              }),
            );
          }

          // Built by a PURE helper from (origin, crawlBlock) only, so the
          // request body is a pure function of the site + its crawl. Part 2.1(a):
          // the "SITE URL UNDER EVALUATION" line carries the canonical origin,
          // never the raw submitted string.
          const userMessage = buildUserMessage(origin, crawlBlock);

          /* ----------------------------------------------------------------
           * RESPONSE CACHE (owner protocol Part 2.2: the determinism fix).
           *
           * The key is the SHA-256 of the WHOLE deterministic request body
           * (model + system prompt + user message + sampling params), tagged
           * with DIAGNOSE_PROMPT_VERSION. It carries no timestamp, run id or
           * randomness, so two separate invocations over an unchanged site and
           * an unchanged crawl produce the same key, and the SECOND one is
           * served the stored payload with no model call at all.
           *
           * What is stored is the final COERCED payload: the exact JSON object
           * returned to the client. Coercion, band snapping, status labels and
           * abstain handling are therefore frozen at write time, so a later
           * divergent raw completion can never resurface.
           *
           * 30-day TTL (owner spec; the parsed-crawl cache is 24h, this one is
           * deliberately longer). In-process Map, cleared on restart; a changed
           * crawl block changes the hash, so old entries simply age out by TTL.
           * Reading happens AFTER the readability gate, so an unreadable site
           * never reaches - and never writes - this cache. Concurrent misses on
           * a serverless platform may each call the model before either writes;
           * the first stored entry then fixes every subsequent read, so that
           * window is one cold request per process.
           * ---------------------------------------------------------------- */
          const requestBody = {
            model: MODEL,
            response_format: { type: "json_object" },
            // Determinism (owner spec 2026-09-15, Part 2.1): no sampling
            // randomness and a seed derived from the normalized origin.
            temperature: 0,
            top_p: 1,
            seed: seedFromOrigin(origin),
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
          };
          // ONE serialisation, used for BOTH the key and the wire body, so the
          // hash can never describe something other than what was sent.
          const requestBodyJson = JSON.stringify(requestBody);
          const requestBodyHash = await sha256Hex(requestBodyJson);
          const cacheKey = diagnoseCacheKey(requestBodyHash);

          const cached = readDiagnoseResponse<DiagnoseResult>(cacheKey);
          if (cached) {
            console.log(
              `[diagnose] response cache HIT: origin=${origin} key=${cacheKey} (no model call)`,
            );
            return Response.json(cached);
          }

          const res = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: requestBodyJson,
            signal: controller.signal,
          });

          if (!res.ok) {
            // An error path is NEVER cached: the next attempt calls the model.
            return Response.json(
              { error: "Live AI diagnosis failed. Please try again." },
              { status: 500 },
            );
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
            system_fingerprint?: unknown;
            usage?: { total_tokens?: unknown };
          };
          // ONE-LINE server log per model call (owner protocol Part 1.3): the
          // serving fingerprint, the request-body hash and the token usage make
          // any future divergence attributable instead of anecdotal. The prompt
          // itself is never logged.
          const fingerprint =
            typeof data?.system_fingerprint === "string"
              ? data.system_fingerprint
              : "none";
          const totalTokens =
            typeof data?.usage?.total_tokens === "number"
              ? String(data.usage.total_tokens)
              : "n/a";
          console.log(
            `[diagnose] model call: origin=${origin} key=${cacheKey} bodySha256=${requestBodyHash} system_fingerprint=${fingerprint} total_tokens=${totalTokens}`,
          );

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
            // A malformed or unparseable generation is NEITHER served as a
            // scorecard nor cached: today's error behaviour is preserved and
            // the next attempt calls the model again.
            return Response.json(
              { error: "Live AI diagnosis returned an invalid response." },
              { status: 500 },
            );
          }
          // Store the FINAL COERCED payload, i.e. exactly what is returned here.
          writeDiagnoseResponse(cacheKey, result);
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
