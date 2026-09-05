/**
 * MarketReady /blog index → /resources redirect (build #21).
 *
 * The Resources hub (src/routes/resources/index.tsx) replaces the old Insights
 * index. This route now issues a permanent 308 redirect so old bookmarks and
 * in-page links resolve; /blog/<slug> post URLs are untouched and still served
 * by src/routes/blog/$slug.tsx.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/")({
  loader: () => {
    throw redirect({ href: "/resources", statusCode: 308 });
  },
  component: () => null,
});
