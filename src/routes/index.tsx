import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { WORK_CASES } from "~/lib/work/cases";
import { BookingModal } from "~/components/BookingModal";
import { Header, Footer, ChevronDown } from "~/components/Layout";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Method timeline (owner spec 2026-09-17): one column per offer tier,
 *  each mapped to its stage. Labels/timelines/stage copy EXACTLY as the
 *  owner wrote them (em-dashes included) — do not normalize.
 *  Owner follow-up 2026-09-14: ALL three columns are plain (no links) —
 *  the Audit and Sprint columns previously linked to their service pages. */
const HOW_IT_WORKS_TIERS = [
  {
    label: "MarketReady Audit",
    days: "5 DAYS",
    href: null,
    stage: {
      n: "01",
      name: "Diagnose",
      body: "I audit your positioning, messaging, and funnel metrics to identify exactly where you are losing clarity, authority, and buyer conversion.",
    },
  },
  {
    label: "GTM Engine Sprint",
    days: "14 DAYS",
    href: null,
    stage: {
      n: "02",
      name: "Rebuild",
      body: "I fix the GTM engine in a focused 14-day sprint—rewriting your narrative architecture, homepage copy, sales deck, and core GTM assets.",
    },
  },
  {
    label: "Product Launch",
    days: "60–90 DAYS",
    href: null,
    stage: {
      n: "03",
      name: "Orchestrate",
      body: "I execute end-to-end GTM rollouts for major product drops or market pivots—equipping sales teams, managing launch timelines, and optimizing live campaigns.",
    },
  },
] as const;

