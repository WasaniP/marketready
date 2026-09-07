/**
 * MarketReady /assessment/results → /services/diagnostic redirect.
 *
 * The results view now lives inline on /services/diagnostic (revealed after
 * the lead gate). This old route — previously reachable only after the gate —
 * issues a permanent 308 redirect so it never 404s.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/assessment/results")({
  loader: () => {
    throw redirect({ href: "/services/diagnostic", statusCode: 308 });
  },
  component: () => null,
});
