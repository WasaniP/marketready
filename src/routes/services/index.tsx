/**
 * MarketReady All-Services overview (build #41).
 *
 * Design-engine re-skin per owner spec: deep slate-950 base with layered
 * teal/cyan ambient glows, a teal hero badge/CTA, neutral secondary CTAs, an
 * engagement-matrix table (5 cols x 4 rows) with speed micro-pills and a
 * glowing teal HERO RECOMMENDED Audit row, the 9-Parameter 3-pillar pipeline
 * with STRICT continuous 1-9 numbering (3 tags per pillar, no overlap), an
 * emerald BUILT FOR / rose NOT FOR qual strip, and a bottom CTA banner.
 * Pricing honored: Free Diagnostic, $3,000 Audit (recommended), $7,500 Sprint,
 * Custom Advisory. Reuses /services/diagnostic, /services/audit, /services/sprint,
 * /services/fractional. 0 em/en dashes (commas / colons / periods only; arrows
 * and glyphs are fine).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { SectionHeading } from "~/components/services-ui";

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services: MarketReady" },
      {
        name: "description",
        content:
          "MarketReady services overview: from instant diagnostic to a dedicated Fractional GTM Lead. The free assessment scores your positioning across 9 PMM parameters, then the $3,000 MarketReady Audit, the $7,500 14-Day Positioning Sprint, or Fractional GTM Lead closes the gap.",
      },
    ],
  }),
  component: ServicesPage,
});

/* ------------------------------------------------------------------ */
/* Engagement matrix: 4 tiers (FREE / $3k Audit / $7.5k Sprint / Custom) */
/* ------------------------------------------------------------------ */

type Tier = {
  id: string;
  name: string;
  price: string;
  scope: string;
  speed: string;
  pillClass: string;
  bestFor: string;
  cta: string;
  ctaStyle: "outline" | "solid";
  href: string;
  recommended?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free Diagnostic Assessment",
    price: "Free",
    scope: "Automated 9-Parameter Scorecard & Leakage Report",
    speed: "< 60 SEC",
    pillClass: "text-slate-400 border-slate-700/60",
    bestFor: "Immediate Snapshot",
    cta: "Run Free Assessment",
    ctaStyle: "outline",
    href: "/services/diagnostic",
  },
  {
    id: "audit",
    name: "MarketReady Audit",
    price: "$3,000",
    scope: "Full Video Teardown + Strategy Brief + Live 45-Min Executive Session",
    speed: "3 DAYS",
    pillClass: "text-teal-400 border-teal-500/30",
    bestFor: "Seed/Series A Launch Prep",
    cta: "Book Audit",
    ctaStyle: "solid",
    href: "/services/audit",
    recommended: true,
  },
  {
    id: "sprint",
    name: "14-Day Positioning Sprint",
    price: "$7,500",
    scope: "Complete Messaging System, Competitive Battlecards & Homepage Copy Rewrite",
    speed: "14 DAYS",
    pillClass: "text-slate-400 border-slate-700/60",
    bestFor: "Category & Feature Launches",
    cta: "Book Sprint",
    ctaStyle: "outline",
    href: "/services/sprint",
  },
  {
    id: "advisory",
    name: "Fractional GTM Lead",
    price: "Custom",
    scope: "Embedded Fractional GTM Leadership, Messaging Iteration & Sales Enablement",
    speed: "RETAINER",
    pillClass: "text-slate-400 border-slate-700/60",
    bestFor: "Scale-Up Execution",
    cta: "Apply for Retainer",
    ctaStyle: "outline",
    href: "/services/fractional",
  },
];

/* ------------------------------------------------------------------ */
/* 9-Parameter Framework: 3-pillar pipeline (owner-specified numbering) */
/* ------------------------------------------------------------------ */

type ParamNode = {
  num: string;
  title: string;
  blurb: string;
  params: string[];
};

