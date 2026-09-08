/**
 * HeroDiagnostic — SHARED homepage hero diagnostic card.
 *
 * This is the SINGLE source of truth for the hero URL-diagnostic used on BOTH
 * the homepage (/) and /services/diagnostic, so the two are identical by
 * construction. It contains: the eyebrow pill + H1 + subhead, the URL input
 * card (label / input / error / CTA / micro-copy), the 4 feature pills, the
 * HeroMockup graphic, and the crawl/score result swap (CrawlScanner +
 * HeroResults). Extracted verbatim from the homepage route (build #NN).
 */
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { scoreAssessment, scoreColor, PILLAR_OF } from "~/lib/audit/engine";
import type { AssessmentInput, AuditResult } from "~/lib/audit/types";
import { toAIResult } from "~/lib/audit/ai";
import type { AIResult } from "~/lib/audit/ai";
import { ASSESSMENT_STORAGE_KEY } from "~/lib/storage";
import { apiUrl } from "~/lib/apiOrigin";


/* ------------------------------------------------------------------ */
/* Owner revision spec §3: the sample-report card is the SOLE hero       */
/* visual (founder photo removed). Larger card, anchored high in the     */
/* right column; 4 parameter rows with a partial fade on the last so it  */
/* reads as a real report. Flat surface per §8 — no ambient glow wash.   */
/* Scores are illustrative samples, never a real result (§12).           */
/* ------------------------------------------------------------------ */
export function HeroMockup() {
  const rows = [
    { label: "Category Positioning", score: "29/100", cls: "text-scorework" },
    { label: "Hero Messaging & Speed", score: "34/100", cls: "text-scorework" },
    { label: "GTM Path & Offer", score: "27/100", cls: "text-scorework" },
    { label: "Differentiation Anchor", score: "21/100", cls: "text-scorework" },
  ];
  const rowCls =
    "flex items-center justify-between gap-3 rounded-lg border border-hairline bg-sand px-3.5 py-2.5";
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      <div
        className="relative overflow-hidden rounded-2xl bg-linen"
        style={{ border: "1px solid #3A312B", borderRadius: "16px" }}
      >
        {/* Top header bar: browser chrome #1F1A16 */}
        <div className="flex items-center gap-3 border-b border-hairline bg-sand px-4 py-2.5">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-linen px-2 py-0.5 text-center text-[12px] text-mist">
            https://yourproduct.com
          </span>
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center gap-1 rounded-full border border-ember/40 bg-ambertint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emberdeep"
          >
            <span className="text-[9px]">●</span>Sample report
          </span>
        </div>
        {/* 4 metric rows; the last is partially faded like a real report */}
        <div className="flex flex-col gap-2 bg-linen p-4 sm:p-5">
          {rows.slice(0, 3).map((r) => (
            <div key={r.label} className={rowCls}>
              <span className="min-w-0 text-[13px] font-medium text-mist">{r.label}</span>
              <span className={`shrink-0 font-mono text-[18px] font-bold tabular-nums ${r.cls}`}>
                {r.score}
              </span>
            </div>
          ))}
          <div className="relative h-[42px] overflow-hidden" aria-hidden="true">
            <div className={rowCls}>
              <span className="min-w-0 text-[13px] font-medium text-mist">{rows[3].label}</span>
              <span className={`shrink-0 font-mono text-[18px] font-bold tabular-nums ${rows[3].cls}`}>
                {rows[3].score}
              </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-linen" />
          </div>
          {/* Sample finding inline beneath the lowest-scoring row */}
          <p className="text-[11px] leading-relaxed text-ember">
            Sample finding: category naming is too broad for high-intent buyers.
          </p>
          {/* Single merged disclaimer line */}
          <p className="rounded-md bg-hairline px-3 py-1.5 text-center text-[11px] font-bold uppercase leading-relaxed tracking-wide text-pinetint">
            Sample score for illustration, run your URL to get your real score.
          </p>
        </div>
      </div>
    </div>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".") || u.hostname.length < 4) return false;
    return true;
  } catch {
    return false;
  }
}

