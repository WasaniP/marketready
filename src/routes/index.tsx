import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PARAMETER_NAMES } from "~/lib/audit/engine";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { BookingModal } from "~/components/BookingModal";
import { Header, Footer, ChevronDown } from "~/components/Layout";

/* ------------------------------------------------------------------ */
/* Build #32 / #34: LIVE AI diagnostic (client-side call + fallback).  */
/* The response shape + defensive normalization live in lib/audit/ai.ts */
/* ------------------------------------------------------------------ */

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
/* Build #7: Diagnostic Engine pillars + how-it-works copy             */
/* ------------------------------------------------------------------ */

type PillarAccent = "electric" | "indigo";

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

/** One-line description per parameter for the Diagnostic Engine cells
 * (drawn from the audit copy module's measures/why wording). */
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

/** Build #22/#35: Diagnose → Prescribe → Activate staged funnel (reframes the
 * old three-step "how it works" copy; the section id #how-it-works stays).
 * Prices are surfaced on the homepage: Stage 02 shows the $7,500 Sprint and
 * Stage 03 the ongoing advisory retainer. The $3,000 MarketReady Audit is a
 * services-page offering and intentionally does NOT appear here. */
const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    name: "Diagnose",
    body: "Run the free AI audit and scorecard to surface your positioning friction.",
  },
  {
    n: "02",
    name: "Prescribe",
    body: "The 14-Day Sprint turns flagged gaps into positioning, messaging, and a launch deck.",
  },
  {
    n: "03",
    name: "Activate",
    body: "Ongoing advisory keeps launch momentum compounding after the sprint.",
  },
] as const;




