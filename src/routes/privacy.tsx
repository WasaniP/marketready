/**
 * MarketReady Privacy Policy page (build #25).
 *
 * Minimal, honest privacy policy. It explains what we collect (name, work email,
 * assessment answers, intake data), how it's used, cookies/localStorage
 * (assessment state stored locally), retention, no selling of data, and a
 * mailto contact. No fabricated claims, no pricing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy: MarketReady" },
      {
        name: "description",
        content:
          "How MarketReady collects, uses, and protects your data: assessment answers, contact details, and intake information.",
      },
    ],
  }),
  component: PrivacyPage,
});

/** Section wrapper for a clean, readable 720px privacy column. */
function PrivacySection({
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

function PrivacyPage() {
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
            <span className="chip border-electric/40 text-electric">
              Privacy Policy
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Privacy Policy: MarketReady
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Last updated August 2026. A plain-language summary of how we
              handle the data you share with us.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <article className="mx-auto max-w-[720px]">
            <p className="text-sm leading-relaxed text-mist sm:text-base">
              MarketReady Strategy Group ("MarketReady," "we," "us") helps
              founders sharpen their positioning and go-to-market readiness.
              This policy explains what we collect, why, and how we protect it.
              It's written to be readable, not to hide anything.
            </p>

            <PrivacySection n="1" title="What We Collect">
              <p>
                When you use the site we may collect: your name and work email
                (when you request your diagnostic score or book a service),
                your assessment answers (the scores and inputs you provide in
                the diagnostic), and intake data you submit when starting an
                engagement (e.g. company name, product URL, target customer,
                competitors).
              </p>
            </PrivacySection>

            <PrivacySection n="2" title="How We Use It">
              <p>
                We use this information to provide the diagnostic and its
                results, to recommend and deliver our services, to respond to
                your enquiries, and to improve the site. We don't use your data
                for anything other than running MarketReady for you.
              </p>
            </PrivacySection>

            <PrivacySection n="3" title="Cookies &amp; Local Storage">
              <p>
                Your assessment state is stored locally in your browser (via
                browser local storage) so your progress and results persist
                across visits. We don't require tracking cookies to use the
                diagnostic. You can clear this data anytime through your
                browser settings.
              </p>
            </PrivacySection>

            <PrivacySection n="4" title="Retention">
              <p>
                We keep contact and assessment records only as long as needed
                to provide our services and meet our legal obligations. You can
                ask us to delete your data at any time.
              </p>
            </PrivacySection>

            <PrivacySection n="5" title="We Don't Sell Your Data">
              <p>
                We do not sell, rent, or trade your personal information. We
                share data with service providers only as necessary to operate
                the site and deliver our services, and never for third-party
                marketing.
              </p>
            </PrivacySection>

            <PrivacySection n="6" title="Contact">
              <p>
                Questions about this policy or your data? Email us at{" "}
                <a
                  href="mailto:hello@getmarketready.co"
                  className="font-semibold text-electric underline decoration-electric/40 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink/40"
                >
                  hello@getmarketready.co
                </a>
                .
              </p>
            </PrivacySection>

            <div className="mt-10 rounded-xl border border-hairline bg-white/[0.02] p-5 text-sm leading-relaxed text-mist">
              <p>
                Return to the{" "}
                <a
                  href="/"
                  className="font-semibold text-electric transition-colors hover:text-ink"
                >
                  homepage
                </a>
                ,{" "}
                <a
                  href="/contact"
                  className="font-semibold text-electric transition-colors hover:text-ink"
                >
                  contact us
                </a>
                , or{" "}
                <a
                  href="/services/diagnostic"
                  className="font-semibold text-electric transition-colors hover:text-ink"
                >
                  run your MarketReady score →
                </a>
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
