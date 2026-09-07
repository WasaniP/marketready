/**
 * MarketReady audit engine: simulated crawl + scoring.
 *
 * Deterministic per input set: a stable pseudo-random seed is derived from the
 * submitted URL + business model + launch stage + ICP, so the same inputs always
 * produce the same dashboard while different URLs produce visibly different
 * ones. The seed supplies a baseline score per parameter; heuristic adjustments
 * then encode the expected weak spots (empty ICP, pre-launch stage, business
 * model archetypes).
 *
 * Build #39 (value-first 6-parameter): the engine now mirrors the live
 * /api/diagnose contract shape: 6 scored parameters (positioning, icp,
 * differentiation, messaging, value-prop, conversion) + 2 LOCKED reserved
 * parameters (gtm, launch) that carry NO fabricated score. Pricing & Packaging
 * Logic was REMOVED from automated scoring entirely: public pricing pages are
 * unreliable across B2B/enterprise and pricing depends on internal unit
 * economics and deal context a scraper cannot access, so it is not returned as
 * a scored dimension.
 *
 * This is a simulated engine by design; live site crawling lands in the
 * /api/diagnose endpoint. The engine is pure (no window/localStorage/network)
 * so a real scraper can slot in behind the same `scoreAssessment` contract
 * without UI changes.
 */

import type { AssessmentInput, AuditResult, ParamResult, Status } from "./types";
import { COPY } from "./copy";

/* ------------------------------------------------------------------ */
/* Public thresholds + helpers                                         */
/* ------------------------------------------------------------------ */

export const SCORE_COLORS = {
  high: "#4D7C0F", // 75 to 100, strong / passing (warm olive)
  mid: "#A16207", //  40 to 74, needs refinement (deep gold)
  low: "#B45309", //   0 to 39, needs work (burnt amber)
} as const;

