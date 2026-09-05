/**
 * MarketReady onboarding intake vault (build #24).
 *
 * /onboarding/success: welcome banner, next-steps checklist, and the six-field
 * intake form (Company Name, Product URL, Target Customer Persona, Top 3
 * Competitors, Collateral Upload Link, Loom Video Link). The form POSTs to
 * /api/intake (best-effort: Neon when connected, else a JSONL file server-side;
 * the client also mirrors the intake to localStorage so nothing is lost). On
 * success it shows the exact confirmation string. No email is ever claimed;
 * the team follows up manually.
 *
 * Light guard: if the visitor hasn't completed a Sprint booking (no
 * localStorage `marketready:booked` flag), a gentle notice appears above the
 * form: never a paywall, never a block.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import {
  BOOKED_STORAGE_KEY,
  CLIENT_ID_STORAGE_KEY,
  INTAKE_STORAGE_KEY,
} from "~/lib/storage";

export const Route = createFileRoute("/onboarding/success")({
  head: () => ({
    meta: [
      { title: "Onboarding: MarketReady" },
      {
        name: "description",
        content:
          "Kick off your MarketReady Sprint. Submit your onboarding intake and start the 14-day clock.",
      },
    ],
  }),
  component: OnboardingSuccess,
});

export interface IntakeForm {
  companyName: string;
  productUrl: string;
  persona: string;
  competitors: string;
  collateralLink: string;
  loomLink: string;
}

const EMPTY: IntakeForm = {
  companyName: "",
  productUrl: "",
  persona: "",
  competitors: "",
  collateralLink: "",
  loomLink: "",
};

const NEXT_STEPS = [
  {
    n: "01",
    title: "Submit your intake",
    body: "Fill in the form below. The more specific you are, the faster we can hit the ground running.",
  },
  {
    n: "02",
    title: "Kickoff call scheduled",
    body: "We'll follow up to book a short kickoff call and confirm scope for your 14 days.",
  },
  {
    n: "03",
    title: "The Sprint begins",
    body: "Your 14-day Positioning Sprint clock starts the day your intake is submitted.",
  },
];

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function OnboardingSuccess() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booked, setBooked] = useState<boolean | null>(null);
  const [form, setForm] = useState<IntakeForm>(EMPTY);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"form" | "submitting" | "done">("form");
  const [serverReached, setServerReached] = useState(true);
  const closeBooking = () => setBookingOpen(false);

  // Read the booking flag after mount only (SSR-safe). null = not yet computed.
  useEffect(() => {
    let bookedFlag = false;
    try {
      bookedFlag = !!window.localStorage.getItem(BOOKED_STORAGE_KEY);
    } catch {
      bookedFlag = false;
    }
    setBooked(bookedFlag);
  }, []);

  const set = (key: keyof IntakeForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const companyName = form.companyName.trim();
    const productUrl = form.productUrl.trim();
    const persona = form.persona.trim();
    const competitors = form.competitors.trim();

    if (!companyName) {
      setError("Enter your company name.");
      return;
    }
    if (!productUrl || !isValidHttpUrl(productUrl)) {
      setError("Enter a valid product URL, e.g. https://yourproduct.com");
      return;
    }
    if (!persona) {
      setError("Describe your target customer persona.");
      return;
    }
    if (!competitors) {
      setError("List your top 3 competitors.");
      return;
    }
    setError("");
    setStatus("submitting");

    let clientId = "";
    try {
      clientId = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY) ?? "";
    } catch {
      clientId = "";
    }

    const payload = {
      companyName,
      productUrl,
      persona,
      competitors,
      collateralLink: form.collateralLink.trim(),
      loomLink: form.loomLink.trim(),
      clientId,
      submittedAt: new Date().toISOString(),
    };

    // Local mirror first (never lose an intake), then best-effort server save.
    try {
      const raw = window.localStorage.getItem(INTAKE_STORAGE_KEY);
      const list: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
      if (Array.isArray(list)) {
        list.push(payload);
        window.localStorage.setItem(
          INTAKE_STORAGE_KEY,
          JSON.stringify(list.slice(-50)),
        );
      }
    } catch {
      // storage unavailable: the server attempt below still runs
    }

    let ok = false;
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    setServerReached(ok);
    setStatus("done");
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        {/* Welcome banner */}
        <section className="relative overflow-hidden border-b border-hairline bg-[#0F172A] px-5 pb-14 pt-32 sm:px-8 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-electric/[0.07] blur-3xl"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="chip border-electric/40 text-electric">Onboarding</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Let's make your 14 days count
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
              Welcome. A few quick details from you and we'll have everything we
              need to start the clock and kick off your Sprint.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-2xl">
            {/* Light guard: never a block */}
            {booked === false && (
              <div className="mb-6 rounded-xl border border-hairline bg-white/[0.03] p-4 text-sm leading-relaxed text-mist">
                This page is for clients who have booked a Sprint. If that's
                you, continue below; otherwise,{" "}
                <a href="/assessment" className="font-semibold text-electric transition-colors hover:text-ink">
                  run the free assessment first →
                </a>
              </div>
            )}

            {/* Next-steps checklist */}
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              {NEXT_STEPS.map((s) => (
                <div key={s.n} className="glass-card flex flex-col gap-1.5 p-5">
                  <span className="text-xs font-bold tracking-widest text-electric">{s.n}</span>
                  <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
                  <p className="text-xs leading-relaxed text-mist">{s.body}</p>
                </div>
              ))}
            </div>

            {/* Intake form / success */}
            <div className="mt-8">
              {status === "done" ? (
                <div className="glass-card flex flex-col items-center gap-4 p-8 text-center">
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
                  <h2 className="text-2xl font-bold tracking-tight text-ink">
                    Intake Received! Your 14-Day Sprint Clock Officially Begins Now.
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-mist">
                    We have everything we need to start. Our team will review
                    your materials and follow up to schedule your kickoff call.
                  </p>
                  {!serverReached && (
                    <p className="max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                      Note: we couldn't reach our server just now. Your intake
                      is saved safely and we'll collect it during kickoff.
                    </p>
                  )}
                  <a href="/" className="btn-ghost mt-2 w-full">
                    Back to home
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="glass-card flex flex-col gap-4 p-6 sm:p-8">
                  <div>
                    <label htmlFor="intake-company" className="field-label">
                      Company Name <span className="text-electric">*</span>
                    </label>
                    <input
                      id="intake-company"
                      type="text"
                      name="companyName"
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder="Acme AI"
                      className="field-input"
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label htmlFor="intake-url" className="field-label">
                      Product URL <span className="text-electric">*</span>
                    </label>
                    <input
                      id="intake-url"
                      type="url"
                      name="productUrl"
                      value={form.productUrl}
                      onChange={(e) => set("productUrl", e.target.value)}
                      placeholder="https://yourproduct.com"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="intake-persona" className="field-label">
                      Target Customer Persona <span className="text-electric">*</span>
                    </label>
                    <textarea
                      id="intake-persona"
                      name="persona"
                      value={form.persona}
                      onChange={(e) => set("persona", e.target.value)}
                      placeholder="Who buys this, what job are they hiring it for, and what's their biggest blocker today?"
                      rows={3}
                      className="field-input resize-y"
                    />
                  </div>
                  <div>
                    <label htmlFor="intake-competitors" className="field-label">
                      Top 3 Competitors <span className="text-electric">*</span>
                    </label>
                    <input
                      id="intake-competitors"
                      type="text"
                      name="competitors"
                      value={form.competitors}
                      onChange={(e) => set("competitors", e.target.value)}
                      placeholder="Rival One, Rival Two, Rival Three"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="intake-collateral" className="field-label">
                      Collateral Upload Link <span className="text-zinc-500">(optional)</span>
                    </label>
                    <input
                      id="intake-collateral"
                      type="url"
                      name="collateralLink"
                      value={form.collateralLink}
                      onChange={(e) => set("collateralLink", e.target.value)}
                      placeholder="Link to any deck, one-pager, or brand assets"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="intake-loom" className="field-label">
                      Loom Video Link <span className="text-zinc-500">(optional)</span>
                    </label>
                    <input
                      id="intake-loom"
                      type="url"
                      name="loomLink"
                      value={form.loomLink}
                      onChange={(e) => set("loomLink", e.target.value)}
                      placeholder="A quick Loom walking us through your product or pitch"
                      className="field-input"
                    />
                  </div>

                  {error && (
                    <p
                      id="intake-error"
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
                    {status === "submitting" ? "Submitting…" : "Submit Intake"}
                  </button>
                  <p className="text-center text-xs text-zinc-500">
                    Submitting this starts your 14-day Sprint timeline.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer onBook={() => setBookingOpen(true)} />
      {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
    </div>
  );
}