/* ------------------------------------------------------------------ */
/* Build #NN: Problem Agitation section ("The Invisible Tax").           */
/* Directly below the hero. 3 compact dark-slate cards, teal icons.    */
/* ------------------------------------------------------------------ */
function ProblemAgitation() {
  const cards = [
    {
      title: "The Sales Velocity Drain",
      metric: "47%",
      metricLabel: ' deals lost to "no decision"',
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M21 7v5h-5" />
        </svg>
      ),
      bullets: [
        <>
          <strong className="font-bold text-ink">Demo calls waste 30 mins</strong> educating category
          rather than closing value.
        </>,
        <>
          <strong className="font-bold text-ink">Extended sales cycles</strong> caused by unclear
          buyer payoff and hesitation.
        </>,
      ],
    },
    {
      title: "The Marketing Burn Multiplier",
      metric: "61%",
      metricLabel: " paid traffic bounce rate",
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
      bullets: [
        <>
          <strong className="font-bold text-ink">Visitors bounce in 8 seconds</strong> due to
          feature-heavy, outcome-light copy.
        </>,
        <>
          <strong className="font-bold text-ink">Skyrocketing CAC</strong> pouring high-cost paid
          traffic into a leaky landing page.
        </>,
      ],
    },
    {
      title: "The Competitive Discount Trap",
      metric: "28%",
      metricLabel: " avg rep discount rate",
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <path d="M7 7h.01" />
        </svg>
      ),
      bullets: [
        <>
          <strong className="font-bold text-ink">Constant comparison</strong> to generic or
          lower-cost market alternatives.
        </>,
        <>
          <strong className="font-bold text-ink">Loss of pricing power</strong> forcing heavy
          discounting to secure signatures.
        </>,
      ],
    },
  ];
  return (
    <section
      id="problem"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-[#0B1220] py-10"
    >
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center" style={{ marginBottom: 48 }}>
          {/* Eyebrow pill */}
          <span
            className="mb-4 inline-block rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              color: "#14B8A6",
              letterSpacing: "0.08em",
              background: "rgba(20,184,166,0.1)",
              border: "1px solid rgba(20,184,166,0.25)",
            }}
          >
            ● THE COST OF WEAK FOUNDATIONS
          </span>
          <h2
            className="text-[32px] font-bold text-[#F9FAFB] sm:text-[36px]"
            style={{ lineHeight: 1.25, maxWidth: 800 }}
          >
            Scaling Spend Before Messaging Precision Is Just{" "}
            <span style={{ color: "#14B8A6" }}>Paid Churn</span>
          </h2>
          <p
            className="text-[15px] text-[#9CA3AF]"
            style={{ lineHeight: 1.5, maxWidth: 640, marginTop: 12 }}
          >
            When your category anchor and buyer outcomes aren't crystal clear, every dollar put into
            ads, outbound, or sales hiring goes straight into a leaky conversion funnel.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group relative rounded-xl p-7 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(20,184,166,0.2)]"
              style={{
                background: "rgba(17,24,39,0.75)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(45,212,191,0.2)",
                borderTop: "1px solid rgba(45,212,191,0.4)",
              }}
            >
              {/* Mini status tag, top-right */}
              <span className="absolute right-5 top-4 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                <span className="text-[9px] text-electric">●</span> FRICTION
              </span>
              {/* Big metric callout */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[34px] font-extrabold leading-none" style={{ color: "#14B8A6" }}>
                  {c.metric}
                </span>
                <span className="text-[13px] text-[#9CA3AF]">{c.metricLabel}</span>
              </div>
              {/* Header: glowing teal badge + title */}
              <div className="mt-5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(20,184,166,0.12)] text-[18px] text-electric shadow-[0_0_18px_rgba(20,184,166,0.35)]">
                  {c.icon}
                </span>
                <h3 className="text-[18px] font-semibold leading-tight text-ink">{c.title}</h3>
              </div>
              {/* Teal-chevron bullets */}
              <ul className="mt-4 space-y-2">
                {c.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-mist">
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-[13px] leading-none text-electric">
                      →
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page sections                                                       */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Build #32 / #34: LIVE AI diagnostic (client-side call + fallback).  */
/* The response shape + defensive normalization live in lib/audit/ai.ts */
/* ------------------------------------------------------------------ */





/** Build #28: Methodology: horizontal stepper (borderless step nodes joined
 * by a gradient connector line). Replaces the old numbered-card pipeline.
 * Captions (Free Instant Audit / 5-D Assessment / 14-Day Sprint) kept as small
 * sub-captions under each node. */
function HowItWorks() {
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
      { threshold: 0.3 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  const reveal = visible ? "mr-step-reveal" : "opacity-0";
  const line = visible ? "mr-line-draw" : "opacity-0";
  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-[#0B1220] py-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-indigo/[0.08] blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border-electric/40 text-electric">Methodology</span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Diagnose <span className="text-electric">→</span> Prescribe{" "}
            <span className="text-electric">→</span> Activate
          </h2>
          <p className="mt-2 text-sm text-mist sm:text-base">
            One readiness scorecard, three moves: diagnose the friction, prescribe the fixes,
            activate the launch.
          </p>
        </div>

        {/* Stepper */}
        <div className="relative mt-5">
          {/* Gradient connector line (desktop only): draws on when the section is seen */}
          <div
            aria-hidden="true"
            className={`absolute left-[16%] right-[16%] top-[13px] hidden h-px bg-gradient-to-r from-electric/0 via-electric/60 to-indigo/60 md:block ${line}`}
          />
          <ol className="grid gap-6 md:grid-cols-3 md:gap-6">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <li
                key={step.n}
                className={`relative flex flex-col items-center text-center ${reveal}`}
                style={{ animationDelay: `${220 + i * 180}ms` }}
              >
                {/* Small indicator dot */}
                <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-electric/40 bg-[#0B1220] text-[10px] font-bold text-electric shadow-[0_0_12px_rgba(20,184,166,0.35)]">
                  <span
                    aria-hidden="true"
                    className="absolute -inset-1 rounded-full bg-electric/15 blur-sm"
                  />
                  <span className="relative">{step.n}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}


function EngineCardRow({
  paramId,
  tag,
  accent,
  expanded,
  onToggle,
}: {
  paramId: string;
  tag: string;
  accent: PillarAccent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = METHODOLOGY_COPY[paramId];
  const isTeal = accent === "electric";
  return (
    <div
      className={`border-l-2 transition-colors duration-200 ${
        expanded
          ? isTeal
            ? "border-electric/60 bg-electric/[0.04]"
            : "border-indigo/60 bg-indigo/[0.04]"
          : "border-transparent hover:bg-white/[0.02]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h4 className="text-sm font-semibold text-ink">{PARAMETER_NAMES[paramId]}</h4>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              isTeal
                ? "border-electric/30 bg-electric/10 text-electric"
                : "border-indigo/30 bg-indigo/10 text-indigo"
            }`}
          >
            {tag}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="px-5 pb-4">
          <p className="text-xs leading-relaxed text-mist">{CELL_LINES[paramId]}</p>
          <p className="mt-2.5 border-t border-hairline pt-2.5 text-xs leading-relaxed text-zinc-400">
            <span className={`font-medium ${isTeal ? "text-electric" : "text-indigo"}`}>
              Why it matters:{" "}
            </span>
            {meta.why}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Build #NN: Diagnostic Engine, owner 2-column spec (Pillar stack +   */
/* mint gauge). The 68/100 gauge and the per-pillar status pills are   */
/* ILLUSTRATIVE DEMO UI only, not a real measured score of any site.  */
function EngineMintGauge({ active }: { active: boolean }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  /* The 38/100 value is ILLUSTRATIVE DEMO UI, not a real measured score of
     any site. Sweep the red/coral arc from 0% to the 38% demo value once the
     section scrolls into view, after the 360° radar scan finishes (the arc
     transition is delayed by the scan duration on first reveal). */
  const offset = active ? `${c * (1 - 0.38)}` : `${c}`;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
      {/* Red/coral halo glow: warning-toned because this demo score is low */}
      <div
        aria-hidden="true"
        className="mr-glow-pulse absolute -inset-2 rounded-full bg-[#EF4444]/25 blur-2xl"
      />
      {/* Radar scan sweep: a conic wedge + radiant laser line rotate 360° once
          on scroll into view, then fade out (reduced-motion disables it). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[11%] rounded-full ${
          active ? "mr-radar-scan active-scan" : ""
        }`}
      >
        <div className="absolute inset-0 mr-radar-wedge" />
        <div className="mr-radar-line" />
      </div>
      <svg
        viewBox="0 0 160 160"
        className="relative h-full w-full -rotate-90"
        role="img"
        aria-label="Illustrative overall readiness score: 38 out of 100"
      >
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="#EF4444"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.38} ${c}`}
          strokeDashoffset={offset}
          className="mr-gauge-sweep"
          style={{
            filter: "drop-shadow(0 0 8px rgba(239,68,68,0.9))",
            transitionDelay: active ? "1.2s" : "0ms",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold leading-none tabular-nums text-[#F87171] drop-shadow-[0_2px_12px_rgba(239,68,68,0.5)] sm:text-[2.5rem]">
          38
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          / 100
        </span>
        <span className="mt-1.5 font-bold text-xs uppercase tracking-wider text-red-500">
          High Risk
        </span>
      </div>
    </div>
  );
}

/** Illustrative demo status per pillar (UI only; not a real measured
 * score). Tones map to amber (needs refinement) and rose (critical gap). */
const PILLAR_STATUS: Record<string, { label: string; cls: string }> = {
  "pillar-positioning": {
    label: "CRITICAL GAP",
    cls: "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#F87171]",
  },
  "pillar-messaging": {
    label: "NEEDS REFINEMENT",
    cls: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FBBF24]",
  },
  "pillar-gtm": {
    label: "NEEDS REFINEMENT",
    cls: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FBBF24]",
  },
};

function DiagnosticEngine() {
  const [expandedPillar, setExpandedPillar] = useState<string | null>("pillar-positioning");
  const [hoveredPillar, setHoveredPillar] = useState<string | null>(null);
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

  /* Reveal classes: stagger IO-based anims. Left text first, gauge second,
     pillar stack slides in from the right last. Reduced-motion kills these
     via the CSS media query (simply rendering with no animation). */
  const revealLeft = visible ? "mr-step-reveal" : "opacity-0";
  const revealGauge = visible ? "mr-step-reveal" : "opacity-0";
  const revealStack = visible ? "mr-shift-slide" : "opacity-0";
  const revealBottom = visible ? "mr-step-reveal" : "opacity-0";

  return (
    <section
      ref={sectionRef}
      id="methodology"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-[#111827] py-10"
    >
      {/* Ambient glow meshes behind the section: indigo top-right, teal
          bottom-left (build #13 set: /10 opacity, pointer-events-none,
          heavy blur). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-12%] h-96 w-96 rounded-full bg-indigo/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-10%] left-[-12%] h-96 w-96 rounded-full bg-electric/10 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8">
          {/* LEFT (lg:col-span-4): title + paragraph + bottom subtext only */}
          <div className={`flex flex-col lg:col-span-4 ${revealLeft}`}>
            <span className="chip self-start border-electric/40 text-electric">Scoring System</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              The MarketReady Diagnostic Engine
            </h2>
            <p className="mt-3 text-lg text-mist">
              Instant, zero-friction automated URL analysis: nine core dimensions scored in
              seconds, grouped into three pillars.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-mist">
              The AI audit reads your live site and maps every signal to one of nine scored
              dimensions, grouped into three pillars: how you position, how you message, and how
              fast you launch. It pinpoints where each breaks, what it costs you, and what to fix
              first.
            </p>
            {/* Bottom subtext */}
            <p className="mt-6 text-sm text-zinc-500">
              Every dimension maps to a scored signal in your audit, with rewrites for the gaps
              that cost you conversion.
            </p>
          </div>

          {/* MIDDLE (lg:col-span-3): glassmorphism gauge score card */}
          <div className={`flex flex-col items-center lg:col-span-3 ${revealGauge}`} style={{ animationDelay: "120ms" }}>
            <div className="flex flex-col items-center rounded-2xl border border-[#EF4444]/25 bg-[#1E293B]/40 px-5 py-5 shadow-[0_0_44px_rgba(239,68,68,0.14)] backdrop-blur-md">
              <EngineMintGauge active={visible} />
            </div>
          </div>

          {/* RIGHT (lg:col-span-5): connective node + pillar accordion stack */}
          <div className={`flex items-stretch gap-3 lg:col-span-5 lg:gap-4 ${revealStack}`} style={{ animationDelay: "240ms" }}>
            {/* Connective node: one segment per pillar, aligned to each accordion
                card. Active/hovered pillar lights its segment + travels a pulse. */}
            <div aria-hidden="true" className="hidden w-6 shrink-0 flex-col items-center justify-around sm:flex">
              {PILLARS.map((pillar) => {
                const active = expandedPillar === pillar.id || hoveredPillar === pillar.id;
                const accent = pillar.accent === "electric" ? "electric" : "indigo";
                return (
                  <div key={pillar.id} className="flex flex-col items-center gap-2">
                    <div className="relative h-px w-full overflow-visible bg-white/10">
                      <span
                        className={`absolute inset-0 transition-colors duration-300 ${
                          active
                            ? accent === "electric"
                              ? "bg-gradient-to-r from-transparent from-10% via-electric to-electric"
                              : "bg-gradient-to-r from-transparent from-10% via-indigo to-indigo"
                            : "bg-transparent"
                        }`}
                      />
                      {active && (
                        <span
                          className={`mr-data-pulse absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                            accent === "electric"
                              ? "bg-electric shadow-[0_0_10px_rgba(20,184,166,0.9)]"
                              : "bg-indigo shadow-[0_0_10px_rgba(99,102,241,0.9)]"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                        active
                          ? accent === "electric"
                            ? "bg-electric shadow-[0_0_8px_rgba(20,184,166,0.9)]"
                            : "bg-indigo shadow-[0_0_8px_rgba(99,102,241,0.9)]"
                          : "bg-white/25"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Pillar accordion stack */}
            <div className="w-full min-w-0 flex-1 space-y-3">
              {PILLARS.map((pillar) => {
                const isTeal = pillar.accent === "electric";
                const status = PILLAR_STATUS[pillar.id];
                const open = expandedPillar === pillar.id;
                const hasActive = expandedPillar !== null;
                return (
                  <div
                    key={pillar.id}
                    onMouseEnter={() => setHoveredPillar(pillar.id)}
                    onMouseLeave={() => setHoveredPillar(null)}
                    className={`overflow-hidden rounded-xl border bg-[#1E293B]/50 backdrop-blur-md transition-all duration-300 ${
                      hasActive && !open ? "opacity-55" : "opacity-100"
                    } ${
                      isTeal
                        ? open
                          ? "border-electric/40 shadow-[0_0_28px_rgba(20,184,166,0.12)]"
                          : "border-hairline hover:border-electric/40"
                        : open
                          ? "border-indigo/40 shadow-[0_0_28px_rgba(99,102,241,0.12)]"
                          : "border-hairline hover:border-indigo/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPillar((cur) => (cur === pillar.id ? null : pillar.id))
                      }
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isTeal ? "bg-electric/15 text-electric" : "bg-indigo/15 text-indigo"
                        }`}
                      >
                        {pillar.num}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                          Pillar {pillar.num}
                        </span>
                        <span className="block text-sm font-semibold leading-tight text-ink">
                          {pillar.title}
                        </span>
                        <span className="hidden text-[11px] text-zinc-500 sm:block">{pillar.summary}</span>
                      </span>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.cls}`}
                      >
                        {status.label}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="mr-acc-reveal divide-y divide-hairline/60 border-t border-hairline/60">
                        {pillar.params.map((p) => (
                          <EngineCardRow
                            key={p.id}
                            paramId={p.id}
                            tag={p.tag}
                            accent={pillar.accent}
                            expanded={expanded === p.id}
                            onToggle={() => setExpanded((cur) => (cur === p.id ? null : p.id))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className={`mt-8 text-center text-sm text-zinc-500 ${revealBottom}`} style={{ animationDelay: "360ms" }}>
          The 38/100 score and pillar statuses above are illustrative demo UI, not a real
          measured score. Run the full diagnostic to see your actual readiness.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/* ---- Build (content pass): Founder credibility section ---- */
/* Founder section: single-column header (icon + title inline, subhead below,
   inline value-pill badges) above the monochrome logo marquee and a 3-card
   offering grid (Diagnostic Audit / Positioning Sprint / Fractional GTM Lead).
   Full-width section; stacks to 1 col on mobile. No em/en dashes anywhere in
   the copy (owner spec rendered dash-free). */

/* Founder-experience brands for the logo marquee. Honest framing: these are
   brands the founder's teams worked at, NOT MarketReady clients, so no "trusted
   by" label appears. Every brand uses its AUTHENTIC vector logo file (sourced
   from Wikimedia Commons, rendered as a white silhouette via the .logo-mono /
   brightness-0 invert filter). No text-wordmark fallbacks remain. */
/* Ordering reflects the owner-confirmed target sequence. Amazon was sourced
   (Wikimedia Commons "Amazon logo.svg" - authentic wordmark, no bg). Impact.com
   and Nativo are NOT in this list: no clean authentic monochrome-rendering vector
   could be sourced from any legitimate public source (Impact.com only ships raster
   WebP/JPG/PNG logos; Nativo was acquired/rebranded to Life360 Ads and its site
   carries no Nativo vector). They are omitted rather than faked. */
const FOUNDER_CRED_BRANDS: { label: string; src: string }[] = [
  { label: "Amazon", src: "/logos/amazon.svg" },
  { label: "Warner Bros. Discovery", src: "/logos/wbd.svg" },
  { label: "TNT Sports", src: "/logos/tntsports.svg" },
  { label: "TBS", src: "/logos/tbs.svg" },
  { label: "Bleacher Report", src: "/logos/bleacherreport.svg" },
  { label: "Variety", src: "/logos/variety.svg" },
  { label: "AEW", src: "/logos/aew.svg" },
  { label: "NCAA", src: "/logos/ncaa.svg" },
];

/* Network / nodes icon (glowing) beside the headline. */
function FounderNetworkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-10 w-10 text-electric drop-shadow-[0_0_14px_rgba(20,184,166,0.55)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <path d="M12 7.2v3.3M6.2 16.4l5-5M17.8 16.4l-5-5" />
    </svg>
  );
}

/* Three compact proof badges shown as a tight horizontal pill row directly
   under the founder subhead. Text-only labels (no icons); rendered as small
   slate pills. */
const FOUNDER_VALUE_BADGES = [
  "Executive PMM Expertise",
  "Strategic Positioning Clarity",
  "Direct GTM Partnership",
];

function FounderCredibility() {
  return (
    <section
      id="founder"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-[#0F172A] py-10 px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-indigo/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-[-10%] h-80 w-80 rounded-full bg-electric/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl">
        {/* Centered leadership hero: icon + title inline centered, subhead
            below, then value-pill badges as a centered horizontal row. */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-3">
            <FounderNetworkIcon />
            <h2 className="text-3xl lg:text-5xl font-bold text-white">
              PMM Leadership, Not an Agency.
            </h2>
          </div>
          <p className="text-slate-300 text-lg mt-3 leading-relaxed max-w-2xl mx-auto">
            Direct, senior-level GTM strategy built for speed and impact: without the agency
            overhead, junior account reps, or inflated retainers.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6 mb-10">
            {FOUNDER_VALUE_BADGES.map((label) => (
              <span
                key={label}
                className="bg-slate-900/80 border border-slate-800 rounded-full py-1.5 px-4 text-xs font-medium text-slate-300 shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Logo marquee: infinite ticker directly below the badges, no label
            above. A row of AUTHENTIC vector brand logos (white silhouettes
            via brightness-0 invert), duplicated for a seamless loop, with edge
            fade masks. Honest framing: brands the founder's teams worked at,
            not clients. */}
        <div className="mt-10 mb-4">
          <div className="mr-marquee" aria-hidden="true">
            <div className="mr-marquee-track">
              {[0, 1].map((i) => (
                <div key={i} className="mr-logo-group">
                  {FOUNDER_CRED_BRANDS.map((b) => (
                    <div
                      key={`${i}-${b.label}`}
                      className="flex items-center justify-center h-10 w-auto px-6"
                    >
                      <img
                        src={b.src}
                        alt=""
                        loading="lazy"
                        className="max-h-7 max-w-[150px] w-auto h-auto object-contain brightness-0 invert opacity-75 transition-opacity hover:opacity-100"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Build (content restructure): compact 3-column pricing grid in the    */
/* services / engagement-models area. Consolidates the paid offers into */
/* a tight side-by-side grid: $3,000 Diagnostic Audit (featured) ->     */
/* $7,500 14-Day Sprint -> Custom Fractional GTM Lead retainer. The     */
/* free tier was removed because the interactive AI diagnostic already  */
/* lives at the top of the page. Featured Card 1 carries a teal glow    */
/* border (#14B8A6) with a teal MOST POPULAR badge floated above it.    */
/* No em/en dashes anywhere (periods and commas only; pipe in badge).  */
/* ------------------------------------------------------------------ */
/* Stage 01: $3,000 Diagnostic Audit */
const DIAGNOSTIC_ITEMS = [
  "9-Parameter Messaging Teardown",
  "Value Prop & ICP Scorecard",
  "Executive Strategy Action Plan",
  "Competitive Gap Analysis",
  "Funnel Leakage Map",
  "45-Min Live Strategy Review",
] as const;
/* Stage 02: 14-Day Sprint ($7,500) */
const SPRINT_ITEMS = [
  "Positioning Architecture",
  "Full Messaging House",
  "Homepage Copy Rewrite",
  "ICP & Persona Map",
  "Differentiation Matrix",
  "Core Sales Playbook",
  "Launch Deck & GTM Plan",
  "60-Min Handover Session",
] as const;
/* Stage 03: Fractional GTM Lead (Custom) */
const FRACTIONAL_ITEMS = [
  "Embedded PMM Leadership",
  "Strategic Launch Planning",
  "Ongoing Copy & Asset Audits",
  "Sales Enablement & Training",
  "Weekly Strategic Syncs",
] as const;
function ServicesStack() {
  return (
    <section
      id="services"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-slate-950 py-8 px-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/30 via-slate-950 to-slate-950"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[size:24px_24px]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)",
        }}
      />
      <div className="relative mx-auto max-w-[1100px]">
        <h2 className="text-[26px] lg:text-[28px] font-bold text-[#F9FAFB] text-center leading-tight">
          Got your score? Here's how we fix the gaps.
        </h2>
        <p className="text-[13px] sm:text-sm text-[#9CA3AF] text-center mb-7 leading-snug">
          Choose the high-velocity engagement model that fits your product launch timeline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Stage 01: $3,000 Diagnostic Audit (FEATURED CORE OFFER) */}
          <div className="relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap text-teal-400 font-bold text-[10px] uppercase tracking-wider">
              MOST POPULAR | CORE ENGAGEMENT
            </span>
            <div className="rounded-xl p-5 bg-[#111827] border-[1.5px] border-[#14B8A6] shadow-[0_0_36px_-10px_rgba(20,184,166,0.45)] h-full">
              <div className="flex items-center justify-center">
                <span className="bg-teal-400/10 text-teal-300 text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full border border-teal-500/30">
                  Stage 01
                </span>
              </div>
              <h3 className="mt-2.5 text-lg font-bold text-white text-center">Diagnostic Audit</h3>
              <div className="mt-0.5 text-[28px] font-bold text-white text-center leading-tight">
                $3,000
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-teal-400/80 font-semibold text-center">
                3-Business-Day Delivery
              </p>
              <p className="mt-2 text-xs text-[#9CA3AF] leading-relaxed mb-3 text-center">
                Comprehensive human teardown of your positioning, site copy, and GTM funnel.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-200">
                {DIAGNOSTIC_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#14B8A6] shrink-0">✓</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/services/audit"
                className="mt-4 flex h-[38px] w-full items-center justify-center rounded-lg bg-[#14B8A6] text-[13px] font-bold text-slate-950 hover:brightness-110 transition-all"
              >
                Get Diagnostic Audit →
              </a>
            </div>
          </div>

          {/* Stage 02: 14-Day Sprint ($7,500) */}
          <div className="rounded-xl p-5 bg-[#111827] border border-white/10 h-full">
            <div className="flex items-center justify-center">
              <span className="bg-slate-800/80 text-teal-400 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">
                Stage 02
              </span>
            </div>
            <h3 className="mt-2.5 text-lg font-bold text-white text-center">14-Day Sprint</h3>
            <div className="mt-0.5 text-[28px] font-bold text-white text-center leading-tight">
              $7,500
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-center">
              2-Week Execution Sprint
            </p>
            <p className="mt-2 text-xs text-[#9CA3AF] leading-relaxed mb-3 text-center">
              Full positioning overhaul and launch assets built directly from diagnostic insights.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {SPRINT_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#14B8A6] shrink-0">✓</span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/services/sprint"
              className="mt-4 flex h-[38px] w-full items-center justify-center rounded-lg border border-[#14B8A6] text-[13px] font-bold text-teal-300 hover:bg-teal-500/10 transition-all"
            >
              Book 14-Day Sprint →
            </a>
          </div>

          {/* Stage 03: Fractional GTM Lead */}
          <div className="rounded-xl p-5 bg-[#111827] border border-white/10 h-full">
            <div className="flex items-center justify-center">
              <span className="bg-slate-800/80 text-teal-400 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">
                Stage 03
              </span>
            </div>
            <h3 className="mt-2.5 text-lg font-bold text-white text-center">Fractional GTM Lead</h3>
            <div className="mt-0.5 text-[28px] font-bold text-white text-center leading-tight">
              Custom
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-center">
              Monthly Retainer
            </p>
            <p className="mt-2 text-xs text-[#9CA3AF] leading-relaxed mb-3 text-center">
              Embedded PMM leadership to guide execution, launch strategy, and team alignment.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {FRACTIONAL_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#14B8A6] shrink-0">✓</span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/services/fractional"
              className="mt-4 flex h-[38px] w-full items-center justify-center rounded-lg border border-white/20 text-[13px] font-bold text-white hover:bg-white/5 transition-all"
            >
              Explore Fractional Lead →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- FAQ accordion (one open at a time) ---- */

const FAQ_ITEMS = [
  {
    q: "Do you work with a team, or is it just you?",
    a: "MarketReady is a high-touch, single-operator practice led directly by a senior Product Marketing strategist. You work 1-on-1 with the strategist on every deliverable: no account managers, junior hand-offs, or agency bloat.",
  },
  {
    q: "How much does the MarketReady Sprint cost?",
    a: "Sprints are a flat $7,500 for a full 14-day engagement. No hourly billing, no hidden fees, and no scope creep. You receive fully finished positioning architecture, website copy rewrites, sales talk tracks, and launch assets.",
  },
  {
    q: "Do I need to book a call before purchasing?",
    a: "No. If your Diagnostic scores clearly show what needs fixing and you're ready to move fast, you can select 'Skip the call, buy now' to secure your 14-day window immediately.",
  },
  {
    q: "Does the Sprint include live team training?",
    a: "The Sprint focuses on strategy and finished, ready-to-use assets. Live team training, sales enablement sessions, and ongoing execution are covered under the Fractional GTM Lead retainer.",
  },
  {
    q: "I want more than the free score, but I'm not ready for the full Sprint: is there anything in between?",
    a: "Yes: the MarketReady Audit is a human-led review (3 to 5 days, $3,000) that gives you a written diagnosis and prioritized recommendations without the full Sprint build-out. $3,000 of your Audit fee applies toward the Sprint if booked within 30 days.",
  },
] as const;

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section
      id="faq"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-[#030712] py-10"
    >
      {/* Deep-band ambient glow behind the FAQ: subtle indigo halo at the
          bottom so the near-black band settles softly into the footer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo/[0.07] blur-3xl"
      />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border-electric/40 text-electric">FAQ</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <div className="mx-auto mt-6 max-w-3xl">
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-button-${i}`;
              return (
                <div
                  key={item.q}
                  className={`glass-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${
                    isOpen ? "border-electric/40" : "hover:border-zinc-600"
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
                            ? "border-electric/50 bg-electric/15 text-electric"
                            : "border-hairline bg-white/[0.03] text-zinc-500"
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
                      <p className="border-t border-hairline/70 px-6 pb-5 pt-4 text-sm leading-relaxed text-mist">
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
/* Founder-experience logo bar: shared component (build #22).         */
/* Rendered directly below the hero (build #28: the calculator/       */
/* DiagnosticInsights blocks moved into the hero, and the insights    */
/* grid was removed for the single-grid rule). Honest framing: these  */
/* are brands the founder's teams worked at, not MarketReady clients. */
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
  // Build #19: pricing-tier CTAs pass the service to pre-check in the booking
  // modal; the header/hero/footer CTAs call with no arg, which resets the
  // preselect so the modal opens with the default empty checklist.
  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      {/* Build #13: dark obsidian page gradient restored (build #12's purple/teal
          bloom stops removed): deep slate at the top, charcoal mid-page,
          settling to the #030712 base at the bottom. Mirrors the body gradient
          in src/styles/app.css. */}
      <Header />
      <main>
        <HeroDiagnostic onBookBriefing={openBooking} />
        {/* Build #NN: Problem Agitation directly below the hero */}
        <ProblemAgitation />
        {/* Build #30: FounderLogos ticker + mid-banner strip removed from the
            homepage (owner direction). Hero now flows directly into Section 2. */}
        {/* Build #28: Methodology stepper (section 2) */}
        <HowItWorks />
        {/* Build #28: Diagnostic Engine: the single 3-card grid on the page */}
        <DiagnosticEngine />
        {/* Content pass: founder credibility directly below the Diagnostic */}
        <FounderCredibility />
        {/* Content restructure: one compact 3-stage service stack */}
        <ServicesStack />
        {/* Build #26: FAQ accordion */}
        <FaqAccordion />
      </main>
      <Footer onBook={openBooking} />
      {/* Mount gate: closing unmounts the modal, which resets its internal
          state (status back to "form") and runs the scroll/focus cleanup. */}
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
