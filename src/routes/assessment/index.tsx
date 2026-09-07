/**
 * MarketReady /assessment → /services/diagnostic redirect.
 *
 * The gated 5-dimension diagnostic engine moved to /services/diagnostic (the
 * live tool). This old route issues a permanent 308 redirect so existing
 * bookmarks and in-page links still resolve.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/assessment/")({
  loader: () => {
    throw redirect({ href: "/services/diagnostic", statusCode: 308 });
  },
  component: () => null,
});
