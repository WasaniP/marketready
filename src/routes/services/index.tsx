/**
 * MarketReady /services (owner spec 2026-09-19, verbatim copy).
 *
 * The public services hub, rebuilt as a LADDER: one continuous vertical rail
 * down the left edge with three group labels (Find the gap / Close the gap /
 * Keep it closed) interrupting it, and eight offers hanging off it as FLAT
 * BANDS (no per-row border, shadow or radius : hairline rules only). Rows
 * expand in place to reveal their deliverable lists; the Audit and the GTM
 * Engine Sprint start expanded. The expand is the ONLY motion on the page.
 *
 * Design system: the shipped warm-dark tokens only (see the sv-* block in
 * styles/app.css and the comment there). No new palette, no new type.
 *
 * Links: every CTA resolves to /services/diagnostic, https://cal.com/wasani-probasco
 * or mailto:hello@getmarketready.co. The three draft offer pages
 * (/services/audit, /services/sprint, /services/fractional) are deliberately
 * NOT linked from anywhere on this page : they are noindex, disallowed in
 * robots.txt and absent from sitemap.xml.
 *
 * Note (conscious, per owner spec): the Free Diagnostic expanded line reads
 * "Automated scoring across six dimensions, two reserved for human review" :
 * kept verbatim even though the framework below counts nine parameters. The
 * 6+2-versus-9 tension is the owner's to resolve; do not "fix" the copy here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer, ChevronDown } from "~/components/Layout";

const CAL = "https://cal.com/wasani-probasco";
const MAIL = "mailto:hello@getmarketready.co";
const DIAGNOSTIC = "/services/diagnostic";

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services: MarketReady" },
      { name: "robots", content: "index, follow" },
      {
        name: "description",
        content:
          "Every MarketReady engagement, from the free diagnostic to the MarketReady Audit, the GTM Engine Sprint, a Product Launch, ghostwriting and the Fractional GTM Partner retainer. One ladder, one 9-parameter framework, one operator.",
      },
    ],
  }),
  component: ServicesPage,
});

/* ------------------------------------------------------------------ */
/* Ladder data (owner spec copy, verbatim)                             */
/* ------------------------------------------------------------------ */

type Row = {
  id: string;
  name: string;
  price: string;
  duration: string;
  line: string;
  bullets?: string[];
  /** Ghostwriting only: prose intro + nested sub-offers + add-on table. */
  extras?: boolean;
  note?: string;
  cta: { label: string; href: string };
  /** Audit + GTM Engine Sprint start expanded (owner spec). */
  openByDefault?: boolean;
};

