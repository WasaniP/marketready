/**
 * MarketReady homepage URL-diagnostic results : VALUE-FIRST 6-PARAMETER model.
 *
 * Build #39. The public tool INSTANTLY shows ALL 6 scored parameter cards with
 * NO email blur-gate and NO locked/reserved cards. Pricing & Packaging Logic
 * was REMOVED from automated scoring entirely (internal unit economics / deal
 * context), so it is not a scored card; a quiet text line under Pillar 2 notes
 * it is reviewed in the MarketReady Audit. The 2 internal parameters (gtm,
 * launch) still exist in the API/engine JSON (the paid Audit uses them) but are
 * NEVER rendered here.
 *
 * Layout:
 *   Overall score + status label + 3 pillar summary badges.
 *   Exactly 1 "Surface Red Flag": the LOWEST-scoring parameter that has valid
 *     extracted evidence (a real evidence_snippet). Parameters with no usable
 *     quote are never highlighted with false evidence; if none have evidence,
 *     it falls back to the lowest scored parameter.
 *   The 6 cards grouped under their 3 Pillar headers, with a quiet pricing note
 *     under Pillar 2 and the existing public-scope note under Pillar 3.
 *   PDF capture bar ("Send Me My PDF Report") : the ONLY capture point. On
 *     submit it POSTs the lead to /api/leads (Airtable, JSONL fallback always
 *     ok; includes domEvidence + strategicImpact + full payload) and then
 *     generates + downloads the 4-page PDF client-side. Honest: the business
 *     has no email capability, so the report is an instant download, never a
 *     fake "we emailed you" claim.
 *   Bottom offer card: a high-trust 15-minute diagnostic briefing invitation
 *     (no direct $3,000 Audit sales pitch).
 *
 * All client-side, SSR-safe. No em/en dashes anywhere in the copy.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import type { AuditResult } from "~/lib/audit/types";
import { PILLAR_OF, scoreColor } from "~/lib/audit/engine";
import type { AIResult } from "~/lib/audit/ai";
import { withAlpha } from "~/components/charts";
import { downloadAuditReport } from "~/lib/report/generate";

/** One scored card in the pillar-grouped grid. Locked (reserved) cards are
 * never built here: the public view shows ONLY the 6 scored parameters. */
export interface DimensionCardData {
  id: string;
  name: string;
  pillar: string;
  score?: number;
  status?: string;
  friction?: string;
  /** Short (2 to 4 word) dynamic diagnostic label, e.g. "Vague Category
   * Naming" or "Feature-Heavy: Low Outcome". Shown as the FRICTION label for
   * scores below 70. */
  frictionLabel?: string;
  /** Short (2 to 4 word) positive anchor label, e.g. "Clear Category Stake".
   * Shown as the STRENGTH label for scores >= 70. */
  anchorLabel?: string;
  /** Short literal DOM quote backing this card's score (server-side carry only,
   * never rendered). Drives the red-flag evidence guard and logs to Airtable. */
  evidenceSnippet?: string;
  /** Direct 1-sentence diagnostic observation of what was FOUND or MISSING on
   * the page, grounded in the messaging/patterning detected on the site. */
  keyObservation?: string;
  /** 1-sentence business impact: the commercial risk (score below 70) or the
   * competitive advantage (score >= 70). Label picked at the 70 threshold. */
  commercialRisk?: string;
  color?: string;
  insufficientData?: boolean;
  locked: boolean;
  isAI: boolean;
}

/** 3 pillar names, EXACT (owner-fixed). Order matches the site's engine.
 * Only the 6 publicly scorable parameter ids appear: Pillar 1 = 3, Pillar 2 =
 * 2 (messaging, value-prop; pricing is not scored), Pillar 3 = 1 (conversion). */
const RESULT_PILLARS: { title: string; ids: string[] }[] = [
  { title: "Core Positioning", ids: ["positioning", "icp", "differentiation"] },
  { title: "Messaging & Value Prop", ids: ["messaging", "value-prop"] },
  { title: "GTM & Launch Velocity", ids: ["conversion"] },
];

