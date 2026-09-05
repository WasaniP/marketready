/**
 * MarketReady Contact page (build #24).
 *
 * Lead form (Name, Work Email, Company, "How can we help?", interest select)
 * captured through the same `captureLead` lib the booking modal uses: source
 * "contact". Honest confirmation only: no claims that emails are sent, no
 * fabricated responses. The team follows up manually.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { captureLead } from "~/lib/leads";
import type { LeadPayload } from "~/lib/leads";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact: MarketReady" },
      {
        name: "description",
        content:
          "Get in touch with MarketReady for questions, Sprint interest, or a quick intro call with a GTM strategist.",
      },
    ],
  }),
  component: ContactPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Interest options for the contact form (short labels per the owner spec). */
const INTEREST_OPTIONS = ["Diagnostic", "Sprint", "Advisory", "Other"] as const;

function ContactPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [interest, setInterest] = useState<string>("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"form" | "submitting" | "done">("form");
  const closeBooking = () => setBookingOpen(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanCompany = company.trim();
    const cleanMessage = message.trim();

    if (!cleanName) {
      setError("Enter your name so we know who to reach out to.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid work email, e.g. you@yourcompany.com");
      return;
    }
    if (!cleanMessage) {
      setError("Tell us a little about what you need.");
      return;
    }
    setError("");
    setStatus("submitting");

    const payload: LeadPayload = {
      email: cleanEmail,
      url: "not provided",
      businessModel: "",
      launchStage: "",
      icp: "",
      overall: 0,
      riskLabel: "-",
      generatedAt: new Date().toISOString(),
      name: cleanName,
      company: cleanCompany || undefined,
      source: "contact",
      serviceInterest: interest ? `Contact: ${interest}` : undefined,
      message: cleanMessage,
    };
    void captureLead(payload);
    setStatus("done");
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        <section className="relative overflow-hidden border-b border-hairline bg-[#0F172A] px-5 pb-12 pt-32 sm:px-8 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-electric/[0.07] blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <span className="chip border-electric/40 text-electric">Contact</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Talk to the MarketReady team
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-mist sm:text-base">
              Questions about the Sprint, the advisory, or your score? Send a
              message. A real human follows up.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-xl">
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
                <h2 className="text-xl font-bold tracking-tight text-ink">
                  Thanks. We received your message and will follow up shortly.
                </h2>
                <p className="text-sm leading-relaxed text-mist">
                  In the meantime, the assessment takes two minutes and tells
                  you exactly where your go-to-market leaks.
                </p>
                <a href="/assessment" className="btn-electric mt-2 w-full">
                  Meanwhile, run your free score →
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="glass-card flex flex-col gap-4 p-6 sm:p-8">
                <div>
                  <label htmlFor="contact-name" className="field-label">
                    Name <span className="text-electric">*</span>
                  </label>
                  <input
                    id="contact-name"
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
                  <label htmlFor="contact-email" className="field-label">
                    Work Email <span className="text-electric">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    autoComplete="email"
                    className="field-input"
                    aria-describedby={error ? "contact-error" : undefined}
                  />
                </div>
                <div>
                  <label htmlFor="contact-company" className="field-label">
                    Company <span className="text-zinc-500">(optional)</span>
                  </label>
                  <input
                    id="contact-company"
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
                  <label htmlFor="contact-interest" className="field-label">
                    What are you interested in?{" "}
                    <span className="text-zinc-500">(optional)</span>
                  </label>
                  <select
                    id="contact-interest"
                    name="interest"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="field-input"
                  >
                    <option value="">Select an option…</option>
                    {INTEREST_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="contact-message" className="field-label">
                    How can we help? <span className="text-electric">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your product, your launch stage, and what you're trying to fix…"
                    rows={5}
                    className="field-input resize-y"
                  />
                </div>

                {error && (
                  <p
                    id="contact-error"
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
                  {status === "submitting" ? "Sending…" : "Send Message"}
                </button>
                <p className="text-center text-xs text-zinc-500">
                  We reply to every message, usually within one business day.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer onBook={() => setBookingOpen(true)} />
      {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
    </div>
  );
}
