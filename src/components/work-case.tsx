/**
 * Shared case-study page blueprint for the four /work/* subpages.
 *
 * Light section system: #F2ECE2 page background with a 22px #E3DAC9 grid
 * overlay at 70% opacity, #FAF8F5 bracketed panels (2px #A8502F 12px L
 * brackets, top-left + bottom-right), mono system labels, serif headlines.
 * All styles are scoped under `.work-case-page` / `.work-case-*` in app.css.
 *
 * Body copy is PLACEHOLDER for the owner to replace — no real case details
 * are invented here.
 */
import { WORK_CASES, workCaseNeighbors, type WorkCase } from "~/lib/work/cases";

const BODY_SECTIONS = [
  {
    heading: "The situation",
    prompt:
      "[Owner to write: 2–3 sentences on the starting point — what the business looked like before this work, and what was at stake.]",
  },
  {
    heading: "What I did",
    prompt:
      "[Owner to write: 3–5 sentences on the positioning and GTM program — what was diagnosed, what was rebuilt, and how it was rolled out.]",
  },
  {
    heading: "The result",
    prompt:
      "[Owner to write: 2–3 sentences connecting the work above to the headline numbers — what moved, and why it mattered to the business.]",
  },
] as const;

export function WorkCasePage({ data }: { data: WorkCase }) {
  const index = WORK_CASES.findIndex((c) => c.slug === data.slug);
  const { prev, next } = workCaseNeighbors(index === -1 ? 0 : index);
  const stripMetrics = [
    { value: data.headline, label: data.headlineLabel },
    ...data.metrics,
  ];
  return (
    <div className="work-case-page">
      {/* Grid overlay across the whole page */}
      <svg
        aria-hidden="true"
        className="work-case-grid"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`work-case-grid-${data.slug}`}
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 22 0 L 0 0 0 22"
              fill="none"
              stroke="#E3DAC9"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#work-case-grid-${data.slug})`} />
      </svg>
      <div className="work-case-content">
        {/* Breadcrumb */}
        <p className="work-case-crumb">
          <a href="/#selected-work">SELECTED WORK</a>
          <span aria-hidden="true"> / </span>
          <span>CASE {data.num}</span>
        </p>
        {/* Sector + headline */}
        <p className="work-case-sector">{data.caseLabel}</p>
        <h1 className="work-case-headline">{data.headline}</h1>
        {/* Metrics strip: headline + three row metrics */}
        <div className="work-case-strip">
          {stripMetrics.map((m) => (
            <div key={m.label} className="work-case-strip-metric">
              <p className="work-case-strip-value">{m.value}</p>
              <p className="work-case-strip-label">{m.label}</p>
            </div>
          ))}
        </div>
        {/* Body sections (owner placeholder copy) */}
        {BODY_SECTIONS.map((s) => (
          <section key={s.heading} className="work-case-body-section">
            <h3 className="work-case-body-heading">{s.heading}</h3>
            <p className="work-case-body-placeholder">
              <em>{s.prompt}</em>
            </p>
          </section>
        ))}
        {/* Prev / next (circular) */}
        <nav className="work-case-pager" aria-label="More case studies">
          <a
            href={`/work/${prev.slug}`}
            className="work-case-pager-link"
          >
            ← CASE {prev.num} · {prev.sector}
          </a>
          <a
            href={`/work/${next.slug}`}
            className="work-case-pager-link"
          >
            CASE {next.num} · {next.sector} →
          </a>
        </nav>
      </div>
      {/* CTA block: dark panel, primary diagnostic funnel */}
      <div className="work-case-cta-wrap">
        <div className="work-case-cta">
          <h2 className="work-case-cta-heading">
            Wondering where your positioning is leaking?
          </h2>
          <p className="work-case-cta-body">
            Run the free diagnostic and get a scored read on your
            positioning and GTM readiness.
          </p>
          <a href="/assessment" className="btn-electric work-case-cta-btn">
            Get Your MarketReady Score →
          </a>
        </div>
      </div>
    </div>
  );
}
