import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PARAMETER_NAMES } from "~/lib/audit/engine";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { BookingModal } from "~/components/BookingModal";
import { Header, Footer, ChevronDown } from "~/components/Layout";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Per-parameter methodology copy (what it measures, why it matters). */
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

/** Diagnose → Prescribe → Activate, in the founder's voice. */
const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    name: "Diagnose",
    body: "I assess your positioning, messaging, and market presence to identify where you're losing clarity, trust, and conversion.",
  },
  {
    n: "02",
    name: "Prescribe",
    body: "I turn those gaps into a focused action plan: what to fix, what to say, and which assets actually need to change.",
  },
  {
    n: "03",
    name: "Activate",
    body: "We put the fixes into market through a focused sprint, turning strategy into work that gets shipped.",
  },
] as const;

/* Friction observations: first-person, stat-free. Per owner spec §12:  */
/* no framework-style titles, no headline stats, no invented citations; */
/* each observation stands alone as the row's lead line. Stacked-row    */
/* layout: ghosted serif numerals, sand headers, consequence tags.      */
/* ------------------------------------------------------------------ */
function FrictionObservations() {
  const rows = [
    {
      n: "01",
      header: "Explaining, not selling",
      body: "If the first 30 minutes of a demo are spent explaining the category instead of selling the product, your positioning isn't doing enough work.",
      tag: "The cost \u2192 Longer sales cycles",
    },
    {
      n: "02",
      header: "The ads were never the problem",
      body: "If visitors are bouncing before they understand your value, more paid traffic won't fix it. You're just paying to send more people to the wrong message.",
      tag: "The cost \u2192 Wasted paid spend",
    },
    {
      n: "03",
      header: "Discounting to close",
      body: "When buyers can't clearly see why you're different, price becomes the easiest lever to pull.",
      tag: "The cost \u2192 Lower margins",
    },
  ];
  return (
    <section id="friction" className="scroll-mt-24 border-t border-hairline bg-sand">
      {/* Paper grain overlay (above the bg, below everything else). */}
      <div className="friction-grain" aria-hidden="true">
        <svg width="100%" height="100%" aria-hidden="true">
          <filter id="friction-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#friction-grain-filter)" />
        </svg>
      </div>
      <div className="relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="friction-grid">
          <div className="friction-left">
            <p className="friction-eyebrow">Where growth gets stuck</p>
            <h2 className="friction-headline">
              Three patterns that quietly hold back growth
            </h2>
            <p className="friction-intro">
              After years inside media and tech brands, I notice the same three failure modes. If any of these sound familiar, your positioning may be the problem, not your product.
            </p>
          </div>
          <div>
            {rows.map((row) => (
              <article key={row.n} className="friction-row">
                <span className="friction-numeral" aria-hidden="true">
                  {row.n}
                </span>
                <div className="friction-row-content">
                  <h3 className="friction-row-header">{row.header}</h3>
                  <p className="friction-row-body">{row.body}</p>
                  <p className="friction-tag">{row.tag}</p>
                </div>
              </article>
            ))}
            <p className="friction-closing">
              These are the patterns the diagnostic is built to uncover.{" "}
              <a
                href="#calculator"
                className="friction-closing-link"
                onClick={(e) => {
                  e.preventDefault();
                  const anchor =
                    document.getElementById("calculator") ??
                    document.getElementById("calc-url");
                  anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.setTimeout(() => {
                    document.getElementById("calc-url")?.focus({ preventScroll: true });
                  }, 650);
                }}
              >
                Run your URL →
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Methodology stepper: Diagnose → Prescribe → Activate                */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-cream py-12 sm:py-16"
    >
      {/* Paper grain overlay (above the bg, below everything else). */}
      <div className="hiw-grain" aria-hidden="true">
        <svg width="100%" height="100%" aria-hidden="true">
          <filter id="hiw-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#hiw-grain-filter)" />
        </svg>
      </div>
      <div className="relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="text-center">
          <p className="hiw-eyebrow">The MarketReady Method</p>
          <h2 className="hiw-headline font-display">
            Diagnose. Prescribe. Activate.
          </h2>
          <p className="hiw-intro-1">
            One readiness score. Three focused moves. I identify where your
            positioning is breaking down, map the highest-impact fixes, and
            help you put them into market.
          </p>
          <p className="hiw-intro-2">
            Most teams jump straight to execution. We start by finding the
            problem worth fixing.
          </p>
        </div>

        <ol className="hiw-steps">
          {HOW_IT_WORKS_STEPS.flatMap((step, i) => [
            ...(i > 0
              ? [
                  <li
                    key={`hiw-arrow-${step.n}`}
                    className="hiw-arrow"
                    aria-hidden="true"
                  >
                    →
                  </li>,
                ]
              : []),
            <li key={step.n} className={`hiw-step hiw-step-${step.n}`}>
              <div className="hiw-step-head">
                <span className="hiw-numeral">{step.n}</span>
                <h3 className="hiw-title">{step.name}</h3>
              </div>
              <p className="hiw-body">{step.body}</p>
            </li>,
          ])}
        </ol>
        <div className="text-center">
          <a href="/services/diagnostic" className="hiw-cta">
            Get Your MarketReady Score →
          </a>
        </div>
      </div>
    </section>
  );
}

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

