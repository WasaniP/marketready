/**
 * MarketReady: 14-Day Sprint (/services/sprint, build #27 + content pass).
 *
 * 'Nine deliverables, shipped in 14 days' (from the owner-approved copy spec)
 * plus the honest terms line (one round of revisions) and explicit exclusions.
 * Both CTAs route honestly: 'Book a Call' opens the booking modal with
 * 'MarketReady Sprint' pre-selected; 'Get the Sprint' uses the same
 * lead-capture booking path (Stripe is not wired, so there is no fake
 * checkout and no 'buy now' wording).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import {
 ServicesChip,
 SectionHeading,
 SubPageHero,
} from "~/components/services-ui";

export const Route = createFileRoute("/services/sprint")({
 head: () => ({
  meta: [
   { title: "14-Day Sprint: MarketReady" },
   {
    name: "description",
    content:
     "The MarketReady 14-Day Positioning Sprint at $7,500: nine strategy and launch assets built from your Diagnostic score, including positioning architecture, messaging framework, homepage copy, and launch assets.",
   },
  ],
 }),
 component: SprintPage,
});

/* ------------------------------------------------------------------ */
/* Section 1: deliverable-to-pillar map (echoes /services 9-Parameter) */
/* ------------------------------------------------------------------ */

/**
 * Maps the nine deliverables back onto the three pillars scored by the
 * Diagnostic. Color coding intentionally matches the /services 9-Parameter
 * Framework (teal / cyan / indigo) so a returning visitor recognizes the same
 * system: Core Positioning -> #14B8A6, Messaging & Value Prop -> #22D3EE,
 * GTM & Launch Velocity -> #6366F1. Deliverable numbers are intentionally
 * non-contiguous within a pillar (e.g. Messaging holds 04,05,06,08).
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

const PILLAR_BANDS: PillarBand[] = [
 {
  name: "Core Positioning",
  blurb: "Pillar 01",
  accent: "#C96A42",
  soft: "rgba(201,106,66,0.25)",
  glow: "rgba(201,106,66,0.25)",
  text: "#B8AEA3",
  light: "#99F6E4",
  items: [
   { num: "01", label: "Positioning Statement & Architecture" },
   { num: "02", label: "ICP & Persona Definition" },
   { num: "03", label: "Competitive Differentiation Framework" },
  ],
 },
 {
  name: "Messaging & Value Prop",
  blurb: "Pillar 02",
  accent: "#E8C9A0",
  soft: "rgba(201,106,66,0.25)",
  glow: "rgba(201,106,66,0.25)",
  text: "#B8AEA3",
  light: "#A5F3FC",
  items: [
   { num: "04", label: "Messaging Framework / Message House" },
   { num: "05", label: "Homepage Copy Rewrite" },
   { num: "06", label: "Core Sales Messaging" },
   { num: "08", label: "Pricing & Packaging Sanity Check" },
  ],
 },
 {
  name: "GTM & Launch Velocity",
  blurb: "Pillar 03",
  accent: "#6E9464",
  soft: "rgba(201,106,66,0.25)",
  glow: "rgba(201,106,66,0.25)",
  text: "#B8AEA3",
  light: "#C7D2FE",
  items: [
   { num: "07", label: "Launch / GTM One-Pager" },
   { num: "09", label: "Scorecard Delta (Before / After)" },
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
       className="inline-flex items-center gap-2 rounded-lg border bg-[#16120F]/60 px-3 py-2 text-sm font-medium text-mist"
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
/* Section 2: 14-day timeline                     */
/* ------------------------------------------------------------------ */