/* Friction observations: three warm-dark cards, compact layout.        */
/* Owner rework copy 2026-09-16: upstream-problems headline, intro,     */
/* three friction cards (distinct card surfaces, hairline border, 6px   */
/* radius, 12px stack gap). Left column keeps the cited JOLT Effect     */
/* stat block; sticky left column via overflow: clip on the section.    */
/* Card hover = understated surface/border tone shift only (no glow,    */
/* no shadow, no lift).                                                  */
/* ------------------------------------------------------------------ */
function FrictionObservations() {
  const rows = [
    {
      n: "01",
      header: "The value isn't obvious",
      body: "If buyers have to work to understand why your product matters, they won't do the work for you.",
      tag: "The cost \u2192 Weak conversion",
    },
    {
      n: "02",
      header: "Sales has to do too much work",
      body: "If every deal requires a custom explanation, lengthy demo, or heavy discount to close, your product's value isn't doing enough of the selling.",
      tag: "The cost \u2192 Longer sales cycles",
    },
    {
      n: "03",
      header: "Growth activity isn't translating",
      body: "More traffic, more launches, and more campaigns can't fix a weak commercial foundation. They just put more money behind the same friction.",
      tag: "The cost \u2192 Wasted growth spend",
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
              Small problems upstream create expensive problems downstream.
            </h2>
            <p className="friction-intro">
              The product isn't always the problem. Sometimes the friction is in how it's positioned, understood, sold, or brought to market.
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
/* Methodology / "The MarketReady Method" (owner spec 2026-09-17):     */
/* warm-dark #16120F surface w/ paper grain + hairline top border,     */
/* centered header (sand eyebrow / Fraunces headline / mist intro),    */
/* 3-column offer timeline mapping each offer tier to its stage        */
/* (MarketReady Audit 5 DAYS/01 Diagnose, GTM Engine Sprint            */
/* 14 DAYS/02 Rebuild, Product Launch 60–90 DAYS/03 Orchestrate).      */
/* Cols 1-2 wrap in links to their offer pages (understated hover:     */
/* surface/border tone shift only, no lift/glow — friction pattern);   */
/* col 3 is plain (no Product Launch page). Closing italic credit +    */
/* 44px solid-rust CTA → /assessment.                                  */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 border-t border-hairline"
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
          <h2 className="hiw-headline">
            When the positioning is wrong, everything downstream costs more.
          </h2>
          <p className="hiw-intro">
            Most teams jump straight to expensive campaigns. I start by
            pinpointing what&apos;s broken, rebuilding your core engine, and
            orchestrating the rollout.
          </p>
        </div>

        <div className="hiw-grid">
          {HOW_IT_WORKS_TIERS.map((tier) => {
            const card = (
              <>
                <div className="hiw-col-head">
                  <span className="hiw-col-label">{tier.label}</span>
                  <span className="hiw-col-days">{tier.days}</span>
                </div>
                <div className="hiw-stage">
                  <div className="hiw-stage-head">
                    <span className="hiw-stage-numeral" aria-hidden="true">
                      {tier.stage.n}
                    </span>
                    <h3 className="hiw-stage-title">{tier.stage.name}</h3>
                  </div>
                  <p className="hiw-stage-body">{tier.stage.body}</p>
                </div>
              </>
            );
            return tier.href ? (
              <a key={tier.stage.n} href={tier.href} className="hiw-col">
                {card}
              </a>
            ) : (
              <div key={tier.stage.n} className="hiw-col hiw-col-plain">
                {card}
              </div>
            );
          })}
        </div>

        <div className="hiw-closing">
          <p className="hiw-credit">
            Start with the Audit to uncover your highest-leverage fixes. The
            $2,000 fee fully credits toward the Sprint or Launch.
          </p>
          <div className="text-center">
            <a
              href="#calculator"
              className="hiw-cta"
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
/* homepage summary of the Diagnostic Engine. Full-bleed #1F1A16 band   */
/* (slightly lighter than the Method band above) with the 28px grid     */
/* overlay at a reduced presence and hairline top/bottom rules. Two-    */
/* column composition (5/12 copy, 7/12 pillar cards, stacked below      */
/* 900px). The three pillars are DISTINCT static cards in the Method/   */
/* Friction card language: 2px pillar-colour accent bar across the      */
/* card top, mono counter + status flag row, Fraunces title + 10-       */
/* segment meter, ghosted numeral. Pure presentation: no hover, no      */
/* chevrons, no accordion, no gauge, no brackets. Upgraded copy of the  */
/* scoring behaviour lives on /services/diagnostic                      */
/* (src/components/DiagnosticEngine.tsx).                               */
/* ------------------------------------------------------------------ */
function ScoreCondensed() {
  const rows = [
    {
      n: "01",
      counter: "PILLAR 01 / 03",
      name: "Core Positioning",
      flag: "◆ CRITICAL GAP",
      color: "#C4603A",
      lit: 3,
    },
    {
      n: "02",
      counter: "PILLAR 02 / 03",
      name: "Messaging & Value Prop",
      flag: "◆ NEEDS REFINEMENT",
      color: "#C9992F",
      lit: 4,
    },
    {
      n: "03",
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
              Six dimensions scored in seconds from your public site, plus two
              reserved for a human review. All eight grouped into three pillars:
              how you position, how you message, and how fast you launch.
            </p>
            <p className="sc-callout">
              A low score isn&apos;t an abstraction. It&apos;s the demo where
              30 minutes go to explaining the category, the ad spend that
              bounces, and the deal that closes at a discount.
            </p>
            <a
              href="#calculator"
              className="sc-link"
              onClick={(e) => {
                e.preventDefault();
                const anchor =
                  document.getElementById("calculator") ??
                  document.getElementById("calc-url");
                anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                window.setTimeout(() => {
                  document.getElementById("calc-url")?.focus({
                    preventScroll: true,
                  });
                }, 650);
              }}
            >
              SEE HOW THE SCORING WORKS →
            </a>
          </div>
          <div className="sc-pillars">
            {rows.map((row) => (
              <article
                key={row.counter}
                className="sc-card"
                style={{ borderTopColor: row.color }}
              >
                <span className="sc-numeral" aria-hidden="true">
                  {row.n}
                </span>
                <div className="sc-label">
                  <span className="sc-counter">{row.counter}</span>
                  <span className="sc-status" style={{ color: row.color }}>
                    {row.flag}
                  </span>
                </div>
                <div className="sc-title-meter">
                  <span className="sc-card-title">{row.name}</span>
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
              </article>
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
          {/* Right column: t-shirt mockup + closing tagline, vertically centered. */}
          <div className="founder-right">
            <img
              src="/manifesto-tshirt.png"
              alt="MarketReady dark navy t-shirt"
              loading="lazy"
              className="founder-tshirt"
            />
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
/* Cards are static showcases (no /work/* URLs — owner 2026-09-15).    */
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
              stroke="#E8E1D4"
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
          Positioning and GTM programs I&rsquo;ve led, across media, adtech,
          and B2B SaaS.
        </p>
        <div className="sw-grid-cards">
          {WORK_CASES.map((c) => (
            <div key={c.slug} className="sw-card">
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
            </div>
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
    timeframe: "5 DAYS",
    pill: "START HERE",
    name: "MarketReady Audit",
    price: "$2,000",
    subPrice: "Credited toward a Sprint booked within 30 days.",
    forBody:
      "growing companies ready to scale who need to stress-test their GTM system and pinpoint friction before accelerating spend.",
    points: [
      "Scored 9-point GTM diagnostic",
      "Positioning leak identification",
      "Conversion friction roadmap",
      "Sales narrative audit",
      "Live 1-on-1 strategic walkthrough",
    ],
    cta: "Book the Audit →",
    service: "MarketReady Audit",
    variant: "outline" as const,
    cardClass: "wwm-col-1",
  },
  {
    timeframe: "14 DAYS",
    pill: null,
    featured: true,
    name: "GTM Engine Sprint",
    price: "$7,500",
    subPrice: "Complete positioning overhaul and core messaging assets.",
    forBody:
      "growth-stage teams hitting pipeline friction, where traffic or spend is flowing but the core narrative fails to convert.",
    points: [
      "Full positioning architecture & category definition",
      "Complete messaging framework",
      "Rewritten homepage & landing page copy",
      "Sales deck narrative & core collateral",
      "Go-to-market launch playbook",
    ],
    cta: "Book the Sprint →",
    service: "GTM Engine Sprint",
    variant: "solid" as const,
    cardClass: "wwm-col-2",
  },
  {
    timeframe: "60–90 DAYS",
    pill: "END-TO-END",
    pillMuted: true,
    name: "Product Launch / Re-Launch",
    price: "From $12,000",
    subPrice:
      "End-to-end GTM orchestration for major releases, pivots, or new product drops.",
    forBody:
      "pre-seed to Series A founders launching a new product, rolling out major features, or repositioning the brand.",
    points: [
      "Everything in GTM Engine Sprint",
      "Full launch sequence & timeline orchestration",
      "Multi-channel asset production & launch copy",
      "Complete sales enablement & battle cards",
      "Pre-launch prep & post-launch war room support",
    ],
    cta: "Scope Your Launch →",
    service: "Product Launch / Re-Launch",
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
        <p className="wwm-eyebrow">● ENGAGEMENT MODELS</p>
        <h2 className="wwm-headline">Three ways I can help your product land.</h2>
        <p className="wwm-intro">
          Start with the diagnostic to see where you stand. When you&rsquo;re
          ready to fix what&rsquo;s broken, here&rsquo;s how we work together.
          You work directly with me on every deliverable&mdash;no account
          managers, no junior hand-offs.
        </p>
        <div className="wwm-cards">
          {WORK_CARDS.map((c) => (
            <div key={c.name} className={`wwm-col ${c.cardClass}`}>
              {"featured" in c && c.featured ? (
                <span className="wwm-badge">Most Popular</span>
              ) : null}
              <div className="wwm-timeframe-row">
                <p className="wwm-timeframe">{c.timeframe}</p>
                {"pill" in c && c.pill ? (
                  <span
                    className={
                      "pillMuted" in c && c.pillMuted
                        ? "wwm-starthere-muted"
                        : "wwm-starthere"
                    }
                  >
                    {c.pill}
                  </span>
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
        <div className="wwm-banner">
          <div className="wwm-banner-left">
            <p className="wwm-banner-title">
              Need a custom project scope or ongoing leadership?
            </p>
            <p className="wwm-banner-desc">
              In addition to fixed-scope sprints, I partner with select teams
              on a fractional, monthly retainer, or bespoke project basis for
              ongoing product marketing and GTM leadership.
            </p>
          </div>
          <button
            type="button"
            className="wwm-banner-cta"
            onClick={() => onBook("Fractional GTM Partner")}
          >
            Inquire About Fractional &amp; Retainers →
          </button>
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
    q: "I want more than the free score, but I'm not ready for a full Sprint. What's in between?",
    a: "Yes. The MarketReady Audit is a human-led review delivered in a few days: a written diagnosis with prioritized recommendations, without the full Sprint build-out. And if you move to a Sprint within 30 days, your Audit fee applies toward it.",
  },
] as const;

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section
      id="faq"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-sand py-10 sm:py-12"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-12">
        <div className="faq-grid">
          <div className="faq-header">
            <p className="faq-eyebrow">Questions I get asked</p>
            <h2 className="faq-headline">Frequently asked questions</h2>
            <p className="faq-intro">
              Still unsure? Run the free diagnostic and we can talk about what it finds.
            </p>
          </div>
          <div className="faq-rows">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-button-${i}`;
              return (
                <div key={item.q} className="faq-row">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                      className="faq-row-button"
                    >
                      <span className="faq-q">{item.q}</span>
                      <ChevronDown
                        className={`faq-chevron ${isOpen ? "faq-chevron-open" : ""}`}
                      />
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
                      <p className="faq-a">{item.a}</p>
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
