/**
 * POST /api/booking : MarketReady booking-request capture (Airtable-backed).
 *
 * The booking modal (src/components/BookingModal.tsx) posts here instead of
 * /api/leads. This route exists as its OWN endpoint for one reason: the
 * diagnostic route (POST /api/leads) triggers the instant results email via
 * Knock, and a booking request must NEVER fire that email — it is not a
 * diagnostic submission and has no results to email. The ONLY email this
 * route may fire is the booking/contact CONFIRMATION workflow
 * (triggerBookingConfirmation → KNOCK_CONFIRMATION_WORKFLOW, default
 * "marketready-booking-confirmation") — never the diagnostic results
 * workflow.
 *
 * JSON in: { name, workEmail, company?, websiteUrl?, serviceInterest?,
 * source?, capturedAt?, message? }. Only name + a valid work email are
 * required; everything else is best-effort (company is inferred from the
 * website domain when omitted, mirroring the diagnostic lead flow). The
 * optional free-text `message` maps to the owner's "Message" column
 * (added to "Bookings" for the /contact form).
 *
 * Server behavior (mirrors src/routes/api/leads.ts, fail-open):
 *   1. Reads ONLY process.env.AIRTABLE_API_TOKEN / AIRTABLE_BASE_ID
 *      (never hard-coded, never logged, never returned).
 *   2. Airtable env vars missing: persists the request to the local JSONL
 *      fallback (.data/bookings.jsonl) with marker airtable:"unconfigured"
 *      and responds { ok:true } — a booking is a contact request, not a
 *      scored deliverable, so the visitor still sees success and the lead
 *      is never lost (console.warn records the gap).
 *   3. Otherwise writes one row to the owner's "Bookings" table via the
 *      shared helpers in src/lib/airtable.ts (schema whitelist from the
 *      metadata API, transient-retry). The table/columns were verified
 *      against the real API: Name, Work Email, Company, Website URL,
 *      Service Interest, Source, Timestamp.
 *   4. On Airtable failure: JSONL fallback with airtable:"failed" + the
 *      error, and responds { ok:false, error } (HTTP 200, friendly) so the
 *      modal can show its inline retry message.
 *   5. Only a malformed body / missing name / invalid email returns non-2xx.
 *   6. Booking/contact confirmation email (INDEPENDENT of the Airtable
 *      outcome — fires on Airtable success AND on the fail-open path, but
 *      NOT on a server-side Airtable failure where the client is told to
 *      retry, so a resubmit never double-emails): after the Airtable step
 *      settles and just before an { ok:true } response, the normalized
 *      booking is queued to Knock (src/lib/knockEmail.ts,
 *      triggerBookingConfirmation) which triggers the owner's
 *      "marketready-booking-confirmation" workflow to the submitter's
 *      workEmail — the SAME workflow for bookings (modal) and contacts
 *      (/contact page), with `source` in the payload so the template can
 *      vary copy. Fail-open: skipped entirely when KNOCK_API_KEY is unset;
 *      any send failure is console.warn'ed only and never blocks or alters
 *      the booking response. The diagnostic results workflow is NEVER
 *      triggered on this route.
 */

import { createFileRoute } from "@tanstack/react-router";
import { mkdir, appendFile } from "node:fs/promises";
import * as path from "node:path";
import {
  EMAIL_RE,
  fetchTableSchema,
  missingEnvVars,
  whitelistFields,
  writeAirtable,
} from "~/lib/airtable";
import { triggerBookingConfirmation } from "~/lib/knockEmail";
import type { KnockBookingConfirmation } from "~/lib/knockEmail";

/** The owner's bookings table (verified against the live metadata API:
 * tbl7EUWespmF9nPEj with exactly these 7 columns). Distinct from the
 * diagnostic "Free diagnostic" table in AIRTABLE_TABLE_NAME. */
const BOOKINGS_TABLE = "Bookings";

/** Safe fallback when the metadata fetch fails: the exact columns that
 * exist in the base today, so a schema outage cannot 422 the write. */
const BOOKINGS_FALLBACK_COLUMNS: ReadonlySet<string> = new Set([
  "Name",
  "Work Email",
  "Company",
  "Website URL",
  "Service Interest",
  "Source",
  "Timestamp",
  "Message",
]);

/** Single-line text columns: hard cap so a bloated payload can never
 * exceed Airtable's cell limits (they hold 100k chars; these are contacts). */
const MAX_LINE = 500;

/** Free-text Message column cap (multiline, owner-added for /contact). */
const MAX_MESSAGE = 5000;

interface BookingRequestBody {
  name?: unknown;
  workEmail?: unknown;
  company?: unknown;
  websiteUrl?: unknown;
  serviceInterest?: unknown;
  source?: unknown;
  capturedAt?: unknown;
  message?: unknown;
}

/** Best-effort company inference from a URL, e.g. https://www.acme.com -> "acme".
 * Mirrors the client/leads inference so the server never trusts a missing field. */
