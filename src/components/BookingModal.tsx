/**
 * MarketReady booking modal : the "Book 14-Day Sprint" overlay.
 *
 * Replaces every external Cal.com link on the site with an in-app modal that
 * captures a lead (name, work email, company, website : all four required —
 * prefilled from the assessment when present) plus a 3-service interest
 * checklist, then posts it
 * to POST /api/booking, which writes a row to the owner's Airtable "Bookings"
 * table. Success is shown ONLY after the server confirms { ok:true }; on a
 * network failure or { ok:false } the form stays up with an inline retry
 * error. The localStorage `captureLead` copy is kept as a harmless fallback.
 * No pricing numbers appear anywhere in this modal.
 *
 * Accessibility: role="dialog" + aria-modal, ESC to close, backdrop click to
 * close, focus moved into the modal on open and restored on close, Tab focus
 * trapped inside the panel while open. SSR-safe: the component only mounts
 * while `open` is true (initial state is closed), and the localStorage prefill
 * runs in an effect, never during render.
 */

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { apiUrl } from "~/lib/apiOrigin";
import { scoreAssessment } from "~/lib/audit/engine";
import type { AssessmentInput } from "~/lib/audit/types";
import { captureLead } from "~/lib/leads";
import type { LeadPayload } from "~/lib/leads";
import {
  ASSESSMENT_STORAGE_KEY,
  BOOKED_STORAGE_KEY,
  CLIENT_ID_STORAGE_KEY,
} from "~/lib/storage";

/** The four services the booking modal lets a lead express interest in.
 * Short names (no pricing anywhere) : the checklist mirrors the nav dropdown. */
