import { useEffect, useRef, useState } from "react";
import { PARAMETER_NAMES } from "~/lib/audit/engine";
import { ChevronDown } from "~/components/Layout";

/* ------------------------------------------------------------------ */
/* Per-parameter methodology copy (what it measures, why it matters).  */
/* ------------------------------------------------------------------ */
const METHODOLOGY_COPY: Record<string, { measures: string; why: string }> = {
  positioning: {
    measures: "Whether a first-time visitor can name the category you own and who it's for within the first screen.",
    why: "Buyers file products under a category. If you don't stake one, competitors define you.",
  },
  icp: {
    measures: "Whether a specific, named buyer anchors your messaging instead of a vague crowd.",
    why: "Messaging written for 'everyone' lands with no one; a named persona makes the pitch feel personal.",
  },
  messaging: {
    measures: "Whether headlines lead with the buyer's outcome or with the technology itself.",
    why: "Outcome-led headlines earn the read; feature-led ones force the buyer to do the translation.",
  },
  differentiation: {
    measures: "Whether the site names a difference competitors can't copy: a spec, benchmark, or category.",
    why: "'Faster / better / cheaper' is table stakes. A defensible difference is why you win the evaluation.",
  },
  "value-prop": {
    measures: "Whether the hero promise names a quantified, time-bound outcome for a named beneficiary.",
    why: "Numbers make a promise credible; capability statements leave the buyer to guess the payoff.",
  },
  pricing: {
    measures: "How easily a buyer can evaluate fit and self-qualify: packaging tied to value, not opacity.",
    why: "Hidden pricing stalls evaluation and drags inbound quality down; clear packaging shortens the sale.",
  },
  gtm: {
    measures: "Whether a concrete, repeatable channel-to-customer path exists, with an offer at the end.",
    why: "Acquisition without a motion depends on luck; a named channel with an offer compounds.",
  },
  launch: {
    measures: "Whether the launch kit (narrative, assets, targets, dated sequence with owners) exists.",
    why: "Launch day is a plan, not a wish. The kit decides whether your launch compounds or fizzles.",
  },
  conversion: {
    measures: "The path from interest to action: one clear CTA per page, proof beneath it, a frictionless next step.",
    why: "Traffic is wasted when visitors don't know the next step. Proof removes the last hesitation.",
  },
};

/* ------------------------------------------------------------------ */
/* Diagnostic Engine pillars                                           */
/* ------------------------------------------------------------------ */

type PillarAccent = "electric" | "indigo";

/* Illustrative demo pillar state (UI only). "critical" = rust #C4603A gap,
   "refine" = amber #C9992F needs refinement, "strong" = green #6E9464. */
type PillarState = "critical" | "refine" | "strong";

/* ILLUSTRATIVE DEMO UI values, not real measured scores. score is out of 10
   (average ≈ 3.7/10, consistent with the demo 38/100 gauge value). */
const PILLAR_STATE: Record<string, { score: number; state: PillarState }> = {
  "pillar-positioning": { score: 3, state: "critical" },
  "pillar-messaging": { score: 4, state: "refine" },
  "pillar-gtm": { score: 4, state: "refine" },
};

const PILLAR_STATE_COLOR: Record<PillarState, string> = {
  critical: "#C4603A",
  refine: "#C9992F",
  strong: "#6E9464",
};

type Pillar = {
  id: string;
  num: string;
  title: string;
  summary: string;
  accent: PillarAccent;
  params: { id: string; tag: string }[];
};

/** The 9 parameters grouped into 3 evaluation pillars. */
const PILLARS: Pillar[] = [
  {
    id: "pillar-positioning",
    num: "01",
    title: "Core Positioning",
    summary: "Positioning, ICP / Audience, Differentiation",
    accent: "electric",
    params: [
      { id: "positioning", tag: "Positioning" },
      { id: "icp", tag: "ICP / Audience" },
      { id: "differentiation", tag: "Differentiation" },
    ],
  },
  {
    id: "pillar-messaging",
    num: "02",
    title: "Messaging & Value Prop",
    summary: "Messaging, Value Proposition, Pricing & Packaging",
    accent: "indigo",
    params: [
      { id: "messaging", tag: "Messaging" },
      { id: "value-prop", tag: "Value Proposition" },
      { id: "pricing", tag: "Pricing & Packaging" },
    ],
  },
  {
    id: "pillar-gtm",
    num: "03",
    title: "GTM & Launch Velocity",
    summary: "GTM Readiness, Launch Readiness, Conversion Readiness",
    accent: "electric",
    params: [
      { id: "gtm", tag: "GTM Readiness" },
      { id: "launch", tag: "Launch Readiness" },
      { id: "conversion", tag: "Conversion Readiness" },
    ],
  },
];

