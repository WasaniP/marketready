/**
 * /services ladder page guards (owner spec 2026-09-19).
 *
 * These are static-source assertions on purpose: they lock the two things that
 * are easy to regress silently — (1) that no surface anywhere in the app links
 * to the three hidden draft offer pages, and (2) that robots.txt / sitemap.xml
 * say what the spec says they say. Copy checks keep the owner's verbatim ladder
 * strings (and the deliberately-kept six-dimensions line) from being "tidied".
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const PAGE = read("src/routes/services/index.tsx");
const ROBOTS = read("public/robots.txt");
const SITEMAP = read("public/sitemap.xml");

const DRAFTS = ["/services/audit", "/services/sprint", "/services/fractional"];

describe("/services page: hidden draft offer pages", () => {
  it("no anchor anywhere in the app points at a hidden draft", () => {
    const glob = new Bun.Glob("src/**/*.{ts,tsx}");
    const offenders: string[] = [];
    for (const file of glob.scanSync({ cwd: ROOT })) {
      if (file.includes("routeTree.gen")) continue;
      const src = read(file);
      for (const draft of DRAFTS) {
        if (src.includes(`href="${draft}"`) || src.includes(`href="${draft}"`)) {
          offenders.push(`${file} -> ${draft}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("all three drafts carry robots noindex, nofollow", () => {
    for (const draft of DRAFTS) {
      const src = read(`src/routes${draft}.tsx`);
      expect(src).toContain('{ name: "robots", content: "noindex, nofollow" }');
    }
  });

  it("robots.txt disallows the three drafts and points at the sitemap", () => {
    for (const draft of DRAFTS) expect(ROBOTS).toContain(`Disallow: ${draft}`);
    expect(ROBOTS).toContain("User-agent: *");
    expect(ROBOTS).toContain(
      "Sitemap: https://59e104a5a8878f58fb5893d4b7ec1597.ctonew.app/sitemap.xml",
    );
  });

  it("sitemap.xml lists the public routes and excludes drafts + the advisory redirect", () => {
    const listed = [
      "/",
      "/services",
      "/services/diagnostic",
      "/about",
      "/assessment",
      "/contact",
      "/resources",
      "/work/publisher-marketplace",
      "/work/consumer-sports",
      "/work/b2b-saas-platform",
      "/work/collectibles-marketplace",
      "/terms",
      "/privacy",
    ];
    const base = "https://59e104a5a8878f58fb5893d4b7ec1597.ctonew.app";
    for (const route of listed) {
      expect(SITEMAP).toContain(`<loc>${base}${route === "/" ? "/" : route}</loc>`);
    }
    for (const excluded of [...DRAFTS, "/services/advisory", "/blog"]) {
      expect(SITEMAP).not.toContain(`<loc>${base}${excluded}</loc>`);
    }
  });
});

describe("/services page: copy and link targets", () => {
  it("every link target on the page is the diagnostic, Cal.com or the mailto", () => {
    const allowed = new Set([
      "https://cal.com/wasani-probasco",
      "mailto:hello@getmarketready.co",
      "/services/diagnostic",
      // not a link target: the route id in createFileRoute("/services/")
      "/services/",
    ]);
    const targets = [...PAGE.matchAll(/"(https?:\/\/[^"']+|mailto:[^"']+|\/services[^"']*)"/g)].map(
      (m) => m[1],
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(allowed.has(t)).toBe(true);
  });

  it("keeps the owner's verbatim ladder copy, including the six-dimensions line", () => {
    const verbatim = [
      "[ SERVICES ]",
      "Your strategy isn&apos;t what your deck says. It&apos;s what your customer reads.",
      "Find the gap",
      "Close the gap",
      "Keep it closed",
      // Owner's verbatim Free Diagnostic bullet — the 6+2-versus-9 tension is a
      // conscious keeper, not an oversight. Do not "fix" it here.
      "Automated scoring across six dimensions, two reserved for human review",
      "Nine-parameter GTM diagnostic across positioning, messaging, and launch velocity",
      "Credits 100% toward a GTM Engine Sprint or a Launch booked within 30 days.",
      "From $12,000",
      "From $3,500/month",
      "From $6,000/month",
      "The 9-Parameter Framework",
      "Nine diagnostics, three pillars, one composite readiness score, so every",
      "Ghostwritten article for an external publication",
      "Not sure which one fits?",
    ];
    for (const line of verbatim) expect(PAGE).toContain(line);
  });

  it("has eight offer rows and the Audit + GTM Sprint open by default", () => {
    // Seven rows book through Cal.com, the free diagnostic row goes to /services/diagnostic.
    expect(PAGE.match(/href: CAL/g)?.length).toBe(7);
    expect(PAGE.match(/href: DIAGNOSTIC/g)?.length).toBe(1);
    expect(PAGE.match(/openByDefault: true/g)?.length).toBe(2);
  });

  it("keeps the reserved voice-proof container empty and hidden", () => {
    expect(PAGE).toContain('id="ghostwriting-voice-proof"');
    expect(PAGE).toContain("className=\"sv-voice-proof\" hidden");
  });

  it("has no forbidden claims, badges or urgency devices", () => {
    const banned = [
      "most clients",
      "typical engagement",
      "fastest-growing",
      "Most Popular",
      "Recommended",
      "spots left",
      "booking for",
      "first client",
    ];
    for (const phrase of banned) expect(PAGE.toLowerCase()).not.toContain(phrase.toLowerCase());
  });
});

describe("homepage: nine parameters, three pillars of three", () => {
  const HOME = read("src/routes/index.tsx");

  it("describes the diagnostic as nine parameters in three pillars", () => {
    expect(HOME).toContain("Nine parameters scored in seconds from your public site");
    expect(HOME).toContain("pillars of three");
    expect(HOME).toContain("Scored nine-parameter GTM diagnostic");
  });

  it("no longer claims eight dimensions on the homepage", () => {
    expect(HOME).not.toContain("All eight grouped into three pillars");
    expect(HOME).not.toContain("Six dimensions scored in seconds");
  });
});

describe("diagnostic engine copy: nine parameters, not six/eight", () => {
  const ENGINE = read("src/components/DiagnosticEngine.tsx");
  it("describes the engine as nine parameters in three pillars of three", () => {
    expect(ENGINE).toContain("Nine parameters scored in seconds from your public site");
    expect(ENGINE).toContain("pillars of three");
  });
  it("has no eight-dimension claim left in the engine", () => {
    expect(ENGINE).not.toContain("All eight grouped into three pillars");
    expect(ENGINE).not.toContain("Six dimensions scored in seconds");
  });
});
