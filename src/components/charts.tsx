/**
 * Hand-rolled SVG data-viz for the MarketReady results dashboard:
 *  - Gauge: 240° radial speedometer for the overall score (indigo ring,
 *    semantic risk label).
 *  - Radar: 9-axis polygon of the parameter scores (indigo strokes/fills).
 *
 * Pure SVG: no charting dependency, SSR-safe, and matches the design system
 * (midnight-slate gradient bg, hairline grid, teal/indigo accents, dynamic
 * semantic score colors).
 */

import type { ParamResult } from "~/lib/audit/types";
import { riskLabel, scoreColor } from "~/lib/audit/engine";

const INK = "#FAFAFA";
const MIST = "#A1A1AA";
const HAIRLINE = "#1E293B";
const INDIGO = "#6E9464";

/** Hex → rgba() with alpha, for tinted fills/strokes. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Radial gauge                                                        */
/* ------------------------------------------------------------------ */

const GAUGE_CX = 140;
const GAUGE_CY = 158;
const GAUGE_R = 118;
const GAUGE_SWEEP = 240; // degrees
const GAUGE_START = -120; // degrees (screen: y down)

function gaugePoint(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: GAUGE_CX + GAUGE_R * Math.sin(rad),
    y: GAUGE_CY - GAUGE_R * Math.cos(rad),
  };
}

export function Gauge({ score }: { score: number }) {
  const risk = scoreColor(score);
  const frac = Math.max(0, Math.min(100, score)) / 100;
  const p0 = gaugePoint(GAUGE_START);
  const p1 = gaugePoint(GAUGE_START + GAUGE_SWEEP);
  const track = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${GAUGE_R} ${GAUGE_R} 0 1 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  const pe = gaugePoint(GAUGE_START + GAUGE_SWEEP * frac);
  const largeArc = frac > 0.5 ? 1 : 0;
  const progress =
    score <= 0
      ? ""
      : `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} 1 ${pe.x.toFixed(2)} ${pe.y.toFixed(2)}`;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 280 210"
        className="w-full max-w-[300px]"
        role="img"
        aria-label={`Overall Market Readiness Score: ${score} out of 100`}
      >
        <path d={track} stroke={HAIRLINE} strokeWidth={16} strokeLinecap="round" fill="none" />
        {progress && (
          <path
            d={progress}
            stroke={INDIGO}
            strokeWidth={16}
            strokeLinecap="round"
            fill="none"
            style={{ filter: `drop-shadow(0 0 10px ${withAlpha(INDIGO, 0.45)})` }}
          />
        )}
        <text
          x={GAUGE_CX}
          y={GAUGE_CY - 10}
          textAnchor="middle"
          fontSize={54}
          fontWeight={800}
          fill={INK}
          style={{ letterSpacing: "-0.03em" }}
        >
          {score}
        </text>
        <text x={GAUGE_CX} y={GAUGE_CY + 22} textAnchor="middle" fontSize={13} fontWeight={500} fill={MIST}>
          out of 100
        </text>
      </svg>
      <p
        className="mt-1 text-sm font-semibold"
        style={{ color: risk }}
        aria-live="polite"
      >
        {score}/100 · {riskLabel(score)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radar chart                                                         */
/* ------------------------------------------------------------------ */

const RADAR_W = 360;
const RADAR_H = 330;
const RADAR_CX = 180;
const RADAR_CY = 160;
const RADAR_R = 102;
const RADAR_GRID = [0.25, 0.5, 0.75, 1];

/** Short axis labels (full names live on the parameter cards). */
const SHORT_LABELS: Record<string, string> = {
  positioning: "Positioning",
  icp: "ICP",
  messaging: "Messaging",
  differentiation: "Diff.",
  "value-prop": "Value Prop",
  pricing: "Pricing",
  gtm: "GTM",
  launch: "Launch",
  conversion: "Conversion",
};

export function Radar({ parameters }: { parameters: ParamResult[] }) {
  const n = parameters.length;
  const angle = (i: number): number => ((-90 + (i * 360) / n) * Math.PI) / 180;
  const point = (i: number, radius: number) => ({
    x: RADAR_CX + radius * Math.cos(angle(i)),
    y: RADAR_CY + radius * Math.sin(angle(i)),
  });
  const polygon = (frac: number) =>
    Array.from({ length: n }, (_, i) => {
      const p = point(i, RADAR_R * frac);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");

  const scorePts = parameters.map((p, i) =>
    point(i, RADAR_R * (0.04 + 0.96 * ((p.score ?? 0) / 100))),
  );

  return (
    <svg
      viewBox={`0 0 ${RADAR_W} ${RADAR_H}`}
      className="mx-auto w-full max-w-[380px]"
      role="img"
      aria-label="Radar chart of the 9 parameter scores"
    >
      {RADAR_GRID.map((frac) => (
        <polygon
          key={frac}
          points={polygon(frac)}
          fill={frac === 1 ? "rgba(201,106,66,0.25)" : "none"}
          stroke={HAIRLINE}
          strokeWidth={1}
        />
      ))}
      {parameters.map((_, i) => {
        const p = point(i, RADAR_R);
        return (
          <line
            key={`axis-${i}`}
            x1={RADAR_CX}
            y1={RADAR_CY}
            x2={p.x}
            y2={p.y}
            stroke={HAIRLINE}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        );
      })}
      <polygon
        points={scorePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill={withAlpha(INDIGO, 0.14)}
        stroke={INDIGO}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 8px ${withAlpha(INDIGO, 0.35)})` }}
      />
      {scorePts.map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill={INDIGO} />
      ))}
      {parameters.map((p, i) => {
        const a = angle(i);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const anchor = cos < -0.2 ? "end" : cos > 0.2 ? "start" : "middle";
        const dy = sin < -0.2 ? -5 : sin > 0.2 ? 15 : 5;
        const lp = point(i, RADAR_R + 20);
        return (
          <text
            key={`label-${i}`}
            x={lp.x}
            y={lp.y + dy}
            textAnchor={anchor}
            fontSize={9.5}
            fontWeight={600}
            fill={MIST}
          >
            {SHORT_LABELS[p.id] ?? p.name}
          </text>
        );
      })}
    </svg>
  );
}