type Group = { label: string; line: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    label: "Find the gap",
    line: "Start here if you can feel the drift but cannot name where it starts.",
    rows: [
      {
        id: "diagnostic",
        name: "Free Diagnostic Assessment",
        price: "Free",
        duration: "60 seconds",
        line: "Your public site scored across nine parameters, in under a minute.",
        bullets: [
          "Automated scoring across six dimensions, two reserved for human review",
          "Composite readiness score with the three pillar breakdowns",
          "The single highest-leverage fix, named",
          "Emailed results, no call required",
        ],
        cta: { label: "Run the free assessment →", href: DIAGNOSTIC },
      },
      {
        id: "audit",
        name: "MarketReady Audit",
        price: "$2,000",
        duration: "5 days",
        line: "A scored diagnostic of your whole go-to-market system, written up and walked through with you.",
        bullets: [
          "Nine-parameter GTM diagnostic across positioning, messaging, and launch velocity",
          "Where your message contradicts itself across the homepage, the deck, the sales narrative, and your public presence",
          "A conversion friction roadmap, ordered by leverage",
          "A sales narrative read: what your team says on calls against what the deck claims",
          "A recorded 60-minute walkthrough you can replay for your team or your board",
        ],
        note: "Credits 100% toward a GTM Engine Sprint or a Launch booked within 30 days.",
        cta: { label: "Book the Audit →", href: CAL },
        openByDefault: true,
      },
    ],
  },
  {
    label: "Close the gap",
    line: "Start here if you already know what is broken and need it built.",
    rows: [
      {
        id: "case-study",
        name: "Customer Case Study",
        price: "$2,000 each",
        duration: "10 days",
        line: "You have closed wins. None of them are written up.",
        bullets: [
          "One 45-minute interview with your customer, run by me",
          "A 1,200 to 1,800 word case study, public-ready or sales-internal",
          "A one-page executive summary your reps can hand over",
          "Three to five quotable lines pulled for the deck and the site",
          "One revision round",
        ],
        note: "Your customer sees a summary of their own quotes within 24 hours of the interview. Nobody is surprised by the final draft.",
        cta: { label: "Book a case study →", href: CAL },
      },
      {
        id: "enablement",
        name: "Sales Enablement Kit",
        price: "$4,500",
        duration: "14 days",
        line: "The materials your reps need to stop improvising.",
        bullets: [
          "Four battlecards, one per competitor: positioning, traps, three questions to ask, three objections and how to answer them",
          "Six one-pagers for post-call recap, partner enablement, and the deal room",
          "A ranked objection-handling doc, sourced from your own team",
          "A discovery question set built off your ICP",
          "Two 30-minute sales call reviews to ground all of it in real deals",
          "Two revision rounds",
        ],
        cta: { label: "Scope the kit →", href: CAL },
      },
      {
        id: "sprint",
        name: "GTM Engine Sprint",
        price: "$7,500",
        duration: "14 days",
        line: "Positioning, messaging, homepage, and sales narrative rebuilt together so they stop contradicting each other.",
        bullets: [
          "Full positioning architecture and category definition, grounded in what sales actually says on calls",
          "A three-tier messaging framework: strategic platform, value ladder, line-level claims",
          "Rewritten homepage and landing page copy, web-ready for your designer",
          "Sales deck narrative and talk track, structure and intent slide by slide",
          "A go-to-market playbook in a working format your team can edit",
        ],
        note: "Visual design stays with your team or your designer. I rewrite the narrative.",
        cta: { label: "Book the Sprint →", href: CAL },
        openByDefault: true,
      },
      {
        id: "launch",
        name: "Product Launch / Re-Launch",
        price: "From $12,000",
        duration: "60 to 90 days",
        line: "End-to-end orchestration for a major release, pivot, or new product drop.",
        bullets: [
          "Everything in the GTM Engine Sprint, produced and shipped",
          "Launch sequence and timeline with checkpoints by channel",
          "Multi-channel launch copy: announcement, blog, customer email, partner email, press, sales briefing",
          "Launch-window sales enablement and battlecards",
          "Pre-launch prep including a recorded sales team training",
          "Two weeks of post-launch war room",
        ],
        note: "A repositioning with no press or partner motion lands near $12,000. A full launch with press, partner rollout, and sales training runs higher. The fit call sets the scope.",
        cta: { label: "Scope the launch →", href: CAL },
      },
    ],
  },
  {
    label: "Keep it closed",
    line: "Ongoing work, monthly. Two different jobs, so read both.",
    rows: [
      {
        id: "ghostwriting",
        name: "Founder Ghostwriting",
        price: "From $3,500/month",
        duration: "3-month minimum",
        line: "One surface. Your executives' public voice, anchored to the positioning.",
        extras: true,
        note: "If your positioning is still moving, run the Audit first. Ghostwriting on unstable positioning produces posts that argue with what your sales team said yesterday.",
        cta: { label: "Book a kickoff call →", href: CAL },
      },
      {
        id: "fractional",
        name: "Fractional GTM Partner",
        price: "From $6,000/month",
        duration: "Retainer",
        line: "Embedded across the whole motion. Not one surface, all of them.",
        bullets: [
          "Embedded GTM leadership on your team's cadence",
          "Ongoing messaging iteration as the product and market move",
          "Sales enablement produced continuously rather than in a fixed scope",
          "Launch support for whatever ships during the engagement",
          "Direct work with your founder, product, and sales leads",
        ],
        note: "Ghostwriting covers one surface, your executives' public voice. The Fractional partnership covers the whole go-to-market motion, with that voice as one part of it. If you want both, the Fractional retainer absorbs the ghostwriting scope.",
        cta: { label: "Apply for the retainer →", href: CAL },
      },
    ],
  },
];