const SERVICE_OPTIONS = [
  { value: "MarketReady Diagnostic" },
  { value: "MarketReady Sprint" },
  { value: "Fractional GTM Lead" },
  { value: "MarketReady Audit" },
  { value: "Diagnostic Briefing" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function readStoredAssessment(): AssessmentInput | null {
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssessmentInput>;
    if (parsed && typeof parsed.url === "string" && parsed.url) {
      return {
        url: parsed.url,
        businessModel: parsed.businessModel ?? "",
        launchStage: parsed.launchStage ?? "",
        icp: parsed.icp ?? "",
        submittedAt: parsed.submittedAt ?? new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function BookingModal({
  open,
  onClose,
  initialService,
}: {
  open: boolean;
  onClose: () => void;
  /** Service pre-checked in the interest checklist when the modal opens
   * (passed by the pricing-tier CTAs). Seeded at mount; the parent only
   * mounts this modal while open, so every open re-seeds fresh. */
  initialService?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [serviceInterest, setServiceInterest] = useState<string[]>(() =>
    initialService ? [initialService] : [],
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"form" | "submitting" | "done">("form");

  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // When a pricing-tier CTA preselected the advisory or audit service, adapt
  // the modal's header/submit copy so it stays truthful for that offer (the
  // Sprint flow keeps its original copy verbatim).
  const isAdvisory = initialService === SERVICE_OPTIONS[2].value;
  const isAudit = initialService === SERVICE_OPTIONS[3].value;
  const isBriefing = initialService === SERVICE_OPTIONS[4].value;

  // Only mounted while `open` : run prefill / focus / scroll-lock on mount and
  // undo them all on unmount (close restores scroll + focus).
  useEffect(() => {
    if (!open) return;
    const restore = restoreFocusRef.current;
    const prevOverflow = document.body.style.overflow;

    try {
      const stored = readStoredAssessment();
      if (stored && stored.url) setWebsite(stored.url);
    } catch {
      // storage unavailable : website field stays empty
    }

    document.body.style.overflow = "hidden";
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = window.requestAnimationFrame(() => firstFieldRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      if (restore && typeof restore.focus === "function" && restore.isConnected) {
        restore.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Render gate: the overlay/backdrop must never exist in the DOM while the
  // dialog is closed. All hooks above still run unconditionally (Rules of
  // Hooks), but nothing is painted until `open` is true.
  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  const toggleService = (value: string) => {
    setServiceInterest((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanCompany = company.trim();
    const cleanWebsite = website.trim();

    if (!cleanName) {
      setError("Enter your name so we know who to reach out to.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid work email, e.g. you@yourcompany.com");
      return;
    }
    if (!cleanCompany) {
      setError("Enter your company.");
      return;
    }
    if (!cleanWebsite) {
      setError("Enter your website URL, e.g. https://yourproduct.com");
      return;
    }
    if (!isValidUrl(cleanWebsite)) {
      setError("Enter a valid website URL, e.g. https://yourproduct.com");
      return;
    }
    setError("");
    setStatus("submitting");

    // Best-effort lead capture from the stored assessment (never throws).
    const stored = readStoredAssessment();
    const scored = stored ? scoreAssessment(stored) : null;
    const payload: LeadPayload = {
      email: cleanEmail,
      url: cleanWebsite || stored?.url || "not provided",
      businessModel: stored?.businessModel ?? "",
      launchStage: stored?.launchStage ?? "",
      icp: stored?.icp ?? "",
      overall: scored?.overall ?? 0,
      riskLabel: scored?.riskLabel ?? "-",
      generatedAt: scored?.generatedAt ?? new Date().toISOString(),
      name: cleanName,
      company: cleanCompany || undefined,
      source: "booking_modal",
      serviceInterest:
        serviceInterest.length > 0 ? serviceInterest.join(", ") : undefined,
    };
    // localStorage fallback (harmless, keeps a local copy even offline).
    void captureLead(payload);

    // Server round-trip: the booking must reach the owner's Airtable
    // "Bookings" table (via POST /api/booking) before we show success —
    // posting through apiUrl() so the apex→www 308 can never drop the body.
    // Only a resolved { ok:true } flips to the success state; a network
    // failure or { ok:false } restores the form with an inline retry error.
    let saved = false;
    try {
      const res = await fetch(apiUrl("/api/booking"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          workEmail: cleanEmail,
          company: cleanCompany,
          websiteUrl: cleanWebsite,
          serviceInterest: serviceInterest.join(", "),
          source: "booking_modal",
          capturedAt: new Date().toISOString(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      saved = res.ok && data?.ok === true;
    } catch {
      saved = false;
    }

    if (!saved) {
      setStatus("form");
      setError("Something went wrong saving your request — please try again.");
      return;
    }

    // Mark the booking locally so /onboarding/success knows this visitor
    // completed a Sprint booking (gentle guard : never a block). Also mint a
    // stable client id the intake form sends with the vault payload.
    try {
      window.localStorage.setItem(BOOKED_STORAGE_KEY, new Date().toISOString());
      if (!window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)) {
        window.localStorage.setItem(
          CLIENT_ID_STORAGE_KEY,
          `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
        );
      }
    } catch {
      // storage unavailable : the booking lead itself is already captured
    }
    setStatus("done");
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop : click closes */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-2xl border border-hairline bg-[#1E293B]/50 p-6 shadow-[0_0_60px_rgba(20,184,166,0.18)] backdrop-blur-xl sm:p-8"
      >
        {status === "done" ? (
          /* ------------------------------------------------ success state */
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[#10B981]/40 bg-[#10B981]/10"
            >
              <svg
                className="h-7 w-7 text-[#10B981]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h4 className="text-xl font-bold tracking-tight text-ink">
              Request received
            </h4>
            <p className="max-w-xs text-sm leading-relaxed text-mist">
              {isAdvisory
                ? "We'll reach out to schedule your intro call."
                : isAudit
                  ? "We'll reach out to schedule your audit."
                  : isBriefing
                    ? "We'll reach out to schedule your diagnostic briefing."
                    : "We'll reach out to schedule your Sprint kickoff."}
            </p>
            <button type="button" onClick={onClose} className="btn-ghost mt-2 w-full">
              Done
            </button>
          </div>
        ) : (
          /* -------------------------------------------------------- form */
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="chip border-electric/40 text-electric">
                  {isAdvisory ? "Advisory" : isAudit ? "MarketReady Audit" : isBriefing ? "Diagnostic Briefing" : "14-Day Sprint"}
                </span>
                <h4 id="booking-modal-title" className="mt-3 text-xl font-bold tracking-tight text-ink">
                  {isAdvisory ? "Apply for Advisory Slot" : isAudit ? "Request Your MarketReady Audit" : isBriefing ? "Book a 15-Min Diagnostic Briefing" : "Book 14-Day Sprint"}
                </h4>
                <p className="mt-1 text-sm text-mist">
                  {isAdvisory
                    ? "Tell us where to reach you. We'll set up an intro call to scope the engagement."
                    : isAudit
                      ? "Tell us where to reach you. We'll set up a short call to scope the audit."
                      : isBriefing
                        ? "Tell us where to reach you. We'll set up your 15-minute diagnostic briefing."
                        : "Tell us where to reach you. We'll set up a kickoff call to scope the Sprint."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close booking dialog"
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

            <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="booking-name" className="field-label">
                  Name <span className="text-electric">*</span>
                </label>
                <input
                  ref={firstFieldRef}
                  id="booking-name"
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
                <label htmlFor="booking-email" className="field-label">
                  Work email <span className="text-electric">*</span>
                </label>
                <input
                  id="booking-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  className="field-input"
                  aria-describedby={error ? "booking-error" : undefined}
                />
              </div>
              <div>
                <label htmlFor="booking-company" className="field-label">
                  Company <span className="text-electric">*</span>
                </label>
                <input
                  id="booking-company"
                  type="text"
                  name="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme AI"
                  autoComplete="organization"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="booking-website" className="field-label">
                  Website <span className="text-electric">*</span>
                </label>
                <input
                  id="booking-website"
                  type="url"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourproduct.com"
                  autoComplete="url"
                  className="field-input"
                />
              </div>

              <fieldset>
                <legend className="field-label">
                  Which service are you interested in?{" "}
                  <span className="text-zinc-500">(optional)</span>
                </legend>
                <div className="flex flex-col gap-2">
                  {SERVICE_OPTIONS.map((s) => {
                    const checked = serviceInterest.includes(s.value);
                    return (
                      <label
                        key={s.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                          checked
                            ? "border-electric/50 bg-electric/[0.05]"
                            : "border-hairline bg-white/[0.02] hover:border-zinc-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="serviceInterest"
                          value={s.value}
                          checked={checked}
                          onChange={() => toggleService(s.value)}
                          className="h-4 w-4 shrink-0 rounded border-hairline accent-electric"
                        />
                        <span className="text-sm font-medium text-ink">{s.value}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {error && (
                <p
                  id="booking-error"
                  role="alert"
                  className="rounded-lg border border-electric/40 bg-electric/10 px-3 py-2 text-sm text-electric"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-electric w-full"
              >
                {status === "submitting"
                  ? "Sending…"
                  : isAdvisory
                    ? "Request Intro Call"
                    : isAudit
                      ? "Request Your Audit"
                      : isBriefing
                        ? "Request a Briefing"
                        : "Request Sprint Kickoff"}
              </button>
              <p className="text-center text-xs text-zinc-500">
                No payment taken here. We'll reach out to schedule your{" "}
                {isAdvisory ? "intro call" : isAudit ? "audit" : isBriefing ? "diagnostic briefing" : "Sprint kickoff"}.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
