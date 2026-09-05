/**
 * MarketReady: Free AI Audit & Scorecard (/services/diagnostic).
 *
 * The above-the-fold is the SAME shared Homepage Hero Diagnostic card used on
 * the homepage — rendered via <HeroDiagnostic> from src/components/HeroDiagnostic.tsx,
 * so the two are identical by construction (UI + crawl/score behavior). Below
 * the fold, a single unified "minimalist glass grid table" presents the
 * 5-dimensional friction matrix in a Dimension / What We Verify & Scan /
 * Revenue Impact layout, bridged by a CTA that funnels into the gated 5-D
 * assessment at /assessment.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { SectionHeading } from "~/components/services-ui";

export const Route = createFileRoute("/services/diagnostic")({
  head: () => ({
    meta: [
      { title: "Diagnostic: MarketReady" },
      {
        name: "description",
        content:
          "The MarketReady Free AI Audit & Scorecard. It identifies GTM friction and revenue leakage in seconds from your product URL alone, with no email required.",
      },
    ],
  }),
  component: DiagnosticPage,
});

/* ------------------------------------------------------------------ */
/* 5-Dimensional Friction Matrix: minimalist glass grid table          */
/* ------------------------------------------------------------------ */

const FRICTION_ROWS = [
  {
    id: "01",
    name: "Positioning",
    icon: "target",
    check: "Whether a first-time visitor can name the category you own in the first screen.",
    impact: "● Poor Category Retention & High Bounce Rate",
  },
  {
    id: "02",
    name: "Messaging",
    icon: "chat",
    check: "Whether headlines lead with the buyer's outcome rather than technical features.",
    impact: "● Low Headline-to-Demo Conversion",
  },
  {
    id: "03",
    name: "ICP Alignment",
    icon: "user",
    check: "Whether a specific, named buyer anchors the pitch instead of a vague audience.",
    impact: "● Unqualified Pipeline & Wasted CAC",
  },
  {
    id: "04",
    name: "Differentiation",
    icon: "scale",
    check: "Whether the site names a defensible difference competitors cannot easily copy.",
    impact: "● Price Competition & Long Sales Cycles",
  },
  {
    id: "05",
    name: "Funnel Velocity",
    icon: "zap",
    check: "Whether there is one clear CTA per page and a frictionless next step.",
    impact: "● High Funnel Abandonment & Paid Ad Burn",
  },
] as const;

function TableIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const svg = {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "target":
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chat":
      return (
        <svg {...svg}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "user":
      return (
        <svg {...svg}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "scale":
      return (
        <svg {...svg}>
          <path d="M12 3v18" />
          <path d="M16.5 7.5 21 5" />
          <path d="M7.5 7.5 3 5" />
          <path d="M12 7a6 6 0 0 0 6 6 6 6 0 0 0 6-6" />
          <path d="M12 7a6 6 0 0 1-6 6 6 6 0 0 1-6-6" />
          <path d="M5 3h14" />
        </svg>
      );
    default: // zap
      return (
        <svg {...svg}>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
  }
}

function FrictionTable() {
  return (
    <section className="border-b border-hairline bg-[#111827] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-[900px]">
        <SectionHeading
          chip="Friction Matrix"
          title="The 5-Dimensional Friction Matrix"
          sub="Five dimensions we check for the friction that quietly kills conversion: what we verify, and the revenue it costs you."
        />

        {/* Unified glass grid table */}
        <div
          className="relative mt-10 overflow-hidden"
          style={{
            backgroundColor: "rgba(17,24,39,0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            boxShadow: "0 0 25px rgba(20,184,166,0.08)",
          }}
        >
          {/* 2px teal→purple gradient accent along the top */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-[2px] w-full"
            style={{ background: "linear-gradient(90deg, #14B8A6, #A855F7)" }}
          />

          {/* Header row */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 px-6 py-[18px] md:grid-cols-[1fr_2fr_1fr]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Dimension</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              What We Verify &amp; Scan
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Revenue Impact</span>
          </div>

          {FRICTION_ROWS.map((row, i) => {
            const isLast = i === FRICTION_ROWS.length - 1;
            return (
              <div
                key={row.id}
                className={`grid grid-cols-1 gap-x-6 gap-y-1 px-6 py-[18px] transition-colors duration-200 hover:bg-[rgba(20,184,166,0.03)] md:grid-cols-[1fr_2fr_1fr] ${
                  isLast ? "" : "border-b border-[rgba(255,255,255,0.06)]"
                }`}
              >
                {/* Dimension */}
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center"
                    style={{
                      backgroundColor: "rgba(20,184,166,0.1)",
                      border: "1px solid #14B8A6",
                      borderRadius: "8px",
                    }}
                  >
                    <TableIcon name={row.icon} className="h-4 w-4 text-electric" />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold tracking-widest text-[#C084FC]">{row.id}</span>
                    <span className="text-sm font-semibold text-ink">{row.name}</span>
                  </div>
                </div>
                {/* What We Verify & Scan */}
                <p className="text-sm leading-relaxed text-mist">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 md:hidden">
                    We verify:{" "}
                  </span>
                  {row.check}
                </p>
                {/* Revenue Impact — glowing red pill badge */}
                <p className="text-sm font-semibold">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 md:hidden">
                    Impact:{" "}
                  </span>
                  <span
                    className="inline-flex items-center rounded-[6px] px-[10px] py-1 text-[13px] font-semibold text-[#F87171]"
                    style={{
                      backgroundColor: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {row.impact}
                  </span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Bridge CTA — scrolls back to the hero URL input, funnels to /assessment */}
        <div className="mt-10 text-center">
          <a
            href="/assessment"
            onClick={() => {
              const hero = document.getElementById("top");
              if (hero) hero.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="btn-electric h-[44px] px-7 text-sm"
            style={{ fontWeight: 700 }}
          >
            Get Your Full 5-D Score &amp; Prescription →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function DiagnosticPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const closeBooking = () => setBookingOpen(false);
  const openBooking = () => setBookingOpen(true);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        {/* Shared hero diagnostic card — centered single-column tool layout on this page */}
        <HeroDiagnostic variant="centered" onBookBriefing={openBooking} />

        {/* 5-Dimensional Friction Matrix: minimalist glass grid table */}
        <FrictionTable />

        {/* Bottom CTA */}
        <section className="bg-[#030712] px-5 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-2xl rounded-xl border border-electric/30 bg-[#1E293B]/50 p-8 text-center shadow-[0_0_40px_rgba(20,184,166,0.14)] sm:p-10">
            <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              The instant scan is just the teaser
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
              The full 5-dimension diagnostic scores each dimension against 9 PMM parameters and
              prescribes the exact fix for your primary friction source.
            </p>
            <div className="mt-7">
              <a href="/assessment" className="btn-electric px-7 py-3.5 text-base">
                Unlock Full 5-D Assessment &amp; Prescription →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer onBook={openBooking} />
      {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
    </div>
  );
}