/* Ghostwriting expansion: intro prose, three nested sub-offers, add-on table. */
const GHOSTWRITING_INTRO = [
  "Your positioning holds on the homepage and in the deck. Then a buyer reads your LinkedIn and meets a different company. I write the posts you would have written if you had the time and the strategic frame in your head all week.",
  "Most ghostwriting is a writer reading two weeks of your old posts and guessing. I run a positioning interview first, because I already do this work for the company. The voice and the strategy get built at the same time, by the same person. Nothing publishes without your sign-off.",
];

const GHOSTWRITING_TIERS = [
  {
    name: "Pilot",
    price: "$1,500",
    duration: "30 days",
    body: "Eight posts over a month. One 60-minute intake call, one voice document, two batches for your review. No minimum term. Exists so you can see the work before you commit.",
  },
  {
    name: "Founder Retainer",
    price: "$3,500/month",
    duration: "",
    body: "Twelve long-form posts a month, one executive. Intake and voice document in week one, first batch inside ten days. One recorded 45-minute source call a month. Async approval.",
  },
  {
    name: "Leadership Retainer",
    price: "$6,500/month",
    duration: "",
    body: "Twenty posts a month across two executives, voice-managed separately. Everything in the Founder Retainer, per person. Cross-posting to X where the format fits. A 30-minute sync every two weeks.",
  },
];

const GHOSTWRITING_ADDONS = [
  { name: "Monthly newsletter draft", price: "$1,000/month" },
  { name: "Conference talk rewrite", price: "$1,500/talk" },
  { name: "Podcast guest prep doc", price: "$800/episode" },
  { name: "Ghostwritten article for an external publication", price: "$1,500/article" },
];

/* 9-Parameter Framework (owner spec copy, verbatim). */
const PILLARS = [
  {
    num: "01",
    title: "Core Positioning",
    params: ["Positioning", "ICP & Audience", "Differentiation"],
  },
  {
    num: "02",
    title: "Messaging & Value Prop",
    params: ["Hero Messaging", "Value Proposition", "Pricing & Packaging"],
  },
  {
    num: "03",
    title: "GTM & Launch Velocity",
    params: ["GTM Readiness", "Launch Readiness", "Conversion Readiness"],
  },
];

/* FAQ (owner spec copy, verbatim) : same treatment as the homepage FAQ. */
const FAQ_ITEMS = [
  {
    q: "Do you work with a team, or is it just you?",
    a: "It is just me. I lead every engagement personally. No account managers, no junior strategists, no handoffs. You work directly with the person who has done this at Amazon, Warner Bros. Discovery, and Bleacher Report, on every deliverable.",
  },
  {
    q: "Can I start anywhere, or do I have to run the Audit first?",
    a: "Start anywhere. The Audit exists for teams who cannot name what is broken. If you already know, book the work.",
  },
  {
    q: "What is the difference between ghostwriting and the fractional retainer?",
    a: "Ghostwriting is one surface: your executives' public voice. The fractional retainer is the whole go-to-market motion, with that voice as one piece of it. If you want both, the fractional retainer absorbs the ghostwriting scope.",
  },
  {
    q: "Is design included?",
    a: "No. I write and architect. Your designer builds. If you do not have one, I can point you at a few.",
  },
  {
    q: "What if my customer will not be named in a case study?",
    a: "I write it as a sales-internal asset with the customer anonymized. You can upgrade to public later if they come around.",
  },
  {
    q: "Do I need to book a call before we start?",
    a: "A short conversation comes first either way, because I only take on work I know I can move. If the diagnostic already shows the gaps and you are ready, we can schedule your window right away.",
  },
];

/* ------------------------------------------------------------------ */
/* Ghostwriting expansion pieces                                       */
/* ------------------------------------------------------------------ */

