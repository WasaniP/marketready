import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

const SITE_URL = "https://59e104a5a8878f58fb5893d4b7ec1597.ctonew.app";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "MarketReady: Clear Positioning. Higher Conversion. Zero Wasted Burn.",
      },
      {
        name: "description",
        content:
          "The 14-day messaging sprint for founders and growth teams scaling high-value offers. MarketReady audits positioning & GTM readiness across 9 PMM parameters: then fixes the gaps.",
      },
      { name: "theme-color", content: "#030712" },
      /* OpenGraph (Build #31) */
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MarketReady" },
      {
        property: "og:title",
        content: "MarketReady: Clear Positioning. Higher Conversion. Zero Wasted Burn.",
      },
      {
        property: "og:description",
        content:
          "MarketReady audits your positioning and GTM readiness across 9 PMM parameters, then prescribes the highest-impact fixes and activates them in a 14-day sprint.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/MarketReady-03-horizontal-dark.png` },
      /* Twitter card (Build #31) */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MarketReady: Clear Positioning. Higher Conversion. Zero Wasted Burn." },
      {
        name: "twitter:description",
        content:
          "MarketReady audits your positioning and GTM readiness across 9 PMM parameters, then prescribes the highest-impact fixes and activates them in a 14-day sprint.",
      },
      { name: "twitter:image", content: `${SITE_URL}/MarketReady-03-horizontal-dark.png` },
    ],
    links: [
      { rel: "icon", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-night">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
