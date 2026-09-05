/**
 * MarketReady /services shared UI primitives (build #27).
 *
 * Shared by the All-Services directory and the three sub-pages
 * (diagnostic / sprint / advisory). Keeps the dark design system tokens in
 * one place: midnight bands, teal/indigo accents, glass cards, chip + h2 + sub
 * section headers, and the '← All services' back affordance.
 *
 * Dollar-free by design: none of these primitives render pricing.
 */
import type { ReactNode } from "react";

/** Teal/indigo accent chip. */
export function ServicesChip({
  children,
  accent = "electric",
}: {
  children: ReactNode;
  accent?: "electric" | "indigo";
}) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${
        accent === "electric"
          ? "border-electric/40 text-electric"
          : "border-indigo/40 text-indigo"
      }`}
    >
      {children}
    </span>
  );
}

/** Section header: chip + centered h2 + sub. */
export function SectionHeading({
  chip,
  title,
  sub,
  accent = "electric",
}: {
  chip: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  accent?: "electric" | "indigo";
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <ServicesChip accent={accent}>{chip}</ServicesChip>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-lg text-mist">{sub}</p>}
    </div>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** '← All services' back affordance for the three sub-pages. */
export function ServicesBackLink() {
  return (
    <a
      href="/services"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-electric"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l6 6m-6-6l6-6" />
      </svg>
      All services
    </a>
  );
}

/** Standard sub-page hero: back link, centered chip + H1 + sub + CTA(s). */
export function SubPageHero({
  chip,
  title,
  sub,
  stats,
  illustration,
  children,
  topPadding = "pt-20 sm:pt-24",
}: {
  chip: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  stats?: ReactNode;
  /** Optional hand-drawn illustrative strip, rendered between the subheadline
   * and the CTA buttons (used by /services/fractional's launch trajectory). */
  illustration?: ReactNode;
  children?: ReactNode;
  topPadding?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden border-b border-hairline bg-[#0F172A] px-5 pb-14 ${topPadding} sm:px-8 sm:pb-16`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-electric/[0.07] blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl">
        <ServicesBackLink />
        <div className="mt-8 text-center">
          {chip}
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            {title}
          </h1>
          {sub && <p className="mx-auto mt-4 max-w-2xl text-lg text-mist">{sub}</p>}
          {stats && <div className="mt-7 flex justify-center">{stats}</div>}
          {illustration && <div className="mt-8 flex justify-center">{illustration}</div>}
          {children && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>}
        </div>
      </div>
    </section>
  );
}
