/**
 * MarketReady: The MarketReady Audit (/services/audit).
 *
 * A distinct, full-scope one-time paid offering: a human-led positioning & GTM
 * audit at $3,000 flat, delivered in 3 to 5 days. The Audit diagnoses the full
 * 3-pillar / 9-Parameter Framework and returns a prioritized written plan, while
 * the 14-Day Sprint executes the fixes. Creative elements mirror the Sprint
 * page's visual system (pillar bands in teal / cyan / indigo, connected day-node
 * timeline) but are scaled to the Audit's shorter, diagnosis-only window.
 * Primary CTA opens the booking modal with 'MarketReady Audit' pre-selected.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import {
  ServicesChip,
  SectionHeading,
  SubPageHero,
  CheckIcon,
} from "~/components/services-ui";

export const Route = createFileRoute("/services/audit")({
  head: () => ({
    meta: [
      { title: "MarketReady Audit: MarketReady" },
      {
        name: "description",
        content:
          "The MarketReady Audit: a faster, human-led diagnosis at a $3,000 flat fee with a 3 to 5 day turnaround. Personal review of your website, pitch deck, and one sales call recording, scored across the full 9-Parameter Framework.",
      },
    ],
  }),
  component: AuditPage,
});

/* ------------------------------------------------------------------ */
/* Audit specifics (from the copy spec)                                */
/* ------------------------------------------------------------------ */

const SCOPE_ITEMS = [
  "Personal review of your existing website/homepage",
  "Your sales/pitch deck",
  "One sales call recording",
] as const;

/** What the written diagnosis document contains, as concrete contents. */
const RECEIVE_ITEMS = [
  "A scored breakdown across all 9 parameters under the 3-pillar framework, with readiness banding for each",
  "Prioritized recommendations per pillar (Core Positioning, Messaging & Value Prop, GTM & Launch Velocity)",
  "Specific, line-level feedback on your homepage and website",
  "Specific pitch deck feedback with concrete reframe options",
  "A 30-minute walkthrough call of the diagnosis and next steps",
] as const;

/* ------------------------------------------------------------------ */
/* Pillar map: the Audit's written diagnosis covers the full framework */
/* ------------------------------------------------------------------ */

/**
 * Maps the Audit's written diagnosis onto the same three pillars scored by the
 * free Diagnostic and rebuilt by the Sprint. Color coding matches the
 * 9-Parameter Framework (teal / cyan / indigo) so a returning visitor sees the
 * same system: Core Positioning -> #14B8A6, Messaging & Value Prop -> #22D3EE,
 * GTM & Launch Velocity -> #6366F1. Each band describes what the Audit's written
 * diagnosis says for that pillar (a scored assessment plus prioritized
 * recommendations), not a deliverable: the Audit assesses, it does not execute.
 */
type PillarBand = {
  name: string;
  blurb: string;
  accent: string;
  soft: string;
  glow: string;
  text: string;
  light: string;
  items: { num: string; label: string }[];
};

const AUDIT_BANDS: PillarBand[] = [
  {
    name: "Core Positioning",
    blurb: "Diagnoses",
    accent: "#14B8A6",
    soft: "rgba(20,184,166,0.10)",
    glow: "rgba(20,184,166,0.18)",
    text: "#5EEAD4",
    light: "#99F6E4",
    items: [
      { num: "01", label: "Positioning: scored, with concrete reframe options" },
      { num: "02", label: "ICP: clarity scored, target fit flagged" },
      { num: "03", label: "Differentiation: gaps named against competitors" },
    ],
  },
  {
    name: "Messaging & Value Prop",
    blurb: "Diagnoses",
    accent: "#22D3EE",
    soft: "rgba(34,211,238,0.10)",
    glow: "rgba(34,211,238,0.18)",
    text: "#67E8F9",
    light: "#A5F3FC",
    items: [
      { num: "04", label: "Value prop: scored, with rewording suggestions" },
      { num: "05", label: "Homepage: line-level before / after feedback" },
      { num: "06", label: "Sales messaging: deck and call read scored" },
    ],
  },
  {
    name: "GTM & Launch Velocity",
    blurb: "Diagnoses",
    accent: "#6366F1",
    soft: "rgba(99,102,241,0.12)",
    glow: "rgba(99,102,241,0.20)",
    text: "#A5B4FC",
    light: "#C7D2FE",
    items: [
      { num: "07", label: "GTM path: scored against your launch stage" },
      { num: "08", label: "Acquisition: funnel and channel efficiency flagged" },
      { num: "09", label: "Conversion: friction points named with priority" },
    ],
  },
];

