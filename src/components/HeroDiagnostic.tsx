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
import type { CSSProperties, FormEvent } from "react";
import varietyLogo from "./hero-logos/variety.svg?raw";
import tntLogo from "./hero-logos/tntsports.svg?raw";
import brLogo from "./hero-logos/bleacherreport.svg?raw";
import aewLogo from "./hero-logos/aew.svg?raw";
import impactLogo from "./hero-logos/impact.svg?raw";
import trackonomicsLogo from "./hero-logos/trackonomics.svg?raw";
import pressboardLogo from "./hero-logos/pressboard.svg?raw";
import { scoreColor, PILLAR_OF, impactLabel, STRONG_MIN } from "~/lib/audit/engine";
import { paramStatus } from "~/lib/audit/thresholds";
import { toAIResult } from "~/lib/audit/ai";
import type { AIResult } from "~/lib/audit/ai";
import { ASSESSMENT_STORAGE_KEY } from "~/lib/storage";
import { apiUrl } from "~/lib/apiOrigin";


/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Owner revision spec §3/§7: the sample-report card is the SOLE hero   */
/* visual (founder photo removed). Larger card, anchored high in the    */
/* right column; 4 parameter rows; flat surface per §8 (no glow wash).  */
/* Scores are illustrative samples, never a real result (§12). §5: 12px */
/* L-brackets top-right + bottom-right only, 1px #C96A42, -1px offset   */
/* (light rhyme with the #methodology engine-gauge brackets — no grid   */
/* overlay / mono labels in the hero). §7 (2026-09-14): rows reveal on  */
/* load, driven by a live-crawl status line (fade + 8px rise, 400ms),   */
/* numerals count up over 500ms, "Scan complete" holds 800ms, finding    */
/* fades in as the status fades out, then one scan sweep (1.2s) stops.   */
/* Reduced motion = final state.                                         */
/* ------------------------------------------------------------------ */
interface HeroRow {
  label: string;
  score: string; // "NN/100"
  cls: string;
}

const MOCKUP_ROWS: HeroRow[] = [
  { label: "Category Positioning", score: "29/100", cls: "text-[#C4603A]" },
  { label: "Hero Messaging & Speed", score: "34/100", cls: "text-[#C9992F]" },
  { label: "GTM Path & Offer", score: "27/100", cls: "text-[#C4603A]" },
  { label: "Differentiation Anchor", score: "21/100", cls: "text-[#C4603A]" },
];

const ROW_CLS =
  "flex items-center justify-between gap-3 rounded-lg border border-[#3A312B] bg-[#16120F] px-3.5 py-2.5";

/* Owner spec 2026-09-14 §4: the sample card runs a status-line-driven
   "live crawl" once on load. The status text cycles through four working
   states (~600ms each); as EACH state completes, the matching score row
   fades in (+8px rise, 400ms ease-out — the inline transition below) and
   counts up over 500ms. After the fourth row lands the status flips to
   "Scan complete" (green), holds 800ms, then fades out as the sample
   finding fades in; a single 1.2s scan sweep (CSS `.hero-card-scan`)
   fires after that and stops. Total ≈ 4.8s, reading as ~4s of tool
   running. Reduced motion = final state immediately (see below). */
const MOCKUP_STATUSES = [
  "Reading homepage…",
  "Checking category clarity…",
  "Scoring differentiation…",
  "Compiling results…",
];

const STATUS_MS = 600; // each working status shows ~600ms (spec: 550–700)
const DONE_HOLD_MS = 800; // "Scan complete" holds 800ms
const ROW_FADE_MS = 400; // fade + 8px rise, ease-out
const COUNTUP_MS = 500; // numeral counts 0 → value over 500ms
// Finding fades in AS the status line fades out (both 400ms ease-out),
// then the single scan sweep fires (CSS owns the 1.2s sweep).
const FINDING_AT_MS = STATUS_MS * MOCKUP_STATUSES.length + DONE_HOLD_MS;
const SCAN_AT_MS = FINDING_AT_MS + ROW_FADE_MS;