function inferCompany(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    const label = host.split(".")[0];
    return label && label.length ? label : "";
  } catch {
    return "";
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asLine(v: unknown, max = MAX_LINE): string {
  const s = asString(v);
  return s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : "";
}

/** Map a normalized booking request to the "Bookings" columns. Empty values
 * are dropped generically (matches the diagnostic field mapper's rules). */
function toBookingFields(b: {
  name: string;
  workEmail: string;
  company: string;
  websiteUrl: string;
  serviceInterest: string;
  source: string;
  capturedAt: string;
  message: string;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Name: b.name,
    "Work Email": b.workEmail,
    Company: b.company,
    "Website URL": b.websiteUrl,
    "Service Interest": b.serviceInterest,
    Source: b.source,
    Timestamp: b.capturedAt,
    Message: b.message,
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

/** Best-effort JSONL append (never throws). Same store pattern as
 * leads.ts/intake.ts; a separate file keeps booking requests distinct. */
async function appendJsonl(record: unknown): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "bookings.jsonl");
  await mkdir(dir, { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
}

export const Route = createFileRoute("/api/booking")({
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
        const raw = (body ?? {}) as BookingRequestBody;

        // Validation: name + valid work email are required (EMAIL_RE shared
        // with the diagnostic lead route); everything else is best-effort.
        const name = asLine(raw.name);
        if (!name) {
          return Response.json({ ok: false, error: "Name is required." }, { status: 400 });
        }
        const workEmail = asLine(raw.workEmail);
        if (!EMAIL_RE.test(workEmail)) {
          return Response.json(
            { ok: false, error: "A valid work email is required." },
            { status: 400 },
          );
        }
        const websiteUrl = asLine(raw.websiteUrl);
        const company = asLine(raw.company) || inferCompany(websiteUrl);
        const serviceInterest = asLine(raw.serviceInterest);
        // The modal always sends source:"booking_modal"; default defensively.
        const source = asLine(raw.source) || "booking_modal";
        // Free-text contact message (the /contact form sends it under
        // `message`); maps to the "Message" column. Multi-line-safe.
        const message = asLine(raw.message, MAX_MESSAGE);
        // Airtable dateTime columns accept ISO 8601; trust the client's
        // timestamp only when it parses, else stamp on receipt.
        const capturedRaw = asString(raw.capturedAt);
        const capturedAt =
          capturedRaw && !Number.isNaN(Date.parse(capturedRaw))
            ? new Date(capturedRaw).toISOString()
            : new Date().toISOString();

        const fields = whitelistFields(
          toBookingFields({ name, workEmail, company, websiteUrl, serviceInterest, source, capturedAt, message }),
          await fetchTableSchema(BOOKINGS_TABLE),
          BOOKINGS_FALLBACK_COLUMNS,
        );

        // Normalized booking for the confirmation email (structurally matches
        // KnockBookingConfirmation). Built once here so the email payload and
        // the Airtable row share exactly the same normalized values.
        const booking: KnockBookingConfirmation = {
          name,
          workEmail,
          company,
          websiteUrl,
          serviceInterest,
          source,
          capturedAt,
          message,
        };

        const result = await writeAirtable(fields, BOOKINGS_TABLE);
        if (result.ok) {
          // Booking/contact confirmation email: AWAITED with a bounded budget
          // BEFORE the { ok:true } response returns (same cold-start fix as
          // /api/leads' instant-results email — the platform freezes background
          // work after a response flushes on serverless hosts). Fail-open:
          // skipped when KNOCK_API_KEY is unset; a send failure never alters
          // the booking response. Only the confirmation workflow fires here —
          // the diagnostic results workflow is NEVER triggered on this route.
          await triggerBookingConfirmation(booking);
          return Response.json({ ok: true });
        }

        if (missingEnvVars().length > 0) {
          // Fail-open: no Airtable configured (local dev / unconfigured host).
          // The visitor's booking still "succeeds" — the lead is preserved in
          // the JSONL fallback with a distinct marker instead.
          console.warn(
            "[booking] Airtable env vars missing; booking saved locally only.",
          );
          try {
            await appendJsonl({
              name,
              workEmail,
              company,
              websiteUrl,
              serviceInterest,
              source,
              capturedAt,
              message,
              airtable: "unconfigured",
            });
          } catch (err) {
            console.warn("[booking] JSONL append failed", err);
          }
          // The visitor was told "we received it", so the confirmation email
          // fires on this fail-open success path too (same awaited bounded
          // trigger, never blocks the response).
          await triggerBookingConfirmation(booking);
          return Response.json({ ok: true });
        }

        // Airtable is configured but the write failed: keep a local copy and
        // tell the client so the modal shows its inline retry error. NO
        // confirmation email here — the visitor was told the request was NOT
        // saved and to retry; emailing "we received it" would contradict the
        // UI and double-email on resubmission.
        console.warn("[booking] Airtable write failed; booking saved locally.");
        try {
          await appendJsonl({
            name,
            workEmail,
            company,
            websiteUrl,
            serviceInterest,
            source,
            capturedAt,
            message,
            airtable: "failed",
            airtableError: result.error,
          });
        } catch (err) {
          console.warn("[booking] JSONL append failed", err);
        }
        return Response.json({
          ok: false,
          error: "We couldn't save your request just now — please try again in a moment.",
        });
      },
    },
  },
});
