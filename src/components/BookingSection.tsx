/**
 * MarketReady booking strip: a slim, non-priced CTA that opens the in-app
 * Sprint booking modal (see BookingModal.tsx).
 *
 * Replaces the old booking card that quoted dollar figures: the owner rule is
 * no pricing numbers anywhere, so this section describes the Sprint's
 * deliverables qualitatively and hands off to the modal for lead capture.
 */

const SPRINT_DELIVERABLES = [
  "Positioning architecture",
  "Homepage rewrites",
  "Core launch deck",
  "Custom AI prompt workflows",
];

export function BookingSection({ onBookSprint }: { onBookSprint: () => void }) {
  return (
    <section id="book-sprint" className="mt-10 scroll-mt-24" aria-label="Book the 14-day sprint">
      <div className="overflow-hidden rounded-xl border border-electric/30 bg-electric/[0.05] p-6 shadow-[0_0_40px_rgba(20,184,166,0.10)] sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="chip border-electric/40 text-electric">14-Day Sprint</span>
            <h4 className="mt-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Fix the gaps in 14 days
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-mist sm:text-base">
              Your audit just named the three gaps costing you conversion. The Sprint turns that
              diagnosis into a complete positioning system: the category frame, messaging,
              homepage, and launch assets you'd otherwise spend months figuring out yourself.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {SPRINT_DELIVERABLES.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-mist">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-electric"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={onBookSprint} className="btn-electric w-full shrink-0 sm:w-auto">
            Book 14-Day Sprint
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
