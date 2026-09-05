/**
 * MarketReady assessment results (build #23).
 *
 * /assessment/results reveals the score, and only after the lead gate: this
 * page reads the completed diagnostic from localStorage key
 * `marketready:diagnostic` and refuses to render without the gate marker
 * (`gatedAt`). Cold access (no stored result) redirects to /assessment.
 *
 * Pricing at $7,500 for the Sprint, as the dynamic prescription: the
 * prescription line and primary CTA below, plus the matching $7,500 Sprint
 * caption on the homepage stages. SSR-safe: the page renders null until
 * hydrated, then either shows the result or redirects.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { openCheckout, CHECKOUT_SERVICES } from "~/lib/checkout";
import {
  DIMENSIONS,
  readDiagnosticState,
  scoreDiagnostic,
  readinessBand,
  bandColor,
  primaryFriction,
  prescriptionFor,
} from "~/lib/diagnostic";
import type { DiagnosticState } from "~/lib/diagnostic";

export const Route = createFileRoute("/assessment/results")({
  head: () => ({
    meta: [
      { title: "Your Score: MarketReady" },
      {
        name: "description",
        content:
          "Your Market Ready Score, readiness level, primary friction point, and the recommended next step for your go-to-market.",
      },
    ],
  }),
  component: Results,
});

/** The sole Sprint-price constant. The homepage stages also surface this same
 * $7,500 figure, but this stays the single source of truth for the results
 * page. */
const RX_PRICE = "$7,500";

/** Checkout-gate terms label (build #24). Kept as ONE literal so the exact
 * sentence ships contiguously in the bundle (QA greps it); the agreement name
 * is split out at render time to become the /terms link. */
const GATE_TERMS_LABEL =
  "I agree to the MarketReady Productized Services Terms & Scope Agreement.";
const GATE_TERMS_NAME = "MarketReady Productized Services Terms & Scope Agreement";
const [GATE_TERMS_BEFORE = "", GATE_TERMS_AFTER = ""] = GATE_TERMS_LABEL.split(GATE_TERMS_NAME);

/* ------------------------------------------------------------------ */
/* Compact 240° gauge (same visual language as the homepage dashboard) */
/* ------------------------------------------------------------------ */
const GAUGE_CX = 140;
const GAUGE_CY = 158;
const GAUGE_R = 118;
const GAUGE_SWEEP = 240;
const GAUGE_START = -120;
const HAIRLINE = "#1E293B";
const INK = "#FAFAFA";
const MIST = "#A1A1AA";

function gaugePoint(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: GAUGE_CX + GAUGE_R * Math.sin(rad),
    y: GAUGE_CY - GAUGE_R * Math.cos(rad),
  };
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const frac = Math.max(0, Math.min(100, score)) / 100;
  const p0 = gaugePoint(GAUGE_START);
  const p1 = gaugePoint(GAUGE_START + GAUGE_SWEEP);
  const track = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${GAUGE_R} ${GAUGE_R} 0 1 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  const pe = gaugePoint(GAUGE_START + GAUGE_SWEEP * frac);
  const largeArc = frac > 0.5 ? 1 : 0;
  const progress =
    score <= 0
      ? ""
      : `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} 1 ${pe.x.toFixed(2)} ${pe.y.toFixed(2)}`;
  const glow = `drop-shadow(0 0 10px ${color}66)`;
  return (
    <svg
      viewBox="0 0 280 210"
      className="w-full max-w-[300px]"
      role="img"
      aria-label={`Market Readiness Score: ${score} out of 100`}
    >
      <path d={track} stroke={HAIRLINE} strokeWidth={16} strokeLinecap="round" fill="none" />
      {progress && (
        <path
          d={progress}
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          fill="none"
          style={{ filter: glow }}
        />
      )}
      <text
        x={GAUGE_CX}
        y={GAUGE_CY - 10}
        textAnchor="middle"
        fontSize={54}
        fontWeight={800}
        fill={INK}
        style={{ letterSpacing: "-0.03em" }}
      >
        {score}
      </text>
      <text x={GAUGE_CX} y={GAUGE_CY + 22} textAnchor="middle" fontSize={13} fontWeight={500} fill={MIST}>
        out of 100
      </text>
    </svg>
  );
}

/** Rating → status color (mirrors the design-system status palette). */
function ratingColor(value: number): string {
  if (value >= 4) return "#10B981";
  if (value === 3) return "#F59E0B";
  return "#EF4444";
}

