import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { WORK_CASES } from "~/lib/work/cases";
import { BookingModal } from "~/components/BookingModal";
import { Header, Footer, ChevronDown } from "~/components/Layout";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

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
    body: "I put the fixes into market through a focused sprint, turning strategy into work that gets shipped.",
  },
] as const;

/* Friction observations: first-person rows, compact warm-dark layout     */
/* (owner rework 2026-09-10): shortened intro, cited JOLT Effect stat    */
/* block in the left column, hover-lift rows (bg/numeral/header/tag),   */
/* sticky left column (overflow: clip on the section). Stacked-row        */
/* layout: ghosted serif numerals, sand headers, consequence tags.        */
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
              If any of these sound familiar, your positioning may be the problem, not your product.
            </p>
            <div className="friction-stat">
              <p className="friction-stat-figure">40–60%</p>
              <p className="friction-stat-body">
                of qualified B2B deals are lost to no decision, not to a
                competitor.
              </p>
              <p className="friction-stat-source">Matt Dixon, The JOLT Effect</p>
            </div>
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
/* Methodology: linked offer groups (label + track segments + columns) */
/* + closing CTA. Step copy lives in HOW_IT_WORKS_STEPS (unchanged).   */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const [stepDiagnose, stepPrescribe, stepActivate] = HOW_IT_WORKS_STEPS;
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-cream py-10 sm:py-12"
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
            When the positioning is wrong, everything downstream costs more.
          </h2>
          <p className="hiw-intro-2">
            Most teams jump straight to execution. I start by finding the
            problem worth fixing.
          </p>
        </div>

        {/* Offer groups: each offer is ONE hover target wrapping its label
            row, its track segment(s), and its column(s). Audit wraps
            Diagnose + Prescribe (segments 1-2); Sprint wraps Activate
            (segment 3). The outer grid's empty 2% column is the gap. */}
        <div className="hiw-groups">
          <a href="/services/audit" className="hiw-group hiw-group-audit">
            <div className="hiw-group-label">
              <span className="hiw-band-label">MarketReady Audit</span>
              <span className="hiw-band-days">3–5 DAYS</span>
            </div>
            <div className="hiw-group-track" aria-hidden="true">
              <span className="hiw-track-seg hiw-track-1" />
              <span className="hiw-track-seg hiw-track-2" />
            </div>
            <div className="hiw-group-cols">
              <div className="hiw-step hiw-step-01">
                <div className="hiw-step-head">
                  <span className="hiw-numeral">{stepDiagnose.n}</span>
                  <h3 className="hiw-title">{stepDiagnose.name}</h3>
                </div>
                <p className="hiw-body">{stepDiagnose.body}</p>
              </div>
              <div className="hiw-step hiw-step-02">
                <div className="hiw-step-head">
                  <span className="hiw-numeral">{stepPrescribe.n}</span>
                  <h3 className="hiw-title">{stepPrescribe.name}</h3>
                </div>
                <p className="hiw-body">{stepPrescribe.body}</p>
              </div>
            </div>
          </a>
          <a href="/services/sprint" className="hiw-group hiw-group-sprint">
            <div className="hiw-group-label">
              <span className="hiw-band-label">Positioning Sprint</span>
              <span className="hiw-band-days">14 DAYS</span>
            </div>
            <div className="hiw-group-track" aria-hidden="true">
              <span className="hiw-track-seg hiw-track-3" />
            </div>
            <div className="hiw-group-cols">
              <div className="hiw-step hiw-step-03">
                <div className="hiw-step-head">
                  <span className="hiw-numeral">{stepActivate.n}</span>
                  <h3 className="hiw-title">{stepActivate.name}</h3>
                </div>
                <p className="hiw-body">{stepActivate.body}</p>
              </div>
            </div>
          </a>
        </div>

        <div className="hiw-closing">
          <p className="hiw-credit">
            Start with the Audit. The fee credits toward the Sprint if you keep
            going.
          </p>
          <div className="text-center">
            <a href="/services/diagnostic" className="hiw-cta">
              Get Your MarketReady Score →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* ScoreCondensed (#score-condensed): condensed, non-interactive        */
/* homepage summary of the Diagnostic Engine. Full-bleed #1F1A16 with   */
/* the 28px grid overlay (no paper grain) and hairline top/bottom       */
/* rules. The full click-to-expand engine moved to /services/diagnostic */
/* (src/components/DiagnosticEngine.tsx) — this row summary is pure     */
/* presentation: no chevrons, no accordion, no gauge, no brackets.      */
/* ------------------------------------------------------------------ */
function ScoreCondensed() {
  const rows = [
    {
      counter: "PILLAR 01 / 03",
      name: "Core Positioning",
      flag: "◆ CRITICAL GAP",
      color: "#C4603A",
      lit: 3,
    },
    {
      counter: "PILLAR 02 / 03",
      name: "Messaging & Value Prop",
      flag: "◆ NEEDS REFINEMENT",
      color: "#C9992F",
      lit: 4,
    },
    {
      counter: "PILLAR 03 / 03",
      name: "GTM & Launch Velocity",
      flag: "◆ NEEDS REFINEMENT",
      color: "#C9992F",
      lit: 4,
    },
  ];

  return (
    <section
      id="score-condensed"
      className="score-condensed relative overflow-hidden"
    >
      {/* 28px grid overlay (absolute, behind content, pointer-events none). */}
      <svg
        aria-hidden="true"
        className="sc-grid"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="sc-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#2A2320" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sc-grid-pattern)" />
      </svg>
      <div className="sc-content relative mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="sc-layout">
          <div className="sc-left">
            <p className="sc-eyebrow">MY SCORING SYSTEM</p>
            <h2 className="sc-headline">The MarketReady Diagnostic Engine</h2>
            <p className="sc-intro">
              Nine dimensions, scored in seconds, grouped into three pillars:
              how you position, how you message, and how fast you launch.
            </p>
            <p className="sc-callout">
              A low score isn&apos;t an abstraction. It&apos;s the demo where
              30 minutes go to explaining the category, the ad spend that
              bounces, and the deal that closes at a discount.
            </p>
            <a href="/services/diagnostic" className="sc-link">
              SEE HOW THE SCORING WORKS →
            </a>
          </div>
          <div className="sc-pillars">
            {rows.map((row) => (
              <div key={row.counter} className="sc-row">
                <div className="sc-label">
                  <span className="sc-counter">{row.counter}</span>
                  <span className="sc-status" style={{ color: row.color }}>
                    {row.flag}
                  </span>
                </div>
                <div
                  className="sc-panel"
                  style={{ borderLeftColor: row.color }}
                >
                  <span className="sc-panel-title">{row.name}</span>
                  <span className="sc-meter" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className="sc-meter-seg"
                        style={{
                          backgroundColor: i < row.lit ? row.color : "#2A2320",
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Founder story (first-person). Round 7 (owner spec 2026-09-10): the  */
/* logo strip was REMOVED entirely per owner request — the founder     */
/* section now closes on the signature; brand marks live on /about.    */
/* ------------------------------------------------------------------ */

/* Founder light panel (owner spec 2026-09-08): the single cream section on
   the homepage — warm cream bg, paper grain, ghosted MR monogram, two-column
   editorial layout. Copy is unchanged; only the layout, color, and texture
   were reworked. Hard-coded LIGHT values are used throughout (the remapped
   cream/ink/mist/fog tokens resolve to dark). */

/* Founder bio (owner spec §12): first-person founder copy replaces the   */
/* old keyword-fragment badges. No photo here (headshot stays on /about   */
/* only).                                                                 */

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
      <div className="relative mx-auto w-full max-w-[1200px] px-6 pt-8 pb-16 sm:px-12 sm:pt-12">
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
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ */
/* Selected Work: light case-study index. Owner spec: second light      */
/* section (#F2ECE2), placed between ScoreCondensed and ServicesStack  */
/* so it is NOT adjacent to the founder note (#founder). Full-bleed    */
/* 22px grid overlay (rhymes with the engine's 28px grid), hairline    */
/* #3A312B rules top + bottom, 2-col card grid (1-col below 900px).    */
/* The entire card is one clickable anchor to its /work/* case page.   */
/* ------------------------------------------------------------------ */
function SelectedWork() {
  return (
    <section id="selected-work" className="sw-section scroll-mt-24">
      {/* 22px grid overlay across the whole section (no paper grain). */}
      <svg
        aria-hidden="true"
        className="sw-grid"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="sw-grid-pattern"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 22 0 L 0 0 0 22"
              fill="none"
              stroke="#E3DAC9"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sw-grid-pattern)" />
      </svg>
      <div className="sw-inner">
        <p className="sw-eyebrow">SELECTED WORK</p>
        <h2 className="sw-headline">What this work has moved.</h2>
        <p className="sw-intro">
          Positioning and GTM programs I&rsquo;ve led. Client names withheld
          under agreement.
        </p>
        <div className="sw-grid-cards">
          {WORK_CASES.map((c) => (
            <a key={c.slug} href={`/work/${c.slug}`} className="sw-card">
              <p className="sw-card-label">{c.caseLabel}</p>
              <h3 className="sw-card-headline">{c.headline}</h3>
              <div className="sw-card-metrics">
                {c.metrics.map((m) => (
                  <div key={m.label} className="sw-card-metric">
                    <p className="sw-card-metric-value">{m.value}</p>
                    <p className="sw-card-metric-label">{m.label}</p>
                  </div>
                ))}
              </div>
              <p className="sw-card-desc">{c.description}</p>
              <p className="sw-card-link">READ THE CASE STUDY →</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ */
/* Services: "Work With Me" priced offers (owner spec 2026-09-09,      */
/* editorial columns rev 2026-09-09). Light #EDE1D5 section,           */
/* hard-coded colors scoped in app.css under #services (global tokens  */
/* remap to dark). No box-shadows.                                     */
/* ------------------------------------------------------------------ */
const WORK_CARDS = [
  {
    timeframe: "3 DAYS",
    pill: "START HERE",
    name: "MarketReady Audit",
    price: "$2,000",
    subPrice: "Credited toward a Positioning Sprint booked within 30 days.",
    forBody:
      "seed and Series A teams preparing to launch who need to know what's broken before they scale spend.",
    points: [
      "Full video teardown of your site",
      "Written GTM strategy brief",
      "Live 45-minute executive session",
      "Prioritized fix list",
    ],
    cta: "Book the Audit →",
    service: "MarketReady Audit",
    variant: "solid" as const,
    cardClass: "wwm-col-1",
  },
  {
    timeframe: "14 DAYS",
    pill: null,
    name: "Positioning Sprint",
    price: "$7,500",
    subPrice: null,
    forBody:
      "category or feature launches where the message needs rebuilding, not tweaking.",
    points: [
      "Complete messaging system",
      "Positioning statement",
      "Homepage copy, rewritten",
      "Competitive battlecards",
      "Launch plan",
    ],
    cta: "Book the Sprint →",
    service: "MarketReady Sprint",
    variant: "outline" as const,
    cardClass: "wwm-col-2",
  },
  {
    timeframe: "RETAINER",
    pill: null,
    name: "Fractional GTM Lead",
    price: "From $6,000",
    per: " /mo",
    subPrice: null,
    forBody: "scale-up teams launching without anyone senior owning GTM.",
    points: [
      "Embedded GTM leadership",
      "Ongoing messaging iteration",
      "Sales enablement assets",
      "Launch strategy and execution",
      "Weekly strategic working sessions",
    ],
    cta: "Talk About a Retainer →",
    service: "Fractional GTM Lead",
    variant: "outline" as const,
    cardClass: "wwm-col-3",
  },
] as const;

function ServicesStack({
  onBook,
}: {
  onBook: (service?: string) => void;
}) {
  return (
    <section id="services" className="wwm-section scroll-mt-24">
      {/* Paper grain overlay (above the bg, below everything else). */}
      <div className="wwm-grain" aria-hidden="true">
        <svg width="100%" height="100%" aria-hidden="true">
          <filter id="wwm-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#wwm-grain-filter)"
          />
        </svg>
      </div>
      <div className="wwm-inner">
        <p className="wwm-eyebrow">WORK WITH ME</p>
        <h2 className="wwm-headline">Three ways I can help your product land.</h2>
        <p className="wwm-intro">
          Start with the free diagnostic if you want to see where you stand.
          When you&rsquo;re ready to fix what&rsquo;s broken, here&rsquo;s how
          we work together. You work directly with me on every deliverable. No
          account managers, no junior hand-offs.
        </p>
        <div className="wwm-cards">
          {WORK_CARDS.map((c) => (
            <div key={c.name} className={`wwm-col ${c.cardClass}`}>
              <div className="wwm-timeframe-row">
                <p className="wwm-timeframe">{c.timeframe}</p>
                {"pill" in c && c.pill ? (
                  <span className="wwm-starthere">{c.pill}</span>
                ) : null}
              </div>
              <h3 className="wwm-name">{c.name}</h3>
              <p className="wwm-price">
                {c.price}
                {"per" in c && c.per ? (
                  <span className="wwm-per">{c.per}</span>
                ) : null}
              </p>
              {c.subPrice ? <p className="wwm-subprice">{c.subPrice}</p> : null}
              <p className="wwm-for">
                <strong>For:</strong> {c.forBody}
              </p>
              <ul className="wwm-list">
                {c.points.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onBook(c.service)}
                className={
                  c.variant === "solid" ? "wwm-cta-solid" : "wwm-cta-link"
                }
              >
                {c.cta}
              </button>
            </div>
          ))}
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
        <ScoreCondensed />
        <SelectedWork />
        <ServicesStack onBook={openBooking} />
        <FaqAccordion />
      </main>
      <Footer onBook={openBooking} />
      {bookingOpen && (
        <BookingModal
          key={preselectService ?? "default"}
          open={bookingOpen}
          onClose={closeBooking}
          initialService={preselectService}
        />
      )}
    </div>
  );
}
