/**
 * MarketReady lead capture.
 *
 * Two layers:
 *  1. Server: `saveLeadServer`: a createServerFn POST that inserts the lead
 *     into the team DB (Neon) when `process.env.DATABASE_URL` is present.
 *     Without a DB it returns `{ saved: false, reason: "no_db" }`, no crash,
 *     no scary logs. The table is created lazily (CREATE TABLE IF NOT EXISTS).
 *  2. Client: `captureLead`: fire-and-forget. Always appends the lead to the
 *     localStorage list `marketready:leads` first (fallback so a lead is never
 *     silently lost), then best-effort posts to the server. Never throws.
 */

import { createServerFn } from "@tanstack/react-start";

/** Everything we capture about a lead (DB columns + localStorage shape). */
export interface LeadPayload {
  email: string;
  url: string;
  businessModel: string;
  launchStage: string;
  icp: string;
  overall: number;
  riskLabel: string;
  generatedAt: string;
  /** Contact name, captured by the Sprint booking modal. */
  name?: string;
  /** Company: optional, captured by the Sprint booking modal. */
  company?: string;
  /** Which surface captured the lead, e.g. "report_gate" | "booking_modal". */
  source?: string;
  /** Service interest: comma-joined selection(s) from the booking modal
   * checklist, e.g. "MarketReady Sprint" or "MarketReady Diagnostic, Launch
   * Partner & Advisory". Omitted when nothing was selected. */
  serviceInterest?: string;
  /** Free-text message, captured by the /contact form ("How can we help?"). */
  message?: string;
}

/** localStorage fallback list, never relied on alone, never the source of truth. */
export const LEADS_STORAGE_KEY = "marketready:leads";
const LEADS_MAX = 100;

export type SaveLeadResult =
  | { saved: true }
  | { saved: false; reason: "no_db" | "db_error" };

/**
 * Server-side insert. Runs only on the server; the client bundle gets an RPC
 * stub. The DB helper is dynamically imported inside the handler so the neon
 * dependency never enters the client graph.
 */
export const saveLeadServer = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as LeadPayload)
  .handler(async ({ data }): Promise<SaveLeadResult> => {
    if (!process.env.DATABASE_URL) {
      // No database connected yet, degrade gracefully and log nothing loudly.
      return { saved: false, reason: "no_db" };
    }
    try {
      const { sql } = await import("../db");
      const db = sql();
      await db`
        CREATE TABLE IF NOT EXISTS leads (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          url TEXT NOT NULL,
          business_model TEXT,
          launch_stage TEXT,
          icp TEXT,
          overall INTEGER,
          risk_label TEXT,
          generated_at TEXT,
          service_interest TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Tables created by earlier builds predate `service_interest`; make sure
      // the column exists so the insert below never fails on a legacy schema.
      await db`ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_interest TEXT`;
      await db`ALTER TABLE leads ADD COLUMN IF NOT EXISTS message TEXT`;
      await db`
        INSERT INTO leads (email, url, business_model, launch_stage, icp, overall, risk_label, generated_at, service_interest, message)
        VALUES (${data.email}, ${data.url}, ${data.businessModel}, ${data.launchStage}, ${data.icp}, ${data.overall}, ${data.riskLabel}, ${data.generatedAt}, ${data.serviceInterest ?? null}, ${data.message ?? null})
      `;
      return { saved: true };
    } catch (err) {
      console.warn("[leads] DB insert failed", err);
      return { saved: false, reason: "db_error" };
    }
  });

/** Append the lead to the localStorage fallback list (guarded, best-effort). */
export function appendLeadLocal(payload: LeadPayload): void {
  try {
    const record = { ...payload, savedAt: new Date().toISOString() };
    const raw = window.localStorage.getItem(LEADS_STORAGE_KEY);
    const list: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
    if (!Array.isArray(list)) {
      window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify([record]));
      return;
    }
    list.push(record);
    // Keep the list bounded; it's a fallback, not a data store.
    window.localStorage.setItem(
      LEADS_STORAGE_KEY,
      JSON.stringify(list.slice(-LEADS_MAX)),
    );
  } catch {
    // storage unavailable (private mode / quota): local fallback is best-effort
  }
}

/**
 * Capture a lead: persist locally first (never lost), then post to the server
 * without blocking or throwing. Safe to fire from an event handler.
 */
export async function captureLead(payload: LeadPayload): Promise<void> {
  appendLeadLocal(payload);
  try {
    await saveLeadServer({ data: payload });
  } catch {
    // Server unreachable / CSRF hiccup / offline: the local copy is already kept.
  }
}
