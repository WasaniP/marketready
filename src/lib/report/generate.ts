/**
 * MarketReady 4-page PDF audit report (client-side, jsPDF).
 *
 * Light print theme on purpose: users print / share these. The surrounding
 * site stays dark obsidian; only the generated PDF is light.
 *
 * Pages:
 *  1. Cover: wordmark, title, assessed URL, overall score + risk label, meta.
 *  2. Scorecard: all 9 parameters with status colors (#10B981 / #F59E0B / #EF4444).
 *  3. Top-3 critical gaps: before/after rewrites.
 *  4. Next steps: Sprint offer, Fractional GTM Lead, in-app booking CTA.
 *
 * The report is delivered as an instant download; nothing is ever emailed
 * (the business has no email capability).
 */

import { jsPDF } from "jspdf";
import type { AuditResult } from "~/lib/audit/types";
import { scoreColor } from "~/lib/audit/engine";

/* ------------------------------------------------------------------ */
/* Palette (light print theme)                                         */
/* ------------------------------------------------------------------ */

const ELECTRIC = "#14B8A6"; /* Electric Teal primary accent */
const INDIGO = "#6366F1"; /* Soft Indigo secondary accent */
const INK = "#0F172A";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const BORDER = "#E2E8F0";
const TINT = "#F8FAFC";
const WHITE = "#FFFFFF";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";
const RED = "#EF4444";

const STATUS_TINT: Record<string, string> = {
  "CRITICAL GAP": "#FEF2F2",
  "NEEDS REFINEMENT": "#FFFBEB",
  STRONG: "#ECFDF5",
  // legacy keys kept so old cached statuses still render
  SOLID: "#ECFDF5",
  "NEEDS WORK": "#FFFBEB",
};
const STATUS_COLOR: Record<string, string> = {
  "CRITICAL GAP": RED,
  "NEEDS REFINEMENT": AMBER,
  STRONG: EMERALD,
  // legacy keys kept so old cached statuses still render
  SOLID: EMERALD,
  "NEEDS WORK": AMBER,
};

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

/* ------------------------------------------------------------------ */
/* Small drawing helpers                                               */
/* ------------------------------------------------------------------ */

function brandHeader(doc: jsPDF) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text("MarketReady", MARGIN, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(FAINT);
  doc.text("Market Readiness Audit", PAGE_W - MARGIN, 56, { align: "right" });
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 66, PAGE_W - MARGIN, 66);
}

function pageFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, PAGE_H - 46, PAGE_W - MARGIN, PAGE_H - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(FAINT);
    doc.text("MarketReady · Market Readiness Audit Report", MARGIN, PAGE_H - 30);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 30, { align: "right" });
  }
}

/** Draw wrapped text starting at (x, y); returns the next baseline y. */
function wrapText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function statusChip(doc: jsPDF, status: string, rightX: number, y: number) {
  const color = STATUS_COLOR[status] ?? MUTED;
  const tint = STATUS_TINT[status] ?? TINT;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const w = doc.getTextWidth(status) + 16;
  doc.setFillColor(tint);
  doc.setDrawColor(color);
  doc.setLineWidth(0.7);
  doc.roundedRect(rightX - w, y, w, 16, 8, 8, "FD");
  doc.setTextColor(color);
  doc.text(status, rightX - w / 2, y + 11, { align: "center" });
  return w;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function sanitizeFilename(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    return host || "assessment";
  } catch {
    return "assessment";
  }
}

/* ------------------------------------------------------------------ */
/* Page builders                                                       */
/* ------------------------------------------------------------------ */