function PillarBandRow({ band }: { band: PillarBand }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 backdrop-blur-md sm:p-6"
      style={{
        borderColor: band.accent,
        background: `linear-gradient(90deg, ${band.soft}, rgba(15,23,42,0.2) 60%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: band.glow }}
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="shrink-0 lg:w-52">
          <span
            className="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: band.text, borderColor: `${band.accent}55`, background: band.soft }}
          >
            {band.blurb}
          </span>
          <h3
            className="mt-2 text-lg font-bold leading-tight tracking-tight"
            style={{ color: band.light }}
          >
            {band.name}
          </h3>
        </div>
        <div className="flex flex-1 flex-wrap gap-2.5">
          {band.items.map((it) => (
            <span
              key={it.num}
              className="inline-flex items-center gap-2 rounded-lg border bg-[#0F172A]/60 px-3 py-2 text-sm font-medium text-mist"
              style={{ borderColor: `${band.accent}44` }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                style={{ color: band.text, background: `${band.accent}22` }}
              >
                {it.num}
              </span>
              {it.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5-day delivery timeline (mirrors the Sprint timeline, scaled down)  */
/* ------------------------------------------------------------------ */

const AUDIT_TIMELINE = [
  {
    span: "DAY 1",
    title: "Intake & Materials Review",
    body: "Your website and homepage, pitch deck, and one sales call recording are reviewed in depth.",
    chip: "Materials reviewed",
  },
  {
    span: "DAYS 2-4",
    title: "Scoring & Diagnosis Writeup",
    body: "All nine parameters are scored under the full 3-pillar framework, and the prioritized diagnosis is written up.",
    chip: "Scored writeup",
  },
  {
    span: "DAY 5",
    title: "Delivery & Walkthrough",
    body: "The written diagnosis is delivered and walked through with you on a 30-minute call, with next steps prioritized.",
    chip: "Diagnosis + call",
  },
];

function AuditTimelineCard({ s }: { s: (typeof AUDIT_TIMELINE)[number] }) {
  return (
    <div className="flex flex-col items-stretch text-left">
      <span className="text-center text-[11px] font-bold uppercase tracking-wider text-electric [text-shadow:0_0_12px_rgba(20,184,166,0.8)]">
        {s.span}
      </span>
      <div className="mt-3 flex justify-center">
        <span
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-electric bg-[#0F172A]"
          style={{ boxShadow: "0 0 12px rgba(20,184,166,0.9)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-electric" />
        </span>
      </div>
      <div className="mt-4 flex flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-bold text-ink">{s.title}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{s.body}</p>
        <div className="my-3 border-t border-slate-800" />
        <span className="mt-auto inline-flex w-fit items-center rounded-md border border-teal-500/30 bg-teal-950/60 px-2.5 py-1 font-mono text-xs text-teal-300">
          {s.chip}
        </span>
      </div>
    </div>
  );
}

function AuditTimelineDesktop() {
  return (
    <div className="relative hidden md:block">
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 top-[30px] h-px bg-gradient-to-r from-transparent via-electric/40 to-transparent"
      />
      <div className="relative grid grid-cols-3 gap-6">
        {AUDIT_TIMELINE.map((s) => (
          <AuditTimelineCard key={s.span} s={s} />
        ))}
      </div>
    </div>
  );
}

function AuditTimelineMobile() {
  return (
    <div className="relative md:hidden">
      <div aria-hidden="true" className="absolute bottom-2 left-[6px] top-2 w-px bg-electric/30" />
      <div className="space-y-5 pl-8">
        {AUDIT_TIMELINE.map((s) => (
          <div key={s.span} className="relative">
            <span
              className="absolute -left-8 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-electric bg-[#111827]"
              style={{ boxShadow: "0 0 10px rgba(20,184,166,0.8)" }}
            >
              <span className="h-1 w-1 rounded-full bg-electric" />
            </span>
            <AuditTimelineCard s={s} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AuditPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(undefined);
  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  const bookAudit = () => openBooking("MarketReady Audit");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        <SubPageHero
          chip={<ServicesChip>MarketReady Audit</ServicesChip>}
          title="The MarketReady Audit"
          sub="A faster, human-led diagnosis: for when you want more than the free score."
          stats={
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <div className="rounded-xl border border-hairline bg-white/[0.03] px-5 py-3 text-center backdrop-blur-md">
                <p className="text-2xl font-extrabold tracking-tight text-ink">$3,000</p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Flat Fee
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-white/[0.03] px-5 py-3 text-center backdrop-blur-md">
                <p className="text-2xl font-extrabold tracking-tight text-ink">3-5 Days</p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Turnaround
                </p>
              </div>
            </div>
          }
        >
          <button type="button" onClick={bookAudit} className="btn-electric px-7 py-3.5 text-base">
            Book Your Audit ($3,000) →
          </button>
          <a href="/services/diagnostic" className="btn-ghost px-7 py-3.5 text-base">
            Run the Free Diagnostic First →
          </a>
        </SubPageHero>

        {/* Scope & deliverables */}
        <section className="border-b border-hairline bg-[#0F172A] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              chip="What's included"
              title="Scope & Deliverables"
              sub="What the MarketReady Audit reviews, what the written diagnosis contains, and how it maps to the full framework."
            />
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
              {/* Scope */}
              <div className="rounded-xl border border-hairline bg-[#1E293B]/50 p-7 backdrop-blur-md">
                <h3 className="text-base font-semibold text-ink">What we review</h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {SCOPE_ITEMS.map((s) => (
                    <li key={s} className="flex items-start gap-3 text-sm leading-relaxed text-mist">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Deliverables */}
              <div className="rounded-xl border border-hairline bg-[#1E293B]/50 p-7 backdrop-blur-md">
                <h3 className="text-base font-semibold text-ink">What you receive</h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {RECEIVE_ITEMS.map((s) => (
                    <li key={s} className="flex items-start gap-3 text-sm leading-relaxed text-mist">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pillar map: the Audit scores the whole framework */}
            <div className="mx-auto mt-12 max-w-5xl">
              <div className="mb-6 text-center">
                <ServicesChip>Full framework, scored</ServicesChip>
                <p className="mx-auto mt-3 max-w-2xl text-base text-mist">
                  The Audit assesses the entire 3-pillar framework, not just one area. Same three
                  colors, same 9-Parameter Framework as the{" "}
                  <a href="/services" className="text-electric underline decoration-electric/40 underline-offset-2 hover:text-teal-300">
                    free Diagnostic
                  </a>
                  , but scored by a human with a written diagnosis per pillar.
                </p>
              </div>
              <div className="space-y-4">
                {AUDIT_BANDS.map((band) => (
                  <PillarBandRow key={band.name} band={band} />
                ))}
              </div>
              <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed text-zinc-400">
                Where the Diagnostic flags, the Audit diagnoses in writing: a scored assessment and
                prioritized recommendations for every pillar. Executing the fixes is what the
                Sprint is for.
              </p>
            </div>
          </div>
        </section>

        {/* 5-day process / timeline */}
        <section className="relative overflow-hidden border-b border-hairline bg-[#111827] px-5 py-10 sm:px-8 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-electric/[0.05] blur-3xl"
          />
          <div className="relative mx-auto max-w-4xl">
            <SectionHeading
              chip="How it's delivered"
              title="A focused 5-day process"
              sub="A short, defined turnaround from intake to a delivered, walked-through diagnosis."
            />
            <div className="mt-12">
              <AuditTimelineDesktop />
              <AuditTimelineMobile />
            </div>
          </div>
        </section>

        {/* Upgrade-credit banner */}
        <section className="border-b border-hairline bg-[#030712] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-electric/40 bg-electric/[0.06] p-8 text-center backdrop-blur-md shadow-[0_0_40px_rgba(20,184,166,0.12)] sm:p-10">
              <span className="inline-block rounded-full border border-electric/40 bg-electric/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-300">
                Upgrade path
              </span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Zero-Risk Diagnosis: 100% of your Audit fee applies toward the Sprint.
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-mist">
                Apply your $3,000 Audit investment directly to the 14-Day Sprint if booked within 30 days.
              </p>
            </div>
          </div>
        </section>

        {/* Audit vs Sprint: self-selection */}
        <section className="relative border-b border-hairline bg-[#030712] px-5 py-10 sm:px-8 sm:py-14">
          <div className="relative mx-auto max-w-5xl">
            <SectionHeading
              chip="Which do you need?"
              title="Audit vs Sprint: two ways to use us"
              sub="One diagnoses, the other executes. Pick based on what you actually need right now."
            />
            <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Audit (primary) */}
              <div className="flex flex-col rounded-xl border border-electric/40 bg-electric/[0.05] p-7 shadow-[0_0_40px_rgba(20,184,166,0.12)] backdrop-blur-md">
                <span className="inline-block w-fit rounded-full border border-electric/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-electric">
                  The Audit
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">For diagnosis and prioritization</h3>
                <p className="mt-3 text-sm leading-relaxed text-mist">
                  Get a scored read on all nine parameters plus a prioritized plan, so you know
                  exactly what to fix and in what order. Best when you need clarity and direction
                  before committing to execution.
                </p>
                <p className="mt-5 text-sm font-semibold text-zinc-300">3 to 5 days · $3,000</p>
                <div className="mt-auto pt-6">
                  <button type="button" onClick={bookAudit} className="btn-electric w-full px-6 py-3 text-sm">
                    Book Your Audit - $3,000
                  </button>
                </div>
              </div>

              {/* Sprint (secondary) */}
              <div className="flex flex-col rounded-xl border border-indigo/30 bg-indigo/[0.05] p-7 backdrop-blur-md">
                <span className="inline-block w-fit rounded-full border border-indigo/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo">
                  The 14-Day Sprint
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">For execution and built assets</h3>
                <p className="mt-3 text-sm leading-relaxed text-mist">
                  Get positioning architecture, a messaging framework, homepage copy, and launch
                  assets built from your Diagnostic score. Best when the gap is clear and you need
                  the fix shipped in 14 days.
                </p>
                <p className="mt-5 text-sm font-semibold text-zinc-300">14 days · $7,500</p>
                <div className="mt-auto pt-6">
                  <a href="/services/sprint" className="btn-ghost w-full px-6 py-3 text-center text-sm">
                    Explore 14-Day Sprint - $7,500
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA: books the audit */}
        <section className="bg-[#030712] px-5 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-2xl rounded-xl border border-electric/30 bg-[#1E293B]/50 p-8 text-center shadow-[0_0_40px_rgba(20,184,166,0.14)] sm:p-10">
            <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Get a strategist's read on your GTM
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
              For when you want more than the free score, without committing to the full Sprint.
              A human-led diagnosis, delivered in 3 to 5 days.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={bookAudit} className="btn-electric px-7 py-3.5 text-base">
                Book Your Audit
              </button>
              <a href="/services/diagnostic" className="btn-ghost px-7 py-3.5 text-base">
                Run the Free Diagnostic First →
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              One-time fee of $3,000, billed upfront. No obligation; the free audit stands on its
              own.
            </p>
          </div>
        </section>
      </main>
      <Footer onBook={() => openBooking()} />
      {bookingOpen && (
        <BookingModal open={bookingOpen} onClose={closeBooking} initialService={preselectService} />
      )}
    </div>
  );
}
