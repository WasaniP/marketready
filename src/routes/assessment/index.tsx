/**
 * MarketReady gated 5-dimension diagnostic (build #23).
 *
 * /assessment IS the first page of the assessment: no intro/landing screen.
 * Step 1 (Positioning) renders immediately, including in the SSR HTML, and a
 * returning visitor's saved progress is restored after hydration from
 * localStorage key `marketready:diagnostic` (see src/lib/diagnostic.ts).
 *
 * Flow: five rating steps (one per dimension, 1 to 5 scale) → lead gate (name +
 * work email) → /assessment/results. The score is NEVER computed or revealed
 * on this page; it exists only behind the gate on the results route.
 *
 * The homepage calculator (un-gated teaser) and this gated engine are
 * separate surfaces: the teaser funnels here via the 'Get Your MarketReady
 * Score' CTAs.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { captureLead } from "~/lib/leads";
import type { LeadPayload } from "~/lib/leads";
import { ASSESSMENT_STORAGE_KEY } from "~/lib/storage";
import {
  DIMENSIONS,
  RATING_LABELS,
  readDiagnosticProgress,
  writeDiagnosticProgress,
  writeDiagnosticState,
  scoreDiagnostic,
  readinessBand,
  primaryFriction,
  prescriptionFor,
  answersSummary,
} from "~/lib/diagnostic";
import type { DiagnosticAnswers, DimensionId } from "~/lib/diagnostic";

export const Route = createFileRoute("/assessment/")({
  head: () => ({
    meta: [
      { title: "Market Ready Score: MarketReady" },
      {
        name: "description",
        content:
          "Take the free MarketReady diagnostic: five questions on positioning, messaging, GTM path, acquisition efficiency, and conversion, then get your Market Ready Score and the recommended next step.",
      },
    ],
  }),
  component: Assessment,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GATE_STEP = DIMENSIONS.length; // 5: the lead gate after the questions

/** Best-effort prefill from the homepage calculator (ASSESSMENT_STORAGE_KEY). */
function readHomeAssessment(): {
  url: string;
  businessModel: string;
  launchStage: string;
  icp: string;
} | null {
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      url?: unknown;
      businessModel?: unknown;
      launchStage?: unknown;
      icp?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return null;
    return {
      url: typeof parsed.url === "string" ? parsed.url : "",
      businessModel: typeof parsed.businessModel === "string" ? parsed.businessModel : "",
      launchStage: typeof parsed.launchStage === "string" ? parsed.launchStage : "",
      icp: typeof parsed.icp === "string" ? parsed.icp : "",
    };
  } catch {
    return null;
  }
}

