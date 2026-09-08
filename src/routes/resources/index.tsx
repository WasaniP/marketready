/**
 * MarketReady Resources hub (build #21).
 *
 * Replaces the Insights index: blog articles AND case studies in the site's
 * glass-card grid, with client-side filter tabs (All / Articles / Case
 * Studies). Filter state is a plain string default ("all"), so SSR and the
 * first client render always agree; tab switching is pure post-hydration
 * client state. No case-study posts are fabricated: the Case Studies tab
 * shows an honest empty state until the founder supplies real material.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getAllPosts, getPostsByType, formatDate, readingTime } from "~/lib/blog/posts";
import type { PostType } from "~/lib/blog/posts";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";

export const Route = createFileRoute("/resources/")({
 head: () => ({
  meta: [
   { title: "Resources: MarketReady" },
   {
    name: "description",
    content:
     "Resources on positioning, messaging, and go-to-market from the MarketReady playbook. Articles and case studies for founders and growth teams.",
   },
  ],
 }),
 component: ResourcesIndex,
});

type Filter = "all" | PostType;

const FILTERS: { id: Filter; label: string }[] = [
 { id: "all", label: "All" },
 { id: "article", label: "Articles" },
 { id: "case-study", label: "Case Studies" },
];

/** Tag pill tint: cycle teal/indigo like the existing chip treatments. */
function tagTint(index: number): string {
 if (index % 2 === 1) {
  return "border-indigo/30 bg-indigo/10 text-indigo";
 }
 return "border-ember/40 bg-ember/10 text-ember";
}

/** Distinct solid-indigo badge for case-study cards (vs translucent topic pills). */
function CaseStudyBadge() {
 return (
  <span className="inline-flex rounded-full border border-indigo/60 bg-indigo px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
   Case Study
  </span>
 );
}

function ResourcesIndex() {
 const [filter, setFilter] = useState<Filter>("all");
 const [bookingOpen, setBookingOpen] = useState(false);
 const closeBooking = () => setBookingOpen(false);

 const posts = filter === "all" ? getAllPosts() : getPostsByType(filter);

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main>
    {/* Hero strip: chip + heading + sub, following the section-heading pattern */}
    <section className="relative overflow-hidden border-b border-hairline bg-[#16120F] px-5 pb-14 pt-32 sm:px-8 sm:pb-16 sm:pt-40">
     <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-ember/[0.07] blur-3xl"
     />
     <div className="relative mx-auto max-w-6xl text-center">
      <span className="chip border-ember/40 text-ember">Resources</span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
       Positioning &amp; GTM, in practice
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-lg text-mist">
       Practical notes on positioning, messaging, and go-to-market. Plus case studies
       from founder-led work, as they're published.
      </p>
     </div>
    </section>

    {/* Filter tabs: segmented control, client-side state */}
    <section className="border-b border-hairline bg-[#1F1A16] px-5 pt-14 sm:px-8 sm:pt-16">
     <div className="mx-auto max-w-6xl">
      <div
       role="group"
       aria-label="Filter resources by type"
       className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-hairline bg-ink/[0.03] p-1"
      >
       {FILTERS.map((f) => {
        const active = filter === f.id;
        return (
         <button
          key={f.id}
          type="button"
          aria-pressed={active}
          onClick={() => setFilter(f.id)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
           active
            ? "border border-ember/40 bg-ember/10 text-ember"
            : "border border-transparent text-mist hover:text-ink"
          }`}
         >
          {f.label}
         </button>
        );
       })}
      </div>
     </div>
    </section>

    {/* Cards: glass treatment matching the capabilities grid */}
    <section className="border-b border-hairline bg-[#1F1A16] px-5 py-14 sm:px-8 sm:py-16">
     <div className="mx-auto max-w-6xl">
      {posts.length === 0 ? (
       /* Honest empty state (Case Studies tab until the founder
         supplies real material; no fabricated content). */
       <div className="mx-auto max-w-xl rounded-xl border border-hairline bg-linen/60 px-6 py-14 text-center ">
        <span className="chip border-indigo/40 text-indigo">Case Studies</span>
        <h3 className="mt-4 text-xl font-bold tracking-tight text-ink">
         Case studies coming soon.
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-mist">
         Built from founder-led positioning work at brands like Warner Bros. Discovery,
         AEW, and NCAA. Publishing shortly.
        </p>
       </div>
      ) : (
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, i) => (
         <a
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="flex flex-col rounded-xl border border-hairline bg-linen/60 p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline hover:"
         >
          <span className="flex flex-wrap items-center gap-2">
           <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tagTint(
             i,
            )}`}
           >
            {post.tags[0]}
           </span>
           {post.type === "case-study" && <CaseStudyBadge />}
          </span>
          <h3 className="mt-4 text-base font-semibold leading-snug text-ink">
           {post.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">
           {post.description}
          </p>
          <p className="mt-5 text-xs text-fog">
           {formatDate(post.publishedAt)} · {readingTime(post)} min read
          </p>
         </a>
        ))}
       </div>
      )}
     </div>
    </section>
   </main>
   <Footer onBook={() => setBookingOpen(true)} />
   {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
  </div>
 );
}