/** Canonical rank of a parameter id (pillar group, then within-pillar order). */
function idRank(id: string): number {
  for (let pi = 0; pi < RESULT_PILLARS.length; pi++) {
    const idx = RESULT_PILLARS[pi].ids.indexOf(id);
    if (idx !== -1) return pi * 10 + idx;
  }
  return 99;
}

/** Build the 6 scored grid cards in canonical order. Uses the live AI result
 * when present (strategic-impact synthesis + evidence_snippet), else the local
 * 6-scored engine. Locked (gtm / launch) entries are excluded from the public
 * view entirely, and pricing is never scored. */
function buildDimensionCards(
  aiResult: AIResult | null | undefined,
  result: AuditResult,
): DimensionCardData[] {
  const source: DimensionCardData[] = [];
  if (aiResult) {
    for (const d of aiResult.dimensions) {
      if (d.locked) continue;
      source.push({
        id: d.id,
        name: d.name,
        pillar: d.pillar || PILLAR_OF[d.id] || "GTM & Launch Velocity",
        score: d.score,
        status: d.status,
        friction: d.friction,
        frictionLabel: d.frictionLabel,
        anchorLabel: d.anchorLabel,
        keyObservation: d.keyObservation,
        commercialRisk: d.commercialRisk,
        evidenceSnippet: d.evidence_snippet,
        insufficientData: d.insufficientData,
        locked: false,
        color: typeof d.score === "number" ? scoreColor(d.score) : undefined,
        isAI: true,
      });
    }
  } else {
    for (const p of result.parameters) {
      if (p.locked) continue;
      source.push({
        id: p.id,
        name: p.name,
        pillar: PILLAR_OF[p.id] || "GTM & Launch Velocity",
        score: p.score,
        status: p.status,
        friction: p.diagnostic,
        frictionLabel: p.frictionLabel,
        anchorLabel: p.anchorLabel,
        keyObservation: p.keyObservation,
        commercialRisk: p.commercialRisk,
        locked: false,
        color: p.color,
        isAI: false,
      });
    }
  }
  return source.sort((a, b) => idRank(a.id) - idRank(b.id));
}

/** Status label: uppercase badge whose color comes from the score. */
function StatusBadge({ status, color }: { status: string; color?: string }) {
  const c = color ?? "#A1A1AA";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c, borderColor: withAlpha(c, 0.35), backgroundColor: withAlpha(c, 0.1) }}
    >
      {status}
    </span>
  );
}

/** Overall readiness status label (exact vocabulary, no dashes). */
function overallStatus(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 40) return "Needs Refinement";
  return "Critical Gap";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Lowest-scoring card, tie-broken by canonical order. */
function pickLowest(cards: DimensionCardData[]): DimensionCardData | undefined {
  return [...cards].sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    if (sa !== sb) return sa - sb;
    return idRank(a.id) - idRank(b.id);
  })[0];
}

function ScoredCard({ card }: { card: DimensionCardData }) {
  const color = card.color ?? "#A1A1AA";
  const score = card.score ?? 0;
  // FRICTION/STRENGTH threshold is 70: below 70 a friction, at 70+ a strength.
  const isStrength = score >= 70;
  const statusLabel = isStrength ? card.anchorLabel : card.frictionLabel;
  const impactLabel = isStrength ? "Competitive Advantage" : "Commercial Risk";
  return (
    <div
      className="glass-card flex flex-col gap-3 p-5"
      style={{
        borderColor: withAlpha(color, 0.3),
        backgroundColor: withAlpha(color, 0.05),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug text-ink">{card.name}</h4>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            card.isAI
              ? "border-electric/40 bg-electric/10 text-electric"
              : "border-hairline bg-white/[0.04] text-zinc-400"
          }`}
        >
          {card.isAI ? "AI crawl" : "Local"}
        </span>
      </div>

      {/* Score + status badge (header) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-3xl font-extrabold leading-none tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-xs font-medium text-zinc-500">/100</span>
        {card.status && <StatusBadge status={card.status} color={color} />}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(4, score)}%`, backgroundColor: color }}
        />
      </div>

      {/* Dynamic status label (subheader): FRICTION below 70, STRENGTH at 70+ */}
      {statusLabel && (
        <p className="text-xs leading-relaxed text-mist">
          <span className="font-semibold text-ink">
            {isStrength ? "STRENGTH: " : "FRICTION: "}
          </span>
          {statusLabel}
        </p>
      )}

      {/* Key Observation + Commercial Risk / Competitive Advantage (body) */}
      {card.keyObservation && (
        <p className="text-xs leading-relaxed text-mist">
          <span className="font-semibold text-ink">Key Observation: </span>
          {card.keyObservation}
        </p>
      )}
      {card.commercialRisk && (
        <p className="text-xs leading-relaxed text-mist">
          <span className="font-semibold text-ink">{impactLabel}: </span>
          {card.commercialRisk}
        </p>
      )}
    </div>
  );
}

