/**
 * MarketReady /services/advisory → /services/fractional redirect.
 *
 * The 'Launch Partner & Advisory' service was renamed to 'Fractional GTM Lead'
 * and moved to /services/fractional (build #42). This old route issues a
 * permanent 308 redirect so existing bookmarks and in-page links still resolve.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/services/advisory")({
  loader: () => {
    throw redirect({ href: "/services/fractional", statusCode: 308 });
  },
  component: () => null,
});