const PARAM_NODES: ParamNode[] = [
  {
    num: "01",
    title: "Core Positioning",
    blurb: "The category, audience, and differentiation that define your edge.",
    params: ["Positioning", "ICP & Audience", "Differentiation"],
  },
  {
    num: "02",
    title: "Messaging & Value Prop",
    blurb: "The message, value story, and pricing that carry it.",
    params: ["Hero Messaging", "Value Proposition", "Pricing & Packaging"],
  },
  {
    num: "03",
    title: "GTM & Launch Velocity",
    blurb: "The readiness to launch, scale, and convert.",
    params: ["GTM Readiness", "Launch Readiness", "Conversion Readiness"],
  },
];

/**
 * Per-cluster accent palette. All variants stay inside the site's dark-navy +
 * teal/cyan/indigo family so the groups read as related but distinguishable:
 *  - Pillar 01 Core Positioning -> Electric Teal (#14B8A6)
 *  - Pillar 02 Messaging & Value Prop -> Soft Cyan / mint (#22D3EE)
 *  - Pillar 03 GTM & Launch Velocity -> Soft Indigo (#6366F1)
 */
const CLUSTER_ACCENTS = [
  {
    hex: "#14B8A6",
    soft: "rgba(20,184,166,0.18)",
    text: "#5EEAD4",
    fill: "rgba(20,184,166,0.10)",
    glow: "rgba(20,184,166,0.12)",
  },
  {
    hex: "#22D3EE",
    soft: "rgba(34,211,238,0.20)",
    text: "#67E8F9",
    fill: "rgba(34,211,238,0.10)",
    glow: "rgba(34,211,238,0.12)",
  },
  {
    hex: "#6366F1",
    soft: "rgba(99,102,241,0.22)",
    text: "#A5B4FC",
    fill: "rgba(99,102,241,0.12)",
    glow: "rgba(99,102,241,0.14)",
  },
];

/**
 * Converging funnel: three glowing lines from the three pillar clusters
 * (column centers: 1/6, 3/6, 5/6 of the 720-wide viewBox) flowing DOWN into
 * the single composite score dial centered below. Desktop only; mobile uses a
 * simpler down-chevron connector.
 */
function FunnelConnector() {
  return (
    <svg
      viewBox="0 0 720 150"
      className="relative z-0 -my-10 mx-auto hidden w-full max-w-4xl md:block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="funnelFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {[120, 360, 600].map((x) => (
        <g key={x}>
          <line
            x1={x}
            y1={0}
            x2={360}
            y2={150}
            stroke="#14B8A6"
            strokeWidth="1.5"
            strokeOpacity="0.25"
          />
          <line
            x1={x}
            y1={0}
            x2={360}
            y2={150}
            stroke="url(#funnelFade)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(20,184,166,0.55))" }}
          />
        </g>
      ))}
      {/* convergence point dot where the three signals meet */}
      <circle
        cx="360"
        cy="150"
        r="5"
        fill="#14B8A6"
        style={{ filter: "drop-shadow(0 0 8px rgba(20,184,166,0.9))" }}
      />
    </svg>
  );
}

/**
 * Composite readiness dial: reuses the homepage gauge's visual identity (full
 * hairline track + glowing teal arc sweep + large centered number). The 68/100
 * value is a static graphical exemplar of the 9->3->1 output, not a measured
 * score of any site.
 */