/** One pillar summary badge: name + mean score of its scored parameters
 * (insufficient-data cards are excluded so an N / A never drags the mean). */
function PillarBadge({ title, score }: { title: string; score: number | null }) {
  const color = score == null ? "#A1A1AA" : scoreColor(score);
  return (
    <div className="glass-card flex flex-col gap-1.5 px-5 py-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{title}</span>
      {score == null ? (
        <span className="text-2xl font-extrabold leading-none text-zinc-500">N / A</span>
      ) : (
        <span className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold leading-none tabular-nums" style={{ color }}>
            {score}
          </span>
          <span className="text-xs font-medium text-zinc-500">/100</span>
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF capture bar: the only lead-capture point on the results screen. */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Company inferred from the submitted URL's domain, not a user field. */
function inferCompany(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function PdfCaptureBar({
  result,
  headlineScore,
  overallBand,
  redFlag,
  dims,
}: {
  result: AuditResult;
  headlineScore: number;
  overallBand: string;
  redFlag: DimensionCardData | undefined;
  dims: unknown[];
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const em = email.trim();
    if (!fn) {
      setError("Enter your first name.");
      return;
    }
    if (!EMAIL_RE.test(em)) {
      setError("Enter a valid work email.");
      return;
    }
    setError("");
    setStatus("sending");

    const payload = {
      firstName: fn,
      workEmail: em,
      company: inferCompany(result.url),
      websiteUrl: result.url,
      icp: result.icp.trim(),
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
        url: result.url,
        dimensions: dims,
      },
    };

    // POST the lead (Airtable, JSONL fallback always ok), then generate +
    // download the PDF client-side. Never block the user on the network and
    // never claim an email was sent: the report is an instant download.
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null)
      .finally(() => {
        setStatus("done");
        downloadAuditReport(result);
      });
  };

  return (
    <div className="mt-10 overflow-hidden rounded-xl border border-electric/40 bg-[#1E293B]/50 shadow-[0_0_30px_rgba(20,184,166,0.12)] backdrop-blur-md">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <span className="chip border-electric/40 text-electric">PDF Report</span>
          <h4 className="mt-3 text-lg font-bold tracking-tight text-ink sm:text-xl">
            Email Me This Full Diagnostic Report (PDF)
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            All 6 scored parameters, the Surface Red Flag, and the observation and risk analysis from
            this scan, packaged as a print-ready PDF for your team and your investors.
          </p>
        </div>

        <div className="w-full max-w-sm shrink-0">
          {status === "done" ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => downloadAuditReport(result)}
                className="btn-electric w-full"
              >
                Your report is ready. Download again →
              </button>
              <p className="text-center text-xs text-zinc-500">
                Downloads instantly as a PDF. Nothing is emailed.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pdf-first" className="field-label">
                    First Name <span className="text-electric">*</span>
                  </label>
                  <input
                    id="pdf-first"
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
                  <label htmlFor="pdf-email" className="field-label">
                    Work Email <span className="text-electric">*</span>
                  </label>
                  <input
                    id="pdf-email"
                    type="email"
                    name="workEmail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    autoComplete="email"
                    className="field-input"
                    aria-describedby={error ? "pdf-error" : undefined}
                  />
                </div>
              </div>
              {error && (
                <p
                  id="pdf-error"
                  role="alert"
                  className="rounded-lg border border-electric/40 bg-electric/10 px-3 py-2 text-sm text-electric"
                >
                  {error}
                </p>
              )}
              <button type="submit" disabled={status === "sending"} className="btn-electric w-full">
                {status === "sending" ? "Preparing your report…" : "Send Me My PDF Report →"}
              </button>
              <p className="text-center text-xs text-zinc-500">
                Instant delivery • Zero spam
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom offer: high-trust diagnostic briefing (no $3,000 hard-sell). */
/* ------------------------------------------------------------------ */

function BriefingOffer({ onBookBriefing }: { onBookBriefing: () => void }) {
  return (
    <div className="mt-6 rounded-xl border border-electric/40 bg-electric/[0.06] p-6 shadow-[0_0_40px_rgba(20,184,166,0.12)] sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="chip border-electric/40 text-electric">Next step</span>
          <h4 className="mt-3 text-2xl font-bold tracking-tight text-ink">
            Let's review your score and map out the fixes.
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Automated scans catch surface friction. In a 15-minute diagnostic briefing, we'll walk
            through your lowest-scoring parameters and pinpoint what to prioritize first.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3">
          <button type="button" onClick={onBookBriefing} className="btn-electric shrink-0">
            Book a 15-Min Diagnostic Briefing →
          </button>
          <a href="/services/audit" className="nav-link text-left text-zinc-400">
            Looking for a full human-led evaluation? We can discuss our 9-parameter Audit during
            your call.
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard root                                                      */
/* ------------------------------------------------------------------ */

export function ResultsDashboard({
  result,
  onReset,
  onBookBriefing,
  aiResult,
  aiPending,
}: {
  result: AuditResult;
  onReset: () => void;
  onBookBriefing: () => void;
  aiResult?: AIResult | null;
  aiPending?: boolean;
}) {
  const isPreliminary = Boolean(aiPending) && !aiResult;
  const headlineScore = aiResult ? aiResult.score : result.overall;
  const overallBand = aiResult?.overallBand ?? result.riskLabel;

  // The 6 scored cards (locked gtm / launch are never built here).
  const scoredCards = buildDimensionCards(aiResult, result);

  // Surface Red Flag: the LOWEST-scoring parameter that is not
  // insufficient-data / N / A. Additionally PREFER a parameter that has a valid
  // evidence_snippet (real DOM quote) so we never highlight a parameter with
  // false evidence; if none have valid evidence, fall back to the lowest scored.
  const scoredCandidates = scoredCards.filter((c) => !c.insufficientData && c.score != null);
  const withEvidence = scoredCandidates.filter((c) => {
    const ev = c.evidenceSnippet;
    return typeof ev === "string" && ev.trim().length > 0;
  });
  const redFlag = pickLowest(
    withEvidence.length ? withEvidence : scoredCandidates.length ? scoredCandidates : scoredCards,
  );

  // Pillar summary badges: mean of each pillar's scored (non-N/A) parameters.
  const pillarSummaries = RESULT_PILLARS.map((pillar) => {
    const cards = scoredCards.filter(
      (c) => pillar.ids.includes(c.id) && !c.insufficientData && c.score != null,
    );
    const avg = cards.length
      ? Math.round(cards.reduce((s, c) => s + (c.score ?? 0), 0) / cards.length)
      : null;
    return { title: pillar.title, avg };
  });

  // The full 6-param payload sent to /api/leads (friction + anchor labels, key
  // observations + commercial risk, AND evidence_snippet included so Airtable
  // Automations have everything, including DOM Evidence per parameter).
  const dimPayload = scoredCards.map((c) => ({
    id: c.id,
    name: c.name,
    pillar: c.pillar,
    score: c.score,
    status: c.status,
    friction_label: c.frictionLabel,
    anchor_label: c.anchorLabel,
    keyObservation: c.keyObservation,
    commercialRisk: c.commercialRisk,
    evidence_snippet: c.evidenceSnippet,
    locked: c.locked,
    insufficientData: c.insufficientData,
  }));

  return (
    <section id="results" className="scroll-mt-24" aria-live="polite">
      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span
            className={`chip ${
              isPreliminary
                ? "border-[#A855F7]/50 bg-[#A855F7]/10 text-[#E9D5FF]"
                : "border-electric/40 text-electric"
            }`}
          >
            {isPreliminary ? "Preliminary Diagnostic" : "Assessment complete"}
          </span>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Your Market Readiness Score
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-mist">{result.url}</p>
          {isPreliminary && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[#E9D5FF]">
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#A78BFA] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C4B5FD]" />
              </span>
              Running Deep AI Crawl... Your final AI score is on its way.
            </p>
          )}
        </div>
        <p className="text-xs text-zinc-500">Scored {formatDate(result.generatedAt)}</p>
      </div>

      {/* Overall score + status + 3 pillar summary badges */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="glass-card flex flex-col justify-center gap-3 px-6 py-8">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-mist">Overall Score</h4>
          <div className="flex items-end gap-3">
            <span className="text-6xl font-extrabold leading-none tabular-nums text-ink">
              {headlineScore}
            </span>
            <span className="pb-1 text-sm font-medium text-zinc-500">/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-mist">Status:</span>
            <StatusBadge status={overallStatus(headlineScore)} color={scoreColor(headlineScore)} />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-mist">Pillars</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {pillarSummaries.map((p) => (
              <PillarBadge key={p.title} title={p.title} score={p.avg} />
            ))}
          </div>
        </div>
      </div>

      {/* Surface Red Flag: 1 card, lowest scored (non-N/A) */}
      {redFlag && (
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-bold tracking-tight text-ink">Surface Red Flag</h4>
            <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-mist">
            The single lowest-scoring parameter from your public site.
          </p>
          <div className="mt-4 max-w-md">
            <ScoredCard card={redFlag} />
          </div>
        </div>
      )}

      {/* Full 6-parameter breakdown grouped under the 3 pillars */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-bold tracking-tight text-ink">Full 6-Parameter Breakdown</h4>
          {aiResult && <span className="chip border-electric/40 text-electric">Final AI Assessment</span>}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-mist">
          Every scored parameter with its key observation and commercial risk, grouped by pillar.
        </p>

        {RESULT_PILLARS.map((pillar) => {
          const cards = scoredCards.filter((c) => pillar.ids.includes(c.id));
          return (
            <div key={pillar.title} className="mt-7">
              <div className="flex items-center gap-3">
                <h5 className="text-base font-bold tracking-tight text-ink">{pillar.title}</h5>
                <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                  <ScoredCard key={card.id} card={card} />
                ))}
              </div>
              {pillar.title === "Messaging & Value Prop" && (
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  Pricing & Packaging Logic requires internal unit economics and deal context -
                  reviewed directly in the MarketReady Audit.
                </p>
              )}
              {pillar.title === "GTM & Launch Velocity" && (
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  Note: Public web scans evaluate Conversion Readiness. Internal sales enablement
                  and launch mechanics are reviewed directly in the MarketReady Audit.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* PDF capture bar: the only capture point. */}
      <PdfCaptureBar
        result={result}
        headlineScore={headlineScore}
        overallBand={overallBand}
        redFlag={redFlag}
        dims={dimPayload}
      />

      {/* Bottom offer: high-trust briefing invitation. */}
      <BriefingOffer onBookBriefing={onBookBriefing} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">
          {aiResult
            ? "Deep AI assessment across the site's core pages plus an external market-intelligence scan."
            : "Automated snapshot assessment: representative diagnostics, not a full site crawl."}
        </p>
        <button type="button" onClick={onReset} className="nav-link">
          Re-run assessment
        </button>
      </div>
    </section>
  );
}
