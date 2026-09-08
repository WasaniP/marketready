/**
 * MarketReady About page - high-trust, first-person founder story.
 *
 * Foundational copy is grounded ONLY in confirmed facts: the positioning &
 * GTM playbook was forged inside major media and sports brands (Warner Bros.
 * Discovery, Impact.com, Nativo, Penske Media, AEW, NCAA, Bleacher Report,
 * TNT Sports, TBS, Variety, Rolling Stone). No invented titles, years,
 * metrics, or client claims. No em dashes anywhere in the copy.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";

export const Route = createFileRoute("/about")({
 head: () => ({
  meta: [
   { title: "About: MarketReady" },
   {
    name: "description",
    content:
     "MarketReady brings the positioning and go-to-market playbook forged inside major media and brands, including Warner Bros. Discovery, Impact.com, Nativo, Penske Media, Bleacher Report, TNT Sports, Rolling Stone, Variety, and AEW, to founders and growth teams.",
   },
  ],
 }),
 component: AboutPage,
});

/** Brand wordmarks (pure CSS text, no images/logos). */
const BRAND_TILES = [
 "Warner Bros. Discovery",
 "Bleacher Report",
 "TNT Sports",
 "Rolling Stone",
 "NCAA",
 "AEW",
 "Variety",
 "TBS",
];

/** Founder operating principles, rendered as ghosted-number cards. */
const PRINCIPLES = [
 {
  n: "01",
  title: "No Strategy Theater",
  body: "We ship executable positioning frameworks, not 80-page decks that collect dust.",
 },
 {
  n: "02",
  title: "Outcomes Over Features",
  body: "Buyers don't care about your tech stack; they care about their revenue, speed, and status.",
 },
 {
  n: "03",
  title: "Precision at Speed",
  body: "Fix messaging drag in 14 days so your sales cycles shorten immediately.",
 },
];

/** MarketReady Standards - what we reject vs. what we deliver. */
const STANDARDS = [
 {
  reject: "Opaque, ongoing agency retainers",
  deliver: "Fixed 14-day GTM positioning sprints",
 },
 {
  reject: "Vague \u201cbrand awareness\u201d metrics",
  deliver: "Measurable headline-to-demo conversion lift",
 },
 {
  reject: "Feature-heavy technical jargon",
  deliver: "Sharp, outcome-driven category ownership",
 },
];

/** X-icon (reject). Inline SVG in the site's stroke style. */
function XIcon() {
 return (
  <svg
   className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/80"
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
   aria-hidden="true"
  >
   <path d="M18 6 6 18M6 6l12 12" />
  </svg>
 );
}

/** LinkedIn "in" icon (small inline SVG). */
function LinkedInIcon() {
 return (
  <svg
   className="h-3.5 w-3.5 shrink-0"
   viewBox="0 0 24 24"
   fill="currentColor"
   aria-hidden="true"
  >
   <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
 );
}

/** Check-icon (deliver). Inline SVG in the site's stroke style. */
function CheckIcon() {
 return (
  <svg
   className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember"
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
   strokeLinejoin="round"
   aria-hidden="true"
  >
   <path d="M20 6 9 17l-5-5" />
  </svg>
 );
}

