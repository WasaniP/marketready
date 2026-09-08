/**
 * MarketReady report gate: the conversion moment.
 *
 * Renders below the top-3 gaps / CTA banner on the results dashboard:
 *  locked  → email input + teal "Unlock Full Report" button
 *  unlocked → "Download PDF" for the real 4-page report
 *
 * Unlock is persisted to localStorage (`marketready:report_unlocked`) so a
 * refresh keeps the report available. The lead is captured client-side
 * (localStorage fallback `marketready:leads`) and posted to the server
 * best-effort, never blocking the unlock, never throwing.
 *
 * Honesty: the business has no email capability; the report is an instant
 * download, nothing is ever sent to anyone. Copy says so explicitly.
 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AuditResult } from "~/lib/audit/types";
import { captureLead } from "~/lib/leads";
import type { LeadPayload } from "~/lib/leads";
import { REPORT_UNLOCK_KEY } from "~/lib/storage";
import { downloadAuditReport } from "~/lib/report/generate";

export interface UnlockRecord {
 email: string;
 unlockedAt: string;
 url: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value: string): boolean {
 return EMAIL_RE.test(value.trim());
}

function readUnlock(): UnlockRecord | null {
 try {
  const raw = window.localStorage.getItem(REPORT_UNLOCK_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<UnlockRecord>;
  if (
   parsed &&
   typeof parsed.email === "string" &&
   typeof parsed.unlockedAt === "string"
  ) {
   return {
    email: parsed.email,
    unlockedAt: parsed.unlockedAt,
    url: typeof parsed.url === "string" ? parsed.url : "",
   };
  }
  return null;
 } catch {
  return null;
 }
}

function writeUnlock(record: UnlockRecord): void {
 try {
  window.localStorage.setItem(REPORT_UNLOCK_KEY, JSON.stringify(record));
 } catch {
  // storage unavailable: unlock still applies for this session
 }
}

function buildLead(result: AuditResult, email: string): LeadPayload {
 return {
  email,
  url: result.url,
  businessModel: result.businessModel,
  launchStage: result.launchStage,
  icp: result.icp,
  overall: result.overall,
  riskLabel: result.riskLabel,
  generatedAt: result.generatedAt,
 };
}

export function ReportGate({ result }: { result: AuditResult }) {
 const [hydrated, setHydrated] = useState(false);
 const [unlocked, setUnlocked] = useState<UnlockRecord | null>(null);
 const [email, setEmail] = useState("");
 const [error, setError] = useState("");
 const [downloading, setDownloading] = useState(false);

 // Restore a previous unlock after mount (SSR-safe: first paint is `null` on
 // both server and client, so there is no hydration mismatch).
 useEffect(() => {
  setUnlocked(readUnlock());
  setHydrated(true);
 }, []);

 const handleUnlock = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const clean = email.trim();
  if (!isValidEmail(clean)) {
   setError("Enter a valid email address, e.g. founder@yourcompany.com");
   return;
  }
  setError("");

  const record: UnlockRecord = {
   email: clean,
   unlockedAt: new Date().toISOString(),
   url: result.url,
  };
  writeUnlock(record);
  setUnlocked(record);

  // Fire the lead capture without blocking the unlock UX. It never throws;
  // local fallback first, then a best-effort server save.
  void captureLead(buildLead(result, clean));
 };

 const handleDownload = () => {
  setDownloading(true);
  try {
   downloadAuditReport(result);
  } finally {
   // Allow a beat for the browser to pick up the download before restoring.
   window.setTimeout(() => setDownloading(false), 600);
  }
 };

 if (!hydrated) return null;

 return (
  <div
   id="report-gate"
   className="mt-10 overflow-hidden rounded-xl border border-hairline bg-[#2A2320]/50 backdrop-blur-md"
  >
   <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
    <div className="max-w-xl">
     <span className="chip border-ember/40 text-ember">PDF Report</span>
     <h4 className="mt-3 text-lg font-bold tracking-tight text-ink sm:text-xl">
      {unlocked
       ? "Your 4-page PDF Audit Report is ready"
       : "Get the full 4-page PDF Audit Report"}
     </h4>
     <p className="mt-2 text-sm leading-relaxed text-mist">
      {unlocked ? (
       <>
        Cover score page, the 9-parameter scorecard, before/after gap
        rewrites, and a next-steps plan, as a print-ready PDF.
       </>
      ) : (
       <>
        Everything the dashboard shows, packaged for your team and your
        investors: cover with your overall score, the color-coded
        scorecard, before/after gap rewrites, and a next-steps plan.
       </>
      )}
     </p>
     {!unlocked && (
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-mist">
       {[
        "Cover page with overall score & risk label",
        "9-parameter scorecard, color-coded",
        "Top-3 gap rewrites (before / after)",
        "Next-steps plan: Sprint & Fractional GTM Lead",
       ].map((f) => (
        <li key={f} className="flex items-start gap-2">
         <svg
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-ember"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
         >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
         </svg>
         {f}
        </li>
       ))}
      </ul>
     )}
    </div>

    <div className="w-full max-w-sm shrink-0">
     {unlocked ? (
      <div className="flex flex-col gap-3">
       <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="btn-electric w-full"
       >
        <svg
         aria-hidden="true"
         className="h-4 w-4"
         fill="none"
         viewBox="0 0 24 24"
         stroke="currentColor"
         strokeWidth={2}
        >
         <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4"
         />
        </svg>
        {downloading ? "Preparing PDF…" : "Download PDF Report (4 pages)"}
       </button>
       <p className="text-center text-xs text-fog">
        Downloads instantly as a PDF · nothing is emailed
       </p>
      </div>
     ) : (
      <form onSubmit={handleUnlock} noValidate className="flex flex-col gap-3">
       <label htmlFor="gate-email" className="field-label">
        Work email <span className="text-ember">*</span>
       </label>
       <input
        id="gate-email"
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="founder@yourcompany.com"
        autoComplete="email"
        className="field-input"
        aria-describedby={error ? "gate-error" : undefined}
       />
       {error && (
        <p
         id="gate-error"
         role="alert"
         className="rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ember"
        >
         {error}
        </p>
       )}
       <button type="submit" className="btn-electric w-full">
        Unlock Full Report
       </button>
       <p className="text-center text-xs text-fog">
        Downloads instantly · Nothing is emailed
       </p>
      </form>
     )}
    </div>
   </div>
  </div>
 );
}