export function HeroMockup({ animate = true }: { animate?: boolean }) {
  const targets = MOCKUP_ROWS.map((r) => parseInt(r.score, 10));
  const [visible, setVisible] = useState(0); // rows revealed so far (0..4)
  const [nums, setNums] = useState<number[]>(() => MOCKUP_ROWS.map(() => 0));
  const [finding, setFinding] = useState(false);
  const [scan, setScan] = useState(false);
  // Status line: `status` null = no content (reduced-motion / end state);
  // `done` = "Scan complete" green state; `statusGone` fades the strip out.
  const [status, setStatus] = useState<string | null>(MOCKUP_STATUSES[0]);
  const [done, setDone] = useState(false);
  const [statusGone, setStatusGone] = useState(false);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const finalState = () => {
      setVisible(MOCKUP_ROWS.length);
      setNums(targets);
      setFinding(true);
      setStatus(null);
      setDone(true);
    };
    if (!animate) {
      finalState();
      return;
    }
    // prefers-reduced-motion: render the final state immediately, no
    // animation (also guarded in CSS for no-JS / emulation gaps).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finalState();
      return;
    }
    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };
    // a. status-driven rows: each working state completes at (i+1)*STATUS_MS;
    //    the matching row fades in (fade + 8px rise via inline transition)
    //    and the next status — or "Scan complete" — takes over the line.
    MOCKUP_STATUSES.forEach((_, i) => {
      at((i + 1) * STATUS_MS, () => {
        setVisible((v) => Math.max(v, i + 1));
        setStatus(
          i + 1 < MOCKUP_STATUSES.length
            ? MOCKUP_STATUSES[i + 1]
            : "Scan complete",
        );
        if (i + 1 === MOCKUP_STATUSES.length) setDone(true);
      });
    });
    // b. each numeral counts 0 → target over 500ms from its row's start
    MOCKUP_ROWS.forEach((_, i) => {
      const target = targets[i];
      at((i + 1) * STATUS_MS, () => {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / COUNTUP_MS);
          const eased = 1 - Math.pow(1 - p, 3);
          setNums((prev) => {
            const next = prev.slice();
            next[i] = Math.round(target * eased);
            return next;
          });
          if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    });
    // c. sample finding fades in AS the status line fades out (400ms ease-out)
    at(FINDING_AT_MS, () => {
      setFinding(true);
      setStatusGone(true);
    });
    // d. single scan sweep after the finding lands, then stops (no loop,
    //    not scroll-tied — CSS owns the 1.2s sweep)
    at(SCAN_AT_MS, () => setScan(true));
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowStyle = (shown: boolean): CSSProperties => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "translateY(0)" : "translateY(8px)",
    transition: `opacity ${ROW_FADE_MS}ms ease-out, transform ${ROW_FADE_MS}ms ease-out`,
  });

  return (
    <div className="hero-mockup relative mx-auto w-full max-w-[380px]">
      {/* Flat 1px hairline border, no glow or lighter edge (owner spec 2026-09-09). */}
      <div
        className="relative overflow-hidden rounded-2xl border border-[#3A312B] bg-[#1F1A16]"
      >
        <div className="relative overflow-hidden rounded-[15px] bg-[#1F1A16]">
          {/* Top header bar: browser chrome */}
          <div className="flex items-center gap-3 border-b border-[#322a24] bg-[#1f1a16] px-4 py-2.5">
            <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6b5b4e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#6b5b4e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#6b5b4e]" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-[#241c18] px-2 py-0.5 text-center text-[12px] text-[#c9beb2]">
              https://yourproduct.com
            </span>
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center gap-1 rounded-full border border-[#e8c9a0]/55 bg-[#e8c9a0]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f0d9b0]"
            >
              <span className="text-[9px]">●</span>Sample report
            </span>
          </div>
          {/* Status line (owner spec 2026-09-14 §4): fixed-height strip
              between the chrome header and the rows, ALWAYS rendered so the
              card height never shifts when the status appears/fades. The
              pulsing rust dot (#C96A42, ~4px core) sits left of the mono
              10px #7D736A text; "Scan complete" flips to a static #6E9464
              dot + text, holds 800ms, then fades out as the finding fades
              in. Reduced motion: strip stays (space reserved) but renders
              empty (JS + CSS guard below). */}
          <div className="flex flex-col gap-2 bg-[#1F1A16] p-4 sm:p-5">
            <div
              className="hero-mockup-status-line flex h-[30px] items-center gap-2 font-mono text-[10px] leading-none"
              style={{
                opacity: statusGone ? 0 : 1,
                transition: `opacity ${ROW_FADE_MS}ms ease-out`,
              }}
            >
              {status && (
                <>
                  {done ? (
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-1 w-1 shrink-0 rounded-full bg-[#6E9464]"
                    />
                  ) : (
                    <span aria-hidden="true" className="relative flex h-1 w-1 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C96A42] opacity-60" />
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-[#C96A42]" />
                    </span>
                  )}
                  <span className={done ? "text-[#6E9464]" : "text-[#7D736A]"}>
                    {status}
                  </span>
                </>
              )}
            </div>
            {/* All 4 metric rows (owner spec 2026-09-09); status-driven
                reveal — opacity/transform transitioned, numerals count up. */}
            {MOCKUP_ROWS.map((r, i) => (
              <div key={r.label} className={`hero-mockup-row ${ROW_CLS}`} style={rowStyle(visible > i)}>
                <span className="min-w-0 text-[13px] font-medium text-[#e8e2d8]">{r.label}</span>
                <span className={`shrink-0 font-mono text-[18px] font-bold tabular-nums ${r.cls}`}>
                  {nums[i]}/100
                </span>
              </div>
            ))}
            {/* Sample finding inline beneath the lowest-scoring row */}
            <p
              className="hero-mockup-finding text-[11px] leading-relaxed text-[#f08a4b]"
              style={{
                opacity: finding ? 1 : 0,
                transition: `opacity ${ROW_FADE_MS}ms ease-out`,
              }}
            >
              Sample finding: category naming is too broad for high-intent buyers.
            </p>
          </div>
          {/* §4d: single 1.2s scan sweep, 40% opacity #C96A42 line, stops */}
          {scan && <div className="hero-card-scan" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* §6: client logo strip — seven authentic brand wordmarks (the same  */
/* public/logos assets the founder marquee uses), all rendered in one  */
/* flat #7D736A treatment. Method: inline the SVG markup (?raw) and    */
/* force every fill via CSS (`fill: #7d736a !important`), which beats   */
/* both fill attributes and inline style fills → EXACT flat color      */
/* (a brightness/invert filter could only produce neutral grays).      */
/* Heights are per-logo CSS classes (hero-logo-*) for optical balance  */
/* across three breakpoints — cap 34px ≥900px (owner spec 2026-09-10   */
/* §1). Variety is the full lockup (letters + underline swoosh — note  */
/* the round-2 crop of the authentic file clipped the swoosh tail by   */
/* ~13 units; the new tight crop includes it, so the full mark shows); */
/* AEW is the full lockup (outer brackets + stacked wordmark, both     */
/* from the owner-approved founder-bar files). Trackonomics is the     */
/* wordmark only (the "an Impact company" tagline is cropped out — it  */
/* duplicated impact.com in the same row and was illegible at display  */
/* size). WBD removed entirely in round 6 (2026-09-10).                */
/* ------------------------------------------------------------------ */
/** Ensure a viewBox so CSS height scales proportionally (amazon.svg
 *  ships none). width/height attrs stay — CSS overrides them. */
function normalizeLogoSvg(raw: string): string {
  if (/viewBox\s*=/.test(raw)) return raw;
  const w = raw.match(/width="([\d.]+)"/)?.[1];
  const h = raw.match(/height="([\d.]+)"/)?.[1];
  return w && h ? raw.replace("<svg", `<svg viewBox="0 0 ${w} ${h}"`) : raw;
}

/* Owner spec 2026-09-10 §1 → round 6: seven-brand adtech/media mix, in this
   order. Round 6 (2026-09-10): WBD REMOVED entirely (root cause of the
   glyph clipping the owner saw — the W letterform extends left of the crop).
   Variety re-added at position 1 (authentic monochrome source, full lockup
   including the underline swoosh) and AEW added at position 4 (authentic
   full lockup: outer brackets + "ALL ELITE WRESTLING" + "AEW" — monochrome
   source created from public/logos/aew.svg, the owner-approved founder-bar
   file; the two files the owner dropped in /home/team/shared are NOT vectors
   (one is a WEBP raster, the other a generic 24×24 Streamline-HQ icon) and
   were not usable). Nativo remains OMITTED (acquired by Impact.com 2022 —
   no authentic vector survives on any public archive; see
   /home/team/shared/hero-rework/NATIVO-HUNT-REPORT.md). Awaiting the
   owner's official Nativo file to complete the 7-mark set (which then
   becomes 8 marks).
   Heights live in CSS (.hero-logo-* classes) so each mark can scale per
   breakpoint: < 600 = 2-col grid (2+2+2+1 rows), 600–899 = 4-col grid
   (4+3 rows), ≥ 900 = ONE full-width row, marks spread edge-to-edge via
   flex space-between (minimum 24px gaps grow to ~65px on wide screens).
   light:true = per-mark legibility exception (§3) — reads too thin at
   rendered size, gets a slightly lighter fill (#A89E95). Variety and AEW
   are solid-weight marks and do NOT need the exception. */
const HERO_LOGOS: { name: string; svg: string; cls: string; light?: boolean }[] = [
  { name: "Variety", svg: varietyLogo, cls: "hero-logo-variety" },
  { name: "TNT Sports", svg: tntLogo, cls: "hero-logo-tnt" },
  { name: "Bleacher Report", svg: brLogo, cls: "hero-logo-br" },
  { name: "AEW", svg: aewLogo, cls: "hero-logo-aew" },
  { name: "impact.com", svg: impactLogo, cls: "hero-logo-impact" },
  { name: "Trackonomics", svg: trackonomicsLogo, cls: "hero-logo-trackonomics", light: true },
  { name: "Pressboard", svg: pressboardLogo, cls: "hero-logo-pressboard", light: true },
];

const HERO_LOGOS_LABEL = "BRANDS MY TEAMS HAVE WORKED WITH";

function HeroLogos() {
  return (
    <div className="hero-logos">
      <div className="border-t border-[#3A312B] pt-4">
        <p className="hero-logos-label">{HERO_LOGOS_LABEL}</p>
        <ul className="hero-logos-row">
          {HERO_LOGOS.map((l) => (
            <li key={l.name}>
              <span
                className={
                  l.light
                    ? `hero-logo hero-logo-lighter ${l.cls}`
                    : `hero-logo ${l.cls}`
                }
                role="img"
                aria-label={l.name}
                dangerouslySetInnerHTML={{ __html: normalizeLogoSvg(l.svg) }}
              />
            </li>
          ))}
        </ul>
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

/** Teaser pillar groups (restored prior build). The two reserved (locked)
 * parameters render as visible locked cards inside the GTM pillar so the
 * 6 scored + 2 reserved structure is legible (owner spec Part 10). */
const TEASER_PILLARS: { title: string; ids: string[] }[] = [
  { title: "Core Positioning", ids: ["positioning", "icp", "differentiation"] },
  { title: "Messaging & Value Prop", ids: ["messaging", "value-prop"] },
  { title: "GTM & Launch Velocity", ids: ["gtm", "launch", "conversion"] },
];

function pillarySort(id: string): number {
  for (let i = 0; i < TEASER_PILLARS.length; i++) {
    const idx = TEASER_PILLARS[i].ids.indexOf(id);
    if (idx !== -1) return i * 10 + idx;
  }
  return 99;
}

/** Score -> per-parameter status label (unified thresholds, no local copy). */
function g2Status(score: number): string {
  return paramStatus(score);
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

/**
 * Map the live diagnostic response onto the card model. Reserved parameters
 * (gtm, launch) are KEPT and rendered as visible locked cards (owner spec
 * Part 10) so the 6 scored + 2 reserved structure is legible; a dimension that
 * abstained (insufficientData) renders as "Not enough signal to score" with no
 * number. Nothing is computed locally: no local engine result is used any more.
 */
function normalizeTeaserDims(aiResult: AIResult | null): TeaserDim[] {
  const out: TeaserDim[] = [];
  if (!aiResult) return out;
  for (const r of aiResult.dimensions) {
    const scored = typeof r.score === "number";
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
      locked: r.locked === true,
      color: scored ? scoreColor(r.score as number) : undefined,
      isAI: true,
    });
  }
  return out.sort((a, b) => pillarySort(a.id) - pillarySort(b.id));
}

/** Scan lifecycle: idle -> loading -> success | error. There is NO local
 * fallback score: a failed live scan shows an explicit error state with a
 * Retry (owner spec Part 7). */
type ScanStatus = "idle" | "loading" | "success" | "error";

function useAssessment() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runCrawl = (cleanUrl: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    // The server bounds crawl + model at ~40s, so the client abort sits above
    // it (owner spec Part 2.3) instead of cutting the request short.
    const timer = window.setTimeout(() => controller.abort(), 45000);
    setStatus("loading");
    setAiResult(null);
    fetch(apiUrl("/api/diagnose"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok) {
          const normalized = toAIResult(data);
          if (normalized) {
            setAiResult(normalized);
            setGeneratedAt(new Date().toISOString());
            setStatus("success");
            return;
          }
        }
        setStatus("error");
      })
      .catch(() => setStatus("error"))
      .finally(() => window.clearTimeout(timer));
  };

  useEffect(() => {
    // Restore ONLY the submitted URL string into the form. The local fallback
    // engine is never re-run (owner spec Part 7): a restored page shows the
    // form again, and the visitor re-runs the live scan.
    try {
      const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.url === "string" && parsed.url) {
          setUrl(parsed.url);
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
    try {
      window.localStorage.setItem(
        ASSESSMENT_STORAGE_KEY,
        JSON.stringify({ url: cleanUrl, submittedAt: new Date().toISOString() }),
      );
    } catch {}
    setSubmittedUrl(cleanUrl);
    runCrawl(cleanUrl);
  };

  /** Re-run the live scan for the same URL after a failure. */
  const retry = () => {
    if (submittedUrl) {
      setError("");
      runCrawl(submittedUrl);
    }
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(ASSESSMENT_STORAGE_KEY);
    } catch {}
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setSubmittedUrl("");
    setAiResult(null);
    setGeneratedAt("");
    setUrl("");
    setError("");
  };

  return {
    url,
    setUrl,
    error,
    status,
    submittedUrl,
    aiResult,
    generatedAt,
    hydrated,
    handleSubmit,
    retry,
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
  const locked = card.locked === true;
  const unscored = !locked && (card.insufficientData === true || card.score == null);
  const color = card.color ?? "#A1A1AA";
  const n = card.score ?? 0;
  const strong = n >= STRONG_MIN;
  const label = strong ? card.anchorLabel : card.frictionLabel;
  // Single label flip, shared threshold (owner spec Part 4).
  const section = impactLabel(n);

  // Reserved parameter: visible, locked, and honest about where it is scored.
  if (locked) {
    return (
      <div
        className="glass-card flex flex-col gap-3 p-5"
        style={{ borderColor: "rgba(125,115,106,0.45)", backgroundColor: "rgba(42,35,32,0.35)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-snug text-ink">{card.name}</h4>
          <span className="shrink-0 rounded-full border border-hairline bg-ink/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fog">
            Reserved
          </span>
        </div>
        <div className="flex items-center gap-2 text-ember">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Locked, not scored from your URL
          </span>
        </div>
        <p className="text-sm leading-relaxed text-mist">
          This parameter needs internal materials (channel plan, launch kit, owners) that a public
          site cannot show, so it is assessed by hand in the paid MarketReady Audit.
        </p>
        <div className="rounded-lg border border-hairline bg-cream px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fog">Locked: </span>
          <span className="text-xs text-mist">Requires internal review, assessed in the MarketReady Audit.</span>
        </div>
      </div>
    );
  }

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
          {unscored ? "Not enough signal to score" : card.status ?? "Pending"}
        </span>
        {!unscored && label && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color, borderColor: hexA(color, 0.35), backgroundColor: hexA(color, 0.1) }}>
            {label}
          </span>
        )}
        <span className="ml-auto font-mono text-lg font-bold tabular-nums" style={{ color }}>
          {unscored ? "—" : `${card.score}/100`}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-mist">{card.keyObservation ?? card.friction}</p>
      {!unscored && card.commercialRisk && (
        <div className="rounded-lg border border-hairline bg-cream px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fog">{section}: </span>
          <span className="text-xs text-mist">{card.commercialRisk}</span>
        </div>
      )}
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
  websiteUrl,
  headlineScore,
  overallBand,
  recommendedFix,
  redFlag,
  dims,
  generatedAt,
}: {
  websiteUrl: string;
  headlineScore: number;
  overallBand: string;
  recommendedFix: string;
  redFlag: TeaserDim | undefined;
  dims: TeaserDim[];
  generatedAt: string;
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
      overallScore: headlineScore,
      lowestParameter: redFlag?.name ?? null,
      prescription: recommendedFix,
      keyObservation: redFlag?.keyObservation ?? "",
      commercialRisk: redFlag?.commercialRisk ?? "",
      frictionLabel: redFlag?.frictionLabel ?? "",
      anchorLabel: redFlag?.anchorLabel ?? "",
      domEvidence: redFlag?.evidenceSnippet ?? "",
      diagnosticPayload: {
        score: headlineScore,
        overallBand,
        generatedAt,
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

/** Teaser results: overall score + pillars + the model's primary friction +
 * the 6 scored cards and the 2 reserved (locked) cards. Rendered ONLY from the
 * live diagnostic response (owner spec Part 7): there is no local fallback and
 * no invented score. A response with no overall score (3 or more dimensions
 * with no evidence) shows the "could not be read well enough" message. */
function HeroResults({
  aiResult,
  url,
  generatedAt,
  onReset,
  onBookBriefing,
}: {
  aiResult: AIResult;
  url: string;
  generatedAt: string;
  onReset: () => void;
  onBookBriefing: () => void;
}) {
  const score = aiResult.score;
  const band = aiResult.overallBand;
  const dims = normalizeTeaserDims(aiResult);
  const scoredDims = dims.filter(
    (d) => !d.locked && d.insufficientData !== true && d.score != null,
  );
  // The lead record still names the LOWEST scored parameter: that keeps a
  // mappable value in the Airtable "Primary Friction" single-select. The card
  // the visitor sees is the model's own primary friction + fix (Part 8).
  const lowest = [...scoredDims].sort(
    (a, b) => (a.score ?? 0) - (b.score ?? 0) || pillarySort(a.id) - pillarySort(b.id),
  )[0];
  const pillarAvgs = TEASER_PILLARS.map((p) => {
    const hit = dims.filter((d) => p.ids.includes(d.id) && !d.locked && !d.insufficientData && d.score != null);
    const avg = hit.length ? Math.round(hit.reduce((sum, d) => sum + (d.score ?? 0), 0) / hit.length) : null;
    return { title: p.title, avg };
  });

  return (
    <section id="results" className="scroll-mt-24" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip">Your results are in</span>
          <h3 className="mt-3 font-display text-2xl tracking-tight text-ink sm:text-3xl">Your Market Readiness Score</h3>
          <p className="mt-1 max-w-2xl text-sm text-mist">{url}</p>
        </div>
        <p className="text-xs text-fog">Scored {m2Date(generatedAt)}</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="glass-card flex flex-col justify-center gap-3 px-6 py-8">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-mist">Overall Score</h4>
          {score == null ? (
            <p className="max-w-md text-sm leading-relaxed text-mist">
              I could not read enough of this site to score it honestly. Too little of the public
              crawl gave usable evidence, so there is no overall score here rather than an invented
              one. If the site blocks crawlers or sits behind a login, try a public marketing page,
              or book a call and I will review it by hand.
            </p>
          ) : (
            <>
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
            </>
          )}
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

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h4 className="font-display text-lg tracking-tight text-ink">The first thing I&apos;d fix</h4>
          <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
        </div>
        <p className="mt-1 max-w-3xl text-sm text-mist">The single biggest drag on growth that I found on your public site.</p>
        <div className="glass-card mt-4 max-w-2xl p-5">
          <div className="rounded-lg border border-hairline bg-cream px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-fog">Primary friction: </span>
            <span className="text-xs text-mist">{aiResult.primaryFriction}</span>
          </div>
          <div className="mt-3 rounded-lg border border-ember/30 bg-ambertint/50 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emberdeep">Recommended fix: </span>
            <span className="text-xs text-mist">{aiResult.recommendedFix}</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h4 className="font-display text-lg tracking-tight text-ink">Full parameter breakdown</h4>
          <span className="chip">Final assessment</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-mist">Every scored area with what I noticed and why it matters, grouped by pillar. The two reserved parameters are locked until the paid Audit.</p>
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
              {p.title === "GTM & Launch Velocity" && (
                <p className="mt-3 text-xs leading-relaxed text-fog">
                  Conversion readiness is scored from your public site. GTM Readiness and Launch Readiness are reserved: they need internal materials (channel plan, launch kit, owners), so I assess them by hand in the paid MarketReady Audit.
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

      {typeof score === "number" && (
        <HomepageUnlock
          websiteUrl={url}
          headlineScore={score}
          overallBand={band ?? ""}
          recommendedFix={aiResult.recommendedFix}
          redFlag={lowest}
          dims={dims}
          generatedAt={generatedAt}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fog">
          My live read of your homepage, pricing and about pages, scored against the MarketReady rubric.
        </p>
        <button type="button" onClick={onReset} className="nav-link">
          Re-run assessment
        </button>
      </div>
    </section>
  );
}

/** Explicit scan-failure state (owner spec Part 7): an honest message and a
 * Retry that re-runs the live crawl. No local engine result, no invented score. */
function ScanError({
  url,
  onRetry,
  onReset,
}: {
  url: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="glass-card px-6 py-8" role="alert" aria-live="assertive">
      <span className="chip">Scan failed</span>
      <h3 className="mt-3 font-display text-xl tracking-tight text-ink sm:text-2xl">
        The scan could not complete.
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
        I could not read{" "}
        <span className="font-semibold text-ink">{url || "that site"}</span> just now, so there is
        no score to show you. Nothing here is guessed: run it again in a moment, or try a different
        URL.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <button type="button" onClick={onRetry} className="btn-electric h-[46px] px-6 text-[14px]">
          Retry scan →
        </button>
        <button type="button" onClick={onReset} className="nav-link">
          Try a different URL
        </button>
      </div>
    </div>
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
    status,
    submittedUrl,
    aiResult,
    generatedAt,
    handleSubmit,
    retry,
    reset,
  } = useAssessment();
  // The panel replaces the hero form as soon as a scan starts, and never shows
  // a made-up score: loading -> results or an explicit error state with Retry.
  const showPanel = status !== "idle";
  const centered = variant === "centered";

  return (
    /* Owner revision spec §6: hero on flat #2A2320 (owner spec 2026-09-09:
       no gradient/glow wash), top padding roughly half the old value
       (fixed header is h-16 + pt-6/pb-4, so pt-24 clears it). §7: the
       only section boundary here is the hairline above the Manifesto.
       Paper-grain overlay reuses the Work With Me feTurbulence approach
       (overlay @ 26%, pointer-events none); content sits above it. */
    <section id="top" className="relative bg-[#2A2320] pt-24 pb-12 sm:pb-16">
      <div className="hero-grain" aria-hidden="true">
        <svg width="100%" height="100%" aria-hidden="true">
          <filter id="hero-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#hero-grain-filter)"
          />
        </svg>
      </div>
      <div className="hero-content relative mx-auto max-w-6xl px-5 sm:px-8">
        {showPanel ? (
          <div
            id="calculator"
            className={centered ? "mt-6 scroll-mt-24 mx-auto max-w-[760px]" : "mt-6 scroll-mt-24"}
          >
            <div className="flex flex-col gap-5">
              {status === "loading" && <CrawlScanner mode="loading" url={submittedUrl} />}
              {status === "error" && (
                <ScanError url={submittedUrl} onRetry={retry} onReset={reset} />
              )}
              {status === "success" && aiResult && (
                <HeroResults
                  aiResult={aiResult}
                  url={submittedUrl}
                  generatedAt={generatedAt}
                  onReset={reset}
                  onBookBriefing={onBookBriefing}
                />
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
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">Six scored dimensions, two reserved</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">0 to 100 readiness score</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">First red flag, free</span>
              <span className="rounded-full border border-hairline bg-linen px-3 py-1 text-xs font-medium text-mist">Full breakdown in your inbox</span>
            </div>
          </div>
        ) : (
          <>
          {/* Owner revision spec §1/§2/§3: hero left column — kicker +
              serif headline (no underline span — the "market story"
              phrase is gone), two-line subhead (13px #C4BBB0 then 12px
              #A79C91, 10px apart, 16px above the URL field), helper text
              under the input. No founder photo anywhere in the hero; the
              sample-report card + logo strip anchor the right/bottom. */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="text-center lg:text-left">
              <p className="eyebrow">ARE YOU MARKETREADY?</p>
              <h1 className="mx-auto mt-3 max-w-[460px] text-balance font-display text-[24px] font-bold leading-[1.2] tracking-tight text-[#F5F0E8] sm:text-[28px] lg:mx-0">
                Optimize your GTM engine. Maximize product growth.
              </h1>
              <p className="mx-auto mt-4 max-w-[480px] text-[13px] leading-[1.55] text-[#C4BBB0] lg:mx-0">
                Weak positioning creates expensive problems downstream. Sales works harder. Acquisition costs more. Launches underperform.
              </p>
              <p className="mx-auto mt-[10px] max-w-[480px] text-[13px] leading-[1.55] text-[#C4BBB0] lg:mx-0">
                I find the friction costing you growth, fix the foundation, and set your business up to scale.
              </p>
              <p className="mx-auto mt-[10px] max-w-[480px] text-[12px] leading-[1.55] text-[#A79C91] lg:mx-0">
                Seasoned PMM expertise. Hands-on execution. No agency layers.
              </p>
              <form onSubmit={handleSubmit} noValidate className="mx-auto mt-4 flex max-w-md flex-col gap-3 lg:mx-0">
                <div className="text-left">
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
                  <p className="mt-2 text-[12px] leading-relaxed text-[#C4BBB0]">
                    Run your URL through MarketReady&apos;s free Market Readiness Diagnostic to identify gaps in your positioning, messaging, and GTM.
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
              </form>
            </div>
            {/* Spec §3: sample-report card is the sole hero visual, anchored
                high in the right column. Stacks below the text on mobile.
                §7: the hero instance animates on load (staggered rows,
                count-up numerals, finding, single scan sweep). */}
            <div className="flex justify-center">
              <HeroMockup animate />
            </div>
          </div>
          {/* §6: client logo strip, full width beneath both columns */}
          <HeroLogos />
          </>
        )}
      </div>
    </section>
  );
}
