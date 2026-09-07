/**
 * Contact-form → /api/booking payload mapping.
 *
 * Pure + unit-tested so the /contact form's server payload can be asserted
 * without mounting React. The shape mirrors the booking modal's POST body
 * exactly (name / workEmail / company / websiteUrl / serviceInterest /
 * source / capturedAt) plus `message`, which POST /api/booking maps to the
 * owner's "Message" column in the "Bookings" table. source is "contact_form"
 * (distinct from the modal's "booking_modal") so the owner can filter contact
 * messages from modal bookings in Airtable.
 */

export interface ContactFormFields {
  name: string;
  workEmail: string;
  company?: string;
  message: string;
  interest?: string;
}

/** Exactly what POST /api/booking accepts (see src/routes/api/booking.ts). */
export interface ContactBookingPayload {
  name: string;
  workEmail: string;
  company: string;
  websiteUrl: string;
  serviceInterest?: string;
  source: "contact_form";
  capturedAt: string;
  message: string;
}

export function buildContactBooking(
  fields: ContactFormFields,
  capturedAt = new Date().toISOString(),
): ContactBookingPayload {
  return {
    name: fields.name,
    workEmail: fields.workEmail,
    company: fields.company ?? "",
    // The contact form has no website field; the route treats this as the
    // "Website URL" column value and never infers a company from it.
    websiteUrl: "not provided",
    // Keep the established "Contact: X" label so the rows read cleanly
    // alongside modal bookings (which send bare service names).
    serviceInterest: fields.interest ? `Contact: ${fields.interest}` : undefined,
    source: "contact_form",
    capturedAt,
    message: fields.message,
  };
}