function Assessment() {
  // Default state IS step 1 (no splash): SSR and the first client paint both
  // render the Positioning question; saved progress is restored after mount.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<DiagnosticAnswers>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(undefined);

  // Restore in-progress answers + step after hydration (refresh survival).
  useEffect(() => {
    const saved = readDiagnosticProgress();
    if (saved) {
      setAnswers(saved.answers);
      let nextStep = saved.step;
      // If the saved step points at an already-answered question (or is the
      // gate), resume at the first unanswered question instead.
      const firstUnanswered = DIMENSIONS.findIndex(
        (d) => typeof saved.answers[d.id] !== "number",
      );
      if (firstUnanswered === -1) {
        nextStep = GATE_STEP;
      } else if (
        nextStep >= DIMENSIONS.length ||
        typeof saved.answers[DIMENSIONS[nextStep]?.id] !== "number"
      ) {
        nextStep = firstUnanswered;
      }
      setStep(nextStep);
    }
  }, []);

  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  const goTo = (s: number) => {
    setStep(s);
    writeDiagnosticProgress({ answers, step: s });
    window.scrollTo(0, 0);
  };

  const selectRating = (id: DimensionId, value: number) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    writeDiagnosticProgress({ answers: next, step });
  };

  const handleContinue = () => {
    if (step >= DIMENSIONS.length) return;
    if (typeof answers[DIMENSIONS[step]?.id] !== "number") return;
    goTo(step + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    goTo(step - 1);
  };

  const handleGateSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName) {
      setError("Enter your name so we know who to reach out to.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid work email, e.g. you@yourcompany.com");
      return;
    }
    setError("");
    setSubmitting(true);

    // All five ratings are required to reach the gate (Continue is gated on
    // each answer), so the reduce below always yields a complete set.
    const full = DIMENSIONS.reduce<DiagnosticAnswers>((acc, d) => {
      acc[d.id] = answers[d.id] ?? 3;
      return acc;
    }, {} as DiagnosticAnswers);
    const score = scoreDiagnostic(full);
    const band = readinessBand(score);
    writeDiagnosticState({ answers: full, gatedAt: new Date().toISOString() });

    // Lead capture: local fallback + best-effort server save (never throws).
    const home = readHomeAssessment();
    const summary = answersSummary(full);
    const frictionId = primaryFriction(full);
    const frictionName = DIMENSIONS.find((d) => d.id === frictionId)?.name ?? frictionId;
    const rx = prescriptionFor(frictionId);
    const prescriptionLabel =
      rx === "sprint"
        ? "14-Day Positioning Sprint ($5,000)"
        : "Fractional GTM Advisory ($5,000/month)";
    const payload: LeadPayload = {
      email: cleanEmail,
      url: home?.url || "not provided",
      businessModel: home?.businessModel ?? "",
      launchStage: home?.launchStage ?? "",
      icp: home?.icp ?? "",
      overall: score,
      riskLabel: band,
      generatedAt: new Date().toISOString(),
      name: cleanName,
      source: "assessment",
    };
    // answersSummary rides along on the payload (kept out of the LeadPayload
    // type so src/lib/leads.ts stays untouched): the localStorage fallback
    // record keeps it; the server insert ignores unknown fields.
    const leadPayload: LeadPayload & { answersSummary: string } = {
      ...payload,
      answersSummary: summary,
    };
    void captureLead(leadPayload);

    // Diagnostic lead → Airtable-backed /api/leads (Source "Full
    // Assessment"). Non-blocking: never throws, never delays the redirect,
    // and the results screen renders the client-computed score regardless of
    // the outcome (score logic untouched: scoreDiagnostic stays the single
    // source of truth).
    try {
      void fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: cleanName,
          workEmail: cleanEmail,
          company: "",
          websiteUrl: home?.url || "",
          icp: home?.icp ?? "",
          diagnosticScore: score,
          readiness: band,
          primaryFriction: frictionName,
          recommendedPrescription: prescriptionLabel,
          scoreBreakdown: summary,
          source: "Full Assessment",
        }),
      })
        .then((res) => res.json().catch(() => null))
        .then((data) => {
          if (data && data.ok === false) {
            console.warn("[assessment] Lead sync did not reach Airtable:", data.error);
          }
        })
        .catch(() => {});
    } catch {
      // fetch itself threw synchronously (offline): results still render.
    }

    window.location.assign("/assessment/results");
  };

  const current = DIMENSIONS[step] ?? null;
  const selectedRating = current ? answers[current.id] : undefined;

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
            {/* Progress header */}
            <div className="flex items-center justify-between">
              <span className="chip border-electric/40 text-electric">
                Market Readiness Diagnostic
              </span>
              <span className="text-sm font-semibold text-mist">
                Step {Math.min(step + 1, GATE_STEP)} of {GATE_STEP}
              </span>
            </div>
            {/* Dimension tracker */}
            <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
              {DIMENSIONS.map((d, i) => {
                const done = typeof answers[d.id] === "number";
                const active = i === step && step < GATE_STEP;
                return (
                  <span
                    key={d.id}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-electric/60 bg-electric/10 text-electric"
                        : done
                          ? "border-hairline bg-white/[0.03] text-zinc-400"
                          : "border-hairline text-zinc-600"
                    }`}
                  >
                    {d.name}
                  </span>
                );
              })}
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-electric transition-all duration-300"
                style={{
                  width: `${(Math.min(step, GATE_STEP) / GATE_STEP) * 100}%`,
                }}
              />
            </div>

            {/* Card */}
            <div className="glass-card mt-6 p-6 sm:p-8">
              {step < GATE_STEP && current ? (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {current.question}
                  </h1>
                  <p className="mt-2 text-sm text-zinc-500">
                    Rate how true this is for your company today.
                  </p>

                  {/* 1 to 5 rating control */}
                  <div
                    className="mt-8 grid grid-cols-5 gap-2 sm:gap-3"
                    role="radiogroup"
                    aria-label="Your rating"
                  >
                    {RATING_LABELS.map((label, i) => {
                      const value = i + 1;
                      const selected = selectedRating === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${value}: ${label}`}
                          onClick={() => selectRating(current.id, value)}
                          className={`flex h-14 flex-col items-center justify-center rounded-xl border text-lg font-bold transition-all duration-200 ${
                            selected
                              ? "border-electric/60 bg-electric/10 text-electric shadow-[0_0_16px_rgba(20,184,166,0.25)]"
                              : "border-hairline bg-white/[0.02] text-mist hover:border-zinc-600 hover:text-ink"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-zinc-500">
                    <span>Strongly disagree</span>
                    <span>Strongly agree</span>
                  </div>
                  <p className="mt-3 min-h-5 text-sm text-electric" aria-live="polite">
                    {typeof selectedRating === "number"
                      ? `Your rating: ${selectedRating}: ${RATING_LABELS[selectedRating - 1]}`
                      : ""}
                  </p>

                  {/* Back / Continue */}
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-hairline pt-6">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={step === 0}
                      className="btn-ghost disabled:opacity-40"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={typeof selectedRating !== "number"}
                      className="btn-electric"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              ) : (
                /* -------------------------------------------------- */
                /* Lead gate: the score stays behind this step       */
                /* -------------------------------------------------- */
                <>
                  <span className="chip border-electric/40 text-electric">
                    Your score is ready
                  </span>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    Unlock your Market Ready Score
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-mist">
                    Two quick fields: your score, readiness level, and the
                    recommended next step appear instantly.
                  </p>

                  <form onSubmit={handleGateSubmit} noValidate className="mt-6 flex flex-col gap-4">
                    <div>
                      <label htmlFor="diag-name" className="field-label">
                        Name <span className="text-electric">*</span>
                      </label>
                      <input
                        id="diag-name"
                        type="text"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ada Lovelace"
                        autoComplete="name"
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="diag-email" className="field-label">
                        Work Email <span className="text-electric">*</span>
                      </label>
                      <input
                        id="diag-email"
                        type="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourcompany.com"
                        autoComplete="email"
                        className="field-input"
                        aria-describedby={error ? "diag-error" : undefined}
                      />
                    </div>

                    {error && (
                      <p
                        id="diag-error"
                        role="alert"
                        className="rounded-lg border border-electric/40 bg-electric/10 px-3 py-2 text-sm text-electric"
                      >
                        {error}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-hairline pt-6">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={submitting}
                        className="btn-ghost disabled:opacity-40"
                      >
                        ← Back
                      </button>
                      <button type="submit" disabled={submitting} className="btn-electric">
                        {submitting ? "Unlocking…" : "Get My Score →"}
                      </button>
                    </div>
                  </form>
                  <p className="mt-4 text-center text-xs text-zinc-500">
                    We only use this to send your score and next steps. No spam,
                    no obligation.
                  </p>
                </>
              )}
            </div>
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
    </div>
  );
}