function ScoreDial({ score = 68 }: { score?: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48">
      <div aria-hidden="true" className="mr-glow-pulse absolute -inset-3 rounded-full bg-electric/25 blur-2xl" />
      <svg
        viewBox="0 0 160 160"
        className="relative h-full w-full -rotate-90"
        role="img"
        aria-label={`Composite readiness score: ${score} out of 100`}
      >
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="#14B8A6"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          strokeDashoffset={`${c * (1 - frac)}`}
          style={{ filter: "drop-shadow(0 0 10px rgba(20,184,166,0.9))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2.5rem] font-extrabold leading-none tabular-nums text-teal-200 drop-shadow-[0_2px_12px_rgba(20,184,166,0.5)]">
          {score}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          / 100
        </span>
        <span className="mt-1.5 text-xs font-bold uppercase tracking-wider text-teal-400">
          Readiness
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ServicesPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const openBooking = () => setBookingOpen(true);
  const closeBooking = () => setBookingOpen(false);

  return (
    <div className="min-h-dvh bg-slate-950">
      <Header />
      <main>
        {/* 1. Hero (cardless, ambient teal glows + faint dot-grid texture) */}
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 px-5 pb-14 pt-32 sm:px-8 sm:pb-16 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 40rem 22rem at 20% -10%, rgba(20,184,166,0.12), transparent 60%), radial-gradient(ellipse 36rem 20rem at 85% 5%, rgba(20,184,166,0.06), transparent 60%), radial-gradient(ellipse 30rem 18rem at 50% 120%, rgba(20,184,166,0.05), transparent 60%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[size:26px_26px]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(51,65,85,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.05) 1px, transparent 1px)",
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <span className="inline-block rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300 shadow-[0_0_14px_rgba(20,184,166,0.18)]">
              [ SERVICES OVERVIEW ]
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              From Instant Diagnostic to Dedicated Fractional GTM Lead.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-mist">
              Every engagement starts with the Free Diagnostic Assessment. It scores your
              positioning across 9 PMM parameters, names the highest-leverage fix, and prescribes
              the exact service to close the gap.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/services/diagnostic"
                className="inline-flex items-center justify-center rounded-lg bg-teal-400 px-7 py-3.5 text-base font-bold text-slate-950 transition-colors hover:bg-teal-300"
              >
                Get Your MarketReady Score →
              </a>
              <a
                href="/services/audit"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-7 py-3.5 text-base font-medium text-slate-300 transition-colors hover:bg-slate-800/40"
              >
                View Audit Details
              </a>
            </div>
          </div>
        </section>

        {/* 2. Engagement matrix: comparison table (desktop) / stacked tiers (mobile) */}
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 px-5 py-10 sm:px-8 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-[-12%] h-96 w-96 rounded-full bg-teal-500/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-15%] left-[-12%] h-96 w-96 rounded-full bg-teal-500/5 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[size:26px_26px]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)",
            }}
          />
          <div className="relative mx-auto max-w-6xl">
            <SectionHeading
              chip="Engagement Matrix"
              title="Four ways we plug in"
              sub="Start with the free assessment. The score tells you which service you actually need."
              accent="electric"
            />

            {/* DESKTOP TABLE */}
            <div className="mt-12 hidden md:block overflow-x-auto">
              <table className="w-full text-left border border-teal-500/10 bg-[#1E293B]/40 backdrop-blur-md">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    {["Service Tier", "Deliverables & Scope", "Speed", "Best For", "Action"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((tier) => (
                    <tr
                      key={tier.id}
                      className={`border-b border-slate-800/50 align-top transition-colors hover:bg-teal-500/[0.03] ${
                        tier.recommended
                          ? "border-t border-t-teal-400/50 border-b-teal-400/30 bg-teal-500/[0.06] shadow-[0_0_32px_rgba(20,184,166,0.2)]"
                          : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <td className="px-4 py-5">
                        {tier.recommended && (
                          <span className="mb-2 inline-block rounded-full border border-teal-400/70 bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200 shadow-[0_0_16px_rgba(20,184,166,0.5)]">
                            [ HERO RECOMMENDED ]
                          </span>
                        )}
                        <div className="font-semibold text-ink">{tier.name}</div>
                        <div
                          className={`mt-0.5 text-sm ${
                            tier.recommended ? "font-bold text-teal-400" : "text-zinc-400"
                          }`}
                        >
                          {tier.price}
                        </div>
                      </td>
                      <td className="px-4 py-5 text-sm text-mist">{tier.scope}</td>
                      <td className="px-4 py-5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tier.pillClass}`}
                        >
                          {tier.speed}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-mist">{tier.bestFor}</td>
                      <td className="px-4 py-5">
                        {tier.ctaStyle === "solid" ? (
                          <a
                            href={tier.href}
                            className="inline-block rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_0_18px_rgba(20,184,166,0.4)] transition-colors hover:bg-teal-300"
                          >
                            {tier.cta}
                          </a>
                        ) : (
                          <a
                            href={tier.href}
                            className="inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/40"
                          >
                            {tier.cta}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE STACKED TIERS (strict sequence preserved) */}
            <div className="mt-10 space-y-4 md:hidden">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-5 backdrop-blur-md transition-colors ${
                    tier.recommended
                      ? "border-teal-400/70 bg-gradient-to-b from-teal-500/10 to-[#1E293B]/40 shadow-[0_0_28px_rgba(20,184,166,0.24)]"
                      : "border-teal-500/15 bg-[#1E293B]/30 shadow-[0_0_18px_rgba(20,184,166,0.06)]"
                  }`}
                >
                  {tier.recommended && (
                    <span className="mb-2 inline-block rounded-full border border-teal-400/70 bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200 shadow-[0_0_14px_rgba(20,184,166,0.45)]">
                      [ HERO RECOMMENDED ]
                    </span>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">{tier.name}</h3>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        tier.recommended ? "text-teal-400" : "text-zinc-400"
                      }`}
                    >
                      {tier.price}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{tier.scope}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tier.pillClass}`}
                    >
                      {tier.speed}
                    </span>
                    <span>
                      <span className="font-medium text-zinc-300">Best for: </span>
                      {tier.bestFor}
                    </span>
                  </div>
                  <div className="mt-4">
                    {tier.ctaStyle === "solid" ? (
                      <a
                        href={tier.href}
                        className="inline-block rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_16px_rgba(20,184,166,0.35)] transition-colors hover:bg-teal-300"
                      >
                        {tier.cta}
                      </a>
                    ) : (
                      <a
                        href={tier.href}
                        className="inline-block rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/40"
                      >
                        {tier.cta}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. The 9-Parameter Framework (3-pillar pipeline) */}
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 px-5 py-10 sm:px-8 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-[-12%] h-96 w-96 rounded-full bg-teal-500/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-12%] right-[-12%] h-96 w-96 rounded-full bg-teal-500/5 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[size:26px_26px]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)",
            }}
          />
          <div className="relative mx-auto max-w-6xl">
            <SectionHeading
              chip="The framework"
              title="The 9-Parameter Framework"
              sub="Every service runs on the same nine PMM dimensions, grouped into three pillars. From the free score to the Audit to the Sprint, the same framework keeps the diagnosis consistent."
              accent="electric"
            />
            <div className="relative mt-12">
              {/* Flow legend: 9 signals -> 3 pillars -> 1 score */}
              <p
                className="mb-8 text-center text-xs font-bold uppercase tracking-[0.22em] text-mist"
                aria-hidden="true"
              >
                9 Signals <span className="text-electric">→</span> 3 Pillars{" "}
                <span className="text-electric">→</span> 1 Score
              </p>

              {/* Stage 1: 3 pillar clusters, each holding 3 parameter nodes */}
              <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                {PARAM_NODES.map((node, i) => {
                  const A = CLUSTER_ACCENTS[i];
                  return (
                    <div
                      key={node.num}
                      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.03] to-[#1E293B]/40 p-5 backdrop-blur-md"
                      style={{ borderColor: A.soft, boxShadow: `0 0 26px ${A.glow}` }}
                    >
                      {/* accent top hairline */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-px"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${A.hex}, transparent)`,
                        }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            borderColor: A.soft,
                            color: A.text,
                            background: A.fill,
                          }}
                        >
                          <span className="text-sm leading-none" style={{ color: A.hex }}>
                            ●
                          </span>
                          Pillar {node.num}
                        </span>
                        <span className="inline-flex shrink-0 rounded-full border border-hairline bg-white/[0.02] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                          {node.params.length} Parameters
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-ink">{node.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-mist">{node.blurb}</p>
                      <div className="mt-4 space-y-2">
                        {node.params.map((p, idx) => {
                          const globalNum = String(i * 3 + idx + 1).padStart(2, "0");
                          return (
                            <div
                              key={p}
                              className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-950/60 py-2.5 pr-3 pl-1.5"
                              style={{ borderLeft: `3px solid ${A.hex}` }}
                            >
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                                style={{
                                  color: A.text,
                                  background: A.fill,
                                  border: `1px solid ${A.soft}`,
                                }}
                              >
                                {globalNum}
                              </span>
                              <span className="text-[13px] font-medium text-zinc-200">{p}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stage 2: converging funnel into the dial (desktop lines /
                  mobile down-chevron) */}
              <FunnelConnector />
              <div className="-my-5 flex justify-center md:hidden" aria-hidden="true">
                <svg viewBox="0 0 24 30" className="h-8 w-6">
                  <line
                    x1="12"
                    y1="2"
                    x2="12"
                    y2="20"
                    stroke="#14B8A6"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />
                  <path
                    d="M6 20 l6 7 6 -7"
                    stroke="#14B8A6"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.85"
                  />
                </svg>
              </div>

              {/* Stage 3: single composite readiness dial */}
              <div className="relative z-10 flex flex-col items-center">
                <span className="rounded-full border border-electric/30 bg-electric/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-300">
                  1 Composite Score
                </span>
                <div className="mt-4">
                  <ScoreDial score={68} />
                </div>
                <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-mist">
                  Nine diagnostics. Three pillars. One composite readiness dial, so every
                  engagement speaks a single consistent number.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Qualification strip: muted mint BUILT FOR / subtle warm NOT FOR */}
        <section className="relative overflow-hidden border-y border-slate-800 bg-slate-950">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[size:26px_26px]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)",
            }}
          />
          <div className="relative mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2">
            <div className="bg-emerald-500/[0.04] p-5 border-b border-slate-800 md:border-b-0 md:border-r md:border-slate-800">
              <p className="text-sm md:text-base font-medium text-emerald-200/50">
                ✓ BUILT FOR: Seed &amp; Series A B2B, SaaS, and AI platforms preparing for
                high-stakes market entry.
              </p>
            </div>
            <div className="bg-rose-500/[0.04] p-5">
              <p className="text-sm md:text-base font-medium text-rose-200/45">
                ✕ NOT FOR: Pre-MVP concepts, traditional e-commerce storefronts, or cheap agency
                execution.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Bottom CTA banner */}
        <section className="relative overflow-hidden bg-slate-950 px-5 py-12 sm:px-8 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-[36rem] rounded-full bg-teal-500/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h3 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Start with the score.
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
              Run the Free Diagnostic Assessment first to pinpoint messaging friction before your
              next launch.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/services/diagnostic"
                className="inline-flex items-center justify-center rounded-lg bg-teal-400 px-7 py-3.5 text-base font-bold text-slate-950 shadow-[0_0_22px_rgba(20,184,166,0.4)] transition-colors hover:bg-teal-300"
              >
                Run Free Assessment →
              </a>
              <button
                type="button"
                onClick={openBooking}
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-7 py-3.5 text-base font-medium text-slate-300 transition-colors hover:bg-slate-800/40"
              >
                Book Strategy Session
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer onBook={openBooking} />
      {bookingOpen && (
        <BookingModal open={bookingOpen} onClose={closeBooking} initialService={undefined} />
      )}
    </div>
  );
}
