/**
 * MarketReady checkout helpers (build #22).
 *
 * The homepage no longer displays pricing (owner direction: pure diagnostic
 * funnel: pricing surfaces only on /assessment/results as the dynamic
 * prescription). The Stripe hook and the booking-modal service-preselect
 * wiring that used to live in the homepage's pricing section are extracted
 * here so /assessment/results (build #23/#24) can reuse them: checkout CTAs
 * there call openCheckout() with the prescribed service.
 */

/** Stripe integration point. Stripe Connect is NOT connected yet, so this is
 * null and checkout CTAs open the booking modal with the service preselected.
 * When the Finance tab is wired up, drop the one-time Sprint checkout URL here
 * and checkout CTAs will redirect to it instead. */
export const SPRINT_PAYMENT_LINK: string | null = null;

/** Checkout services: short names matching the booking modal checklist.
 * No pricing figures appear here (pricing is revealed only on the assessment
 * results page, never in the checkout plumbing). */
export const CHECKOUT_SERVICES = {
  sprint: "MarketReady Sprint",
  advisory: "Fractional GTM Lead",
} as const;

export type CheckoutService = (typeof CHECKOUT_SERVICES)[keyof typeof CHECKOUT_SERVICES];

/**
 * Route a checkout intent to the payment link when Stripe is connected; until
 * then, open the booking modal with the service preselected via the page's
 * modal opener (`openBooking(service?)` : the booking-modal preselect wiring
 * on the page shell).
 */
export function openCheckout(
  service: CheckoutService,
  openBooking: (service?: string) => void,
): void {
  if (SPRINT_PAYMENT_LINK && service === CHECKOUT_SERVICES.sprint) {
    window.location.href = SPRINT_PAYMENT_LINK;
    return;
  }
  openBooking(service);
}
