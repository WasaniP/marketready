/**
 * Shared case-study data for the Selected Work section (homepage) and the
 * four /work/* case-study subpages. Copy is owner-specified verbatim.
 *
 * NOTE: the "−30%" value uses U+2212 MINUS SIGN, not a hyphen — keep it.
 */
export type WorkMetric = { value: string; label: string };

export type WorkCase = {
  /** "01".."04" */
  num: string;
  slug: string;
  /** e.g. "ENTERPRISE PUBLISHER MARKETPLACE" */
  sector: string;
  /** Full card label: "CASE 01 / 04 · ENTERPRISE PUBLISHER MARKETPLACE" */
  caseLabel: string;
  /** Serif headline metric, e.g. "40% adoption in 3 months" */
  headline: string;
  headlineLabel: string;
  metrics: WorkMetric[];
  description: string;
  /** <title> for the subpage head() */
  pageTitle: string;
  /** meta description for the subpage head() */
  pageDescription: string;
};

export const WORK_CASES: WorkCase[] = [
  {
    num: "01",
    slug: "publisher-marketplace",
    sector: "ENTERPRISE PUBLISHER MARKETPLACE",
    caseLabel: "CASE 01 / 04 · ENTERPRISE PUBLISHER MARKETPLACE",
    headline: "40% adoption in 3 months",
    headlineLabel: "PLATFORM ADOPTION",
    metrics: [
      { value: "$1.2M", label: "EXPANSION REV" },
      { value: "$3.5M", label: "QUAL PIPELINE" },
      { value: "+12PT", label: "MQL → SQL" },
    ],
    description:
      "Led GTM strategy and product integration for an acquired platform, repositioning around a unified publisher revenue story.",
    pageTitle: "Publisher Marketplace Case Study — MarketReady",
    pageDescription:
      "How a repositioned publisher revenue story drove 40% platform adoption in 3 months, $1.2M in expansion revenue, and $3.5M in qualified pipeline.",
  },
  {
    num: "02",
    slug: "consumer-sports",
    sector: "CONSUMER SPORTS TECHNOLOGY",
    caseLabel: "CASE 02 / 04 · CONSUMER SPORTS TECHNOLOGY",
    headline: "+38% 7-day activation",
    headlineLabel: "7-DAY ACTIVATION",
    metrics: [
      { value: "+24%", label: "ARPU EXPANSION" },
      { value: "+22%", label: "RETENTION" },
      { value: "+18%", label: "PREMIUM CONV" },
    ],
    description:
      "Led feature relaunch and GTM activation for a core intelligence product, simplifying workflows and deploying lifecycle rollout.",
    pageTitle: "Consumer Sports Technology Case Study — MarketReady",
    pageDescription:
      "How a feature relaunch and lifecycle GTM rollout lifted 7-day activation 38%, ARPU expansion 24%, and premium conversion 18%.",
  },
  {
    num: "03",
    slug: "b2b-saas-platform",
    sector: "B2B SAAS ENTERPRISE PLATFORM",
    caseLabel: "CASE 03 / 04 · B2B SAAS ENTERPRISE PLATFORM",
    headline: "+8 pts repeat purchase rate",
    headlineLabel: "REPEAT PURCHASE RATE",
    metrics: [
      { value: "+$4.5M", label: "MARKETPLACE GMV" },
      { value: "−30%", label: "DELIVERY EXCEPT" },
      { value: "+42%", label: "FEATURE ADOPTION" },
    ],
    description:
      "Led GTM strategy to drive adoption of the core fulfillment workflow, diagnosing friction for repeat enterprise buyers.",
    pageTitle: "B2B SaaS Platform Case Study — MarketReady",
    pageDescription:
      "How a GTM strategy around the core fulfillment workflow lifted repeat purchase rate 8 points, added $4.5M in marketplace GMV, and cut delivery exceptions 30%.",
  },
  {
    num: "04",
    slug: "collectibles-marketplace",
    sector: "WEB3 & COLLECTIBLES MARKETPLACE",
    caseLabel: "CASE 04 / 04 · WEB3 & COLLECTIBLES MARKETPLACE",
    headline: "+$8.5M partnership-driven GMV",
    headlineLabel: "PARTNERSHIP GMV",
    metrics: [
      { value: "+65%", label: "NEW COLLECTORS" },
      { value: "+35%", label: "90-DAY RETENTION" },
      { value: "4.8×", label: "LAUNCH ROI" },
    ],
    description:
      "Built a repeatable GTM playbook for Tier-1 brand partnerships, turning launches into scalable acquisition engines.",
    pageTitle: "Collectibles Marketplace Case Study — MarketReady",
    pageDescription:
      "How a repeatable Tier-1 brand partnership playbook drove $8.5M in partnership GMV, 65% new-collector growth, and 4.8× launch ROI.",
  },
];

/** Circular prev/next: case 01's prev is case 04, case 04's next is case 01. */
export function workCaseNeighbors(index: number): {
  prev: WorkCase;
  next: WorkCase;
} {
  const n = WORK_CASES.length;
  return {
    prev: WORK_CASES[(index - 1 + n) % n],
    next: WORK_CASES[(index + 1) % n],
  };
}
