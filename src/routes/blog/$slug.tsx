/**
 * MarketReady Insights post template (build #20).
 * SSR-rendered article: max-w-[720px] centered column, structured block
 * rendering (paragraph / h2 / h3 / list / quote-callout), per-post document
 * title + meta description via route head, sticky end-of-article CTA linking
 * to the homepage calculator anchor (/ #assessment), and a styled 404 for
 * unknown slugs (loader throws notFound() → HTTP 404 + route notFoundComponent).
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { getPostBySlug, formatDate, readingTime } from "~/lib/blog/posts";
import type { BlogPost } from "~/lib/blog/posts";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";

export const Route = createFileRoute("/blog/$slug")({
 loader: ({ params }) => {
  const post = getPostBySlug(params.slug);
  if (!post) throw notFound();
  return post;
 },
 head: ({ loaderData }) => {
  const post = loaderData;
  return {
   meta: [
    {
     title: post ? `${post.title}: MarketReady` : "Post not found: MarketReady",
    },
    {
     name: "description",
     content: post?.description ?? "MarketReady Insights on positioning and go-to-market.",
    },
   ],
  };
 },
 component: BlogPostPage,
 notFoundComponent: PostNotFound,
});

/* ------------------------------------------------------------------ */
/* Block renderer                           */
/* ------------------------------------------------------------------ */

function renderBlock(block: BlogPost["content"][number], key: number) {
 switch (block.type) {
  case "paragraph":
   return (
    <p key={key} className="text-[17px] leading-8 text-mist">
     {block.text}
    </p>
   );
  case "h2":
   return (
    <h2
     key={key}
     className="mt-10 scroll-mt-24 text-2xl font-bold tracking-tight text-ink"
    >
     {block.text}
    </h2>
   );
  case "h3":
   return (
    <h3 key={key} className="mt-8 text-lg font-semibold tracking-tight text-ink">
     {block.text}
    </h3>
   );
  case "list":
   return (
    <ul key={key} className="my-6 flex flex-col gap-2.5">
     {block.items.map((item, i) => (
      <li key={i} className="flex items-start gap-3 text-[17px] leading-7 text-mist">
       <svg
        aria-hidden="true"
        className="mt-2 h-4 w-4 shrink-0 text-ember"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
       >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
       </svg>
       <span>{item}</span>
      </li>
     ))}
    </ul>
   );
  case "quote":
   return (
    <blockquote
     key={key}
     className="my-8 rounded-r-xl border-l-2 border-electric bg-ember/[0.06] px-6 py-5"
    >
     <p className="text-lg italic leading-relaxed text-ink">{block.text}</p>
     {block.cite && (
      <footer className="mt-3 text-sm font-medium not-italic text-fog">
       - {block.cite}
      </footer>
     )}
    </blockquote>
   );
 }
}

/* ------------------------------------------------------------------ */
/* Page                                */
/* ------------------------------------------------------------------ */

function BlogPostPage() {
 const post = Route.useLoaderData();
 const [bookingOpen, setBookingOpen] = useState(false);
 const closeBooking = () => setBookingOpen(false);

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main>
    <article className="mx-auto max-w-[720px] px-5 pb-16 pt-32 sm:px-8 sm:pt-40">
     {/* Header block: tag pill + title + date/reading-time meta line */}
     <header className="border-b border-hairline pb-8">
      <span className="inline-flex rounded-full border border-ember/40 bg-ember/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ember">
       {post.tags[0]}
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
       {post.title}
      </h1>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fog">
       <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
       <span aria-hidden="true" className="text-mist">
        ·
       </span>
       <span>{readingTime(post)} min read</span>
       {post.source && post.source.url && (
        <a
         href={post.source.url}
         className="text-ember transition-colors hover:text-ember/80"
        >
         Also on {post.source.name} →
        </a>
       )}
      </div>
     </header>

     {/* Article body */}
     <div className="mt-10 flex flex-col gap-6">
      {post.content.map((block, i) => renderBlock(block, i))}
     </div>

     {/* Sticky end-of-article CTA: prominent glass card, teal glow.
       Links to /services/diagnostic (the live 5-dimension diagnostic tool). */}
     <div className="sticky bottom-6 z-10 mt-14">
      <div className="rounded-2xl border border-ember/40 bg-[#2A2320]/70 p-8 text-center backdrop-blur-xl">
       <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
        Know your Market Readiness Score?
       </h2>
       <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-mist">
        Run the free audit and see your 9-parameter Market Readiness Score in under a
        minute.
       </p>
       <a
        href="/services/diagnostic"
        className="btn-electric mt-6 w-full px-8 py-3 text-base sm:w-auto"
       >
        Get Your MarketReady Score™
       </a>
      </div>
     </div>
    </article>
   </main>
   <Footer onBook={() => setBookingOpen(true)} />
   {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
  </div>
 );
}

/* ------------------------------------------------------------------ */
/* Unknown slug → styled 404                      */
/* ------------------------------------------------------------------ */

function PostNotFound() {
 const [bookingOpen, setBookingOpen] = useState(false);
 const closeBooking = () => setBookingOpen(false);

 return (
  <div className="min-h-dvh bg-gradient-to-b from-[#16120F] via-[#1F1A16] to-[#16120F]">
   <Header />
   <main className="mx-auto max-w-2xl px-5 pb-24 pt-40 text-center sm:px-8">
    <span className="chip border-ember/40 text-ember">404</span>
    <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
     Post not found
    </h1>
    <p className="mt-3 text-mist">
     That article doesn't exist, or it's still being written.
    </p>
    <a href="/blog" className="btn-ghost mt-8 px-7 py-3">
     Back to Insights
    </a>
   </main>
   <Footer onBook={() => setBookingOpen(true)} />
   {bookingOpen && <BookingModal open={bookingOpen} onClose={closeBooking} />}
  </div>
 );
}
