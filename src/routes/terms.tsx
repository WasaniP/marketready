/**
 * MarketReady Terms page (build #24).
 *
 * Productized-services terms covering the owner-specified points verbatim in
 * meaning: the 14-day Sprint timeline begins once the onboarding intake is
 * submitted; single 100% upfront payment, non-refundable once work commences;
 * liability capped at the fee paid. Plus minimal, honest boilerplate (scope,
 * client responsibilities, IP, governing law, State of California). No
 * pricing figures appear here (pricing surfaces only on /assessment/results).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms: MarketReady" },
      {
        name: "description",
        content:
          "MarketReady Productized Services Terms & Scope Agreement: engagement timeline, payment, intellectual property, liability, and governing law.",
      },
    ],
  }),
  component: TermsPage,
});

/** Section wrapper for a clean, readable 720px terms column. */
function TermSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight text-ink">
        <span className="mr-2 text-electric">{n}.</span>
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-mist sm:text-base">
        {children}
      </div>
    </section>
  );
}

function TermsPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const closeBooking = () => setBookingOpen(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        <section className="relative overflow-hidden border-b border-hairline bg-[#0F172A] px-5 pb-12 pt-32 sm:px-8 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-electric/[0.07] blur-3xl"
          />
          <div className="relative mx-auto max-w-[720px]">
            <span className="chip border-electric/40 text-electric">Terms</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              MarketReady Productized Services Terms &amp; Scope Agreement
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Last updated August 2026. Plain-language terms for our productized
              services, no fine print games.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <article className="mx-auto max-w-[720px]">
            <p className="text-sm leading-relaxed text-mist sm:text-base">
              These terms govern engagements with MarketReady Strategy Group
              ("MarketReady," "we," "us"). By booking a service, or by
              submitting an onboarding intake, you ("Client") agree to them.
              They're written to be readable, not to hide anything.
            </p>

            <TermSection n="1" title="Scope of Services">
              <p>
                MarketReady provides productized go-to-market services: the
                MarketReady Diagnostic (a positioning and GTM readiness audit),
                the 14-Day Positioning Sprint (positioning architecture,
                messaging, and launch assets), and Fractional GTM Lead
                (ongoing fractional GTM support). The specific deliverables for
                your engagement are confirmed at kickoff.
              </p>
            </TermSection>

            <TermSection n="2" title="Engagement Timeline">
              <p>
                The 14-Day Positioning Sprint timeline begins once the
                onboarding intake is submitted. The countdown is dependent on
                intake submission. The clock starts when we receive your
                completed intake, not before. Advisory engagements run on a
                month-to-month basis from the agreed start date.
              </p>
            </TermSection>

            <TermSection n="3" title="Payment">
              <p>
                Services are billed as a single 100% upfront payment, due at
                the start of the engagement. Payment is non-refundable once
                work commences. We don't take payment on this site yet. Your
                booking request is confirmed by our team before any invoice is
                issued.
              </p>
            </TermSection>

            <TermSection n="4" title="Client Responsibilities">
              <p>
                You'll provide the materials and access needed to do the work, including
                website access where relevant, brand and product information,
                competitor context, and timely feedback at each checkpoint.
                Delays in providing these may shift deliverable dates within
                the engagement.
              </p>
            </TermSection>

            <TermSection n="5" title="Intellectual Property">
              <p>
                Upon full payment, the deliverables produced specifically for
                your engagement are yours to use for your business. MarketReady
                retains ownership of its underlying methodologies, frameworks,
                and prior tools, which we license to you for use with your
                deliverables.
              </p>
            </TermSection>

            <TermSection n="6" title="Liability">
              <p>
                To the fullest extent permitted by law, MarketReady's total
                liability for any claim arising out of or relating to an
                engagement is capped at the fee paid for that engagement.
                Neither party is liable for indirect, incidental, or
                consequential damages.
              </p>
            </TermSection>

            <TermSection n="7" title="Governing Law">
              <p>
                These terms are governed by the laws of the State of California,
                without regard to conflict-of-law principles. Any disputes are
                subject to the exclusive jurisdiction of the state and federal
                courts located in California.
              </p>
            </TermSection>

            <div className="mt-10 rounded-xl border border-hairline bg-white/[0.02] p-5 text-sm leading-relaxed text-mist">
              <p>
                Questions about these terms? Reach out through the{" "}
                <a href="/contact" className="font-semibold text-electric transition-colors hover:text-ink">
                  contact page
                </a>
                , or{" "}
                <a href="/assessment" className="font-semibold text-electric transition-colors hover:text-ink">
                  run your MarketReady score →
                </a>{" "}
                to see where your go-to-market stands.
              </p>
            </div>
          </article>
        </section>
      </main>
      <Footer onBook={() => setBookingOpen(true)} />
      {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
    </div>
  );
}