function DiagnosticEngine() {
  const [expandedPillar, setExpandedPillar] = useState<string | null>("pillar-positioning");
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
      id="methodology"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-navy"
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
        <div className={`engine-layout`}>
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
                    {open && (
                      <div className="engine-rows">
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
                    )}
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

/* ------------------------------------------------------------------ */
/* Founder story (first-person). The logo marquee below is untouched:  */
/* the same authentic brand marks, brands the founder's teams worked   */
/* at, not MarketReady clients.                                        */
/* ------------------------------------------------------------------ */

/* Founder light panel (owner spec 2026-09-08): the single cream section on
   the homepage — warm cream bg, paper grain, ghosted MR monogram, two-column
   editorial layout, static full-color logo bar. Copy is unchanged; only the
   layout, color, and texture were reworked. Hard-coded LIGHT values are used
   throughout (the remapped cream/ink/mist/fog tokens resolve to dark). */

const FOUNDER_CRED_BRANDS: { label: string; src: string; h: number }[] = [
  { label: "Amazon", src: "/logos/amazon.svg", h: 12 },
  { label: "Warner Bros. Discovery", src: "/logos/wbd.svg", h: 13 },
  { label: "TNT Sports", src: "/logos/tntsports.svg", h: 13 },
  { label: "TBS", src: "/logos/tbs.svg", h: 14 },
  { label: "Bleacher Report", src: "/logos/bleacherreport.svg", h: 12 },
  { label: "Variety", src: "/logos/variety.svg", h: 13 },
  { label: "AEW", src: "/logos/aew.svg", h: 14 },
  { label: "NCAA", src: "/logos/ncaa.svg", h: 15 },
];

/* Founder bio (owner spec §12): first-person founder copy replaces the   */
/* old keyword-fragment badges. Logo bar directly beneath; no photo here   */
/* (headshot stays on /about only).                                        */

function FounderStory() {
  return (
    <section
      id="founder"
      className="founder-light relative scroll-mt-24 overflow-hidden bg-[#F2ECE2]"
      style={{ borderTop: "1px solid #3A312B", borderBottom: "1px solid #3A312B" }}
    >
      {/* Paper grain overlay (above the bg, below everything else). */}
      <div className="founder-grain" aria-hidden="true">
        <svg width="100%" height="100%" aria-hidden="true">
          <filter id="founder-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#founder-grain-filter)" />
        </svg>
      </div>
      {/* Ghosted MR monogram: bleeds off the top edge, hidden < 768px. */}
      <div className="founder-mono" aria-hidden="true">
        MR
      </div>
      <div className="relative mx-auto w-full max-w-[1200px] px-6 py-8 sm:px-12 sm:py-12">
        <div className="founder-grid">
          {/* Left column: eyebrow, headline, body, signature. */}
          <div className="founder-left">
            <p className="founder-eyebrow">BUILT FROM EXPERIENCE</p>
            <h2 className="founder-headline">
              Good products deserve a better story.
            </h2>
            <div className="founder-body">
              <p>
                I&rsquo;ve spent my career helping companies bring products to
                market, and I&rsquo;ve seen what happens when the product is ready
                but the story isn&rsquo;t.
              </p>
              <p>
                The positioning is fuzzy. The sales team is asking for better
                materials. Marketing is saying one thing while the product says
                another. And suddenly you&rsquo;re spending more money trying to
                scale a story that was never clear to begin with.
              </p>
              <p>
                I bring the product marketing leadership, strategic thinking, and
                hands-on execution to help you get the story right, give your team
                what they need to sell it, and build a GTM foundation that can
                support the next stage of growth.
              </p>
              <p>
                I&rsquo;m not here to hand you a strategy deck. I&rsquo;m here to
                help you put it to work.
              </p>
            </div>
            <div className="founder-sig">
              <p className="founder-sig-name">
                Wasani Probasco
              </p>
              <p className="founder-sig-title">
                Founder, MarketReady
              </p>
            </div>
          </div>
          {/* Right column: closing tagline, vertically centered. */}
          <div className="founder-right">
            <div className="founder-tag-rule" aria-hidden="true" />
            <p className="founder-tagline">
              Hands-on execution. No agency layers.
            </p>
          </div>
        </div>
        {/* Static full-color logo bar, full container width. */}
        <div className="founder-logobar">
          <div className="founder-logos">
            {FOUNDER_CRED_BRANDS.map((b) => (
              <img
                key={b.label}
                src={b.src}
                alt={b.label}
                title={b.label}
                loading="lazy"
                className="founder-logo"
                style={{ height: `${b.h}px` }}
              />
            ))}
          </div>
          <p className="founder-caption">
            Brands my teams have worked with, not MarketReady clients.
          </p>
        </div>
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ */
/* Services: unpriced engagement models. Owner rule: no pricing lives  */
/* on the homepage. The diagnostic CTA is the amber primary; every     */
/* other CTA is outline/secondary.                                     */
/* ------------------------------------------------------------------ */
const SERVICE_CARDS = [
  {
    stage: "Start here · Free",
    name: "MarketReady Diagnostic",
    body: "The free AI audit and scorecard. I read your live site like a first-time buyer and show you where positioning leaks.",
    points: ["Instant readiness score", "Surface red-flag callout", "Pillar-by-pillar breakdown"],
    cta: "Get Your MarketReady Score →",
    href: "/services/diagnostic",
    primary: true,
  },
  {
    stage: "Fix it in 14 days",
    name: "Positioning Sprint",
    body: "A focused engagement where I rebuild your positioning, messaging, and launch assets directly from the diagnostic.",
    points: ["Positioning architecture", "Homepage copy rewrite", "Launch deck and GTM plan"],
    cta: "Explore the Sprint →",
    href: "/services/sprint",
    primary: false,
  },
  {
    stage: "Stay sharp",
    name: "Fractional GTM Lead",
    body: "Ongoing senior PMM partnership: I stay in the room as you launch, iterate messaging, and enable sales.",
    points: ["Embedded PMM leadership", "Ongoing message iteration", "Sales enablement support"],
    cta: "Explore Fractional →",
    href: "/services/fractional",
    primary: false,
  },
] as const;

function ServicesStack() {
  return (
    <section
      id="services"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-cream py-14 sm:py-[4.5rem]"
    >
      <div className="relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="grid items-start gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-4">
            <p className="eyebrow text-navy">How we can work together</p>
            <h2 className="mt-3 max-w-[22ch] text-balance font-display text-3xl tracking-tight text-ink sm:text-[32px]">
              Got your score? Here's how I help you fix the gaps.
            </h2>
            <p className="mt-3 max-w-[36rem] text-base leading-relaxed text-mist">
              Pick the option that fits where you are right now. You work directly with me on every deliverable. No account managers, no junior hand-offs.
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 md:col-span-8 md:grid-cols-3">
          {SERVICE_CARDS.map((s) => (
            <div
              key={s.name}
              className="glass-card flex h-full flex-col p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fog">
                {s.stage}
              </p>
              <h3 className="mt-2 font-display text-lg text-ink">{s.name}</h3>
              <p className="mb-3 mt-2 text-sm leading-relaxed text-mist">
                {s.body}
              </p>
              <ul className="space-y-1.5 text-sm text-mist">
                {s.points.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="shrink-0 text-ember">✓</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={s.href}
                className={
                  s.primary
                    ? "btn-electric mt-5 w-full"
                    : "btn-ghost mt-5 w-full"
                }
              >
                {s.cta}
              </a>
            </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- FAQ accordion (one open at a time; human tone, no pricing) ---- */

const FAQ_ITEMS = [
  {
    q: "Do you work with a team, or is it just you?",
    a: "It's just me. I'm Wasani, and I lead every engagement personally. No account managers, no junior strategists, no hand-offs. You work directly with the person who's done this at Amazon, Warner Bros. Discovery, and Bleacher Report, on every single deliverable.",
  },
  {
    q: "What does an engagement cost?",
    a: "The diagnostic is free, always. Sprints are a flat-fee 14-day engagement and fractional work is a monthly retainer. Because scope depends on what your diagnostic reveals, I talk through fit and pricing on a short call before anything is signed.",
  },
  {
    q: "Do I need to book a call before we start?",
    a: "A short conversation comes first either way, because I only take on work I know I can move. If your diagnostic clearly shows the gaps and you're ready, we can get your window scheduled right away.",
  },
  {
    q: "Does the Sprint include live team training?",
    a: "The Sprint is about strategy and finished, ready-to-use assets. Live team training, sales enablement sessions, and ongoing execution live in the fractional retainer.",
  },
  {
    q: "I want more than the free score, but I'm not ready for a full Sprint. Is there anything in between?",
    a: "Yes. The MarketReady Audit is a human-led review delivered in a few days: a written diagnosis with prioritized recommendations, without the full Sprint build-out. And if you move to a Sprint within 30 days, your Audit fee applies toward it.",
  },
] as const;

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section
      id="faq"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-sand py-14 sm:py-[4.5rem]"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="max-w-2xl">
          <p className="eyebrow">Questions I get asked</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-[32px]">
            Frequently asked questions
          </h2>
        </div>
        <div className="mt-8 w-full">
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-button-${i}`;
              return (
                <div
                  key={item.q}
                  className={`glass-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${
                    isOpen ? "border-ember/40" : "hover:border-hairline"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-base font-semibold text-ink">{item.q}</span>
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                          isOpen
                            ? "border-ember/50 bg-ambertint text-ember"
                            : "border-hairline bg-ink/[0.03] text-fog"
                        }`}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-hairline px-6 pb-5 pt-4 text-sm leading-relaxed text-mist">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(
    undefined,
  );
  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  return (
    <div className="min-h-dvh bg-cream">
      <Header />
      <main>
        <HeroDiagnostic onBookBriefing={openBooking} />
        <FounderStory />
        <FrictionObservations />
        <HowItWorks />
        <DiagnosticEngine />
        <ServicesStack />
        <FaqAccordion />
      </main>
      <Footer onBook={openBooking} />
      {bookingOpen && (
        <BookingModal
          open={bookingOpen}
          onClose={closeBooking}
          initialService={preselectService}
        />
      )}
    </div>
  );
}