/** Teaser pillar groups (restored prior build). */
const TEASER_PILLARS: { title: string; ids: string[] }[] = [
  { title: "Core Positioning", ids: ["positioning", "icp", "differentiation"] },
  { title: "Messaging & Value Prop", ids: ["messaging", "value-prop"] },
  { title: "GTM & Launch Velocity", ids: ["conversion"] },
];

function pillarySort(id: string): number {
  for (let i = 0; i < TEASER_PILLARS.length; i++) {
    const idx = TEASER_PILLARS[i].ids.indexOf(id);
    if (idx !== -1) return i * 10 + idx;
  }
  return 99;
}

function g2Status(score: number): string {
  return score >= 75 ? "Strong" : score >= 40 ? "Needs Refinement" : "Critical Gap";
}

function m2Date(t?: string): string {
  try {
    return new Date(t ?? 0).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return t ?? "";
  }
}

function hexA(hex: string, alpha: number): string {
  const h = (hex || "#A1A1AA").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "A1A1AA", 16);
  if (Number.isNaN(n)) return `rgba(161,161,170,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

interface TeaserDim {
  id: string;
  name: string;
  pillar: string;
  score?: number;
  status?: string;
  friction?: string;
  frictionLabel?: string;
  anchorLabel?: string;
  keyObservation?: string;
  commercialRisk?: string;
  evidenceSnippet?: string;
  insufficientData?: boolean;
  locked?: boolean;
  color?: string;
  isAI: boolean;
}

function normalizeTeaserDims(aiResult: AIResult | null, result: AuditResult): TeaserDim[] {
  const out: TeaserDim[] = [];
  if (aiResult) {
    for (const r of aiResult.dimensions) {
      if (r.locked) continue;
      out.push({
        id: r.id,
        name: r.name,
        pillar: r.pillar || PILLAR_OF[r.id] || "GTM & Launch Velocity",
        score: r.score,
        status: r.status,
        friction: r.friction,
        frictionLabel: r.frictionLabel,
        anchorLabel: r.anchorLabel,
        keyObservation: r.keyObservation,
        commercialRisk: r.commercialRisk,
        evidenceSnippet: r.evidence_snippet,
        insufficientData: r.insufficientData,
        locked: false,
        color: typeof r.score === "number" ? scoreColor(r.score) : undefined,
        isAI: true,
      });
    }
  } else {
    for (const r of result.parameters) {
      if (r.locked) continue;
      out.push({
        id: r.id,
        name: r.name,
        pillar: PILLAR_OF[r.id] || "GTM & Launch Velocity",
        score: r.score,
        status: r.status,
        friction: r.diagnostic,
        frictionLabel: r.frictionLabel,
        anchorLabel: r.anchorLabel,
        keyObservation: r.keyObservation,
        commercialRisk: r.commercialRisk,
        locked: false,
        color: r.color,
        isAI: false,
      });
    }
  }
  return out.sort((a, b) => pillarySort(a.id) - pillarySort(b.id));
}

function useAssessment() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "done">("idle");
  const [submitted, setSubmitted] = useState<AssessmentInput | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runCrawl = (cleanUrl: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 32000);
    setAiStatus("loading");
    setAiResult(null);
    fetch(apiUrl("/api/diagnose"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl, heroCopy: "", icp: "" }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok) {
          const normalized = toAIResult(data);
          if (normalized) {
            setAiResult(normalized);
            setAiStatus("success");
            return;
          }
        }
        setAiStatus("error");
      })
      .catch(() => setAiStatus("error"))
      .finally(() => window.clearTimeout(timer));
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.url === "string" && parsed.url) {
          const restored: AssessmentInput = {
            url: parsed.url,
            businessModel: "",
            launchStage: "",
            icp: typeof parsed.icp === "string" ? parsed.icp : "",
            submittedAt: parsed.submittedAt ?? new Date().toISOString(),
          };
          setSubmitted(restored);
          setResult(scoreAssessment(restored));
          setPhase("done");
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!isValidUrl(cleanUrl)) {
      setError("Enter a valid website URL, e.g. https://yourproduct.com");
      return;
    }
    setError("");
    const assessment: AssessmentInput = {
      url: cleanUrl,
      businessModel: "",
      launchStage: "",
      icp: "",
      submittedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(assessment));
    } catch {}
    setSubmitted(assessment);
    setResult(scoreAssessment(assessment));
    setPhase("done");
    runCrawl(cleanUrl);
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(ASSESSMENT_STORAGE_KEY);
    } catch {}
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setSubmitted(null);
    setResult(null);
    setAiStatus("idle");
    setAiResult(null);
    setUrl("");
    setError("");
  };

  return {
    url,
    setUrl,
    error,
    phase,
    submitted,
    result,
    aiStatus,
    aiResult,
    hydrated,
    handleSubmit,
    reset,
  };
}

/** Live AI crawl scanner card (loading + demo modes). */
function CrawlScanner({ mode = "demo", url }: { mode?: "demo" | "loading"; url?: string }) {
  const rows = [
    { label: "ICP Alignment Index", score: "42/100", border: "border-ember/30", scoreClass: "text-scorework" },
    { label: "Messaging Clarity Score", score: "88/100", border: "border-scorepass/40", scoreClass: "text-scorepass" },
    { label: "Value Proposition & Contrast", score: "31/100", border: "border-ember/30", scoreClass: "text-scorework" },
  ];
  const shownUrl = url || "https://yourproduct.com";
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="glass-card relative overflow-hidden">
        <div className="flex items-center gap-3 border-b border-hairline bg-sand px-4 py-3">
          <span aria-hidden="true" className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-fog/40" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-fog">{shownUrl}</span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-ember/40 bg-ambertint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emberdeep">
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
            </span>
            Sample scan
          </span>
        </div>
        {mode === "loading" ? (
          <div className="flex flex-col items-center gap-4 bg-linen p-8" role="status" aria-live="polite">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember/25" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-ember bg-ambertint">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ember border-t-transparent" />
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tracking-wide text-ink">Reading your site like a buyer would...</p>
              <p className="mt-2 animate-pulse text-xs tracking-wider text-mist">Scanning positioning signals, this takes under a minute</p>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((s) => (
                <span key={s} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember" style={{ animationDelay: `${s * 120}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 bg-linen p-5">
            {rows.map((s) => (
              <div key={s.label} className={`flex items-center justify-between gap-3 rounded-lg border bg-sand px-4 py-3 ${s.border}`}>
                <span className="min-w-0 text-xs font-medium text-mist sm:text-sm">{s.label}</span>
                <span className={`shrink-0 font-mono text-sm font-bold tabular-nums ${s.scoreClass}`}>{s.score}</span>
              </div>
            ))}
            <div className="mt-1 rounded-lg bg-hairline px-4 py-3">
              <p className="text-xs font-bold uppercase leading-relaxed tracking-wider text-pinetint sm:text-[13px]">
                Sample finding: value proposition relies on generic features rather than buyer outcomes.
              </p>
            </div>
            <p className="mt-1 text-center text-[11px] leading-relaxed text-fog">
              Sample score for illustration, run your URL to get your real score.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DimCard({ card }: { card: TeaserDim }) {
  const color = card.color ?? "#A1A1AA";
  const n = card.score ?? 0;
  const strong = n >= 70;
  const label = strong ? card.anchorLabel : card.frictionLabel;
  const section = strong ? "Competitive Advantage" : "Commercial Risk";
  return (
    <div className="glass-card flex flex-col gap-3 p-5" style={{ borderColor: hexA(color, 0.3), backgroundColor: hexA(color, 0.05) }}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug text-ink">{card.name}</h4>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${card.isAI ? "border-ember/40 bg-ambertint text-emberdeep" : "border-hairline bg-ink/[0.03] text-fog"}`}>
          {card.isAI ? "AI crawl" : "Local"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color, borderColor: hexA(color, 0.35), backgroundColor: hexA(color, 0.1) }}>
          {card.status ?? "Pending"}
        </span>
        {label && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color, borderColor: hexA(color, 0.35), backgroundColor: hexA(color, 0.1) }}>
            {label}
          </span>
        )}
        <span className="ml-auto font-mono text-lg font-bold tabular-nums" style={{ color }}>{card.score != null ? `${card.score}/100` : "—"}</span>
      </div>
      <p className="text-sm leading-relaxed text-mist">{card.keyObservation ?? card.friction}</p>
      <div className="rounded-lg border border-hairline bg-cream px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-fog">{section}: </span>
        <span className="text-xs text-mist">{card.commercialRisk}</span>
      </div>
    </div>
  );
}