const TIMELINE = [
 {
  span: "DAYS 1-2",
  title: "Diagnostic Deep-Dive",
  body: "Your scores and primary friction reviewed, scored, and prioritized with you.",
  chip: "Executive Strategy Deck",
 },
 {
  span: "DAYS 3-7",
  title: "Positioning & ICP",
  body: "Positioning and messaging built on the exact gaps the Diagnostic found.",
  chip: "Core Messaging System",
 },
 {
  span: "DAYS 8-12",
  title: "Messaging & Sales Assets",
  body: "Homepage copy, core sales messaging, objection handling and battlecards.",
  chip: "Homepage Copy & Battlecards",
 },
 {
  span: "DAYS 13-14",
  title: "Delivery & Scorecard",
  body: "Final assets delivered and the before / after scorecard delta reviewed.",
  chip: "Final Delta Scorecard",
 },
];

function TimelineCard({ s }: { s: (typeof TIMELINE)[number] }) {
 return (
  <div className="flex flex-col items-stretch text-left">
   {/* Top indicator: day-range badge above the connector node */}
   <span className="text-center text-[11px] font-bold uppercase tracking-wider text-ember [text-shadow:0_0_12px_rgba(201,106,66,0.25)]">
    {s.span}
   </span>
   <div className="mt-3 flex justify-center">
    <span
     className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-electric bg-[#16120F]"
     style={{ boxShadow: "0 0 12px rgba(201,106,66,0.25)" }}
    >
     <span className="h-1.5 w-1.5 rounded-full bg-ember" />
    </span>
   </div>
   {/* Milestone card */}
   <div className="mt-4 flex flex-1 flex-col rounded-xl border border-slate-800 bg-[#1F1A16]/50 p-4">
    <h4 className="text-sm font-bold text-ink">{s.title}</h4>
    <p className="mt-1.5 text-xs leading-relaxed text-fog">{s.body}</p>
    <div className="my-3 border-t border-slate-800" />
    <span className="mt-auto inline-flex w-fit items-center rounded-md border border-teal-500/30 bg-teal-950/60 px-2.5 py-1 font-mono text-xs text-teal-300">
     {s.chip}
    </span>
   </div>
  </div>
 );
}

function TimelineDesktop() {
 return (
  <div className="relative hidden md:block">
   <div
    aria-hidden="true"
    className="absolute left-0 right-0 top-[30px] h-px bg-gradient-to-r from-transparent via-electric/40 to-transparent"
   />
   <div className="relative grid grid-cols-4 gap-6">
    {TIMELINE.map((s) => (
     <TimelineCard key={s.span} s={s} />
    ))}
   </div>
  </div>
 );
}

function TimelineMobile() {
 return (
  <div className="relative md:hidden">
   <div aria-hidden="true" className="absolute bottom-2 left-[6px] top-2 w-px bg-ember/30" />
   <div className="space-y-5 pl-8">
    {TIMELINE.map((s) => (
     <div key={s.span} className="relative">
      <span
       className="absolute -left-8 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-electric bg-[#1F1A16]"
       style={{ boxShadow: "0 0 10px rgba(201,106,66,0.25)" }}
      >
       <span className="h-1 w-1 rounded-full bg-ember" />
      </span>
      <TimelineCard s={s} />
     </div>
    ))}
   </div>
  </div>
 );
}

/* ------------------------------------------------------------------ */
/* Section 4: score-delta before / after radial gauges         */
/* ------------------------------------------------------------------ */

function DeltaGauge({
 score,
 color,
 halo,
 valueText,
 label,
 labelColor,
}: {
 score: number;
 color: string;
 halo: string;
 valueText: string;
 label: string;
 labelColor: string;
}) {
 const r = 64;
 const c = 2 * Math.PI * r;
 const frac = Math.max(0, Math.min(100, score)) / 100;
 return (
  <div className="flex flex-col items-center">
   <div className="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
    <div
     aria-hidden="true"
     className="absolute -inset-2 rounded-full blur-2xl"
     style={{ background: halo }}
    />
    <svg
     viewBox="0 0 160 160"
     className="relative h-full w-full -rotate-90"
     role="img"
     aria-label={`${label}: ${score} out of 100`}
    >
     <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
     <circle
      cx="80"
      cy="80"
      r={r}
      fill="none"
      stroke={color}
      strokeWidth="10"
      strokeLinecap="round"
      strokeDasharray={`${c * frac} ${c}`}
      style={{ filter: `drop-shadow(0 0 10px ${color})` }}
     />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
     <span
      className="text-[2.5rem] font-extrabold leading-none tabular-nums"
      style={{ color: valueText }}
     >
      {score}
     </span>
     <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fog">
      / 100
     </span>
     <span
      className="mt-1 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: labelColor }}
     >
      {label}
     </span>
    </div>
   </div>
  </div>
 );
}

/* ------------------------------------------------------------------ */
/* Page                                */
/* ------------------------------------------------------------------ */

function SprintPage() {
 const [bookingOpen, setBookingOpen] = useState(false);
 const [preselectService, setPreselectService] = useState<string | undefined>(undefined);
 const openBooking = (service?: string) => {
  setPreselectService(service);
  setBookingOpen(true);
 };
 const closeBooking = () => setBookingOpen(false);

 const bookSprint = () => openBooking("MarketReady Sprint");

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main>
    <SubPageHero
     chip={<ServicesChip>14-Day Sprint</ServicesChip>}
     title="14-Day Strategy &amp; Launch Assets From Your Diagnostic Score."
     sub="Built from your Diagnostic: not a generic template. Every Sprint starts with your actual scores, so the fixes are specific to your product."
     topPadding="pt-20 sm:pt-24"
    >
     <button
      type="button"
      onClick={bookSprint}
      className="rounded-lg bg-teal-400 px-7 py-3.5 text-base font-bold text-slate-950 transition-colors hover:bg-teal-300"
     >
      Book Your 14-Day Sprint ($7,500) →
     </button>
     <a
      href="/services/diagnostic"
      className="rounded-lg border border-hairline px-7 py-3.5 text-base font-medium text-mist transition-colors hover:bg-linen/40"
     >
      Haven't run the Diagnostic yet?
     </a>
    </SubPageHero>

    {/* Section 1 (build #29): deliverable-to-pillar map */}
    <section className="relative overflow-hidden border-b border-hairline bg-[#16120F] px-5 py-10 sm:px-8 sm:py-14">
     <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-ember/[0.06] blur-3xl"
     />
     <div className="relative mx-auto max-w-5xl">
      <SectionHeading
       chip="The map"
       title="Every deliverable maps to a pillar the Diagnostic already scored."
       sub="Same three pillars, same colors, same 9-Parameter Framework that runs the free Diagnostic and the full Audit."
      />
      <div className="mt-12 space-y-4">
       {PILLAR_BANDS.map((band) => (
        <PillarBandRow key={band.name} band={band} />
       ))}
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-fog">
       If you recognize this color coding from the{" "}
       <a href="/services" className="text-ember underline decoration-electric/40 underline-offset-2 hover:text-teal-300">
        9-Parameter Framework diagram
       </a>
       , that's the point: the Sprint rebuilds the exact pillars your Diagnostic scored lowest,
       in the same system, so the fix reads as an extension of the diagnosis rather than a
       different product.
      </p>
     </div>
    </section>

    {/* Section 2 (build #29): 14-day timeline */}
    <section className="relative overflow-hidden border-b border-hairline bg-[#1F1A16] px-5 py-10 sm:px-8 sm:py-14">
     <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[size:26px_26px]"
      style={{
       backgroundImage:
        "linear-gradient(rgba(51,65,85,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.04) 1px, transparent 1px)",
      }}
     />
     <div className="relative mx-auto max-w-4xl">
      <SectionHeading
       chip="How the 14 days run"
       title="A focused two-week build"
       sub="The timetable below is a working rhythm, tightened to what the Diagnostic flags as your weakest pillar."
      />
      <div className="mt-12">
       <TimelineDesktop />
       <TimelineMobile />
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-fog">
       One round of revisions is included per deliverable: your team stays in the loop at
       each of the four checkpoints rather than waiting for a single final reveal.
      </p>
     </div>
    </section>

    {/* Section 3 (build #29): BUILT FOR / NOT FOR */}
    <section className="relative border-b border-hairline bg-[#16120F] px-5 py-10 sm:px-8 sm:py-14">
     <div className="relative mx-auto max-w-5xl">
      <SectionHeading
       chip="Is it for you?"
       title="Built to fix what the Diagnostic found"
       sub="The Sprint is an execution engagement, not a discovery we make generic."
      />
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
       <div className="overflow-hidden rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-6 backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">✓ Built for</p>
        <p className="mt-3 text-sm leading-relaxed text-emerald-200/50">
         Teams who scored in a "needs refinement" or "critical gap" range on the Diagnostic
         and need the fix executed, not just diagnosed. You already know where the gap is,
         the Sprint closes it.
        </p>
       </div>
       <div className="overflow-hidden rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-6 backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-300">✕ Not for</p>
        <p className="mt-3 text-sm leading-relaxed text-rose-200/45">
         Pre-MVP concepts, or teams who haven't run the Diagnostic yet. If that's you,
         {" "}
         <a href="/services/diagnostic" className="underline decoration-rose-300/40 underline-offset-2 hover:text-rose-200">
          run the free Diagnostic first
         </a>{" "}
         so the fix targets your real gaps rather than guesswork.
        </p>
       </div>
      </div>
     </div>
    </section>

    {/* Section 4 (build #29): score-delta before / after gauges */}
    <section className="relative overflow-hidden border-b border-hairline bg-[#1F1A16] px-5 py-10 sm:px-8 sm:py-14">
     <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-ember/[0.05] blur-3xl"
     />
     <div className="relative mx-auto max-w-4xl">
      <SectionHeading
       chip="The target shift"
       title="The scorecard delta the Sprint targets"
       sub="Same 9 dimensions, rescored after delivery. Represented as an illustrative before / after; it is what the Sprint is designed to move, not a promise to any specific customer."
      />
      <div className="mx-auto mt-12 flex max-w-2xl flex-col items-center justify-center gap-8 sm:flex-row sm:gap-6">
       <div className="flex flex-col items-center">
        <DeltaGauge
         score={42}
         color="#EF4444"
         halo="rgba(239,68,68,0.25)"
         valueText="#F87171"
         label="High Risk"
         labelColor="#EF4444"
        />
        <p className="mt-2 text-center text-sm font-medium text-mist/70">Before</p>
       </div>
       <div
        aria-hidden="true"
        className="flex items-center text-2xl font-extrabold text-ember sm:text-3xl"
       >
        →
       </div>
       <div className="flex flex-col items-center">
        <DeltaGauge
         score={86}
         color="#C96A42"
         halo="rgba(201,106,66,0.25)"
         valueText="#B8AEA3"
         label="Market Ready"
         labelColor="#C96A42"
        />
        <p className="mt-2 text-center text-sm font-medium text-pinetint/70">After</p>
       </div>
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-fog">
       The Sprint targets the exact leakage points dragging down your score. You get a full
       rescore at Day 14 to measure your positioning delta.
      </p>
     </div>
    </section>

    {/* Bottom CTA: dual CTAs */}
    <section className="bg-[#16120F] px-5 py-12 sm:px-8 sm:py-14">
     <div className="mx-auto max-w-2xl rounded-xl border border-ember/30 bg-[#2A2320]/50 p-8 text-center sm:p-10">
      <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
       Ready to lock your positioning?
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
       For teams ready to fix what the Diagnostic found.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
       <button type="button" onClick={bookSprint} className="btn-electric px-7 py-3.5 text-base">
        Book a Call →
       </button>
       <button type="button" onClick={bookSprint} className="btn-ghost px-7 py-3.5 text-base">
        Get the Sprint →
       </button>
      </div>
      <p className="mt-4 text-xs text-fog">
       Not sure it's the right fit? Run the free diagnostic first. It tells you exactly what
       you need.
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
