/**
 * MarketReady Free Diagnostic (/services/diagnostic).
 *
 * This page IS the live diagnostic tool (the gated 5-dimension engine moved
 * here from /assessment, which now 308-redirects here):
 *
 *  Hero (shared <HeroDiagnostic> instant-scan card) → 5-Dimensional Friction
 *  Matrix → the live interactive engine (#diagnostic-engine): five rating
 *  steps (one per dimension, 1 to 5 scale) → lead gate (name + work email,
 *  POST /api/leads Source "Full Assessment") → inline results (score,
 *  readiness band, primary friction, dynamic prescription, dual CTAs with the
 *  terms gate + booking modal, and the mr:leadSyncFailed banner).
 *
 * The score is NEVER computed or revealed before the gate: the results view
 * renders only when a completed diagnostic (with the `gatedAt` marker) exists
 * in localStorage key `marketready:diagnostic` (see src/lib/diagnostic.ts).
 * In-progress answers survive refresh via the same key; a returning visitor
 * with a completed run lands back on their results, and "Retake the
 * diagnostic" restarts the flow fresh (the stored result is overwritten at
 * the next gate submit, exactly as /assessment behaved).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { HeroDiagnostic } from "~/components/HeroDiagnostic";
import { SectionHeading } from "~/components/services-ui";
import { captureLead } from "~/lib/leads";
import type { LeadPayload } from "~/lib/leads";
import { apiUrl } from "~/lib/apiOrigin";
import { ASSESSMENT_STORAGE_KEY } from "~/lib/storage";
import { openCheckout, CHECKOUT_SERVICES } from "~/lib/checkout";
import {
 DIMENSIONS,
 RATING_LABELS,
 readDiagnosticProgress,
 readDiagnosticState,
 writeDiagnosticProgress,
 writeDiagnosticState,
 scoreDiagnostic,
 readinessBand,
 bandColor,
 primaryFriction,
 prescriptionFor,
 answersSummary,
} from "~/lib/diagnostic";
import type {
 DiagnosticAnswers,
 DiagnosticState,
 DimensionId,
} from "~/lib/diagnostic";

export const Route = createFileRoute("/services/diagnostic")({
 head: () => ({
  meta: [
   { title: "Diagnostic: MarketReady" },
   {
    name: "description",
    content:
     "The MarketReady Free Diagnostic: five questions on positioning, messaging, GTM path, acquisition efficiency, and conversion, then your Market Ready Score and the recommended next step.",
   },
  ],
 }),
 component: DiagnosticPage,
});

/* ------------------------------------------------------------------ */
/* 5-Dimensional Friction Matrix: minimalist glass grid table     */
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
  <section className="border-b border-hairline bg-[#1F1A16] px-5 py-10 sm:px-8 sm:py-14">
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
      boxShadow: "0 0 25px rgba(201,106,66,0.25)",
     }}
    >
     {/* 2px teal→purple gradient accent along the top */}
     <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 h-[2px] w-full"
      style={{ background: "linear-gradient(90deg, #C96A42, #E8C9A0)" }}
     />

     {/* Header row */}
     <div className="grid grid-cols-1 gap-x-6 gap-y-1 px-6 py-[18px] md:grid-cols-[1fr_2fr_1fr]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-fog">Dimension</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-fog">
       What We Verify &amp; Scan
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-fog">Revenue Impact</span>
     </div>

     {FRICTION_ROWS.map((row, i) => {
      const isLast = i === FRICTION_ROWS.length - 1;
      return (
       <div
        key={row.id}
        className={`grid grid-cols-1 gap-x-6 gap-y-1 px-6 py-[18px] transition-colors duration-200 hover:bg-ember/[0.03] md:grid-cols-[1fr_2fr_1fr] ${
         isLast ? "" : "border-b border-[rgba(255,255,255,0.06)]"
        }`}
       >
        {/* Dimension */}
        <div className="flex items-center gap-3">
         <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{
           backgroundColor: "rgba(201,106,66,0.25)",
           border: "1px solid #C96A42",
           borderRadius: "8px",
          }}
         >
          <TableIcon name={row.icon} className="h-4 w-4 text-ember" />
         </span>
         <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold tracking-widest text-[#C084FC]">{row.id}</span>
          <span className="text-sm font-semibold text-ink">{row.name}</span>
         </div>
        </div>
        {/* What We Verify & Scan */}
        <p className="text-sm leading-relaxed text-mist">
         <span className="text-[10px] font-bold uppercase tracking-wider text-fog md:hidden">
          We verify:{" "}
         </span>
         {row.check}
        </p>
        {/* Revenue Impact — glowing red pill badge */}
        <p className="text-sm font-semibold">
         <span className="text-[10px] font-bold uppercase tracking-wider text-fog md:hidden">
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

    {/* Bridge CTA — anchors down to the live interactive engine on this page */}
    <div className="mt-10 text-center">
     <a
      href="#diagnostic-engine"
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
/* Interactive engine: questions → lead gate (ported from /assessment) */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GATE_STEP = DIMENSIONS.length; // 5: the lead gate after the questions

/** sessionStorage flag read by the results view to show a discreet
 * "report not saved" banner. Set on final /api/leads failure only; the
 * results reveal stays immediate and non-blocking either way. */
const LEAD_SYNC_FAILED_KEY = "mr:leadSyncFailed";
function markLeadSyncFailed() {
 try {
  window.sessionStorage.setItem(LEAD_SYNC_FAILED_KEY, "1");
 } catch {
  // Storage unavailable (private mode): results still render.
 }
}

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

function DiagnosticEngine({ onComplete }: { onComplete: (state: DiagnosticState) => void }) {
 // Default state IS step 1 (no splash): the first client paint renders the
 // Positioning question; saved progress is restored after mount.
 const [step, setStep] = useState(0);
 const [answers, setAnswers] = useState<Partial<DiagnosticAnswers>>({});
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [error, setError] = useState("");
 const [submitting, setSubmitting] = useState(false);

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

 const goTo = (s: number) => {
  setStep(s);
  writeDiagnosticProgress({ answers, step: s });
  document
   .getElementById("diagnostic-engine")
   ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const completed: DiagnosticState = { answers: full, gatedAt: new Date().toISOString() };
  writeDiagnosticState(completed);

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
  // Assessment"). Posts to the canonical origin so the request never
  // crosses the apex→www 308 (which can re-issue a POST as GET and drop
  // the lead). Non-blocking: never throws, never delays the reveal,
  // and the results view renders the client-computed score regardless of
  // the outcome (score logic untouched: scoreDiagnostic stays the single
  // source of truth).
  try {
   void fetch(apiUrl("/api/leads"), {
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
      console.warn("[diagnostic] Lead sync did not reach Airtable:", data.error);
      markLeadSyncFailed();
     }
    })
    .catch(() => {
     markLeadSyncFailed();
    });
  } catch {
   // fetch itself threw synchronously (offline): results still render.
   markLeadSyncFailed();
  }

  onComplete(completed);
 };

 const current = DIMENSIONS[step] ?? null;
 const selectedRating = current ? answers[current.id] : undefined;

 return (
  <div className="relative mx-auto w-full max-w-2xl">
   {/* Progress header */}
   <div className="flex items-center justify-between">
    <span className="chip border-ember/40 text-ember">
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
         ? "border-electric/60 bg-ember/10 text-ember"
         : done
          ? "border-hairline bg-white/[0.03] text-fog"
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
     className="h-full rounded-full bg-ember transition-all duration-300"
     style={{
      width: `${(Math.min(step, GATE_STEP) / GATE_STEP) * 100}%`,
     }}
    />
   </div>

   {/* Card */}
   <div className="glass-card mt-6 p-6 sm:p-8">
    {step < GATE_STEP && current ? (
     <>
      <h3 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
       {current.question}
      </h3>
      <p className="mt-2 text-sm text-fog">
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
            ? "border-electric/60 bg-ember/10 text-ember "
            : "border-hairline bg-white/[0.02] text-mist hover:border-hairline hover:text-ink"
          }`}
         >
          {value}
         </button>
        );
       })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-fog">
       <span>Strongly disagree</span>
       <span>Strongly agree</span>
      </div>
      <p className="mt-3 min-h-5 text-sm text-ember" aria-live="polite">
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
     /* Lead gate: the score stays behind this step    */
     /* -------------------------------------------------- */
     <>
      <span className="chip border-ember/40 text-ember">
       Your score is ready
      </span>
      <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
       Unlock your Market Ready Score
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-mist">
       Two quick fields: your score, readiness level, and the
       recommended next step appear instantly.
      </p>

      <form onSubmit={handleGateSubmit} noValidate className="mt-6 flex flex-col gap-4">
       <div>
        <label htmlFor="diag-name" className="field-label">
         Name <span className="text-ember">*</span>
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
         Work Email <span className="text-ember">*</span>
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
         className="rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ember"
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
      <p className="mt-4 text-center text-xs text-fog">
       We only use this to send your score and next steps. No spam,
       no obligation.
      </p>
     </>
    )}
   </div>
  </div>
 );
}

/* ------------------------------------------------------------------ */
/* Results view (ported from /assessment/results)           */
/* ------------------------------------------------------------------ */

/** The sole Sprint-price constant. This stays the single source of truth
 * for the results view. */
const RX_PRICE = "$5,000";

/** Checkout-gate terms label. Kept as ONE literal so the exact sentence
 * ships contiguously in the bundle (QA greps it); the agreement name
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

function DiagnosticResults({
 result,
 onRetake,
 onBook,
}: {
 result: DiagnosticState;
 onRetake: () => void;
 onBook: (service?: string) => void;
}) {
 // Checkout gate: the primary CTA opens this gate first (terms agreement),
 // which then routes through the existing openCheckout flow.
 const [gateOpen, setGateOpen] = useState(false);
 const [gateChecked, setGateChecked] = useState(false);
 const [gateHint, setGateHint] = useState("");
 const gateCheckboxRef = useRef<HTMLInputElement>(null);
 // Lead-sync failure flag: read client-side only, after mount (SSR-safe).
 // Cleared after showing so the banner appears once.
 const [leadSyncFailed, setLeadSyncFailed] = useState(false);

 useEffect(() => {
  try {
   if (window.sessionStorage.getItem(LEAD_SYNC_FAILED_KEY) === "1") {
    setLeadSyncFailed(true);
    window.sessionStorage.removeItem(LEAD_SYNC_FAILED_KEY);
   }
  } catch {
   // Storage unavailable: nothing to surface.
  }
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
  openCheckout(CHECKOUT_SERVICES.sprint, onBook);
 };

 const gateKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key === "Escape") {
   e.stopPropagation();
   setGateOpen(false);
  }
 };

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
  <div className="relative mx-auto w-full max-w-2xl">
   <span className="chip border-ember/40 text-ember">
    Market Readiness Score
   </span>
   <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
    Your Market Ready Score
   </h2>

   {/* Lead-sync failure notice: discreet, on-brand; the score below
     is client-computed and still accurate. Shown once per flag. */}
   {leadSyncFailed && (
    <div
     role="status"
     className="mt-6 rounded-xl border border-ember/40 bg-[#2A2320]/50 px-5 py-4 backdrop-blur-md"
    >
     <p className="text-sm leading-relaxed text-mist">
      <span className="font-semibold text-ember">
       We couldn&apos;t save your diagnostic report to our system.{" "}
      </span>
      Your score below is still accurate. Re-enter your details via
      the booking option below to receive the full breakdown and
      prescription.
     </p>
    </div>
   )}

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
    <p className="mt-3 text-sm text-fog">
     Based on your five responses, {score}/100 overall readiness.
    </p>
   </div>

   {/* Primary friction */}
   <div className="glass-card mt-4 p-6 sm:p-8">
    <h3 className="text-xl font-bold tracking-tight text-ink">
     Primary Friction Point:{" "}
     <span className="text-ember">{frictionName}</span>
    </h3>
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
          ? "border-ember/40 bg-ember/[0.06]"
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
   <div className="glass-card mt-4 border-ember/30 p-6 sm:p-8">
    <span className="chip border-ember/40 text-ember">
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
     Start Your Sprint ($5,000) →
    </button>
    <button
     type="button"
     onClick={() => onBook(CHECKOUT_SERVICES.advisory)}
     className="btn-ghost flex-1"
    >
     Talk to a GTM Strategist →
    </button>
   </div>
   <p className="mt-3 text-center text-xs text-fog">
    No obligation. The free audit stands on its own.
   </p>

   <p className="mt-8 text-center">
    <button
     type="button"
     onClick={onRetake}
     className="text-sm font-medium text-fog transition-colors hover:text-ember"
    >
     Retake the diagnostic →
    </button>
   </p>

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
     <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-[#2A2320]/50 p-6 backdrop-blur-xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
       <div>
        <span className="chip border-ember/40 text-ember">Checkout</span>
        <h4 id="gate-modal-title" className="mt-3 text-xl font-bold tracking-tight text-ink">
         Confirm your Sprint booking
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-mist">
         14-Day Positioning Sprint, a one-time engagement, billed
         upfront. You&apos;ll complete a short booking form next; we&apos;ll
         handle scheduling from there.
        </p>
       </div>
       <button
        type="button"
        onClick={() => setGateOpen(false)}
        aria-label="Close checkout dialog"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline text-mist transition-colors hover:border-hairline hover:text-ink"
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

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-hairline">
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
         className="font-semibold text-ember underline decoration-electric/40 underline-offset-2 transition-colors hover:decoration-electric"
        >
         {GATE_TERMS_NAME}
        </a>
        {GATE_TERMS_AFTER}
       </span>
      </label>

      {gateHint && (
       <p
        role="alert"
        className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-pinetint"
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
         : "cursor-not-allowed border border-hairline bg-white/[0.03] text-fog"
       } py-3 text-sm font-semibold`}
      >
       Proceed to Checkout
      </button>
      <p className="mt-3 text-center text-xs text-fog">
       No payment is taken on this page. You&apos;ll confirm next.
      </p>
     </div>
    </div>
   )}
  </div>
 );
}

/* ------------------------------------------------------------------ */
/* Page                                */
/* ------------------------------------------------------------------ */

function scrollToEngine() {
 // Defer a tick so the view swap paints before scrolling.
 window.requestAnimationFrame(() => {
  document
   .getElementById("diagnostic-engine")
   ?.scrollIntoView({ behavior: "smooth", block: "start" });
 });
}

function DiagnosticPage() {
 const [bookingOpen, setBookingOpen] = useState(false);
 const [preselectService, setPreselectService] = useState<string | undefined>(undefined);
 // Completed gated result (null until the gate is passed). A returning
 // visitor with a stored completed run lands back on their results.
 const [result, setResult] = useState<DiagnosticState | null>(null);
 const [showResults, setShowResults] = useState(false);

 useEffect(() => {
  const stored = readDiagnosticState();
  if (stored) {
   setResult(stored);
   setShowResults(true);
  }
 }, []);

 const closeBooking = () => setBookingOpen(false);
 const openBooking = (service?: string) => {
  setPreselectService(service);
  setBookingOpen(true);
 };

 const handleComplete = (completed: DiagnosticState) => {
  setResult(completed);
  setShowResults(true);
  scrollToEngine();
 };

 const handleRetake = () => {
  // Fresh flow: the stored result is overwritten at the next gate submit,
  // exactly as /assessment behaved with its retake link.
  setShowResults(false);
  scrollToEngine();
 };

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main>
    {/* Shared hero diagnostic card — centered single-column tool layout on this page */}
    <HeroDiagnostic variant="centered" onBookBriefing={() => openBooking()} />

    {/* 5-Dimensional Friction Matrix: minimalist glass grid table */}
    <FrictionTable />

    {/* The live interactive engine: questions → gate → results */}
    <section
     id="diagnostic-engine"
     className="relative scroll-mt-24 overflow-hidden px-5 py-10 sm:px-8 sm:py-14"
    >
     <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ember/[0.08] blur-3xl"
     />
     <div className="relative">
      <div className="mx-auto mb-8 max-w-2xl text-center">
       <span className="chip border-ember/40 text-ember">
        Free Interactive Diagnostic
       </span>
       <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Run the diagnostic, get your score
       </h2>
       <p className="mt-2 text-sm leading-relaxed text-mist sm:text-base">
        Five quick ratings, then unlock your Market Ready Score, primary
        friction point, and recommended prescription.
       </p>
      </div>
      {showResults && result ? (
       <DiagnosticResults result={result} onRetake={handleRetake} onBook={openBooking} />
      ) : (
       <DiagnosticEngine onComplete={handleComplete} />
      )}
     </div>
    </section>

    {/* Bottom CTA */}
    <section className="bg-[#16120F] px-5 py-12 sm:px-8 sm:py-14">
     <div className="mx-auto max-w-2xl rounded-xl border border-ember/30 bg-[#2A2320]/50 p-8 text-center sm:p-10">
      <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
       The instant scan is just the teaser
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
       The full 5-dimension diagnostic scores each dimension against 9 PMM parameters and
       prescribes the exact fix for your primary friction source.
      </p>
      <div className="mt-7">
       <a href="#diagnostic-engine" className="btn-electric px-7 py-3.5 text-base">
        Start the Free Diagnostic →
       </a>
      </div>
     </div>
    </section>
   </main>
   <Footer onBook={() => openBooking()} />
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
