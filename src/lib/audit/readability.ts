/**
 * Readability contract for the URL diagnostic (owner readability fix, Part D).
 *
 * "Refuse to score what wasn't read": when the crawl cannot read a site (a
 * client-rendered SPA answers 200 on every route with the same shell, or the
 * extracted text is far too thin to judge), the diagnostic returns NO score at
 * all and the UI renders a distinct state instead of a scorecard. This module
 * is the ONE definition of that state: the threshold, the reason vocabulary,
 * the copy, and the CTA, shared by the server route (src/routes/api/diagnose.ts)
 * and every client surface (homepage hero card + /services/diagnostic) so the
 * copy can never drift between them.
 *
 * No em/en dashes anywhere in the copy (sitewide copy constraint).
 */

/** Minimum total usable extracted characters across all crawled pages before
 * the diagnostic will score a site at all. Below this the site was not read,
 * so it is not scored. Tunable: every refusal logs the real character count
 * (and the per-page breakdown) so this number can be revisited with data. */
export const MIN_USABLE_CHARS = 300;

/** Why a site could not be scored. Distinct values so it is diagnosable which
 * rule fired (see assessReadability in src/lib/audit/crawl.ts). */
export type UnreadableReason = "low_content" | "identical_shell";

/** The existing cal.com booking link used by the header, footer and nav CTAs.
 * The unreadable state's CTA points at the same destination. */
export const BOOK_A_CALL_URL = "https://cal.com/wasani-probasco";

/** Unreadable-state copy (verbatim, owner-specified). The body is one string
 * with blank-line paragraph breaks so the server and the client cannot render
 * different wording. */
export const UNREADABLE_HEADING = "I couldn't read this site.";

export const UNREADABLE_BODY = `Your site renders its content with JavaScript, so a plain page fetch returns an empty shell. My crawler pulled fewer than ${MIN_USABLE_CHARS} characters of readable text from it.

That matters beyond this diagnostic. Search engines, AI tools, link previews, and social scrapers often read pages the same way I just did. If they're seeing what I saw, your positioning isn't reaching them either.

Worth checking directly: run your homepage through Google's URL Inspection tool in Search Console and look at the rendered HTML.`;

export const UNREADABLE_CTA_LABEL = "Book a Call";

/** The wire shape of the unreadable response (HTTP 200, `readable: false`).
 * It deliberately carries NO score, band, dimensions, primaryFriction or
 * recommendedFix: there are no results to report. */
export interface UnreadablePayload {
  readable: false;
  reason: UnreadableReason;
  /** Total usable extracted characters across every crawled page. */
  usableChars: number;
  /** True when every fetched page returned byte-identical content (SPA shell). */
  shellDetected: boolean;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  /** Per-page character counts, for tuning the threshold later. */
  pages: { path: string; kind: string; chars: number }[];
}

/** Build the unreadable payload (single definition site, used by the route). */
export function buildUnreadablePayload(input: {
  reason: UnreadableReason;
  usableChars: number;
  shellDetected: boolean;
  pages: { path: string; kind: string; chars: number }[];
}): UnreadablePayload {
  return {
    readable: false,
    reason: input.reason,
    usableChars: input.usableChars,
    shellDetected: input.shellDetected,
    heading: UNREADABLE_HEADING,
    body: UNREADABLE_BODY,
    cta: { label: UNREADABLE_CTA_LABEL, href: BOOK_A_CALL_URL },
    pages: input.pages,
  };
}

/** True for a value that is the unreadable payload (used by the client to
 * branch BEFORE any score normalization is attempted). */
export function isUnreadablePayload(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return r.readable === false && (r.reason === "low_content" || r.reason === "identical_shell");
}
