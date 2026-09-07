/**
 * MarketReady shared site chrome (build #22).
 *
 * Header + Footer (with Wordmark / ChevronDown / ServicesDropdown) extracted
 * so every route reuses the same chrome.
 *
 * Build #21: the primary nav (desktop + mobile) linked "Resources" → /resources.
 *
 * Build #22 (site expansion A): nav restructured to
 * How It Works | Services ▾ | Resources | About ("Methodology" link dropped :
 * the #methodology homepage section stays). 'Services' label now navigates to
 * /services, with a chevron toggle for the dropdown; the dropdown gains a final
 * 'Explore all services →' item. Header CTA replaced with
 * 'Get Your MarketReady Score →' → /services/diagnostic (btn-electric). Footer gains a
 * links row: /services, /resources, /terms, /contact. Copyright line unchanged.
 */
import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Services dropdown links (route to the /services subpages : the brochure
 * content that lives there since build #27. Full owner-specified names +
 * subtexts : the exact copy the dropdown shows.) */
export const SERVICES_LINKS = [
  {
    name: "MarketReady Diagnostic (Free AI Audit & Scorecard)",
    subtext: "Real-time URL crawl & 9-parameter GTM assessment.",
    href: "/services/diagnostic",
  },
  {
    name: "MarketReady Audit (Human-Led Positioning & GTM Review)",
    subtext: "A human-led positioning & GTM audit with prioritized recommendations.",
    href: "/services/audit",
  },
  {
    name: "MarketReady Sprint (14-Day Strategy & Launch Deck)",
    subtext:
      "Positioning architecture, homepage rewrites, core launch deck, and custom AI prompt workflows.",
    href: "/services/sprint",
  },
  {
    name: "Fractional GTM Lead (Ongoing Growth Retainer)",
    subtext: "Embedded PMM leadership, messaging iteration, and launch execution.",
    href: "/services/fractional",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

export function Wordmark({ className = "h-7" }: { className?: string }) {
  return (
    <a href="/" className="flex items-center" aria-label="MarketReady home">
      <img
        src="/MarketReady-03-horizontal-dark.png"
        alt="MarketReady Logo"
        className={`${className} w-auto`}
      />
    </a>
  );
}

export function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3.5 w-3.5 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Services dropdown (desktop nav)                                     */
/* ------------------------------------------------------------------ */

export function ServicesDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Build #22: the 'Services' label navigates to /services; the chevron
          button toggles the dropdown (hover opens/closes the whole group). */}
      <div className="flex items-center">
        <a
          href="/services"
          onClick={() => setOpen(false)}
          className="nav-link py-2"
        >
          Services
        </a>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? "Close services menu" : "Open services menu"}
          onClick={() => setOpen((v) => !v)}
          className="nav-link -ml-1 inline-flex items-center p-2"
        >
          <ChevronDown className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          aria-label="Services"
          className="absolute left-0 top-full z-50 mt-2 w-96 rounded-xl border border-hairline bg-obsidian/95 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          {SERVICES_LINKS.map((l) => (
            <a
              key={l.href}
              role="menuitem"
              href={l.href}
              onClick={() => setOpen(false)}
              className="group block rounded-lg px-3 py-2.5 transition-colors hover:bg-electric/15"
            >
              <span className="block text-sm font-semibold text-mist transition-colors group-hover:text-electric">
                {l.name}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-500 transition-colors group-hover:text-electric/80">
                {l.subtext}
              </span>
            </a>
          ))}
          <div className="my-1.5 h-px bg-hairline" />
          <a
            role="menuitem"
            href="/services"
            onClick={() => setOpen(false)}
            className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
          >
            <span className="text-sm font-semibold text-electric">Explore all services →</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-electric"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/** Focusable selector used for the mobile drawer's focus trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Build #31: mobile drawer accessibility. When open: Escape closes it, Tab
     is trapped/cycled inside the drawer (never escapes to background), focus
     moves into the first item on open, and returns to the toggle on close. */
  useEffect(() => {
    if (!menuOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusables = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus into the drawer (first interactive item).
    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === drawer)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Return focus to the toggle button on close.
      toggleRef.current?.focus();
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "border-b border-hairline bg-obsidian/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 pt-6 pb-4 mb-9 sm:px-8">
        <Wordmark />

        {/* Build #22: How It Works | Services ▾ | Resources | About */}
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          <a href="/#how-it-works" className="nav-link">
            How It Works
          </a>
          <ServicesDropdown />
          <a href="/resources" className="nav-link">
            Resources
          </a>
          <a href="/about" className="nav-link">
            About
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a href="/services/diagnostic" className="btn-electric hidden sm:inline-flex">
            Get Your MarketReady Score →
          </a>
          <button
            type="button"
            ref={toggleRef}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white/[0.03] text-ink md:hidden"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          ref={drawerRef}
          aria-label="Mobile"
          className="border-t border-hairline bg-obsidian/95 px-5 py-4 backdrop-blur-xl md:hidden"
        >
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                aria-expanded={servicesOpen}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-mist hover:bg-white/[0.05] hover:text-ink"
              >
                Services
                <ChevronDown
                  className={`transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`}
                />
              </button>
              {servicesOpen && (
                <ul className="ml-3 flex flex-col gap-0.5 border-l border-hairline pl-3">
                  {SERVICES_LINKS.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.05]"
                      >
                        <span className="block text-sm font-medium text-mist">{l.name}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                          {l.subtext}
                        </span>
                      </a>
                    </li>
                  ))}
                  <li>
                    <a
                      href="/services"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-semibold text-electric transition-colors hover:bg-white/[0.05]"
                    >
                      Explore all services →
                    </a>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <a
                href="/#how-it-works"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-mist hover:bg-white/[0.05] hover:text-ink"
              >
                How It Works
              </a>
            </li>
            <li>
              <a
                href="/resources"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-mist hover:bg-white/[0.05] hover:text-ink"
              >
                Resources
              </a>
            </li>
            <li>
              <a
                href="/about"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-mist hover:bg-white/[0.05] hover:text-ink"
              >
                About
              </a>
            </li>
            <li className="mt-2">
              <a href="/services/diagnostic" className="btn-electric w-full">
                Get Your MarketReady Score →
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Footer (build #25 : redesigned per owner spec).
 *
 * Deep slate/navy band (#0B132B) with a subtle slate top separation. Brand +
 * mission, a nav column that mirrors the header (How It Works / Services /
 * Resources / About) plus a prominent teal-tinted Score CTA, and a contact
 * column with the direct mailto line + the Book 14-Day Sprint button (onBook).
 * A legal strip holds the copyright, Privacy Policy, Terms, and the standing
 * notice line. No pricing appears here.
 */
export function Footer({ onBook }: { onBook: () => void }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-800/60 bg-[#0B132B]">
      {/* Main footer body */}
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[2fr_1fr_1fr] md:py-16">
        {/* Brand + mission */}
        <div className="max-w-sm">
          <Wordmark className="h-7" />
          <p className="mt-4 text-sm leading-relaxed text-mist">
            MarketReady diagnoses where your GTM is breaking, prescribes the
            highest-impact fixes, and activates them in 14 days.
          </p>
        </div>

        {/* Mirror of the top navigation + Score CTA */}
        <nav aria-label="Footer" className="flex flex-col items-start gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Navigate
          </span>
          <a
            href="/services/diagnostic"
            className="text-sm font-semibold text-electric transition-colors hover:text-ink"
          >
            Get Your MarketReady Score →
          </a>
          <a href="/#how-it-works" className="nav-link">
            How It Works
          </a>
          <a href="/services" className="nav-link">
            Services
          </a>
          <a href="/resources" className="nav-link">
            Resources
          </a>
          <a href="/about" className="nav-link">
            About
          </a>
        </nav>

        {/* Contact */}
        <div className="flex flex-col items-start gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Get started
          </span>
          <button
            type="button"
            onClick={onBook}
            className="btn-electric w-auto whitespace-nowrap"
          >
            Book 14-Day Sprint
          </button>
          <a
            href="mailto:hello@getmarketready.co"
            className="mt-1 text-sm text-electric underline decoration-electric/40 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink/40"
          >
            Have questions? Email us at hello@getmarketready.co
          </a>
        </div>
      </div>

      {/* Legal strip */}
      <div className="border-t border-slate-800/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-zinc-500">
            © {year} MarketReady. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href="/privacy"
              className="text-xs text-zinc-500 transition-colors hover:text-ink"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-xs text-zinc-500 transition-colors hover:text-ink"
            >
              Terms of Service
            </a>
          </nav>
        </div>
        <p className="border-t border-slate-800/60 px-5 pb-6 pt-3 text-center text-xs text-zinc-600 sm:px-8">
          MarketReady Strategy Group: Go-To-Market Enablement &amp; Positioning.
        </p>
      </div>
    </footer>
  );
}