/** Homepage calculator lead capture ("Unlock My Full Diagnostic Report").
 *
 * Renders below the teaser score on the homepage / /services/diagnostic
 * results: First Name + Work Email, non-blocking. On submit it POSTs the
 * teaser score + full diagnostic payload to /api/leads with Source
 * "Homepage Calculator" (Airtable-backed, JSONL fallback), then shows a
 * confirmation. The score above is already visible and never depends on the
 * POST outcome: on failure the results stay on screen and a one-line
 * console.warn (no token) is logged.
 */
const UNLOCK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Company inferred from the submitted URL's domain, not a user field. */
function inferUnlockCompany(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function HomepageUnlock({
  result,
  submitted,
  headlineScore,
  overallBand,
  redFlag,
  dims,
}: {
  result: AuditResult;
  submitted: AssessmentInput | null;
  headlineScore: number;
  overallBand: string;
  redFlag: TeaserDim | undefined;
  dims: TeaserDim[];
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const em = email.trim();
    if (!fn) {
      setError("Enter your first name.");
      return;
    }
    if (!UNLOCK_EMAIL_RE.test(em)) {
      setError("Enter a valid work email.");
      return;
    }
    setError("");
    setStatus("sending");

    const websiteUrl = submitted?.url || result.url;
    const dimPayload = dims.map((d) => ({
      id: d.id,
      name: d.name,
      pillar: d.pillar,
      score: d.score,
      status: d.status,
      friction_label: d.frictionLabel,
      anchor_label: d.anchorLabel,
      keyObservation: d.keyObservation,
      commercialRisk: d.commercialRisk,
      evidence_snippet: d.evidenceSnippet,
      locked: d.locked,
      insufficientData: d.insufficientData,
    }));
    const payload = {
      firstName: fn,
      workEmail: em,
      company: inferUnlockCompany(websiteUrl),
      websiteUrl,
      icp: submitted?.icp ?? result.icp ?? "",
      overallScore: headlineScore,
      lowestParameter: redFlag?.name ?? null,
      keyObservation: redFlag?.keyObservation ?? "",
      commercialRisk: redFlag?.commercialRisk ?? "",
      frictionLabel: redFlag?.frictionLabel ?? "",
      anchorLabel: redFlag?.anchorLabel ?? "",
      domEvidence: redFlag?.evidenceSnippet ?? "",
      diagnosticPayload: {
        score: headlineScore,
        overallBand,
        generatedAt: result.generatedAt,
        url: websiteUrl,
        dimensions: dimPayload,
      },
      source: "Homepage Calculator",
    };

    // Non-blocking: the teaser score above stays visible no matter what.
    // Canonical origin (never crosses the apex→www 308).
    // On failure the unlock form stays and the error is shown inline; the
    // success "unlocked" message only appears on data.ok === true.
    fetch(apiUrl("/api/leads"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data && data.ok === true) {
          setStatus("done");
        } else {
          console.warn("[homepage] Lead sync did not reach Airtable:", data?.error);
          setError("We couldn't save your report. Please try again.");
          setStatus("error");
        }
      })
      .catch(() => {
        setError("We couldn't save your report. Please try again.");
        setStatus("error");
      });
  };

  return (
    <div className="glass-card mt-6 overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <span className="chip">Full Report</span>
          <h4 className="mt-3 font-display text-lg tracking-tight text-ink sm:text-xl">
            {status === "done" ? "Your diagnostic report is unlocked" : "Want the full breakdown in your inbox?"}
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            {status === "done"
              ? "Your score breakdown is saved. If you'd like, I can walk you through the highest-impact fixes in a free 15-minute call."
              : "Drop your name and work email and I'll send every scored parameter, the red flag, and what I'd fix first."}
          </p>
        </div>

        <div className="w-full max-w-sm shrink-0">
          {status === "done" ? (
            <div className="flex flex-col gap-3">
              <p className="rounded-lg border border-scorepass/40 bg-scorepass/10 px-3 py-2 text-center text-sm font-semibold text-scorepass">
                Report unlocked. Check your inbox for next steps.
              </p>
              <p className="text-center text-xs text-fog">
                I'll only email about your diagnostic. No spam, ever.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="home-unlock-first" className="field-label">
                    First Name <span className="text-electric">*</span>
                  </label>
                  <input
                    id="home-unlock-first"
                    type="text"
                    name="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ada"
                    autoComplete="given-name"
                    className="field-input"
                  />
                </div>
                <div>
                  <label htmlFor="home-unlock-email" className="field-label">
                    Work Email <span className="text-electric">*</span>
                  </label>
                  <input
                    id="home-unlock-email"
                    type="email"
                    name="workEmail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    autoComplete="email"
                    className="field-input"
                    aria-describedby={error ? "home-unlock-error" : undefined}
                  />
                </div>
              </div>
              {error && (
                <p
                  id="home-unlock-error"
                  role="alert"
                  className="rounded-lg border border-ember/40 bg-ambertint px-3 py-2 text-sm text-emberdeep"
                >
                  {error}
                </p>
              )}
              <button type="submit" disabled={status === "sending"} className="btn-electric w-full">
                {status === "sending" ? "Unlocking…" : "Unlock My Full Diagnostic Report →"}
              </button>
              <p className="text-center text-xs text-fog">
                I'll only email about your diagnostic. No spam, ever.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** Restored teaser results component (was A2 in the prior build). */
function HeroResults({
  result,
  submitted,
  onReset,
  onBookBriefing,
  aiResult,
  aiPending,
}: {
  result: AuditResult;
  submitted: AssessmentInput | null;
  onReset: () => void;
  onBookBriefing: () => void;
  aiResult: AIResult | null;
  aiPending: boolean;
}) {
  const pending = !!aiPending && !aiResult;
  const score = aiResult ? aiResult.score : result.overall;
  const band = aiResult?.overallBand ?? result.riskLabel;
  const dims = normalizeTeaserDims(aiResult, result);
  const visible = dims.filter((d) => !d.insufficientData && d.score != null);
  const withEvidence = visible.filter((d) => typeof d.evidenceSnippet === "string" && d.evidenceSnippet.trim().length > 0);
  const redFlag = [...(withEvidence.length ? withEvidence : visible.length ? visible : dims)].sort((a, b) => {
    const ra = a.score ?? 0;
    const rb = b.score ?? 0;
    return ra !== rb ? ra - rb : pillarySort(a.id) - pillarySort(b.id);
  })[0];
  const pillarAvgs = TEASER_PILLARS.map((p) => {
    const hit = dims.filter((d) => p.ids.includes(d.id) && !d.insufficientData && d.score != null);
    const avg = hit.length ? Math.round(hit.reduce((sum, d) => sum + (d.score ?? 0), 0) / hit.length) : null;
    return { title: p.title, avg };
  });

  return (
    <section id="results" className="scroll-mt-24" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip">
            {pending ? "Preliminary Diagnostic" : "Your results are in"}
          </span>
          <h3 className="mt-3 font-display text-2xl tracking-tight text-ink sm:text-3xl">Your Market Readiness Score</h3>
          <p className="mt-1 max-w-2xl text-sm text-mist">{result.url}</p>
          {pending && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emberdeep">
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
              </span>
              Reading your site... Your final score is on its way.
            </p>
          )}
        </div>
        <p className="text-xs text-fog">Scored {m2Date(result.generatedAt)}</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="glass-card flex flex-col justify-center gap-3 px-6 py-8">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-mist">Overall Score</h4>
          <div className="flex items-end gap-3">
            <span className="text-6xl font-extrabold leading-none tabular-nums text-ink">{score}</span>
            <span className="pb-1 text-sm font-medium text-fog">/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-mist">Status:</span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: scoreColor(score), borderColor: hexA(scoreColor(score), 0.35), backgroundColor: hexA(scoreColor(score), 0.1) }}>
              {g2Status(score)}
            </span>
          </div>
          <p className="text-xs text-fog">{band}</p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-mist">Pillars</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {pillarAvgs.map((p) => (
              <div key={p.title} className="glass-card flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                <span className="text-sm font-semibold text-ink">{p.title}</span>
                <span className="font-mono text-xl font-bold tabular-nums" style={{ color: p.avg != null ? scoreColor(p.avg) : "#A1A1AA" }}>
                  {p.avg != null ? `${p.avg}/100` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {redFlag && (
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <h4 className="font-display text-lg tracking-tight text-ink">The first thing I'd fix</h4>
            <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-mist">The single lowest-scoring area I found on your public site.</p>
          <div className="mt-4 max-w-md">
            <DimCard card={redFlag} />
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h4 className="font-display text-lg tracking-tight text-ink">Full parameter breakdown</h4>
          {aiResult && <span className="chip">Final assessment</span>}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-mist">Every scored area with what I noticed and why it matters, grouped by pillar.</p>
        {TEASER_PILLARS.map((p) => {
          const cards = dims.filter((d) => p.ids.includes(d.id));
          return (
            <div key={p.title} className="mt-7">
              <div className="flex items-center gap-3">
                <h5 className="text-base font-bold tracking-tight text-ink">{p.title}</h5>
                <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((d) => (
                  <DimCard key={d.id} card={d} />
                ))}
              </div>
              {p.title === "Messaging & Value Prop" && (
                <p className="mt-3 text-xs leading-relaxed text-fog">
                  Pricing and packaging needs your internal numbers and deal context, so I review that with you directly in the MarketReady Audit.
                </p>
              )}
              {p.title === "GTM & Launch Velocity" && (
                <p className="mt-3 text-xs leading-relaxed text-fog">
                  Note: public scans cover conversion readiness. Your internal sales motion and launch mechanics are something I review with you directly in the MarketReady Audit.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-ember/30 bg-ambertint/50 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="font-display text-lg tracking-tight text-ink">Want my plan for fixing this?</h4>
          <p className="mt-1 max-w-xl text-sm text-mist">
            I'll map every gap to a fix you can ship. Book a free 15-minute call and we'll walk through it together.
          </p>
        </div>
        <button
          type="button"
          onClick={onBookBriefing}
          className="btn-ghost h-[46px] shrink-0 px-6 text-[14px] font-bold"
        >
          Book a 15-Minute Call →
        </button>
      </div>

      <HomepageUnlock
        result={result}
        submitted={submitted}
        headlineScore={score}
        overallBand={typeof band === "string" ? band : String(band)}
        redFlag={redFlag}
        dims={dims}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fog">
          {aiResult
            ? "My read of your site's core pages, plus a scan of how your market talks about the problem."
            : "A quick snapshot from your public pages, not a full deep-dive. Your real score comes from running your URL."}
        </p>
        <button type="button" onClick={onReset} className="nav-link">
          Re-run assessment
        </button>
      </div>
    </section>
  );
}

export function HeroDiagnostic({
  onBookBriefing,
  variant = "home",
}: {
  onBookBriefing: () => void;
  variant?: "home" | "centered";
}) {
  const {
    url,
    setUrl,
    error,
    phase,
    submitted,
    result,
    aiStatus,
    aiResult,
    handleSubmit,
    reset,
  } = useAssessment();
  const showResult = phase === "done";
  const aiLoading = aiStatus === "loading";
  const aiResolved = aiStatus === "success" ? aiResult : null;
  const centered = variant === "centered";

  return (
    /* Owner revision spec §6: hero on flat cream, top padding roughly half
       the old value (fixed header is h-16 + pt-6/pb-4, so pt-24 clears it).
       Spec §8: no gradient/glow wash in the hero — flat surface. §7: the
       only section boundary here is the hairline above the Manifesto. */
    <section id="top" className="relative bg-cream pt-24 pb-12 sm:pb-16">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {showResult ? (
          <div
            id="calculator"
            className={centered ? "mt-6 scroll-mt-24 mx-auto max-w-[760px]" : "mt-6 scroll-mt-24"}
          >
            <div className="flex flex-col gap-5">
              {submitted && result && (
                <>
                  {aiLoading && <CrawlScanner mode="loading" url={submitted.url} />}
                  <HeroResults
                    result={result}
                    submitted={submitted}
                    onReset={reset}
                    onBookBriefing={onBookBriefing}
                    aiResult={aiResolved}
                    aiPending={aiLoading}
                  />
                </>
              )}
            </div>
          </div>
        ) : centered ? (
          <div className="mx-auto max-w-[760px] text-center">
            <span className="chip">
              <span aria-hidden="true" className="mr-1.5 text-[10px]">●</span>
              Free AI Audit &amp; Scorecard
            </span>
            <h1 className="mt-5 font-display text-[36px] font-bold leading-[1.15] tracking-tight text-ink sm:text-[42px]">
              Are your GTM motions ready to convert?
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-[1.65] text-mist">
              I read your public site like a first-time buyer and show you where
              your positioning leaks. Free, instant, no email needed.
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="glass-card mx-auto mt-8 max-w-[600px] p-6 text-left"
            >
              <label
                htmlFor="calc-url"
                className="field-label"
              >
                Your website URL <span className="text-ember">*</span>
              </label>
              <input
                id="calc-url"
                type="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourproduct.com"
                autoComplete="url"
                className="field-input h-[44px] text-[14px]"
                aria-describedby={error ? "calc-error" : undefined}
              />
              {error && (
                <p id="calc-error" role="alert" className="mt-3 rounded-lg border border-ember/40 bg-ambertint px-3 py-2 text-left text-sm text-emberdeep">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-electric mt-4 h-[44px] w-full text-[15px]"
              >
                Get Your MarketReady Score →
              </button>
            </form>
            <p className="mt-3 text-center text-[12px] text-fog">
              Free, instant, no email needed. I read your public site like a buyer would.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">Nine scored dimensions</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">0 to 100 readiness score</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">First red flag, free</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">Full breakdown in your inbox</span>
            </div>
          </div>
        ) : (
          <>
          {/* Owner revision spec §3/§9: hero left column — kicker + full-ink
              serif headline at ~80% of the old size (two balanced lines),
              subhead tightened to the URL input. No founder photo anywhere
              in the hero; the sample-report card anchors the right column. */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="text-center lg:text-left">
              <p className="eyebrow">ARE YOU MARKETREADY?</p>
              <h1 className="mt-3 font-display text-[24px] font-bold leading-[1.2] tracking-tight text-white sm:text-[30px]">
                Your product isn't the problem.
                <br />
                Your <span className="hero-highlight">market story</span> might be.
              </h1>
              <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.55] text-stone-300 lg:mx-0">
                I help B2B SaaS, consumer tech, and growing startups turn good
                products into products people understand, remember, and buy.
                From positioning and messaging to GTM strategy and launches, I
                help you figure out what's not working, what needs to change,
                and how to take your product to market with a story that actually
                lands.
              </p>
              <form onSubmit={handleSubmit} noValidate className="mx-auto mt-5 flex max-w-md flex-col gap-3 lg:mx-0">
                <div className="text-left">
                  <label htmlFor="calc-url" className="field-label">
                    Your website URL <span className="text-ember">*</span>
                  </label>
                  <input
                    id="calc-url"
                    type="url"
                    name="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourproduct.com"
                    autoComplete="url"
                    className="field-input h-[48px] text-[15px]"
                    aria-describedby={error ? "calc-error" : undefined}
                  />
                  <p className="mt-2 text-[12px] leading-relaxed text-stone-400">
                    Run your URL through MarketReady and see your GTM through a buyer's eyes.
                  </p>
                </div>
                {error && (
                  <p id="calc-error" role="alert" className="rounded-lg border border-ember/40 bg-ambertint px-3 py-2 text-left text-sm text-emberdeep">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-electric h-[48px] w-full text-[15px]"
                >
                  Get Your MarketReady Score →
                </button>
                <p className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-fog">
                  MY 60-SECOND READ - BUILT FOR B2B SAAS AND CONSUMER TECH
                </p>
              </form>
            </div>
            {/* Spec §3: sample-report card is the sole hero visual, anchored
                high in the right column. Stacks below the text on mobile. */}
            <div>
              <HeroMockup />
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
