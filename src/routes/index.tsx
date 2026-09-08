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
    body: "I run your site through the free diagnostic and show you exactly where your positioning is leaking trust.",
  },
  {
    n: "02",
    name: "Prescribe",
    body: "I turn the flagged gaps into a fix plan: positioning, messaging, and the assets that carry them.",
  },
  {
    n: "03",
    name: "Activate",
    body: "We ship the fixes together in a focused sprint, then keep your launch momentum compounding.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Manifesto: first-person statement of why MarketReady exists.        */
/* No stats, no proof points, just the founder's belief.               */
/* ------------------------------------------------------------------ */
function Manifesto() {
  return (
    <section id="manifesto" className="scroll-mt-24 border-t border-hairline bg-cream py-14 sm:py-[4.5rem]">
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow text-navy">Why I built this</p>
        <blockquote className="mt-5 font-display text-xl leading-snug text-ink sm:text-[22px]">
          Most startups don't have a product problem. They have a language
          problem. I started MarketReady so founders could hear, plainly, how
          their GTM sounds to a first-time buyer, and fix it before it costs
          them the launch.
        </blockquote>
        <p className="mt-5 text-sm font-semibold text-ember">Wasani, Founder</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Friction observations: first-person, stat-free. Per owner spec §12:  */
/* no framework-style titles, no headline stats, no invented citations; */
/* each observation stands alone as the card's lead line.               */
/* ------------------------------------------------------------------ */
function FrictionObservations() {
  const cards = [
    {
      header: "Explaining, not selling",
      body: "I've sat on demo calls where the first 30 minutes go to explaining the category, not selling the product. That's not a sales problem. That's a positioning problem.",
    },
    {
      header: "The ads were never the problem",
      body: "I've watched founders pour six figures into paid traffic before fixing copy that bounces visitors in under 8 seconds. The ads were never the problem.",
    },
    {
      header: "Discounting to close",
      body: "When buyers can't tell you apart from a cheaper option, your reps discount to close. I've seen this kill margins on otherwise strong products.",
    },
  ];
  return (
    <section id="friction" className="scroll-mt-24 border-t border-hairline bg-sand py-14 sm:py-[4.5rem]">
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="grid items-start gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <p className="eyebrow text-navy">What I keep seeing</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-[32px]">
              The patterns I see holding back growth
            </h2>
            <p className="mt-3 max-w-[36rem] text-base leading-relaxed text-mist">
              After years inside media and tech brands, I notice the same three
              failure modes. If any of these sound familiar, your positioning is
              doing it, not your product.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:col-span-8 md:grid-cols-3">
            {cards.map((card) => (
              <article key={card.header} className="glass-card-sand flex h-full flex-col p-6">
                <h3 className="font-display text-lg font-semibold leading-snug text-navy">
                  {card.header}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-mist">{card.body}</p>
              </article>
            ))}
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
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-cream py-16 sm:py-[4.5rem]"
    >
      <div className="relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="grid items-end gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-8">
            <p className="eyebrow text-navy">How I work</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-[32px]">
              Diagnose. Prescribe. Activate.
            </h2>
            <p className="mt-3 max-w-[36rem] text-base leading-relaxed text-mist">
              One readiness score, three moves. I diagnose where your positioning
              breaks, prescribe the highest-impact fixes, and activate them with you.
            </p>
            <p className="mt-3 max-w-[36rem] text-base leading-relaxed text-mist">
              I built this in this exact order because most founders try to activate before they've diagnosed the actual problem. That's how budget gets wasted on the wrong fix.
            </p>
          </div>
          <div className="md:col-span-4 md:justify-self-end md:pb-1">
            <a href="/services/diagnostic" className="btn-electric">
              Get Your MarketReady Score →
            </a>
          </div>
        </div>

        <div className="relative mt-10">
          <div
            aria-hidden="true"
            className={`absolute left-[16%] right-[16%] top-[13px] hidden h-px bg-hairline md:block ${line}`}
          />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <li
                key={step.n}
                className={`relative flex flex-col items-start text-left ${reveal}`}
                style={{ animationDelay: `${220 + i * 180}ms` }}
              >
                <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-cream text-[10px] font-bold text-mist">
                  <span className="relative">{step.n}</span>
                </span>
                <h3 className="mt-4 font-display text-xl text-ink">{step.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{step.body}</p>
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
  const isEmber = accent === "electric";
  return (
    <div
      className={`border-l-2 transition-colors duration-200 ${
        expanded
          ? isEmber
            ? "border-ember/60 bg-ember/[0.05]"
            : "border-pinetint/40 bg-ink/[0.03]"
          : "border-transparent hover:bg-ink/[0.02]"
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
              isEmber
                ? "border-ember/30 bg-ambertint text-emberdeep"
                : "border-pinetint/30 bg-ink/[0.04] text-pinetint"
            }`}
          >
            {tag}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-fog transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="px-5 pb-4">
          <p className="text-xs leading-relaxed text-mist">{CELL_LINES[paramId]}</p>
          <p className="mt-2.5 border-t border-hairline pt-2.5 text-xs leading-relaxed text-mist">
            <span className={`font-medium ${isEmber ? "text-ember" : "text-pinetint"}`}>
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
/* Diagnostic Engine (owner 2-column spec: pillar stack + gauge).      */
/* The 38/100 gauge and pillar status pills are ILLUSTRATIVE DEMO UI   */
/* only, not a real measured score of any site.                        */
/* ------------------------------------------------------------------ */
function EngineMintGauge({ active }: { active: boolean }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  /* The 38/100 value is ILLUSTRATIVE DEMO UI, not a real measured score of
     any site. Sweep the arc from 0% to the 38% demo value once the section
     scrolls into view. */
  const offset = active ? `${c * (1 - 0.38)}` : `${c}`;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
      <div
        aria-hidden="true"
        className="mr-glow-pulse absolute -inset-2 rounded-full bg-ember/20 blur-2xl"
      />
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
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(245,240,232,0.16)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="#C4603A"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.38} ${c}`}
          strokeDashoffset={offset}
          className="mr-gauge-sweep"
          style={{
            transitionDelay: active ? "1.2s" : "0ms",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold leading-none tabular-nums text-scorerefine sm:text-[2.5rem]">
          38
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-pinetint">
          / 100
        </span>
        <span className="mt-1.5 text-xs font-bold uppercase tracking-wider text-ember">
          High Risk
        </span>
      </div>
    </div>
  );
}

/** Illustrative demo status per pillar (UI only; not a real measured score). */
const PILLAR_STATUS: Record<string, { label: string; cls: string }> = {
  "pillar-positioning": {
    label: "CRITICAL GAP",
    cls: "border-ember/40 bg-ambertint text-emberdeep",
  },
  "pillar-messaging": {
    label: "NEEDS REFINEMENT",
    cls: "border-scorerefine/40 bg-scorerefine/10 text-scorerefine",
  },
  "pillar-gtm": {
    label: "NEEDS REFINEMENT",
    cls: "border-scorerefine/40 bg-scorerefine/10 text-scorerefine",
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

  const revealLeft = visible ? "mr-step-reveal" : "opacity-0";
  const revealGauge = visible ? "mr-step-reveal" : "opacity-0";
  const revealStack = visible ? "mr-shift-slide" : "opacity-0";
  const revealBottom = visible ? "mr-step-reveal" : "opacity-0";

  return (
    <section
      ref={sectionRef}
      id="methodology"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-navy py-16 sm:py-[4.5rem]"
    >
      <div className="relative mx-auto w-full max-w-[1200px] overflow-hidden px-6 sm:px-12">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8">
          <div className={`flex flex-col lg:col-span-4 ${revealLeft}`}>
            <p className="eyebrow text-pinetint">My scoring system</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
              The MarketReady Diagnostic Engine
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-mist">
              This is how I read your site: nine dimensions, scored in seconds,
              grouped into three pillars.
            </p>
            <p className="mt-3 text-base leading-relaxed text-mist/90">
              After years running product marketing at Amazon, Warner Bros. Discovery, and Bleacher Report, I built this scorecard around the same 9 things I check on every positioning teardown.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-mist/85">
              I map every signal to one of nine scored dimensions, grouped into
              three pillars: how you position, how you message, and how fast you
              launch. You see where each breaks, what it costs you, and what to
              fix first.
            </p>
            <p className="mt-6 text-sm text-mist/70">
              Every dimension maps to a scored signal in your audit, with rewrites
              for the gaps that cost you conversion.
            </p>
          </div>

          <div className={`flex flex-col items-center lg:col-span-3 ${revealGauge}`} style={{ animationDelay: "120ms" }}>
            <div className="pine-card flex flex-col items-center px-7 py-7">
              <EngineMintGauge active={visible} />
            </div>
          </div>

          <div className={`flex items-stretch gap-3 lg:col-span-5 lg:gap-4 ${revealStack}`} style={{ animationDelay: "240ms" }}>
            <div aria-hidden="true" className="hidden w-6 shrink-0 flex-col items-center justify-around sm:flex">
              {PILLARS.map((pillar) => {
                const active = expandedPillar === pillar.id || hoveredPillar === pillar.id;
                const accent = pillar.accent === "electric" ? "ember" : "pinetint";
                return (
                  <div key={pillar.id} className="flex flex-col items-center gap-2">
                    <div className="relative h-px w-full overflow-visible bg-ink/10">
                      <span
                        className={`absolute inset-0 transition-colors duration-300 ${
                          active
                            ? accent === "ember"
                              ? "bg-gradient-to-r from-transparent from-10% via-ember to-ember"
                              : "bg-gradient-to-r from-transparent from-10% via-pinetint to-pinetint"
                            : "bg-transparent"
                        }`}
                      />
                      {active && (
                        <span
                          className={`mr-data-pulse absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                            accent === "ember"
                              ? "bg-ember"
                              : "bg-pinetint"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                        active
                          ? accent === "ember"
                            ? "bg-ember"
                            : "bg-pinetint"
                          : "bg-ink/25"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="w-full min-w-0 flex-1 space-y-3">
              {PILLARS.map((pillar) => {
                const isEmber = pillar.accent === "electric";
                const status = PILLAR_STATUS[pillar.id];
                const open = expandedPillar === pillar.id;
                const hasActive = expandedPillar !== null;
                return (
                  <div
                    key={pillar.id}
                    onMouseEnter={() => setHoveredPillar(pillar.id)}
                    onMouseLeave={() => setHoveredPillar(null)}
                    className={`glass-card overflow-hidden transition-all duration-300 ${
                      hasActive && !open ? "opacity-55" : "opacity-100"
                    } ${
                      isEmber
                        ? open
                          ? "border-ember/40"
                          : "hover:border-ember/40"
                        : open
                          ? "border-pinetint/40"
                          : "hover:border-pinetint/40"
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
                          isEmber ? "bg-ambertint text-emberdeep" : "bg-ink/[0.04] text-pinetint"
                        }`}
                      >
                        {pillar.num}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-semibold uppercase tracking-widest text-fog">
                          Pillar {pillar.num}
                        </span>
                        <span className="block text-sm font-semibold leading-tight text-ink">
                          {pillar.title}
                        </span>
                        <span className="hidden text-[11px] text-fog sm:block">{pillar.summary}</span>
                      </span>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.cls}`}
                      >
                        {status.label}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-fog transition-transform duration-200 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="mr-acc-reveal divide-y divide-hairline border-t border-hairline">
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
        <p className={`mt-8 text-left text-sm text-fog ${revealBottom}`} style={{ animationDelay: "360ms" }}>
          The 38/100 score and pillar statuses above are a sample for
          illustration only, not a real measured score. Run the free diagnostic
          to see your actual readiness.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Founder story (first-person). The logo marquee below is untouched:  */
/* the same authentic brand marks, brands the founder's teams worked   */
/* at, not MarketReady clients.                                        */
/* ------------------------------------------------------------------ */

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

/* Founder bio (owner spec §12): first-person founder copy replaces the   */
/* old keyword-fragment badges. Logo bar directly beneath; no photo here   */
/* (headshot stays on /about only).                                        */

function FounderStory() {
  return (
    <section
      id="founder"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-cream py-14 sm:py-[4.5rem]"
    >
      <div className="relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="grid items-start gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-4">
            <p className="eyebrow">A note from the founder</p>
            <h2 className="font-display text-3xl text-ink lg:text-[32px]">
              I've sat in the rooms where launches are won and lost.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-mist">
              Hi, I'm Wasani. I've spent years leading product marketing at Amazon, Warner Bros. Discovery (Bleacher Report), and other high-growth companies. I started MarketReady because I kept seeing the same thing: founders and growth teams scaling spend before their positioning could support it. This isn't an agency. It's me, working directly with you.
            </p>
          </div>

          <div className="md:col-span-8">
            <div className="mb-4 mt-2 md:mt-10">
              <div className="mr-marquee" aria-hidden="true">
                <div className="mr-marquee-track">
                  {[0, 1].map((i) => (
                    <div key={i} className="mr-logo-group">
                      {FOUNDER_CRED_BRANDS.map((b) => (
                        <div
                          key={`${i}-${b.label}`}
                          className="flex h-10 w-auto items-center justify-start px-6"
                        >
                          <img
                            src={b.src}
                            alt=""
                            loading="lazy"
                            className="h-auto max-h-7 w-auto max-w-[150px] object-contain opacity-75 transition-opacity hover:opacity-100"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-left text-xs text-fog">
              Brands my teams have worked with, not MarketReady clients.
            </p>
          </div>
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
        <Manifesto />
        <FrictionObservations />
        <HowItWorks />
        <DiagnosticEngine />
        <FounderStory />
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