function AboutPage() {
 const [bookingOpen, setBookingOpen] = useState(false);
 const closeBooking = () => setBookingOpen(false);

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main>
    {/* SECTION 1 - HERO (photo placeholder beside the founder intro) */}
    <section className="relative overflow-hidden border-b border-hairline bg-[#16120F] px-5 pb-14 pt-24 sm:px-8 sm:pb-16 sm:pt-28">
     <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-ember/[0.07] blur-3xl"
     />
     <div className="relative mx-auto flex max-w-[820px] flex-col items-start gap-8 sm:flex-row sm:items-start sm:gap-10">
      {/* Left column: photo on top, LinkedIn pill beneath it */}
      <div className="flex shrink-0 flex-col items-start gap-3">
       {/* Circular photo placeholder (no real asset yet) */}
       <div
        role="img"
        aria-label="Wasani Probasco, Founder of MarketReady"
        className="flex h-[132px] w-[132px] items-center justify-center rounded-full border-2 border-electric/60 bg-[#0B1220] "
       >
        <span className="text-[38px] font-extrabold tracking-tight text-ember/70">
         WP
        </span>
       </div>
       <a
        href="https://www.linkedin.com/in/wasanip/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1 text-[13px] font-medium text-ember transition hover:bg-ember/15"
       >
        <LinkedInIcon />
        LinkedIn
       </a>
      </div>

      {/* Founder copy */}
      <div className="max-w-[640px]">
       <h1 className="text-2xl font-medium tracking-tight text-ink">
        I&rsquo;m Wasani
       </h1>
       <p className="mt-1 text-[14px] font-medium text-ember">
        Founder, MarketReady
       </p>
       <p className="mt-5 text-[15px] leading-relaxed text-mist">
        For most of my career, I&rsquo;ve built go-to-market strategy inside
        some of the biggest names in media and entertainment: Warner Bros.
        Discovery, Impact.com, Nativo, Penske Media. I&rsquo;ve shaped how
        brands like Bleacher Report, Rolling Stone, Variety, and TNT Sports
        talk to their audiences, and I&rsquo;ve sat in the room when a launch
        either lands or falls flat.
       </p>
       <p className="mt-5 text-[15px] leading-relaxed text-mist">
        What I noticed along the way is that this kind of rigor rarely
        reaches an early-stage company, even though founders want it just as
        much as any enterprise team does. It usually lives inside
        organizations with a headcount and budget most startups haven&rsquo;t
        built yet.
       </p>
       <p className="mt-5 text-[15px] leading-relaxed text-mist">
        That&rsquo;s the thread running through everything I do: understand how
        a buyer actually decides, then build messaging that meets them there
        instead of talking past them.
       </p>
       <p className="mt-5 text-[15px] leading-relaxed text-mist">
        MarketReady is where that thread becomes a system. It&rsquo;s the
        positioning and GTM process I&rsquo;ve used across SaaS, media, and
        consumer products, built for teams at the pre-seed and Series A stage
        who need it now, not once they can finally afford to hire for it.
       </p>
      </div>
     </div>

     {/* Employer credibility strip - thin top border + single dot-bulleted line */}
     <div className="relative mx-auto mt-12 max-w-[820px] border-t border-hairline px-5 pt-6 sm:px-0">
      <p className="text-sm font-medium tracking-wide text-[#71717A]">
       Warner Bros. Discovery
       <span aria-hidden="true" className="mx-1.5 text-[#71717A]/60">·</span>
       Impact.com
       <span aria-hidden="true" className="mx-1.5 text-[#71717A]/60">·</span>
       Nativo
       <span aria-hidden="true" className="mx-1.5 text-[#71717A]/60">·</span>
       Penske Media
      </p>
     </div>
    </section>

    {/* SECTION 2 - BRAND CREDIBILITY (quiet horizontal wordmark strip) */}
    <section className="border-b border-hairline bg-[#16120F] px-5 py-12 sm:px-8">
     <div className="mx-auto max-w-[900px]">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
       Positioning &amp; GTM Playbooks Applied Across
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8B8F98]">
       {BRAND_TILES.map((brand) => (
        <span key={brand}>{brand}</span>
       ))}
      </div>
     </div>
    </section>

    {/* SECTION 3 - THE FOUNDER'S PERSPECTIVE (editorial split + ghosted numbers) */}
    <section className="border-b border-hairline bg-[#1F1A16] px-5 py-16 sm:px-8 sm:py-24">
     <div className="mx-auto grid max-w-[1000px] gap-12 md:grid-cols-2 md:gap-16">
      {/* Left - section intro + condensed thesis */}
      <div>
       <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ember">
        The Founder&rsquo;s Perspective
       </p>
       <h3 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Rigor that follows the buyer&rsquo;s decision.
       </h3>
       <p className="mt-5 text-base leading-relaxed text-mist">
        In major media and sports environments, positioning isn&rsquo;t an
        afterthought. It is the entire battle. The audience is identified
        before the headline is written, the category is staked before the
        launch date is set, and every single asset must agree.
       </p>
       <p className="mt-5 text-base leading-relaxed text-mist">
        Most startups don&rsquo;t fail because their product is weak. They
        fail because their positioning is generic. MarketReady brings
        big-brand positioning discipline into a high-velocity 14-day sprint,
        without the bloated retainers and strategy theater.
       </p>
      </div>

      {/* Right - operating principles as ghosted-number cards */}
      <div className="flex flex-col gap-6">
       {PRINCIPLES.map((p) => (
        <div
         key={p.n}
         className="relative overflow-hidden rounded-xl border border-hairline bg-[#16120F]/60 p-6"
        >
         {/* Huge ghosted background number */}
         <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-7 -right-3 select-none text-[96px] font-extrabold leading-none text-ember/[0.06]"
         >
          {p.n}
         </span>
         <h4 className="relative text-lg font-semibold text-ink">{p.title}</h4>
         <p className="relative mt-2 text-sm leading-relaxed text-mist">
          {p.body}
         </p>
        </div>
       ))}
      </div>
     </div>
    </section>

    {/* SECTION 4 - THE MARKETREADY STANDARDS (2-column table + icons) */}
    <section className="border-b border-hairline bg-[#16120F] px-5 py-16 sm:px-8 sm:py-24">
     <div className="mx-auto max-w-[800px]">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
       The MarketReady Standards
      </p>
      <div className="mt-10 border-t-2 border-electric">
       <div className="grid grid-cols-2 gap-6 border-b border-hairline py-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-mist">
         What we reject
        </span>
        <span className="text-sm font-semibold uppercase tracking-wide text-ink">
         What we deliver
        </span>
       </div>
       {STANDARDS.map((row) => (
        <div
         key={row.reject}
         className="grid grid-cols-2 gap-6 border-b border-hairline py-5"
        >
         <span className="flex items-start gap-2.5 text-sm leading-relaxed text-[#9CA3AF]">
          <XIcon />
          <span>{row.reject}</span>
         </span>
         <span className="flex items-start gap-2.5 text-sm font-semibold leading-relaxed text-[#F9FAFB]">
          <CheckIcon />
          <span>{row.deliver}</span>
         </span>
        </div>
       ))}
      </div>
     </div>
    </section>

    {/* SECTION 5 - CALL TO ACTION BANNER (kept as-is) */}
    <section className="border-b border-hairline bg-[#1F1A16] px-5 py-16 sm:px-8 sm:py-20">
     <div className="mx-auto max-w-3xl text-center">
      <h3 className="text-2xl font-bold tracking-tight text-[#F9FAFB] sm:text-3xl">
       Ready to stop wasting burn on ambiguous messaging?
      </h3>
      <a
       href="/services/diagnostic"
       className="mt-8 inline-flex h-[44px] items-center justify-center rounded-lg bg-ember px-7 text-[14px] font-bold text-[#16120F] transition hover:brightness-110"
      >
       Get Your Free Diagnostic Score →
      </a>
     </div>
    </section>
   </main>
   <Footer onBook={() => setBookingOpen(true)} />
   {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
  </div>
 );
}