/** One-line description per parameter for the Diagnostic Engine cells. */
const CELL_LINES: Record<string, string> = {
  positioning: "A first-time visitor can name the category you own within the first screen.",
  icp: "A specific, named buyer anchors the messaging, not a vague crowd.",
  differentiation: "A defensible difference competitors can't copy: a spec, benchmark, or category.",
  messaging: "Headlines lead with the buyer's outcome, not the technology.",
  "value-prop": "The hero promise names a quantified, time-bound outcome for a named beneficiary.",
  conversion: "One clear CTA per page, proof beneath it, a frictionless next step.",
  pricing: "Buyers can evaluate fit and self-qualify, with packaging tied to value, not opacity.",
  gtm: "A concrete, repeatable channel-to-customer path with an offer at the end.",
  launch: "A dated launch kit: narrative, assets, targets, and owners.",
};

function EngineCardRow({
  paramId,
  num,
  expanded,
  onToggle,
}: {
  paramId: string;
  num: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = METHODOLOGY_COPY[paramId];
  return (
    <div className="engine-row-wrap">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`engine-row${expanded ? " is-open" : ""}`}
      >
        <span className="engine-row-num">{num}</span>
        <span className="engine-row-name">{PARAMETER_NAMES[paramId]}</span>
        <ChevronDown
          className={`engine-row-chevron${expanded ? " is-open" : ""}`}
        />
      </button>
      {expanded && (
        <div className="engine-detail">
          <p className="engine-detail-def">{CELL_LINES[paramId]}</p>
          <p className="engine-detail-why">
            <span className="engine-why-label">WHY IT MATTERS: </span>
            {meta.why}
          </p>
        </div>
      )}
    </div>
  );
}

/* Ten-segment pillar meter. score/10 segments lit in the pillar's state
   color, the rest unlit. Rendered in every pillar header. */
