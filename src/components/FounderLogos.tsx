/**
 * MarketReady founder-experience logo bar (build #14, refined; shared in
 * build #22 so the About page reuses the exact homepage markup).
 *
 * All-text wordmarks : no SVG/PNG icons : rendered as plain uppercase brand
 * names in a single nowrap row (overflow-x auto on small screens). Honest
 * framing: these are brands the founder's teams worked at, NOT MarketReady
 * clients. The label line is 'Positioning & GTM playbook applied at'.
 */
const FOUNDER_BRANDS: string[] = [
  "Warner Bros. Discovery",
  "AEW",
  "NCAA",
  "Bleacher Report",
  "TNT Sports",
  "TBS",
  "Variety",
  "Rolling Stone",
];

export function FounderLogos() {
  return (
    <div className="mx-auto max-w-7xl bg-[#16120F] px-5 py-12 sm:px-8">
      <p className="text-center text-xs text-zinc-500">
        Positioning &amp; GTM playbook applied at
      </p>
      <div
        className="mt-5 flex flex-nowrap items-center justify-center overflow-x-auto"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {FOUNDER_BRANDS.map((label, i) => (
          <span
            key={label}
            className="flex items-center whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.12em] text-white/50 transition-colors duration-300 hover:text-white"
          >
            {label}
            {i < FOUNDER_BRANDS.length - 1 && (
              <span aria-hidden="true" className="mx-8 text-white/30">
                •
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
