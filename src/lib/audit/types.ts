/**
 * MarketReady audit engine: type schema.
 *
 * Pure client-side types: the engine module must never touch `window`,
 * `localStorage`, or the network, so a live scraper can replace the simulated
 * scoring later without changing the UI contract.
 *
 * Build #39: 6-scored + 2-locked shape. The URLs diagnostic scores 6 parameters
 * from the crawled site (positioning, icp, differentiation, messaging,
 * value-prop, conversion). Pricing & Packaging Logic is NOT scored: it requires
 * internal unit economics and deal context a public crawl cannot access. GTM
 * Readiness and Launch Readiness are RESERVED parameters: they require internal
 * materials the crawler cannot access, so they carry `locked: true` and NO
 * score in both the live AI response and the local fallback engine.
 */

/** Inputs captured by the assessment calculator (shape of ASSESSMENT_STORAGE_KEY). */
export interface AssessmentInput {
  url: string;
  businessModel: string;
  launchStage: string;
  icp: string;
  submittedAt: string;
}

/** Fixed status vocabulary for a scored parameter (matches the homepage
 * Diagnostic Engine labels: scores below 40, 40 to 74, and 75+). */
export type Status = "CRITICAL GAP" | "NEEDS REFINEMENT" | "STRONG";

/** One scored or reserved PMM parameter. */
export interface ParamResult {
  /** Stable machine id, e.g. "positioning". */
  id: string;
  /** Exact display name, e.g. "Category Positioning". */
  name: string;
  /** 0 to 100 readiness score. ABSENT for locked (reserved) parameters. */
  score?: number;
  /** Hex color derived from the score thresholds. ABSENT for locked. */
  color?: string;
  status?: Status;
  /** Reserved parameters (gtm, launch) that cannot be scored from the URL. */
  locked?: boolean;
  /** One-sentence diagnostic explanation. */
  diagnostic: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the actual messaging/patterning detected on the site.
   * NOT a generic textbook definition. */
  keyObservation?: string;
  /** 1-sentence explanation of the business impact: the commercial risk the
   * score creates (shown as "Commercial Risk" for scores below 70) or, for
   * scores >= 70, the competitive advantage the current site framing buys the
   * company (shown as "Competitive Advantage"). Single statement, relabeled by
   * the UI at the 70 threshold. */
  commercialRisk?: string;
  /** Short (2 to 4 word) diagnostic friction label used for scores below 70,
   * e.g. "Vague Category Naming" or "Feature-Heavy: Low Outcome". Dynamic,
   * per-parameter. */
  frictionLabel?: string;
  /** Short (2 to 4 word) positive anchor label used for scores >= 70, e.g.
   * "Clear Category Stake" or "Outcome-Led Headline". Dynamic, per-parameter. */
  anchorLabel?: string;
  /** Representative "what the site says today" template line. */
  before: string;
  /** Strong, benefit-led rewrite. */
  after: string;
  /**
   * Deeper diagnostic rationale: what the parameter measures, why it scored
   * this way for THIS assessment (stage / ICP / business model aware).
   */
  rationale?: string;
  /** Concrete signals the assessment found working in the site's favor. */
  positives?: string[];
  /** Concrete elements the parameter is missing. */
  missing?: string[];
}

/** Full output of the audit engine. */
export interface AuditResult {
  /** Composite score, weighted toward the weak scored parameters. */
  overall: number;
  /** "Low / Moderate / High Launch Risk". */
  riskLabel: string;
  /** All 8 parameters in canonical order (6 scored + gtm/launch locked). */
  parameters: ParamResult[];
  /** The 3 lowest-scoring SCORED parameters, ascending (worst first). */
  topGaps: ParamResult[];
  url: string;
  businessModel: string;
  launchStage: string;
  icp: string;
  /** ISO timestamp of when the audit was generated. */
  generatedAt: string;
}