function EngineMeter({ score, state }: { score: number; state: PillarState }) {
  const color = PILLAR_STATE_COLOR[state];
  return (
    <span className="engine-meter" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="engine-meter-seg"
          style={{ backgroundColor: i < score ? color : "#2A2320" }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Diagnostic Engine (owner restyle spec: pillar panels + gauge panel). */
/* The 38/100 gauge, pillar scores, and pillar status flags are         */
/* ILLUSTRATIVE DEMO UI only, not a real measured score of any site.    */
/* ------------------------------------------------------------------ */
function EngineMintGauge({ active }: { active: boolean }) {
  const trackR = 50;
  const ringR = 58;
  const c = 2 * Math.PI * trackR;
  /* The 38/100 value is ILLUSTRATIVE DEMO UI, not a real measured score of
     any site. Sweep the arc from 0% to the 38% demo value once the section
     scrolls into view. */
  const offset = active ? `${c * (1 - 0.38)}` : `${c}`;
  return (
    <div className="engine-gauge-wrap">
      <svg
        viewBox="0 0 140 140"
        className="engine-gauge-svg"
        role="img"
        aria-label="Illustrative overall readiness score: 38 out of 100"
      >
        <circle
          cx="70"
          cy="70"
          r={ringR}
          fill="none"
          stroke="#2A2320"
          strokeWidth="3"
        />
        <circle
          cx="70"
          cy="70"
          r={trackR}
          fill="none"
          stroke="#2A2320"
          strokeWidth="9"
        />
        <circle
          cx="70"
          cy="70"
          r={trackR}
          fill="none"
          stroke="#C4603A"
          strokeWidth="9"
          strokeLinecap="butt"
          strokeDasharray={`${c * 0.38} ${c}`}
          strokeDashoffset={offset}
          className="mr-gauge-sweep"
        />
      </svg>
      <div className="engine-gauge-center">
        <span className="engine-gauge-numeral">38</span>
        <span className="engine-gauge-denom">/ 100</span>
        <span className="engine-gauge-status">◆ HIGH RISK</span>
      </div>
    </div>
  );
}

/** Illustrative demo status per pillar (UI only; not a real measured score). */
const PILLAR_STATUS: Record<string, { label: string }> = {
  "pillar-positioning": { label: "◆ CRITICAL GAP" },
  "pillar-messaging": { label: "◆ NEEDS REFINEMENT" },
  "pillar-gtm": { label: "◆ NEEDS REFINEMENT" },
};

/**
 * Full Diagnostic Engine — the 3-pillar scoring methodology with
 * click-to-expand accordions, 9 dimension rows, and the demo gauge.
 *
 * Purely presentational: expansion is click-only (never scroll-tied). The
 * IntersectionObserver below drives the entrance reveal + gauge sweep only.
 *
 * Moved from the homepage #methodology section (2026-09): re-scoped CSS
 * lives under `.engine-section` in app.css; the condensed homepage summary
 * uses its own `.score-condensed` id/classes so the two never collide.
 */
export function DiagnosticEngine() {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const revealLeft = visible ? "mr-step-reveal" : "opacity-0";
  const revealRight = visible ? "mr-step-reveal" : "opacity-0";

  return (
    <section
      ref={sectionRef}
      id="engine-methodology"
      className="engine-section relative scroll-mt-24 overflow-hidden border-t border-hairline bg-navy"
    >
      <svg
        aria-hidden="true"
        className="engine-grid"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="engine-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#2A2320" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#engine-grid-pattern)" />
      </svg>
      <div className="engine-content relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="engine-layout">
          <div className={`engine-pillars ${revealLeft}`} style={{ animationDelay: "240ms" }}>
            {PILLARS.map((pillar) => {
              const status = PILLAR_STATUS[pillar.id];
              const demo = PILLAR_STATE[pillar.id];
              const open = expandedPillar === pillar.id;
              return (
                <div key={pillar.id} className="engine-pillar-unit">
                  <div className="engine-meta">
                    <span className="engine-counter">
                      PILLAR {pillar.num} / 03
                    </span>
                    <span
                      className="engine-flag"
                      style={{ color: PILLAR_STATE_COLOR[demo.state] }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div
                    className={`engine-panel${open ? " is-open" : ""}`}
                    style={{ borderLeftColor: PILLAR_STATE_COLOR[demo.state] }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPillar((cur) => (cur === pillar.id ? null : pillar.id))
                      }
                      aria-expanded={open}
                      className="engine-panel-head"
                    >
                      <span className="engine-panel-title">{pillar.title}</span>
                      <EngineMeter score={demo.score} state={demo.state} />
                      <ChevronDown className={`engine-panel-chevron${open ? " is-open" : ""}`} />
                    </button>
                    <div
                      className={`engine-rows${open ? " is-open" : ""}`}
                      inert={open ? undefined : true}
                    >
                      <div className="engine-rows-inner">
                        {pillar.params.map((p, i) => (
                          <EngineCardRow
                            key={p.id}
                            paramId={p.id}
                            num={`0${i + 1}`}
                            expanded={expanded === p.id}
                            onToggle={() => setExpanded((cur) => (cur === p.id ? null : p.id))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`engine-side ${revealRight}`} style={{ animationDelay: "120ms" }}>
            <p className="engine-eyebrow">My scoring system</p>
            <h2 className="engine-headline">
              The MarketReady Diagnostic Engine
            </h2>
            <p className="engine-intro">
              Nine dimensions, scored in seconds, grouped into three pillars: how you position, how you message, and how fast you launch.
            </p>
            <p className="engine-callout">
              A low score isn&apos;t an abstraction. It&apos;s the demo where
              30 minutes go to explaining the category, the ad spend that
              bounces, and the deal that closes at a discount.
            </p>
            <div className="engine-gauge">
              <p className="engine-gauge-label">READINESS SCORE</p>
              <EngineMintGauge active={visible} />
              <div className="engine-gauge-rule" aria-hidden="true" />
              <p className="engine-disclaimer">
                Sample score for illustration. Run your URL for a real one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}