function pageCover(doc: jsPDF, result: AuditResult) {
  // Wordmark
  doc.setFillColor(ELECTRIC);
  doc.roundedRect(MARGIN, 50, 38, 38, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(WHITE);
  doc.text("MR", MARGIN + 19, 75, { align: "center" });
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text("MarketReady", MARGIN + 52, 76);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(INK);
  doc.text("Market Readiness Audit Report", MARGIN, 160);

  // Assessed URL
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text("Prepared for", MARGIN, 188);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK);
  const urlLines = doc.splitTextToSize(result.url, CONTENT_W) as string[];
  doc.text(urlLines[0], MARGIN, 206);
  let urlEnd = 206;
  if (urlLines.length > 1) {
    doc.setFontSize(11);
    for (let i = 1; i < urlLines.length; i++) {
      urlEnd += 15;
      doc.text(urlLines[i], MARGIN, urlEnd);
    }
  }

  // Big score
  const scoreColorHex = scoreColor(result.overall);
  const scoreY = 300;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INDIGO);
  doc.text("OVERALL MARKET READINESS", PAGE_W / 2, scoreY, { align: "center" });
  doc.setFontSize(84);
  doc.setTextColor(scoreColorHex);
  doc.text(String(result.overall), PAGE_W / 2 - 30, scoreY + 96, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(FAINT);
  doc.text("/100", PAGE_W / 2 + 24, scoreY + 88);
  // Risk chip
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const chipLabel = result.riskLabel;
  const chipW = doc.getTextWidth(chipLabel) + 32;
  doc.setFillColor(WHITE);
  doc.setDrawColor(scoreColorHex);
  doc.setLineWidth(1.2);
  doc.roundedRect(PAGE_W / 2 - chipW / 2, scoreY + 116, chipW, 30, 15, 15, "FD");
  doc.setTextColor(scoreColorHex);
  doc.text(chipLabel, PAGE_W / 2, scoreY + 136, { align: "center" });

  // Meta panel
  const metaY = scoreY + 176;
  doc.setFillColor(TINT);
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, metaY, CONTENT_W, 168, 12, 12, "FD");
  const rows: Array<[string, string]> = [
    ["Business model", result.businessModel || "Not specified"],
    ["Launch stage", result.launchStage || "Not specified"],
    ["Target ICP", result.icp.trim() || "Not specified"],
    ["Report generated", formatDate(result.generatedAt)],
  ];
  rows.forEach(([label, value], i) => {
    const y = metaY + 34 + i * 36;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED);
    doc.text(label, MARGIN + 24, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    const vLines = doc.splitTextToSize(value, CONTENT_W - 210) as string[];
    doc.text(vLines[0], MARGIN + 160, y);
    if (vLines.length > 1) {
      for (let j = 1; j < vLines.length; j++) {
        doc.setFontSize(9.5);
        doc.text(vLines[j], MARGIN + 160, y + j * 13);
      }
    }
  });

  // Footnote
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(FAINT);
  wrapText(
    doc,
    "Automated snapshot assessment generated by the MarketReady diagnostic engine. Scores are representative estimates across 9 positioning & GTM parameters, not a live site crawl.",
    MARGIN,
    806,
    CONTENT_W,
    12,
  );
}

function pageScorecard(doc: jsPDF, result: AuditResult) {
  doc.addPage();
  brandHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INDIGO);
  doc.text("Parameter Scorecard", MARGIN, 104);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text("Six scored PMM parameters plus the two reserved (GTM, Launch) covered in the MarketReady Audit.", MARGIN, 122);

  let y = 148;
  for (const p of result.parameters) {
    if (p.locked) {
      // Reserved parameter: render an honest locked note, not a fabricated score.
      doc.setFillColor(TINT);
      doc.setDrawColor(BORDER);
      doc.setLineWidth(0.8);
      doc.roundedRect(MARGIN, y, CONTENT_W, 56, 9, 9, "FD");
      doc.setFillColor(AMBER);
      doc.roundedRect(MARGIN, y, 5, 56, 2.5, 2.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(INK);
      doc.text(`${p.name} (reserved)`, MARGIN + 20, y + 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED);
      const lockLines = doc.splitTextToSize(
        "Reserved for the MarketReady Audit.",
        390,
      ) as string[];
      lockLines.forEach((line, i) => {
        doc.text(line, MARGIN + 20, y + 36 + i * 11);
      });
      y += 64;
      continue;
    }
    const status = p.status ?? "NEEDS REFINEMENT";
    const color = STATUS_COLOR[status] ?? p.color ?? MUTED;
    const tint = STATUS_TINT[status] ?? TINT;

    doc.setFillColor(tint);
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.8);
    doc.roundedRect(MARGIN, y, CONTENT_W, 56, 9, 9, "FD");
    // Left accent bar
    doc.setFillColor(color);
    doc.roundedRect(MARGIN, y, 5, 56, 2.5, 2.5, "F");

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text(p.name, MARGIN + 20, y + 22);

    // Status chip (top right)
    statusChip(doc, status, PAGE_W - MARGIN - 14, y + 10);

    // Score (bottom right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(color);
    doc.text(String(p.score ?? 0), PAGE_W - MARGIN - 46, y + 42, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(FAINT);
    doc.text("/100", PAGE_W - MARGIN - 14, y + 42, { align: "right" });

    // Diagnostic
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    const diagLines = doc.splitTextToSize(p.diagnostic, 390) as string[];
    diagLines.forEach((line, i) => {
      doc.text(line, MARGIN + 20, y + 36 + i * 11);
    });

    y += 64;
  }
}

