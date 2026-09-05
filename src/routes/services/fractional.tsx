/**
 * MarketReady: Fractional GTM Lead (/services/fractional, build #43).
 *
 * Comprehensive embedded-GTM retainer page: hero, a MarketReady vs
 * Full-Time Hire vs Traditional Agency comparison table, tiered capacity
 * 'Choose Your Embedded Velocity' grid, a Full Velocity detail block, a
 * two-column fit qualification block, an upgrade-credit card, and a final CTA
 * card. Primary CTA books the retainer: booking modal with 'Fractional GTM
 * Lead' pre-selected. 0 em/en dashes anywhere (commas, colons, periods,
 * arrows, and glyphs only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import {
  ServicesChip,
  SectionHeading,
  SubPageHero,
  CheckIcon,
  XIcon,
} from "~/components/services-ui";

export const Route = createFileRoute("/services/fractional")({
  head: () => ({
    meta: [
      { title: "Fractional GTM Lead: MarketReady" },
      {
        name: "description",
        content:
          "The MarketReady Fractional GTM Lead retainer delivers senior product marketing leadership to iterate messaging, enable sales, and run continuous post-launch execution without a full-time hire.",
      },
    ],
  }),
  component: FractionalPage,
});

/* ------------------------------------------------------------------ */
/* Scroll-reveal hook (mirrors the site's IntersectionObserver pattern) */
/* ------------------------------------------------------------------ */

