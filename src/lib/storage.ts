/**
 * Shared localStorage keys for the MarketReady app.
 *
 * Kept in one module so both the calculator route and the booking modal can
 * reference the assessment storage without importing a route file (which would
 * create a component → route import cycle).
 */

/** Storage key for the assessment inputs (shape: AssessmentInput). */
export const ASSESSMENT_STORAGE_KEY = "marketready:assessment";

/** Storage key for the PDF report unlock record. */
export const REPORT_UNLOCK_KEY = "marketready:report_unlocked";

/** Storage key for the localStorage lead fallback list (re-exported from leads.ts). */
export { LEADS_STORAGE_KEY } from "./leads";

/** Storage key set when a Sprint booking succeeds through the booking modal.
 * /onboarding/success reads it to show the gentle "booked a Sprint?" guard :
 * it never blocks, it just orients the visitor. */
export const BOOKED_STORAGE_KEY = "marketready:booked";

/** Storage key for the booking client id, generated when a booking succeeds.
 * The intake form sends it so the team can join the intake to the lead record. */
export const CLIENT_ID_STORAGE_KEY = "marketready:clientId";

/** Storage key for the intake-vault localStorage fallback list (best-effort
 * mirror of POST /api/intake, so an intake is never silently lost). */
export const INTAKE_STORAGE_KEY = "marketready:intake";
