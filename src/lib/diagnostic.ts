/**
 * MarketReady 5-dimension diagnostic: shared types, spec questions, and
 * scoring for the gated /assessment flow (build #23).
 *
 * The flow: /assessment asks five 1 to 5 rating questions (one per dimension),
 * then a lead gate (name + work email). Only after the gate is the score
 * revealed on /assessment/results. This module is the single source of truth
 * for the dimension spec, scoring math, readiness bands, and prescription
 * mapping so both routes stay in lockstep.
 *
 * Pure module: no window/localStorage access at import time. All storage
 * access goes through the helpers below, which are only ever called from
 * event handlers / effects (never during SSR render).
 */

/** localStorage key for the diagnostic (in-progress answers + gated result). */
export const DIAGNOSTIC_STORAGE_KEY = "marketready:diagnostic";

/** The five dimensions in display order; this order is also the tie-break
 * order for the primary friction point (earliest in the list wins). */
export const DIMENSIONS = [
  {
    id: "positioning",
    name: "Positioning",
    question: "Can your target customer immediately understand why you're different?",
  },
  {
    id: "messaging",
    name: "Messaging",
    question: "Is your value proposition clear and compelling?",
  },
  {
    id: "gtm-path",
    name: "GTM Path",
    question: "Do you have a defined path from target audience → acquisition → conversion?",
  },
  {
    id: "acquisition",
    name: "Acquisition Efficiency",
    question: "Are you generating qualified demand without burning capital?",
  },
  {
    id: "conversion",
    name: "Conversion",
    question: "Is your funnel turning qualified interest into paying customers?",
  },
] as const;

export type DimensionId = (typeof DIMENSIONS)[number]["id"];

/** 1 to 5 rating per dimension (5 = strongly agree). */
export type DiagnosticAnswers = Record<DimensionId, number>;

/** Completed, gated result: persisted at the gate step and read by
 * /assessment/results. `gatedAt` is the gate marker: the results page refuses
 * to render without it, so the score can never surface before the gate. */
export interface DiagnosticState {
  answers: DiagnosticAnswers;
  /** ISO timestamp set when the lead gate was passed. */
  gatedAt: string;
}

/** In-progress persistence shape (written on every answer change so a refresh
 * survives; the gate replaces it with a DiagnosticState). */
export interface DiagnosticProgress {
  answers: Partial<DiagnosticAnswers>;
  /** 0 to 4 = question index, 5 = the lead gate. */
  step: number;
}

/** 1 to 5 scale labels, left → right. */
export const RATING_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
] as const;

/** Score: mean of the five 1 to 5 ratings × 20, rounded (e.g. 3.15 → 63/100). */
export function scoreDiagnostic(answers: DiagnosticAnswers): number {
  const total = DIMENSIONS.reduce((sum, d) => sum + answers[d.id], 0);
  return Math.round((total / DIMENSIONS.length) * 20);
}

export type ReadinessBand = "Market Ready" | "Needs Attention" | "High Launch Risk";

/** Readiness band by score: 80 to 100 Market Ready, 60 to 79 Needs Attention,
 * 0 to 59 High Launch Risk. */
export function readinessBand(score: number): ReadinessBand {
  if (score >= 80) return "Market Ready";
  if (score >= 60) return "Needs Attention";
  return "High Launch Risk";
}

/** Band → status color (emerald / amber / crimson). */
export function bandColor(band: ReadinessBand): string {
  switch (band) {
    case "Market Ready":
      return "#10B981";
    case "Needs Attention":
      return "#F59E0B";
    case "High Launch Risk":
      return "#EF4444";
  }
}

/** Primary friction source: the lowest-scoring dimension; ties go to the
 * earliest dimension in DIMENSIONS order. */
export function primaryFriction(answers: DiagnosticAnswers): DimensionId {
  let minId: DimensionId = DIMENSIONS[0].id;
  let min = answers[minId];
  for (const d of DIMENSIONS) {
    if (answers[d.id] < min) {
      min = answers[d.id];
      minId = d.id;
    }
  }
  return minId;
}

export type Prescription = "sprint" | "advisory";

/** Prescription mapping: positioning/messaging/conversion friction → the
 * 14-Day Sprint; GTM path / acquisition friction → the advisory retainer. */
export function prescriptionFor(friction: DimensionId): Prescription {
  return friction === "gtm-path" || friction === "acquisition" ? "advisory" : "sprint";
}

/** Human-readable answers summary for the lead record, e.g.
 * "Positioning: 2/5; Messaging: 3/5; …". */
export function answersSummary(answers: DiagnosticAnswers): string {
  return DIMENSIONS.map((d) => `${d.name}: ${answers[d.id]}/5`).join("; ");
}

/* ------------------------------------------------------------------ */
/* SSR-safe persistence helpers (call only from effects/handlers)      */
/* ------------------------------------------------------------------ */

function readRaw(): unknown {
  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Read the in-progress diagnostic (answers + step). Returns null when
 * storage is unavailable, malformed, or holds a completed (gated) run; a
 * completed run starts the assessment fresh at step 1. */
export function readDiagnosticProgress(): DiagnosticProgress | null {
  const parsed = readRaw();
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<DiagnosticProgress> & Partial<DiagnosticState>;
  if (p.gatedAt) return null; // completed run: /assessment starts fresh
  if (!p.answers || typeof p.answers !== "object") return null;
  const answers = p.answers as Partial<DiagnosticAnswers>;
  const step = typeof p.step === "number" ? Math.floor(p.step) : 0;
  return { answers, step: Math.max(0, Math.min(DIMENSIONS.length, step)) };
}

/** Read the completed, gated result. Returns null unless ALL five dimensions
 * have a valid 1 to 5 rating AND the gate marker is present. */
export function readDiagnosticState(): DiagnosticState | null {
  const parsed = readRaw();
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<DiagnosticState>;
  if (!p.gatedAt || !p.answers || typeof p.answers !== "object") return null;
  const answers = p.answers as Partial<DiagnosticAnswers>;
  for (const d of DIMENSIONS) {
    const v = answers[d.id];
    if (typeof v !== "number" || v < 1 || v > 5) return null;
  }
  return { answers: answers as DiagnosticAnswers, gatedAt: p.gatedAt };
}

export function writeDiagnosticProgress(progress: DiagnosticProgress): void {
  try {
    window.localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable: best-effort persistence
  }
}

export function writeDiagnosticState(state: DiagnosticState): void {
  try {
    window.localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: best-effort persistence
  }
}