function Results() {
  const [result, setResult] = useState<DiagnosticState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(undefined);
  // Build #24 checkout gate: the primary CTA opens this gate first (terms
  // agreement), which then routes through the existing openCheckout flow.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const [gateHint, setGateHint] = useState("");
  const gateCheckboxRef = useRef<HTMLInputElement>(null);

  // Read after mount only (SSR-safe): render null until hydrated, then either
  // show the result or send cold visitors back to the assessment.
  useEffect(() => {
    const stored = readDiagnosticState();
    if (!stored) {
      window.location.replace("/assessment");
      return;
    }
    setResult(stored);
    setHydrated(true);
  }, []);

  // Scroll-lock + focus while the gate is open (mirrors the booking modal).
  useEffect(() => {
    if (!gateOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = window.requestAnimationFrame(() => gateCheckboxRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, [gateOpen]);

  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  /** Primary CTA → terms gate. Proceed routes through openCheckout (real
   * Stripe redirect once SPRINT_PAYMENT_LINK is set; booking modal otherwise). */
  const openGate = () => {
    setGateChecked(false);
    setGateHint("");
    setGateOpen(true);
  };

  const proceedFromGate = () => {
    if (!gateChecked) {
      setGateHint("Please agree to the terms to continue.");
      return;
    }
    setGateOpen(false);
    openCheckout(CHECKOUT_SERVICES.sprint, openBooking);
  };

  const gateKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setGateOpen(false);
    }
  };

  if (!hydrated || !result) return null;

  const score = scoreDiagnostic(result.answers);
  const band = readinessBand(score);
  const color = bandColor(band);
  const friction = primaryFriction(result.answers);
  const frictionName = DIMENSIONS.find((d) => d.id === friction)?.name ?? "Positioning";
  const rx = prescriptionFor(friction);
  const prescriptionName =
    rx === "sprint"
      ? `14-Day Positioning Sprint (${RX_PRICE})`
      : `Fractional GTM Advisory (${RX_PRICE}/month)`;
  const prescriptionLine =
    rx === "sprint"
      ? "A two-week engagement that turns the gaps this audit flagged into positioning architecture, homepage rewrites, and a core launch deck."
      : "Ongoing fractional GTM support for acquisition and funnel execution alongside your team, starting where this audit found the friction.";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pt-36">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-electric/[0.08] blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-2xl">
            <span className="chip border-electric/40 text-electric">
              Market Readiness Score
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Your Market Ready Score
            </h1>

            {/* Score + readiness */}
            <div className="glass-card mt-6 flex flex-col items-center p-6 sm:p-8">
              <ScoreGauge score={score} color={color} />
              <p
                className="mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold"
                style={{
                  color,
                  borderColor: `${color}55`,
                  backgroundColor: `${color}14`,
                }}
                aria-live="polite"
              >
                {band}
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Based on your five responses, {score}/100 overall readiness.
              </p>
            </div>

            {/* Primary friction */}
            <div className="glass-card mt-4 p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                Primary Friction Point:{" "}
                <span className="text-electric">{frictionName}</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-mist">
                Your lowest-scoring dimension is the first place your go-to-market
                leaks. This is where the fix starts.
              </p>

              {/* Per-dimension breakdown */}
              <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-6">
                {DIMENSIONS.map((d) => {
                  const value = result.answers[d.id];
                  const isFriction = d.id === friction;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                        isFriction
                          ? "border-electric/40 bg-electric/[0.06]"
                          : "border-hairline bg-white/[0.02]"
                      }`}
                    >
                      <span className="w-40 shrink-0 text-sm font-medium text-ink">
                        {d.name}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(value / 5) * 100}%`,
                            backgroundColor: ratingColor(value),
                          }}
                        />
                      </div>
                      <span
                        className="w-9 shrink-0 text-right text-sm font-bold"
                        style={{ color: ratingColor(value) }}
                      >
                        {value}/5
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prescribed solution */}
            <div className="glass-card mt-4 border-electric/30 p-6 sm:p-8">
              <span className="chip border-electric/40 text-electric">
                Recommended Prescription
              </span>
              <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink">
                {prescriptionName}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{prescriptionLine}</p>
            </div>

            {/* Conversion CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openGate}
                className="btn-electric flex-1"
              >
                Start Your Sprint ($7,500) →
              </button>
              <button
                type="button"
                onClick={() => openBooking(CHECKOUT_SERVICES.advisory)}
                className="btn-ghost flex-1"
              >
                Talk to a GTM Strategist →
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-500">
              No obligation. The free audit stands on its own.
            </p>

            <p className="mt-8 text-center">
              <a
                href="/assessment"
                className="text-sm font-medium text-zinc-500 transition-colors hover:text-electric"
              >
                Retake the assessment →
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer onBook={openBooking} />
      {bookingOpen && (
        <BookingModal
          open={bookingOpen}
          onClose={closeBooking}
          initialService={preselectService}
        />
      )}
      {gateOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-modal-title"
          onKeyDown={gateKeyDown}
        >
          {/* Backdrop: click closes */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setGateOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-[#1E293B]/50 p-6 shadow-[0_0_60px_rgba(20,184,166,0.18)] backdrop-blur-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="chip border-electric/40 text-electric">Checkout</span>
                <h4 id="gate-modal-title" className="mt-3 text-xl font-bold tracking-tight text-ink">
                  Confirm your Sprint booking
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-mist">
                  14-Day Positioning Sprint, a one-time engagement, billed
                  upfront. You'll complete a short booking form next; we'll
                  handle scheduling from there.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                aria-label="Close checkout dialog"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline text-mist transition-colors hover:border-zinc-600 hover:text-ink"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-zinc-600">
              <input
                ref={gateCheckboxRef}
                type="checkbox"
                checked={gateChecked}
                onChange={(e) => {
                  setGateChecked(e.target.checked);
                  if (e.target.checked) setGateHint("");
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-hairline accent-electric"
              />
              <span className="text-sm leading-relaxed text-mist">
                {GATE_TERMS_BEFORE}
                <a
                  href="/terms"
                  className="font-semibold text-electric underline decoration-electric/40 underline-offset-2 transition-colors hover:decoration-electric"
                >
                  {GATE_TERMS_NAME}
                </a>
                {GATE_TERMS_AFTER}
              </span>
            </label>

            {gateHint && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
              >
                {gateHint}
              </p>
            )}

            <button
              type="button"
              onClick={proceedFromGate}
              aria-disabled={!gateChecked}
              className={`mt-5 w-full ${
                gateChecked
                  ? "btn-electric"
                  : "cursor-not-allowed border border-hairline bg-white/[0.03] text-zinc-500"
              } py-3 text-sm font-semibold`}
            >
              Proceed to Checkout
            </button>
            <p className="mt-3 text-center text-xs text-zinc-500">
              No payment is taken on this page. You'll confirm next.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