function GhostwritingExtras() {
  return (
    <>
      {GHOSTWRITING_INTRO.map((p) => (
        <p key={p.slice(0, 24)} className="sv-prose">
          {p}
        </p>
      ))}

      <div className="sv-sub">
        {GHOSTWRITING_TIERS.map((t) => (
          <div key={t.name} className="sv-sub-item">
            <div className="sv-sub-head">
              <span className="sv-sub-name">{t.name}</span>
              <span className="sv-sub-meta">
                {t.price}
                {t.duration ? ` · ${t.duration}` : ""}
              </span>
            </div>
            <p className="sv-sub-body">{t.body}</p>
          </div>
        ))}
      </div>

      <div className="sv-table-wrap">
        <table className="sv-table">
          <caption className="sr-only">Ghostwriting add-ons and prices</caption>
          <thead>
            <tr>
              <th scope="col">Add-on</th>
              <th scope="col">Price</th>
            </tr>
          </thead>
          <tbody>
            {GHOSTWRITING_ADDONS.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td>{a.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ladder                                                              */
/* ------------------------------------------------------------------ */

function LadderRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(Boolean(row.openByDefault));
  const panelId = `sv-panel-${row.id}`;
  const buttonId = `sv-button-${row.id}`;

  return (
    <div className="sv-row">
      <div className="sv-row-head">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="sv-toggle"
        >
          <span className="sv-main">
            <span className="sv-name">{row.name}</span>
            <span className="sv-line">{row.line}</span>
          </span>
          <span className="sv-meta">
            <span className="sv-price">{row.price}</span>
            <span className="sv-duration">{row.duration}</span>
          </span>
          <ChevronDown className={`sv-chevron ${open ? "sv-chevron-open" : ""}`} />
        </button>
        <div className="sv-cta-cell">
          <a className="btn-ghost sv-cta" href={row.cta.href}>
            {row.cta.label}
          </a>
        </div>
      </div>

      <div id={panelId} role="region" aria-labelledby={buttonId} className="sv-panel" data-open={open}>
        <div className="sv-panel-inner">
          <div className="sv-body">
            {row.extras && <GhostwritingExtras />}
            {row.bullets && (
              <ul className="sv-bullets">
                {row.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {row.note && <p className="sv-note">{row.note}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Ladder() {
  return (
    <div className="sv-ladder">
      {GROUPS.map((group) => (
        <div key={group.label} className="sv-group">
          <div className="sv-group-label-wrap">
            <h2 className="sv-group-label">{group.label}</h2>
            <p className="sv-group-line">{group.line}</p>
          </div>
          <div className="sv-rows">
            {group.rows.map((row) => (
              <div key={row.id} className="sv-row-wrap">
                <LadderRow row={row} />
                {row.id === "ghostwriting" && (
                  /*
                   * Reserved: before-and-after voice transformation block for the
                   * Founder Ghostwriting row. Deliberately EMPTY and hidden until
                   * real content exists (owner spec 2026-09-19, "LEAVE THIS EMPTY":
                   * no placeholder copy, no filler). Add the block's markup to this
                   * container and drop the `hidden` attribute when the content lands.
                   */
                  <div id="ghostwriting-voice-proof" className="sv-voice-proof" hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ServicesPage() {
  return (
    <div id="services-page" className="min-h-dvh bg-cream">
      <Header />
      <main>
        {/* HERO */}
        <section className="sv-hero">
          <div className="sv-wrap">
            <p className="eyebrow">[ SERVICES ]</p>
            <h1 className="sv-h1">
              Your strategy isn&apos;t what your deck says. It&apos;s what your customer reads.
            </h1>
            <div className="sv-lede">
              <p>
                Most B2B teams have positioning that works in the room and falls apart
                everywhere else. The homepage says one thing. The deck says another. The
                founder&apos;s LinkedIn says a third. Sales improvises the rest.
              </p>
              <p>
                I close that gap, on every surface it shows up. Every engagement runs
                through me. No account managers, no junior writers, no handoffs.
              </p>
            </div>
            <div className="sv-cta-row">
              <a className="btn-electric" href={DIAGNOSTIC}>
                Run the free diagnostic →
              </a>
              <a className="btn-ghost" href={CAL}>
                Book a 15-minute fit call →
              </a>
            </div>
          </div>
        </section>

        {/* THE LADDER */}
        <section id="ladder" className="sv-ladder-section">
          <div className="sv-wrap">
            <Ladder />
          </div>
        </section>

        {/* 9-PARAMETER FRAMEWORK */}
        <section id="framework" className="sv-framework">
          <div className="sv-wrap">
            <p className="eyebrow">[ THE FRAMEWORK ]</p>
            <h2 className="sv-h2">The 9-Parameter Framework</h2>
            <p className="sv-section-lede">
              Every service runs on the same nine dimensions, grouped into three pillars.
              From the free score to the Audit to the Sprint, the same framework keeps the
              diagnosis consistent.
            </p>
            <div className="sv-pillars">
              {PILLARS.map((p) => (
                <div key={p.num} className="sv-pillar">
                  <p className="sv-pillar-num">Pillar {p.num}</p>
                  <h3 className="sv-pillar-title">{p.title}</h3>
                  <p className="sv-pillar-params">{p.params.join(" · ")}</p>
                </div>
              ))}
            </div>
            <p className="sv-framework-close">
              Nine diagnostics, three pillars, one composite readiness score, so every
              engagement speaks the same number.
            </p>
          </div>
        </section>

        {/* BUILT FOR / NOT FOR */}
        <section className="sv-fit">
          <div className="sv-wrap">
            <div className="sv-fit-grid">
              <div className="sv-fit-col">
                <p className="eyebrow">Built for</p>
                <p className="sv-fit-body">
                  Seed and Series A B2B SaaS and AI platforms preparing for high-stakes
                  market entry. Founders whose company sounds one way internally and reads
                  another way externally. Heads of sales who need their team armed before
                  next quarter. Marketing leads who inherited positioning that lives in a
                  deck and nowhere else.
                </p>
              </div>
              <div className="sv-fit-col">
                <p className="eyebrow">Not for</p>
                <p className="sv-fit-body">
                  Pre-MVP concepts. Traditional e-commerce storefronts. Teams who want cheap
                  agency execution. Teams who want someone running their marketing org for a
                  year, which is a different scope and price band. Anyone who wants posts
                  published in their name without reading them first.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ (homepage treatment) */}
        <section id="faq" className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-sand py-10 sm:py-12">
          <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-12">
            <div className="faq-grid">
              <div className="faq-header">
                <p className="faq-eyebrow">Questions I get asked</p>
                <h2 className="faq-headline">Frequently asked questions</h2>
                <p className="faq-intro">
                  Still unsure? Run the free diagnostic and we can talk about what it finds.
                </p>
              </div>
              <div className="faq-rows">
                {FAQ_ITEMS.map((item, i) => (
                  <FaqRow key={item.q} item={item} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CLOSE */}
        <section className="sv-close">
          <div className="sv-wrap">
            <h2 className="sv-h2">Not sure which one fits?</h2>
            <p className="sv-close-body">
              Book fifteen minutes. I will ask three questions and tell you. If the answer is
              that you do not need me yet, I will say that too.
            </p>
            <div className="sv-cta-row sv-cta-row-center">
              <a className="btn-electric" href={CAL}>
                Book a 15-minute fit call →
              </a>
              <a className="btn-ghost" href={MAIL}>
                Email me directly →
              </a>
            </div>
          </div>
        </section>
      </main>
      {/* Footer requires onBook; this page books through Cal.com, not the modal. */}
      <Footer onBook={() => undefined} />
    </div>
  );
}

/** Homepage FAQ behaviour: one panel open at a time, grid-rows height reveal. */
function FaqRow({ item, index }: { item: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `sv-faq-panel-${index}`;
  const buttonId = `sv-faq-button-${index}`;
  return (
    <div className="faq-row">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="faq-row-button"
        >
          <span className="faq-q">{item.q}</span>
          <ChevronDown className={`faq-chevron ${open ? "faq-chevron-open" : ""}`} />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="faq-a">{item.a}</p>
        </div>
      </div>
    </div>
  );
}