function useOnScreen(threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ------------------------------------------------------------------ */
/* Illustrated graphics (hand-drawn SVG, build #44).                   */
/* Teal/electric #14B8A6, indigo #6366F1, muted zinc, coral risk       */
/* tones, on the midnight bands. These replace the plain                */
/* text-and-border visual treatments, keeping every price/CTA/chip.     */
/* ------------------------------------------------------------------ */

const TEAL = "#14B8A6";
const INDIGO = "#6366F1";
const INK = "#FAFAFA";
const MIST = "#A1A1AA";
const ZINC = "#52525B";
const HAIR = "#1E293B";
const CORAL = "#FB7185";

/* ---- 1. Hero: launch trajectory ------------------------------------ */

/**
 * Dashed curved path rising left-to-right from a low "Today" start through
 * three stage markers (Pre-launch, Launch, Beyond) into the top-right.
 * Reuses the mr-path-draw dash-march (mr-gauge-sweep family) + mr-step-reveal
 * stagger on scroll into view; reduced-motion renders it static.
 */
function LaunchTrajectory() {
  const { ref, visible } = useOnScreen(0.25);
  const pathClass = visible ? "mr-path-draw" : "fr-traj-hidden";
  const reveal = (_d: number) => `${visible ? "mr-step-reveal" : "opacity-0"}`;
  return (
    <div
      ref={ref}
      className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-hairline bg-[#0B1018]/60 px-4 pb-5 pt-6 shadow-[0_0_50px_rgba(20,184,166,0.10)] sm:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-electric/[0.06] blur-3xl"
      />
      <svg viewBox="0 0 920 220" className="relative h-auto w-full" role="img" aria-label="Launch trajectory: from today's low base through Pre-launch, Launch, and Beyond">
        {/* Dashed rising path */}
        <path
          d="M 70 176 C 130 172 150 156 196 150 C 280 140 360 116 466 96 C 592 72 660 54 764 44 C 826 38 866 32 900 27"
          fill="none"
          stroke={TEAL}
          strokeOpacity="0.7"
          strokeWidth="3"
          strokeLinecap="round"
          className={pathClass}
        />
        {/* Faint under-glow of the same curve (drawn static, out of the dash
            animation so the glow never blinks) */}
        <path
          d="M 70 176 C 130 172 150 156 196 150 C 280 140 360 116 466 96 C 592 72 660 54 764 44 C 826 38 866 32 900 27"
          fill="none"
          stroke={TEAL}
          strokeOpacity="0.16"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Today start node */}
        <circle cx="70" cy="176" r="5" fill={INK} />
        <text x="78" y="180" fontSize="11" fontWeight={600} fill={MIST}>
          Today
        </text>
        {/* Stage markers on the curve: node dot + label + caption */}
        <g className={reveal(0)} style={{ animationDelay: "0.5s" }}>
          <circle cx="196" cy="150" r="9" fill={INDIGO} opacity="0.18" />
          <circle cx="196" cy="150" r="4.5" fill={INDIGO} />
          <text x="196" y="126" fontSize="13.5" fontWeight={700} fill="#A5B4FC" textAnchor="middle">
            Pre-launch
          </text>
          <text x="196" y="142" fontSize="10.5" fill={MIST} textAnchor="middle">
            Positioning set
          </text>
        </g>
        <g className={reveal(1)} style={{ animationDelay: "0.72s" }}>
          <circle cx="466" cy="96" r="12" fill={TEAL} opacity="0.16" />
          <circle cx="466" cy="96" r="6" fill={TEAL} style={{ filter: "drop-shadow(0 0 7px rgba(20,184,166,0.85))" }} />
          <text x="466" y="78" fontSize="13.5" fontWeight={700} fill={INK} textAnchor="middle">
            Launch
          </text>
          <text x="466" y="93" fontSize="10.5" fill={MIST} textAnchor="middle">
            Assets ship
          </text>
        </g>
        <g className={reveal(2)} style={{ animationDelay: "0.94s" }}>
          <circle cx="764" cy="44" r="13" fill={TEAL} opacity="0.2" />
          <circle cx="764" cy="44" r="6.5" fill={TEAL} style={{ filter: "drop-shadow(0 0 9px rgba(20,184,166,0.95))" }} />
          <text x="764" y="26" fontSize="13.5" fontWeight={700} fill={INK} textAnchor="middle">
            Beyond
          </text>
          <text x="764" y="41" fontSize="10.5" fill={MIST} textAnchor="middle">
            Compounding
          </text>
        </g>
      </svg>
      <p className="relative mt-1 text-center text-[11px] uppercase tracking-widest text-zinc-500">
        Embedded GTM execution through launch and beyond
      </p>
    </div>
  );
}

/* ---- 2. Engagement options: escalator dial (semicircular gauge) ----- */

/** Point on the top semicircle: f in [0,1], 0 = left end, 1 = right end. */
function arcPoint(cx: number, cy: number, r: number, f: number) {
  const a = Math.PI * (1 - f);
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

const DIAL_CX = 180;
const DIAL_CY = 168;
const DIAL_R = 124;
const DIAL_LEN = Math.PI * DIAL_R; /* half-circle length */

const DIAL_TICKS = [
  { f: 0.15, name: "Strategic Lead", color: ZINC, glow: "rgba(82,82,91,0.0)", font: MIST, bold: 600 },
  { f: 0.5, name: "Co-Pilot", color: INDIGO, glow: "rgba(99,102,241,0.6)", font: "#A5B4FC", bold: 700 },
  { f: 0.9, name: "Full Velocity", color: TEAL, glow: "rgba(20,184,166,0.95)", font: INK, bold: 700 },
] as const;

/**
 * Semicircular "engagement escalator": all three tiers live on ONE rising
 * arc (Strategic low, Co-Pilot mid, Full Velocity high). Same circular
 * arc + fill + glow treatment as the homepage EngineMintGauge dial, with a
 * teal sweep that draws on scroll into view.
 */
function EngagementEscalator() {
  const { ref, visible } = useOnScreen(0.3);
  const fill = DIAL_TICKS[2].f;
  return (
    <div ref={ref} className="relative mx-auto mt-10 max-w-3xl">
      {/* Halo glow behind the dial (EngineMintGauge treatment) */}
      <div
        aria-hidden="true"
        className="mr-glow-pulse absolute left-1/2 top-[26%] h-56 w-[26rem] -translate-x-1/2 rounded-full bg-[#14B8A6]/20 blur-3xl"
      />
      <svg
        viewBox="0 0 360 200"
        className="relative h-auto w-full"
        role="img"
        aria-label="Engagement escalator: Strategic Lead low, Co-Pilot mid, Full Velocity at the highest point"
      >
        {/* Track */}
        <path
          d={`M ${DIAL_CX - DIAL_R} ${DIAL_CY} A ${DIAL_R} ${DIAL_R} 0 0 1 ${DIAL_CX + DIAL_R} ${DIAL_CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        {/* Teal sweep to the Full Velocity point (draws on reveal) */}
        <path
          d={`M ${DIAL_CX - DIAL_R} ${DIAL_CY} A ${DIAL_R} ${DIAL_R} 0 0 1 ${DIAL_CX + DIAL_R} ${DIAL_CY}`}
          fill="none"
          stroke={TEAL}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${DIAL_LEN * fill} 800`}
          strokeDashoffset={visible ? 0 : DIAL_LEN * fill}
          className="mr-gauge-sweep"
          style={{ filter: "drop-shadow(0 0 9px rgba(20,184,166,0.5))", transitionDelay: visible ? "0.2s" : "0ms" }}
        />
        {/* Tier ticks */}
        {DIAL_TICKS.map((t) => {
          const p = arcPoint(DIAL_CX, DIAL_CY, DIAL_R, t.f);
          const tickScale = t.f === 0.9 ? 7 : t.f === 0.5 ? 5.5 : 4;
          const glow =
            t.f === 0.9
              ? "drop-shadow(0 0 10px rgba(20,184,166,0.95))"
              : t.f === 0.5
                ? "drop-shadow(0 0 6px rgba(99,102,241,0.6))"
                : "none";
          return (
            <g key={t.name}>
              <circle cx={p.x} cy={p.y} r={tickScale + 4} fill={t.color} opacity="0.15" />
              <circle cx={p.x} cy={p.y} r={tickScale} fill={t.color} style={{ filter: glow }} />
              {/* Leader line from tick down to the name label */}
              <path d={`M ${p.x} ${p.y + 18} L ${p.x} ${DIAL_CY + 8}`} stroke={t.color} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
              <text x={p.x} y={DIAL_CY + 24} fontSize={t.f === 0.9 ? 14.5 : 13} fontWeight={t.bold} fill={t.font} textAnchor="middle">
                {t.name}
              </text>
            </g>
          );
        })}
        {/* Low / High hint labels */}
        <text x={DIAL_CX - DIAL_R - 2} y={DIAL_CY + 42} fontSize="10.5" fill={MIST} textAnchor="end">
          Advisory
        </text>
        <text x={DIAL_CX + DIAL_R + 2} y={DIAL_CY + 42} fontSize="10.5" fill={MIST} textAnchor="start">
          Full execution
        </text>
      </svg>
    </div>
  );
}

/* ---- 3. Why Embedded: three time-to-value paths --------------------- */

/**
 * Three drawn paths from a shared "You / need" origin to a shared "Value"
 * flag: Full-Time Hire winds (Months, muted zinc), Traditional Agency
 * detours through an account-manager waypoint (Weeks, coral), MarketReady
 * runs direct (Days, teal emphasis).
 */
function TimeToValuePaths() {
  const { ref, visible } = useOnScreen(0.25);
  const step = (_d: number) => `${visible ? "mr-step-reveal" : "opacity-0"}`;
  return (
    <div ref={ref} className="relative mx-auto mt-10 max-w-4xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[30%] h-24 rounded-full bg-electric/[0.05] blur-2xl"
      />
      <svg viewBox="0 0 920 330" className="relative h-auto w-full" role="img" aria-label="Three time to value paths: Full-Time Hire takes months on a winding road, Traditional Agency takes weeks with an account manager detour, MarketReady takes days on a direct road">
        {/* Destination flag */}
        <g>
          <path d="M 856 118 L 856 150" stroke={MIST} strokeWidth="2" />
          <path d="M 856 118 L 884 122 L 856 128 Z" fill={TEAL} />
          <text x="856" y="172" fontSize="12" fontWeight={700} fill={INK} textAnchor="middle">
            Value
          </text>
        </g>

        {/* Full-Time Hire: longest, winding (muted zinc) */}
        <path
          d="M 95 150 C 175 42 250 130 330 68 C 395 22 475 128 555 66 C 620 22 705 108 775 86 L 836 146"
          fill="none"
          stroke={ZINC}
          strokeOpacity={visible ? "0.85" : "0.5"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 7"
          className="transition-opacity duration-700"
        />
        <text x="152" y="34" fontSize="13" fontWeight={600} fill="#B8B8C0" className={step(0)} style={{ animationDelay: "0.1s" }}>
          Full-Time Hire
        </text>
        <text x="152" y="50" fontSize="11" fill={MIST} className={step(0)} style={{ animationDelay: "0.1s" }}>
          Months
        </text>

        {/* Traditional Agency: medium path with account-manager detour (coral) */}
        <path
          d="M 95 150 C 150 232 170 268 236 268 C 300 268 330 258 390 258 C 500 258 560 268 640 268 C 700 268 780 210 836 150"
          fill="none"
          stroke={CORAL}
          strokeOpacity={visible ? "0.75" : "0.45"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 7"
          className="transition-opacity duration-700"
        />
        {/* Account-manager waypoint */}
        <circle cx="236" cy="268" r="10" fill={CORAL} opacity="0.14" />
        <circle cx="236" cy="268" r="5" fill={CORAL} style={{ filter: "drop-shadow(0 0 6px rgba(251,113,133,0.7))" }} />
        <circle cx="243" cy="262" r="3.4" fill="none" stroke={CORAL} strokeWidth="1.1" />
        <path d="M 237 266 a 4.4 3.2 0 0 1 6.4 0" fill="none" stroke={CORAL} strokeWidth="1.1" />
        <text x="258" y="272" fontSize="11" fill={CORAL} className={step(2)} style={{ animationDelay: "0.5s" }}>
          account manager
        </text>
        <text x="600" y="290" fontSize="13" fontWeight={600} fill="#FDA4AF" className={step(2)} style={{ animationDelay: "0.5s" }}>
          Traditional Agency
        </text>
        <text x="600" y="306" fontSize="11" fill={MIST} className={step(2)} style={{ animationDelay: "0.5s" }}>
          Weeks
        </text>

        {/* MarketReady: shortest, direct (teal emphasis) */}
        <path
          d="M 95 150 C 320 140 620 140 836 150"
          fill="none"
          stroke={TEAL}
          strokeWidth={visible ? "4" : "3"}
          strokeLinecap="round"
          className="mr-gauge-sweep"
          style={{ filter: "drop-shadow(0 0 8px rgba(20,184,166,0.55))", transition: "stroke-width 0.6s ease, opacity 0.6s ease", opacity: visible ? 1 : 0.35 }}
        />
        <path d="M 828 142 L 840 150 L 828 158 Z" fill={TEAL} />
        <text x="430" y="212" fontSize="14" fontWeight={700} fill={INK} className={step(1)} style={{ animationDelay: "0.3s" }}>
          MarketReady
        </text>
        <text x="444" y="228" fontSize="11.5" fontWeight={700} fill={TEAL} className={step(1)} style={{ animationDelay: "0.3s" }}>
          Days
        </text>

        {/* Shared origin marker */}
        <circle cx="68" cy="150" r="7" fill={INK} />
        <circle cx="68" cy="150" r="11" fill="none" stroke={HAIR} strokeWidth="1.5" />
        <text x="68" y="178" fontSize="12" fontWeight={700} fill={INK} textAnchor="middle" className={step(3)}>
          You
        </text>
        <text x="68" y="192" fontSize="10.5" fill={MIST} textAnchor="middle" className={step(3)}>
          need
        </text>
      </svg>
    </div>
  );
}

/* ---- 4. Are You A Good Fit: fork in the road ----------------------- */

const GOOD_FIT_CAPTIONS = [
  "Need senior PMM execution without the $200k+ hire",
  "Need speed, can't wait months for a senior role",
  "CMO or Founder leads strategy, you ship",
  "Coming off a Sprint or Audit, need to hold momentum",
  "Want AI-native workflows that outlast launch",
];

const NOT_FIT_CAPTIONS = [
  "Just need a monthly advisory chat",
  "Expect a junior agency team, not a senior strategist",
  "No active product or early market feedback yet",
];

/**
 * Fork in the road: one origin path splits into two branches. Teal branch
 * carries qualified visitors to the "Full Velocity" destination; coral
 * branch routes the not-yet-fit toward "Try the Sprint or Audit first".
 * The qualifying criteria live as short captions along each branch.
 */
function FitFork() {
  const { ref, visible } = useOnScreen(0.2);
  const step = (_d: number) => `${visible ? "mr-step-reveal" : "opacity-0"}`;
  const edge = (on: boolean, base: string) =>
    `${base} transition-opacity duration-1000 ${on ? "opacity-100" : "opacity-30"}`;
  return (
    <div ref={ref} className="relative mx-auto mt-12 max-w-4xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] top-4 h-40 w-[70%] rounded-full bg-electric/[0.04] blur-3xl"
      />
      <svg viewBox="0 0 960 560" className="relative h-auto w-full" role="img" aria-label="Fork in the road: qualified visitors take the teal path to Full Velocity, others take the coral path to try the Sprint or Audit first">
        {/* Origin + trunk */}
        <g className={step(0)}>
          <circle cx="70" cy="280" r="8" fill={INK} />
          <circle cx="70" cy="280" r="13" fill="none" stroke={HAIR} strokeWidth="1.5" />
          <text x="70" y="322" fontSize="12.5" fontWeight={700} fill={INK} textAnchor="middle">
            You
          </text>
          <text x="70" y="338" fontSize="10.5" fill={MIST} textAnchor="middle">
            need
          </text>
        </g>
        <path d="M 92 280 C 140 280 170 280 210 280" fill="none" stroke={MIST} strokeWidth="3" strokeLinecap="round" className={edge(visible, "")} />

        {/* Split node */}
        <circle cx="210" cy="280" r="7" fill={MIST} className={step(1)} />

        {/* Teal branch: good fit, up toward Full Velocity */}
        <path
          d="M 214 278 C 258 226 300 116 356 108 C 470 94 560 92 640 90 C 700 88 736 78 762 68"
          fill="none"
          stroke={TEAL}
          strokeWidth="3.5"
          strokeLinecap="round"
          className={`mr-gauge-sweep ${visible ? "opacity-100" : "opacity-30"}`}
          style={{ filter: "drop-shadow(0 0 7px rgba(20,184,166,0.5))", strokeDasharray: visible ? undefined : "0 400", transition: "opacity 0.9s ease" }}
        />
        {/* Full Velocity destination badge */}
        <g className={step(2)}>
          <rect x="776" y="38" width="172" height="46" rx="23" fill="#0B1018" stroke={TEAL} strokeOpacity="0.55" style={{ filter: "drop-shadow(0 0 14px rgba(20,184,166,0.4))" }} />
          <path d="M 756 74 C 772 72 782 70 792 66" fill="none" stroke={TEAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" />
          <text x="862" y="68" fontSize="14.5" fontWeight={700} fill={INK} textAnchor="middle">
            Full Velocity
          </text>
        </g>
        {/* Good-fit captions along the teal branch (single clean lane below
            the branch, clear of the Full Velocity badge) */}
        {GOOD_FIT_CAPTIONS.map((c, i) => (
          <g key={c} className={step(0)}>
            <circle cx="300" cy={132 + i * 34} r="3" fill={TEAL} />
            <text x="314" y={132 + i * 34} fontSize="11.5" fill="#B6EADF" fontStyle="italic">
              {c}
            </text>
          </g>
        ))}
        <text x="302" y="52" fontSize="13" fontWeight={700} fill={INK} className={step(0)}>
          You're a good fit if you:
        </text>

        {/* Coral branch: not a fit yet, down toward Sprint/Audit */}
        <path
          d="M 214 282 C 258 336 300 466 362 474 C 470 486 560 490 640 494 C 700 496 736 500 762 508"
          fill="none"
          stroke={CORAL}
          strokeWidth="3"
          strokeLinecap="round"
          className={`transition-opacity duration-1000 ${visible ? "opacity-80" : "opacity-25"}`}
        />
        {/* Sprint-or-Audit destination badge */}
        <g className={step(3)}>
          <rect x="700" y="500" width="248" height="48" rx="24" fill="#0B1018" stroke={CORAL} strokeOpacity="0.45" style={{ filter: "drop-shadow(0 0 12px rgba(251,113,133,0.25))" }} />
          <path d="M 756 508 C 774 512 786 516 792 520" fill="none" stroke={CORAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" />
          <text x="824" y="530" fontSize="13.5" fontWeight={700} fill={INK} textAnchor="middle">
            Try the Sprint or Audit first
          </text>
        </g>
        {/* Not-fit captions above the coral lane (right of the descending
            fork, clear of the branch path) */}
        {NOT_FIT_CAPTIONS.map((c, i) => (
          <g key={c} className={step(1)}>
            <circle cx="388" cy={418 + i * 26} r="3" fill={CORAL} />
            <text x="404" y={418 + i * 26} fontSize="11.5" fill="#FECDD3" fontStyle="italic">
              {c}
            </text>
          </g>
        ))}
        <text x="302" y="398" fontSize="13" fontWeight={700} fill={INK} className={step(0)}>
          This is not for you if you:
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (indigo)                                                      */
/* ------------------------------------------------------------------ */

function CardIcon({ name, className = "h-5 w-5" }: { name: "message" | "rocket" | "spark"; className?: string }) {
  if (name === "message") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-11.6 7.14L4 21l1.86-5.4A8 8 0 1 1 21 12z" />
      </svg>
    );
  }
  if (name === "rocket") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l1.5 4.5L19 9l-4.5 1.5L13 15l-1.5-4.5L7 9l4.5-1.5L13 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17l.75 2.25L20 20l-2.25.75L17 23l-.75-2.25L14 20l2.25-.75L17 17z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Capacity bar (3 segments)                                           */
/* ------------------------------------------------------------------ */

function CapacityBar({ filled }: { filled: number }) {
  return (
    <div className="mt-4 flex gap-1.5" aria-label={`${filled} of 3 capacity segments`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i < filled ? "bg-electric shadow-[0_0_8px_rgba(20,184,166,0.6)]" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Content: Why Embedded comparison table (Section 2)                  */
/* ------------------------------------------------------------------ */

const COMPARE_ROWS = [
  {
    label: "Cost",
    fth: { text: "$180K to $220K+ base + equity", tone: "weak" },
    mr: { text: "Fraction of a full-time salary", tone: "strong" },
    ag: { text: "$8K to $15K/mo retainer, junior-staffed", tone: "weak" },
  },
  {
    label: "Time to start",
    fth: { text: "3 to 6 month hiring cycle", tone: "weak" },
    mr: { text: "Days", tone: "strong" },
    ag: { text: "2 to 4 week onboarding", tone: "ok" },
  },
  {
    label: "Seniority",
    fth: { text: "Varies by hire", tone: "weak" },
    mr: { text: "Senior operator on every task", tone: "strong" },
    ag: { text: "Junior account staff, senior oversight only", tone: "weak" },
  },
  {
    label: "Flexibility",
    fth: { text: "Fixed headcount", tone: "weak" },
    mr: { text: "Scale up/down monthly", tone: "strong" },
    ag: { text: "Locked contract terms", tone: "weak" },
  },
  {
    label: "Access",
    fth: { text: "Direct", tone: "ok" },
    mr: { text: "Direct Slack/email, no account layer", tone: "strong" },
    ag: { text: "Routed through account manager", tone: "weak" },
  },
];

function CompareLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </div>
  );
}

/** Tone: strong = MarketReady (teal hero), weak = coral x, ok = muted check. */
function CompareCell({ tone, text }: { tone: "strong" | "weak" | "ok"; text: string }) {
  const hero = tone === "strong";
  const weak = tone === "weak";
  const mark = hero ? (
    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-electric" />
  ) : weak ? (
    <XIcon className="h-3.5 w-3.5 shrink-0 text-rose-400/80" />
  ) : (
    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500/70" />
  );
  return (
    <div
      className={`flex items-center justify-center gap-2 px-3 py-4 text-center text-sm leading-snug ${
        hero ? "border-x border-electric/50 bg-electric/[0.06]" : ""
      }`}
    >
      {mark}
      <span className={hero ? "font-semibold text-teal-100" : weak ? "text-rose-200/60" : "text-zinc-400"}>
        {text}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Content: Tiered capacity (Section 3)                                */
/* ------------------------------------------------------------------ */

const TIERS = [
  {
    title: "Strategic Lead (Advisory & Reviews)",
    price: "Starting at $3,XXX/mo",
    capacity: 1,
    featured: false,
    label: "",
    items: [
      "Weekly 1:1 strategic syncs and GTM roadmap alignment",
      "Positioning reviews, launch asset teardowns, and messaging feedback",
      "Mentoring internal junior marketing hires and contractor oversight",
    ],
    tag: "Deliverable: Live Strategic Roadmap & Async Support",
  },
  {
    title: "Co-Pilot (Strategy + Targeted Execution)",
    price: "Starting at $5,XXX/mo",
    capacity: 2,
    featured: false,
    label: "",
    items: [
      "Everything in Strategic Lead, plus hands-on campaign execution",
      "High-converting sales pitch decks, 2-pagers, and homepage rewrites",
      "Setting up core AI prompt stacks for launch asset generation",
    ],
    tag: "Deliverable: Monthly GTM Sprints & Standard Workflows",
  },
  {
    title: "Embedded Fractional Lead (Full Velocity)",
    featured: true,
    label: "Full Velocity",
    price: "Starting at $7,XXX/mo",
    capacity: 3,
    items: [
      "Complete end-to-end positioning iteration and continuous post-launch execution",
      "Full launch toolkits, competitive battlecards, and win/loss analysis",
      "Advanced AI context systems and custom GTM prompt workflows",
    ],
    tag: "Deliverable: Full Launch Systems & Continuous Execution",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Content: Three core pillars (Section 3)                             */
/* ------------------------------------------------------------------ */

const DELIVERABLES = [
  {
    title: "Positioning & Messaging Iteration",
    icon: "message",
    items: [
      "Continuous messaging refinement based on real market signals & win/loss feedback",
      "Sales call teardowns & objection-handling updates",
      "Value proposition & ICP sharpening as you scale",
    ],
    tag: "Deliverable: Live Positioning Architecture & Call Teardowns",
  },
  {
    title: "Sales & Launch Enablement",
    icon: "rocket",
    items: [
      "High-converting sales pitch decks & 2-pagers",
      "Competitive battlecards & feature launch toolkits",
      "Homepage rewrites & product update campaign copy",
    ],
    tag: "Deliverable: Full Launch Assets & Sales Toolkits",
  },
  {
    title: "AI-Powered GTM Workflows & Advisory",
    icon: "spark",
    items: [
      "Custom GTM Prompt Libraries: Pre-built templates for your team to quickly generate launch posts, email sequences, and feature summaries in your exact brand voice",
      "Streamlined Research Workflows: AI-assisted systems to ingest customer calls and competitor updates into structured insights in minutes",
      "Weekly 1:1 Strategic Syncs: Direct Slack/email access and a monthly GTM Delta Scorecard to measure progress",
    ],
    tag: "Deliverable: Custom Prompt Stack & Weekly Syncs",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Content: Qualification (Section 4)                                  */
/* The qualifying criteria live as SHORT PATH CAPTIONS inside the       */
/* FitFork graphic below (GOOD_FIT_CAPTIONS / NOT_FIT_CAPTIONS), so     */
/* the old bullet arrays were absorbed there. The headings remain.      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function FractionalPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(undefined);
  const openBooking = (service: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  const applyRetainer = () => openBooking("Fractional GTM Lead");
  const bookCall = () => openBooking("Fractional GTM Lead");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#030712]">
      <Header />
      <main>
        {/* Section 1 · Hero */}
        <SubPageHero
          chip={<ServicesChip accent="indigo">Embedded GTM Retainer</ServicesChip>}
          title="Embedded GTM Execution Through Launch &amp; Beyond."
          sub="Senior product marketing leadership to iterate messaging, enable sales, and drive continuous post-launch execution without adding a $200k+ full-time headcount or a 6-month hiring ramp."
          illustration={<LaunchTrajectory />}
        >
          <button type="button" onClick={applyRetainer} className="btn-electric px-7 py-3.5 text-base">
            Apply for Retainer →
          </button>
          <button type="button" onClick={bookCall} className="btn-ghost px-7 py-3.5 text-base">
            Book Strategy Call
          </button>
        </SubPageHero>

        {/* Section 2 · MarketReady vs Full-Time Hire vs Traditional Agency */}
        <section className="border-b border-hairline bg-[#0F172A] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              chip="Why Embedded"
              accent="indigo"
              title="MarketReady vs. Full-Time Hire vs. Traditional Agency"
              sub="Senior embedded leadership, live in days, without the six-figure salary or the hiring ramp."
            />

            {/* Illustrated: three time-to-value paths */}
            <TimeToValuePaths />

            {/* Primary: marketReady centered, teal hero column */}
            <div className="mt-12 overflow-x-auto">
              <div className="mx-auto min-w-[44rem] max-w-5xl overflow-hidden rounded-2xl border border-hairline bg-[#0B1018]/60 shadow-[0_0_50px_rgba(20,184,166,0.10)]">
                {/* Header */}
                <div className="grid grid-cols-[9rem_1fr_1.15fr_1fr] items-stretch border-b border-hairline">
                  <div className="px-4 py-5" />
                  <div className="flex items-center justify-center px-3 py-5 text-center text-sm font-semibold uppercase tracking-widest text-zinc-400">
                    Full-Time Hire
                  </div>
                  <div className="relative flex items-center justify-center border-x border-electric/50 bg-electric/[0.06] px-3 py-5 text-center text-sm font-bold uppercase tracking-widest text-electric shadow-[inset_0_0_30px_rgba(20,184,166,0.08)]">
                    MarketReady
                  </div>
                  <div className="flex items-center justify-center px-3 py-5 text-center text-sm font-semibold uppercase tracking-widest text-zinc-400">
                    Traditional Agency
                  </div>
                </div>

                {/* Body rows */}
                {COMPARE_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[9rem_1fr_1.15fr_1fr] items-stretch border-b border-hairline/70 last:border-b-0"
                  >
                    <CompareLabel>{row.label}</CompareLabel>
                    <CompareCell tone={row.fth.tone} text={row.fth.text} />
                    <CompareCell tone={row.mr.tone} text={row.mr.text} />
                    <CompareCell tone={row.ag.tone} text={row.ag.text} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 · Choose Your Embedded Velocity */}
        <section className="border-b border-hairline bg-[#0F172A] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              chip="Engagement Options"
              accent="indigo"
              title="Flexible Capacity Built Around Your Growth Stage"
              sub="Select the level of embedded leadership and execution throughput your launch requires."
            />
            {/* Illustrated: single semicircular escalation dial with all three
                tiers on one rising arc */}
            <EngagementEscalator />
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {TIERS.map((tier, i) => (
                <div
                  key={tier.title}
                  className={`relative flex flex-col rounded-xl border p-7 transition-all duration-300 hover:-translate-y-0.5 ${
                    tier.featured
                      ? "border-electric/50 bg-gradient-to-b from-[#1E293B]/70 to-[#1E293B]/40 shadow-[0_0_40px_rgba(20,184,166,0.18)]"
                      : "border-hairline bg-[#1E293B]/50 shadow-[0_0_24px_rgba(99,102,241,0.12)] hover:border-zinc-600"
                  }`}
                >
                  {tier.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-electric/50 bg-[#111827] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-electric">
                      {tier.label}
                    </span>
                  )}
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      tier.featured ? "bg-electric/15 text-electric" : i === 1 ? "bg-indigo/15 text-indigo" : "bg-electric/5 text-electric"
                    }`}
                  >
                    <CardIcon name={i === 0 ? "message" : i === 1 ? "rocket" : "spark"} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold leading-tight text-ink">{tier.title}</h3>
                  <p className="mt-2 text-sm font-bold text-electric">{tier.price}</p>
                  <CapacityBar filled={tier.capacity} />
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {tier.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-mist">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 border-t border-hairline pt-4">
                    <span className="inline-block rounded-full border border-electric/40 px-3 py-1 text-xs font-medium text-electric">
                      {tier.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <p className="text-sm text-zinc-500">
                Not sure which velocity fits? Book a strategy call and we'll scope the right level
                of embedded leadership for your launch.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 · What's Included in Full Velocity */}
        <section className="border-b border-hairline bg-[#111827] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              chip="Full Velocity Detail"
              accent="indigo"
              title="What's Included in Full Velocity"
              sub="The expanded detail for the Embedded Fractional Lead (Full Velocity) tier: the full scope your embedded lead owns once engaged."
            />
            <div className="mt-12 overflow-hidden rounded-xl border border-hairline bg-[#1E293B]/50 shadow-[0_0_24px_rgba(99,102,241,0.12)] backdrop-blur-md">
              <div className="grid divide-y divide-white/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                {DELIVERABLES.map((card, i) => {
                  const isTeal = i % 2 === 0;
                  return (
                    <div key={card.title} className="flex flex-col p-7">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          isTeal ? "bg-electric/15 text-electric" : "bg-indigo/15 text-indigo"
                        }`}
                      >
                        <CardIcon name={card.icon as "message" | "rocket" | "spark"} />
                      </span>
                      <h3 className="mt-4 text-base font-semibold leading-tight text-ink">{card.title}</h3>
                      <ul className="mt-4 flex flex-col gap-2.5">
                        {card.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-mist">
                            <CheckIcon
                              className={`mt-0.5 h-4 w-4 shrink-0 ${isTeal ? "text-electric" : "text-indigo"}`}
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 border-t border-hairline pt-4">
                        <span
                          className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${
                            isTeal ? "border-electric/40 text-electric" : "border-indigo/40 text-indigo"
                          }`}
                        >
                          {card.tag}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 · Are You A Good Fit? */}
        <section className="border-b border-hairline bg-[#030712] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <SectionHeading
              chip="Qualification"
              accent="indigo"
              title="Are You A Good Fit?"
              sub="The retainer works best when there's momentum to sustain and a strategist with senior judgment to keep it compounding."
            />
            {/* Illustrated: fork in the road. The qualifying criteria become
                short captions along each branch; headings preserved. */}
            <FitFork />
          </div>
        </section>

        {/* Section 5 · Upgrade path card + final CTA card */}
        <section className="border-b border-hairline bg-[#030712] px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-electric/40 bg-electric/[0.06] p-8 text-center backdrop-blur-md shadow-[0_0_40px_rgba(20,184,166,0.12)] sm:p-10">
              <span className="inline-block rounded-full border border-electric/40 bg-electric/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-300">
                UPGRADE PATH
              </span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Zero-Risk Upgrade to Fractional GTM Lead.
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-mist">
                Completed the Sprint or Audit? 100% of your previous fee applies toward your
                first month of Fractional GTM Lead.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 · Final CTA */}
        <section className="bg-[#030712] px-5 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-2xl rounded-xl border border-indigo/30 bg-[#1E293B]/50 p-8 text-center shadow-[0_0_40px_rgba(99,102,241,0.14)] sm:p-10">
            <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Keep your GTM compounding after launch
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
              Start with the free diagnostic to see your readiness, then bring us in as your
              embedded GTM lead through launch and beyond.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={applyRetainer} className="btn-electric px-7 py-3.5 text-base">
                Apply for Retainer →
              </button>
              <a href="/assessment" className="btn-ghost px-7 py-3.5 text-base">
                Run the Free Diagnostic →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer onBook={() => openBooking("Fractional GTM Lead")} />
      {bookingOpen && (
        <BookingModal open={bookingOpen} onClose={closeBooking} initialService={preselectService} />
      )}
    </div>
  );
}
