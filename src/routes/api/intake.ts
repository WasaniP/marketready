/**
 * POST /api/intake: the onboarding intake vault endpoint (build #24).
 *
 * Accepts the intake form payload from /onboarding/success as JSON and saves it
 * best-effort, two layers (same philosophy as src/lib/leads.ts):
 *   1. When DATABASE_URL (Neon) is connected → insert into an `intakes` table
 *      (created lazily via CREATE TABLE IF NOT EXISTS).
 *   2. Otherwise → append one JSON line per intake to `.data/intakes.jsonl`
 *      next to the site (server-side, so data survives restarts and is never
 *      lost to a missing database).
 * Always returns { ok: true } on a valid payload. The client shows its
 * confirmation optimistically. 400 only when required fields are missing.
 * No email is ever sent; the team follows up manually.
 */
import { createFileRoute } from "@tanstack/react-router";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

/** Fields the intake form collects (EXACTLY six, per the owner spec). */
export interface IntakePayload {
  companyName: string;
  productUrl: string;
  persona: string;
  competitors: string;
  collateralLink: string;
  loomLink: string;
  /** Lead id from the booking (localStorage `marketready:clientId`). */
  clientId: string;
  submittedAt: string;
}

/** Required for the intake to be actionable; the two share-links are optional
 * (a client may not have collateral or a Loom yet). */
const REQUIRED: Array<keyof IntakePayload> = [
  "companyName",
  "productUrl",
  "persona",
  "competitors",
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Best-effort JSONL append: never throws to the caller. */
async function appendJsonl(record: IntakePayload): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "intakes.jsonl");
  await mkdir(dir, { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

export const Route = createFileRoute("/api/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Request body must be valid JSON." },
            { status: 400 },
          );
        }
        const b = (body ?? {}) as Partial<IntakePayload>;
        const missing = REQUIRED.filter((k) => !isNonEmptyString(b[k]));
        if (missing.length > 0) {
          return Response.json(
            {
              ok: false,
              error: `Missing required field(s): ${missing.join(", ")}.`,
            },
            { status: 400 },
          );
        }
        const record: IntakePayload = {
          companyName: (b.companyName as string).trim(),
          productUrl: (b.productUrl as string).trim(),
          persona: (b.persona as string).trim(),
          competitors: (b.competitors as string).trim(),
          collateralLink: typeof b.collateralLink === "string" ? b.collateralLink.trim() : "",
          loomLink: typeof b.loomLink === "string" ? b.loomLink.trim() : "",
          clientId: typeof b.clientId === "string" ? b.clientId.trim() : "",
          submittedAt:
            typeof b.submittedAt === "string" && b.submittedAt
              ? b.submittedAt
              : new Date().toISOString(),
        };

        // Layer 1: Neon when connected. Any failure falls through to the file.
        if (process.env.DATABASE_URL) {
          try {
            const { sql } = await import("../../db");
            const db = sql();
            await db`
              CREATE TABLE IF NOT EXISTS intakes (
                id BIGSERIAL PRIMARY KEY,
                company_name TEXT NOT NULL,
                product_url TEXT NOT NULL,
                persona TEXT NOT NULL,
                competitors TEXT NOT NULL,
                collateral_link TEXT,
                loom_link TEXT,
                client_id TEXT,
                submitted_at TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
              )
            `;
            await db`
              INSERT INTO intakes (company_name, product_url, persona, competitors, collateral_link, loom_link, client_id, submitted_at)
              VALUES (${record.companyName}, ${record.productUrl}, ${record.persona}, ${record.competitors}, ${record.collateralLink || null}, ${record.loomLink || null}, ${record.clientId || null}, ${record.submittedAt})
            `;
            return Response.json({ ok: true });
          } catch (err) {
            console.warn("[intake] DB insert failed, falling back to JSONL", err);
          }
        }

        // Layer 2: JSONL file fallback (also the path when no DB is connected).
        try {
          await appendJsonl(record);
        } catch (err) {
          console.warn("[intake] JSONL append failed", err);
          return Response.json(
            { ok: false, error: "Intake could not be persisted." },
            { status: 500 },
          );
        }
        return Response.json({ ok: true });
      },
    },
  },
});