function pageGaps(doc: jsPDF, result: AuditResult) {
  doc.addPage();
  brandHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INDIGO);
  doc.text("Top 3 Critical Gaps", MARGIN, 104);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text("The three lowest-scoring parameters, with the rewrite that fixes each one.", MARGIN, 122);

  let y = 150;
  result.topGaps.forEach((gap, i) => {
    const status = gap.status ?? "NEEDS REFINEMENT";
    const color = STATUS_COLOR[status] ?? gap.color ?? MUTED;

    // Rank badge
    doc.setFillColor("#FEF2F2");
    doc.setDrawColor(RED);
    doc.setLineWidth(0.8);
    doc.circle(MARGIN + 12, y + 12, 12, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(RED);
    doc.text(String(i + 1), MARGIN + 12, y + 16, { align: "center" });

    // Name + score
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(gap.name, MARGIN + 34, y + 17);
    doc.setFontSize(13);
    doc.setTextColor(color);
    doc.text(String(gap.score), PAGE_W - MARGIN - 30, y + 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(FAINT);
    doc.text("/100", PAGE_W - MARGIN - 14, y + 17, { align: "right" });

    // Before
    y += 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(RED);
    doc.text("BEFORE: WHAT THE SITE SAYS TODAY", MARGIN + 2, y);
    y += 13;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    y = wrapText(doc, `“${gap.before}”`, MARGIN + 2, y, CONTENT_W - 4, 12.5);

    // After
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(EMERALD);
    doc.text("AFTER: MARKETREADY REWRITE", MARGIN + 2, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    y = wrapText(doc, `“${gap.after}”`, MARGIN + 2, y, CONTENT_W - 4, 13);

    y += 18;
    if (i < 2) {
      doc.setDrawColor(BORDER);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 14;
    }
  });
}

function pageNextSteps(doc: jsPDF, result: AuditResult) {
  doc.addPage();
  brandHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INDIGO);
  doc.text("Your Next Steps", MARGIN, 104);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text("Turn the diagnosis into a launch-ready positioning system.", MARGIN, 122);

  // Offer cards
  const cardY = 148;
  const cardH = 236;
  const gap = 14;
  const cardW = (CONTENT_W - gap) / 2;

  const sprintCard: { name: string; headline: string; note: string; features: string[]; highlight: boolean } = {
    name: "MarketReady Sprint",
    headline: "A complete positioning system in 14 days",
    note: "Fixed scope · delivered in two weeks",
    features: [
      "Positioning architecture",
      "Homepage rewrites",
      "Core launch deck",
      "Custom AI prompt workflows",
    ],
    highlight: true,
  };
  const partnerCard: { name: string; headline: string; note: string; features: string[]; highlight: boolean } = {
    name: "Fractional GTM Lead",
    headline: "Embedded GTM execution through launch and beyond",
    note: "Ongoing engagement · milestone-based",
    features: ["Ongoing GTM execution", "Post-launch messaging optimization", "Growth advisory"],
    highlight: false,
  };

  [sprintCard, partnerCard].forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    const border = card.highlight ? ELECTRIC : BORDER;
    const fill = card.highlight ? "#F0FDFA" : TINT;
    doc.setFillColor(fill);
    doc.setDrawColor(border);
    doc.setLineWidth(card.highlight ? 1.4 : 0.8);
    doc.roundedRect(x, cardY, cardW, cardH, 12, 12, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK);
    doc.text(card.name, x + 20, cardY + 34);
    doc.setFontSize(13);
    doc.setTextColor(card.highlight ? ELECTRIC : INK);
    doc.text(card.headline, x + 20, cardY + 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    doc.text(card.note, x + 20, cardY + 76);

    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.8);
    doc.line(x + 20, cardY + 92, x + cardW - 20, cardY + 92);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    card.features.forEach((f, j) => {
      doc.setFillColor(card.highlight ? ELECTRIC : MUTED);
      doc.circle(x + 24, cardY + 112 + j * 20 - 1.5, 1.8, "F");
      doc.text(f, x + 34, cardY + 112 + j * 20);
    });
  });

  // CTA banner
  const ctaY = cardY + cardH + 26;
  doc.setFillColor(ELECTRIC);
  doc.roundedRect(MARGIN, ctaY, CONTENT_W, 64, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(WHITE);
  doc.text("Book your 14-Day Sprint on MarketReady", PAGE_W / 2, ctaY + 28, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#CCFBF1");
  doc.text("Tell us where to reach you; we'll set up your Sprint kickoff call.", PAGE_W / 2, ctaY + 46, { align: "center" });

  // Bottom note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(FAINT);
  wrapText(
    doc,
    `Report prepared by MarketReady for ${result.url} on ${formatDate(result.generatedAt)}. MarketReady audits product positioning and GTM readiness so you launch with conviction, not guesswork.`,
    MARGIN,
    806,
    CONTENT_W,
    12,
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Build the 4-page PDF document (call .save() to trigger the download). */
export function generateAuditReport(result: AuditResult): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  pageCover(doc, result);
  pageScorecard(doc, result);
  pageGaps(doc, result);
  pageNextSteps(doc, result);
  pageFooter(doc);
  return doc;
}

/** Build + download the report as a real .pdf file. */
export function downloadAuditReport(result: AuditResult): void {
  const doc = generateAuditReport(result);
  const host = sanitizeFilename(result.url);
  doc.save(`MarketReady-Audit-Report-${host}.pdf`);
}