/** Score → hex color, exact thresholds from the rubric status labels. */
export function scoreColor(score: number): string {
  if (score >= 75) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

/** Score → status badge label (homepage Diagnostic Engine vocabulary). */
export function statusFor(score: number): Status {
  if (score >= 75) return "STRONG";
  if (score >= 40) return "NEEDS REFINEMENT";
  return "CRITICAL GAP";
}

/** Overall score → launch risk label. */
export function riskLabel(overall: number): string {
  if (overall >= 80) return "Low Launch Risk";
  if (overall >= 60) return "Moderate Launch Risk";
  return "High Launch Risk";
}

/* ------------------------------------------------------------------ */
/* Deterministic PRNG (seeded from the input set)                      */
/* ------------------------------------------------------------------ */

/** cyrb53-style string hash → 53-bit int, stable across runs and platforms. */
function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 PRNG that returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Parameter catalogue + heuristics                                    */
/* ------------------------------------------------------------------ */

/** Canonical 8 parameters: 6 scored + 2 locked (gtm, launch). ORDER IS THE
 * CONTRACT for the /api/diagnose response and the dashboard. Pricing &
 * Packaging Logic is NOT in the scored set: it requires internal unit economics
 * and deal context a public crawl cannot access. The paid 9-parameter MarketReady
 * Audit still evaluates it (with the 2 locked GTM/Launch parameters). */
export const PARAMETER_IDS = [
  "positioning",
  "icp",
  "messaging",
  "differentiation",
  "value-prop",
  "gtm",
  "launch",
  "conversion",
] as const;

/** Rubric names. Category Positioning → positioning, etc. */
export const PARAMETER_NAMES: Record<string, string> = {
  positioning: "Category Positioning",
  icp: "ICP & Audience Alignment",
  differentiation: "Differentiation Anchor",
  messaging: "Hero Messaging & Speed",
  "value-prop": "Value Proposition Density",
  gtm: "GTM Readiness",
  launch: "Launch Readiness",
  conversion: "Conversion & Friction Mechanics",
};

/** The 2 reserved parameters: never scored from a URL. */
export const LOCKED_PARAMETER_IDS = new Set(["gtm", "launch"]);

/** 3 pillar names, EXACT (owner-fixed; do not relabel). */
export const PILLAR_OF: Record<string, string> = {
  positioning: "Core Positioning",
  icp: "Core Positioning",
  differentiation: "Core Positioning",
  messaging: "Messaging & Value Prop",
  "value-prop": "Messaging & Value Prop",
  gtm: "GTM & Launch Velocity",
  launch: "GTM & Launch Velocity",
  conversion: "GTM & Launch Velocity",
};

/** Business-model archetype weak spots (penalty applied to that parameter). */
const MODEL_WEAK_SPOT: Record<string, string> = {
  "B2B SaaS": "differentiation",
  Marketplaces: "positioning",
  "AI Infrastructure": "messaging",
  Enterprise: "messaging",
  "Consumer AI": "conversion",
};

/** Launch-stage adjustments, keyed by parameter id. */
const STAGE_ADJUSTMENTS: Record<string, Record<string, number>> = {
  "Pre-Launch / MVP": { conversion: -12 },
  "Post-Seed Scaling": { conversion: 8, positioning: 2 },
  "Series A+ Growth": {
    conversion: 12,
    positioning: 6,
    differentiation: 6,
    messaging: 4,
  },
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Deterministic dynamic friction labels for the local fallback engine, keyed
 * by parameter id and score band. The live /api/diagnose returns its own
 * LLM-generated labels; this mirror keeps the preliminary/local card honest. */
const FRICTION_LABELS: Record<string, { high: string; mid: string; low: string }> = {
  positioning: { high: "Clear Category Stake", mid: "Hazy Category Naming", low: "No Category Staked" },
  icp: { high: "Named Buyer Focus", mid: "Broad Audience Targeting", low: "Untargeted, Everyone Copy" },
  differentiation: { high: "Strong Distinct Anchor", mid: "Weak Differentiation", low: "Generic Adjectives Only" },
  messaging: { high: "Outcome-Led Headline", mid: "Feature-Led Headline", low: "No Clear Message" },
  "value-prop": { high: "Outcome-Dense Promise", mid: "Low Outcome Density", low: "Feature-Heavy, Low Outcome" },
  conversion: { high: "Clear Conversion Path", mid: "Fuzzy Next Step", low: "Conflicting CTAs" },
};

/** Pick the deterministic 2 to 4 word friction label for the local engine. */
function frictionLabelFor(id: string, score: number): string {
  const band = FRICTION_LABELS[id];
  if (!band) return "Gap in the assessment";
  return score >= 75 ? band.high : score >= 40 ? band.mid : band.low;
}

/** Pick the deterministic 2 to 4 word positive anchor label used when a score is
 * high (>= 70). This is the parameter's best-case phrase, always the strength
 * framing regardless of the band. */
function anchorLabelFor(id: string): string {
  const band = FRICTION_LABELS[id];
  return band ? band.high : "Clear Strength";
}

/** Reserved-parameter copy: honest "requires internal materials" state.
 * NOTE: the public results UI never renders locked cards, so this text no
 * longer surfaces on the homepage. It stays in the API/engine JSON only. */
const LOCKED_COPY: Pick<ParamResult, "diagnostic" | "before" | "after" | "rationale"> = {
  diagnostic: "Reserved for the MarketReady Audit.",
  before:
    "GTM and launch readiness depend on internal materials (channel plan, launch kit, owners) that a public crawl cannot access.",
  after:
    "The full MarketReady Audit unlocks GTM Readiness and Launch Readiness with a human-led review of your internal go-to-market materials.",
  rationale:
    "This parameter is reserved: it is not scored from the public site because it requires internal materials the crawler cannot access. It is assessed in the MarketReady Audit.",
};

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Score an assessment. Deterministic for a given input set; returns the full
 * AuditResult consumed by the results dashboard. GTM Readiness and Launch
 * Readiness are LOCKED (no score) in the result.
 */
export function scoreAssessment(input: AssessmentInput): AuditResult {
  const seedInput = [input.url.trim(), input.businessModel, input.launchStage, input.icp.trim()].join("|");
  const rand = mulberry32(hashString(seedInput));

  const icpText = input.icp.trim();
  const unfocusedIcp = /everyone|anyone|anybody|any company|all types|general audience|every company|everyone who/i.test(icpText);

  // Baseline: per-parameter random in a mid band, then heuristic deltas.
  const deltas: Record<string, number> = {};
  const modelWeak = MODEL_WEAK_SPOT[input.businessModel];
  if (modelWeak) deltas[modelWeak] = -16;
  const stageAdj = STAGE_ADJUSTMENTS[input.launchStage];
  if (stageAdj) {
    for (const [id, d] of Object.entries(stageAdj)) {
      deltas[id] = (deltas[id] ?? 0) + d;
    }
  }
  if (!icpText) {
    deltas.icp = (deltas.icp ?? 0) - 24; // no named buyer → severe ICP penalty
    deltas.positioning = (deltas.positioning ?? 0) - 4;
  } else if (unfocusedIcp) {
    deltas.icp = (deltas.icp ?? 0) - 16;
    deltas.positioning = (deltas.positioning ?? 0) - 6; // "everyone" ICP → fuzzy category
  } else {
    deltas.icp = (deltas.icp ?? 0) + 8; // articulated buyer → small lift
  }

  const parameters: ParamResult[] = PARAMETER_IDS.map((id) => {
    if (LOCKED_PARAMETER_IDS.has(id)) {
      // Reserved: never fabricate a score. Honest locked state, same 9-slot shape.
      return {
        id,
        name: PARAMETER_NAMES[id],
        locked: true,
        diagnostic: LOCKED_COPY.diagnostic,
        before: LOCKED_COPY.before,
        after: LOCKED_COPY.after,
        rationale: LOCKED_COPY.rationale,
        positives: [
          "Free scan coverage stops at what a public crawl can see",
          "Internal materials unlock this parameter in the MarketReady Audit",
        ],
        missing: [
          "Internal channel plan and acquisition motion",
          "Launch kit: narrative, assets, targets, dated sequence with owners",
        ],
      };
    }
    const base = 48 + rand() * 38; // 48 to 86
    const delta = deltas[id] ?? 0;
    const raw = clamp(Math.round(base + delta), 8, 96);
    const score = raw;
    const copy = COPY[id](input, score);
    return {
      id,
      name: PARAMETER_NAMES[id],
      score,
      color: scoreColor(score),
      status: statusFor(score),
      diagnostic: copy.diagnostic,
      keyObservation: copy.keyObservation,
      commercialRisk: copy.commercialRisk,
      frictionLabel: frictionLabelFor(id, score),
      anchorLabel: anchorLabelFor(id),
      before: copy.before,
      after: copy.after,
      rationale: copy.rationale,
      positives: copy.positives,
      missing: copy.missing,
    };
  });

  // Composite: mean of the 7 SCORED parameters weighted toward the weak spots
  // (lower score → more weight), so one terrible parameter drags the overall
  // down harder than one strong one lifts it. Locked parameters are excluded.
  const scored = parameters.filter((p) => !p.locked);
  let weightSum = 0;
  let scoreSum = 0;
  for (const p of scored) {
    const s = p.score ?? 0;
    const weight = 1 + ((100 - s) / 100) * 0.55; // 1.0 (score 100) → 1.55 (score 0)
    weightSum += weight;
    scoreSum += s * weight;
  }
  let overall = weightSum > 0 ? Math.round(scoreSum / weightSum) : 0;
  if (input.launchStage === "Pre-Launch / MVP") overall -= 2;
  else if (input.launchStage === "Post-Seed Scaling") overall += 2;
  else overall += 5; // Series A+ Growth: traction compounds readiness
  if (icpText && !unfocusedIcp) overall += 2;
  overall = clamp(overall, 0, 100);

  const topGaps = [...scored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3);

  return {
    overall,
    riskLabel: riskLabel(overall),
    parameters,
    topGaps,
    url: input.url,
    businessModel: input.businessModel,
    launchStage: input.launchStage,
    icp: input.icp,
    generatedAt: new Date().toISOString(),
  };
}