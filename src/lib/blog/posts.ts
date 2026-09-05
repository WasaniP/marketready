/**
 * MarketReady Resources content registry (build #21).
 *
 * Lightweight, typed, dependency-free post store for blog articles AND case
 * studies: a small structured block array keeps content SSR/hydration-safe
 * (no markdown parsing, no client-only rendering). All helpers are pure
 * functions of this static data, so server and client always render the same
 * output. No case-study posts are fabricated; the Case Studies tab stays
 * empty until the founder supplies real material.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Structured content block: the only shapes the post template renders. */
export type BlogBlock =
  | { type: "paragraph"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; cite?: string };

/** Allowed topic tags. "Case Studies" is a content-type tag for case-study posts.
 * "Teardowns" tags the archetypal GTM teardown articles (build #22). */
export const BLOG_TAGS = [
  "Positioning",
  "Messaging",
  "GTM Strategy",
  "ICP",
  "Launch",
  "Pricing & Packaging",
  "Teardowns",
  "Case Studies",
] as const;

export type BlogTag = (typeof BLOG_TAGS)[number];

/** Cross-post origin (e.g. Substack). Rendered only when `url` is truthy. */
export type BlogSource = {
  name: "Substack";
  url: string;
};

/** Content type: long-form article, or client case study (none fabricated yet). */
export type PostType = "article" | "case-study";

export type BlogPost = {
  /** Content type: always explicit so a future post can't silently misclassify. */
  type: PostType;
  slug: string;
  title: string;
  /** One-sentence summary: blog index cards + per-post meta description. */
  description: string;
  /** ISO date (YYYY-MM-DD). Displayed via formatDate(). */
  publishedAt: string;
  tags: BlogTag[];
  /** Optional cross-post link shown in the post header. */
  source?: BlogSource;
  content: BlogBlock[];
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const WORDS_PER_MINUTE = 200;

/** ~200 wpm reading time, derived from content word count. Pure + SSR-safe. */
export function readingTime(post: Pick<BlogPost, "content">): number {
  let words = 0;
  for (const block of post.content) {
    if (block.type === "list") {
      for (const item of block.items) words += item.split(/\s+/).length;
    } else if (block.type === "quote") {
      words += block.text.split(/\s+/).length;
      if (block.cite) words += block.cite.split(/\s+/).length;
    } else {
      words += block.text.split(/\s+/).length;
    }
  }
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** "Aug 12, 2026", formatted in UTC so SSR and client output always match. */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ------------------------------------------------------------------ */
/* Posts (sorted newest first by getAllPosts)                          */
/* ------------------------------------------------------------------ */

const POSTS: BlogPost[] = [
  {
    type: "article",
    slug: "positioning-is-a-decision",
    title: "Positioning is a decision, not a tagline",
    description:
      "Most teams treat positioning as copywriting. It's actually a series of strategic choices, and the choices are where the value lives.",
    publishedAt: "2026-08-12",
    tags: ["Positioning"],
    source: { name: "Substack", url: "#" },
    content: [
      {
        type: "paragraph",
        text: "Ask a founder what their positioning is and you'll usually get a tagline. Ask them who they lose deals to and you'll get the real story: a category they never claimed, a buyer they never named, and a difference they never staked out. The tagline was the last step. The thinking never happened.",
      },
      {
        type: "paragraph",
        text: "Positioning is the set of choices that decide how a market files you: what category you own, who the offer is for, why you win the evaluation, and what you deliberately give up. Every one of those is a decision, and decisions are uncomfortable because they close doors. Copywriting is comfortable because it opens none.",
      },
      {
        type: "h2",
        text: "The four decisions behind every position",
      },
      {
        type: "paragraph",
        text: "Before any words go on a page, four questions need answers, in writing, with a named owner, and with the trade-offs made explicit:",
      },
      {
        type: "list",
        items: [
          "Category: what do buyers already call the thing you sell, and which adjacent category are you deliberately not competing in?",
          "ICP: which specific person's problem is this built for, and whose problem are you willing to be wrong for?",
          "Difference: what can't a competitor copy in a quarter, such as a benchmark, an integration, a workflow, or a constraint you chose?",
          "Proof: what observable evidence backs each claim, and what claim goes if the evidence isn't there?",
        ],
      },
      {
        type: "paragraph",
        text: "Teams that skip these decisions don't have positioning that needs polishing. They have a description of the product waiting for a competitor to assign it a category.",
      },
      {
        type: "quote",
        text: "You don't find your position by surveying what you're good at. You choose what you'll be known for, and then you make the product and the story agree with the choice.",
        cite: "The MarketReady playbook",
      },
      {
        type: "h2",
        text: "A decision creates friction. That's the point",
      },
      {
        type: "paragraph",
        text: "The moment a team commits to a category and an ICP, someone inside the company will object: \"But we could sell to enterprise too.\" \"But our tool helps marketers as well.\" That friction is the signal that a real choice was made. Positioning that pleases everyone internally is positioning that no one outside the company can remember.",
      },
      {
        type: "paragraph",
        text: "The useful test isn't whether the positioning sounds right in a room. It's whether a first-time visitor can name the category, the buyer, and the difference within the first screen of the site, and whether the sales team can repeat them from memory after one read. If either fails, the gap is usually a missing decision, not a missing word.",
      },
      {
        type: "h2",
        text: "Start with the decision, then write",
      },
      {
        type: "paragraph",
        text: "Taglines, hero copy, and launch narratives all get easier once the decisions exist, because they stop being creative exercises and become tests of the choice. The 9-parameter diagnostic in the MarketReady assessment checks for exactly this: whether a category is staked, an ICP is named, a difference is defensible, and the promise is backed by evidence. When a site scores low, it's almost never because the copywriter underperformed. It's because a decision was deferred.",
      },
      {
        type: "paragraph",
        text: "Make the decision. Write the tagline last. The market will file you somewhere either way. The only question is whether you choose where.",
      },
    ],
  },
  {
    type: "article",
    slug: "the-9-parameters-that-predict-launch-risk",
    title: "The 9 parameters that predict launch risk",
    description:
      "Before you spend on launch distribution, score the nine things that decide whether the market will actually adopt what you're shipping.",
    publishedAt: "2026-07-28",
    tags: ["GTM Strategy"],
    content: [
      {
        type: "paragraph",
        text: "Most launches fail quietly before day one. The announcement goes out, the traffic comes in, and the conversion numbers expose what the team never checked: the market couldn't answer three basic questions: what this is, who it's for, and why it beats what they already use. None of that is fixed by more distribution. It's fixed by the positioning and GTM groundwork that should have happened first.",
      },
      {
        type: "h2",
        text: "Nine parameters, three pillars",
      },
      {
        type: "paragraph",
        text: "The MarketReady diagnostic scores a launch across nine parameters, grouped into three pillars. They're deliberately the boring things, the things you can check before spending a dollar on launch activity:",
      },
      {
        type: "h3",
        text: "1. Core positioning & ICP alignment",
      },
      {
        type: "list",
        items: [
          "Positioning: can a first-time visitor name the category you own?",
          "ICP: is the messaging aimed at a specific, named buyer instead of a vague crowd?",
          "Differentiation: is there a difference competitors can't copy in a quarter?",
        ],
      },
      {
        type: "h3",
        text: "2. Messaging & value proposition",
      },
      {
        type: "list",
        items: [
          "Messaging: do headlines lead with the buyer's outcome, not the technology?",
          "Value proposition: is the promise quantified and time-bound for a named beneficiary?",
          "Conversion readiness: is there one clear CTA per page with proof beneath it?",
        ],
      },
      {
        type: "h3",
        text: "3. GTM & launch velocity",
      },
      {
        type: "list",
        items: [
          "Pricing & packaging: can a buyer self-qualify, or is evaluation blocked by opacity?",
          "GTM readiness: is there a repeatable channel-to-customer motion with an offer at the end?",
          "Launch readiness: does the launch kit (narrative, assets, targets, dated sequence with owners) exist?",
        ],
      },
      {
        type: "quote",
        text: "Launch risk isn't the risk that nobody sees you. It's the risk that the people who see you can't figure out what you are.",
      },
      {
        type: "h2",
        text: "Why these nine predict outcomes",
      },
      {
        type: "paragraph",
        text: "Each parameter maps to a failure mode that shows up in the numbers. Weak positioning shows up as high bounce and low time-on-page. A fuzzy ICP shows up as leads that don't qualify. A missing difference shows up in win-loss notes: \"went with the incumbent.\" Hidden pricing shows up as inbound that never books. None of these are marketing problems in the creative sense; they're decisions that were never made, and they surface as predictable downstream costs.",
      },
      {
        type: "paragraph",
        text: "That's why the score matters more than the launch date. A team that ships a launch with a 35/100 readiness score isn't unlucky when the campaign underperforms; it's predictable. The fix isn't to push harder; it's to close the specific gaps the score names, in order of severity.",
      },
      {
        type: "h2",
        text: "Score before you spend",
      },
      {
        type: "paragraph",
        text: "Run the assessment on your live site and you'll get a 0 to 100 score with the top three gaps spelled out, each with a before/after rewrite you can ship today. The highest-leverage time to run it is before you commit budget to launch distribution, because the cheapest gap to close is the one you find before the market does.",
      },
    ],
  },
  {
    type: "article",
    slug: "messaging-that-survives-contact-with-sales",
    title: "Messaging that survives contact with sales",
    description:
      "The hero copy that wins the click is not the language that wins the deal. Here's how to build messaging that holds up in the demo.",
    publishedAt: "2026-07-14",
    tags: ["Messaging"],
    content: [
      {
        type: "paragraph",
        text: "There's a version of every company's messaging that sounds great on the website and falls apart in the first sales call. The buyer shows up because the ad promised outcomes; ten minutes into the demo, they're asking how it handles their data stack, and the rep is improvising. The gap between the promise and the conversation is where deals go to die, not because the product is bad, but because the messaging was built for impressions, not for proof.",
      },
      {
        type: "h2",
        text: "The site sells the outcome. Sales sells the mechanism.",
      },
      {
        type: "paragraph",
        text: "Marketing and sales are doing two different jobs with the same offer. The site has seconds to earn a click, so it leads with the outcome. The rep has an hour to earn a signature, so the conversation must move from outcome to mechanism: how it works, what it replaces, what the buyer has to change to get the result. Messaging that survives contact with sales supports both moves: the outcome on the surface, and the mechanism one layer down, ready to be produced the moment a skeptical buyer asks \"how?\"",
      },
      {
        type: "quote",
        text: "If your sales team has to invent the value story on the first call, your messaging wasn't finished; it was just published.",
        cite: "The MarketReady playbook",
      },
      {
        type: "h2",
        text: "Three tests for deal-surviving messaging",
      },
      {
        type: "paragraph",
        text: "Before you lock any hero copy or pitch language, run it through three checks:",
      },
      {
        type: "list",
        items: [
          "The substitution test: could a competitor put their logo on your page and look equally true? If yes, you've described the category, not your offer.",
          "The objection test: for every claim on the page, can you answer the first question a procurement team would ask? If the claim can't survive one \"how do you know,\" soften it before the buyer finds out.",
          "The handoff test: does the site language and the demo script use the same nouns for the same things? When marketing and sales use different vocabulary for the same feature, buyers assume the product changed between the page and the call.",
        ],
      },
      {
        type: "h2",
        text: "Build the proof stack under every promise",
      },
      {
        type: "paragraph",
        text: "Every outcome claim should have a proof layer beneath it: the mechanism that produces the outcome, the evidence that it works, and the conditions under which it doesn't. Sales teams don't need a script; they need a proof stack they can draw from as the conversation moves. When a claim survives contact with sales, it's because the person making it can go one layer deeper than the promise, and the layer below is real.",
      },
      {
        type: "paragraph",
        text: "This is exactly what a messaging framework is for. It keeps the outcome claim on the surface where it earns attention, and keeps the mechanism, the evidence, and the honest caveats organized underneath where they win trust. Build the framework before the launch, arm the team with it, and the demo stops being where your messaging goes to die.",
      },
    ],
  },
  /* Build #22: teardown posts: generic archetypes (no client-specific
     claims), type 'article' + tag 'Teardowns' so the resources hub and the
     homepage teardowns section link to real content. */
  {
    type: "article",
    slug: "teardown-ad-spend-on-unclear-messaging",
    title: "Teardown: scaling ad spend on unclear messaging",
    description:
      "The most expensive GTM mistake isn't a bad channel; it's paying to send more people to a message they can't parse.",
    publishedAt: "2026-08-18",
    tags: ["Teardowns"],
    content: [
      {
        type: "paragraph",
        text: "The pattern is easy to spot and expensive to run: a growth team gets budget approval, doubles the paid campaigns, and waits for the funnel to scale. Instead, CPA creeps up, landing-page conversion holds flat, and the report turns into a debate about creative fatigue. The channel was never the problem. The message was.",
      },
      {
        type: "h2",
        text: "What's actually happening",
      },
      {
        type: "paragraph",
        text: "Paid traffic only amplifies what the landing page already communicates. If a first-time visitor can't name the category, the buyer, and the difference within the first screen, then every new click is another person failing the same five-second test. More budget means more people failing it. The cost per outcome rises even though the creative quality never changed. This is why the diagnostic's positioning and messaging parameters tend to move in lockstep with paid efficiency: the score didn't change, so the economics didn't either.",
      },
      {
        type: "list",
        items: [
          "The hero names a capability instead of an outcome for a named buyer.",
          "The category is implied, so the ad and the landing page can mean two different offers.",
          "The difference is generic ('faster', 'better', 'cheaper'), so no evaluation has a reason to prefer you.",
        ],
      },
      {
        type: "quote",
        text: "Scaling spend before the message is clear multiplies the confusion, not the revenue.",
        cite: "The MarketReady playbook",
      },
      {
        type: "h2",
        text: "The fix",
      },
      {
        type: "paragraph",
        text: "Rewrite the hero around one named buyer and one quantified outcome before touching budget. Test the new message at the current spend level until conversion holds, then scale what already converts. The diagnostic's before/after rewrites exist for exactly this: they turn a vague promise into a testable one in an afternoon.",
      },
    ],
  },
  {
    type: "article",
    slug: "teardown-feature-focused-pitch-decks",
    title: "Teardown: feature-focused pitch decks",
    description:
      "When the deck walks feature by feature, the buyer never hears what changes for them.",
    publishedAt: "2026-08-15",
    tags: ["Teardowns"],
    content: [
      {
        type: "paragraph",
        text: "Some pitch decks are really product tours in disguise. Slide one introduces the platform. Slide two shows the dashboard. Slide three walks a workflow, and somewhere around slide eight the buyer's question becomes 'so what?', out loud or in their head. The deck answered a question nobody asked: what the product does, instead of what changes for the buyer.",
      },
      {
        type: "h2",
        text: "Why feature tours stall evaluations",
      },
      {
        type: "paragraph",
        text: "A buyer evaluating a new vendor is trying to build a mental model of before and after: what they'd do differently, what they'd stop doing, and what the outcome would look like in their numbers. A feature-by-feature deck forces them to do that translation themselves, and most won't. They'll file you under 'nice product, not for us' and move on. Competitors with a simpler story win the meeting even with an inferior feature set, because the buyer can repeat their pitch to a colleague.",
      },
      {
        type: "h2",
        text: "Restructure around the outcome",
      },
      {
        type: "list",
        items: [
          "Open with the buyer's before-state and the specific problem that makes it painful.",
          "Present the after-state first: what changes, in their language, with their metric.",
          "Use features as proof points beneath the outcome: evidence that the after-state is real, not the story itself.",
        ],
      },
      {
        type: "paragraph",
        text: "The test: can someone who missed the demo repeat your pitch to a colleague in two sentences? If the two sentences describe features, the deck is a product tour. If they describe a change the buyer gets to experience, the deck is a pitch. Most decks fail that test on the first slide, and it takes a rewrite of the narrative, not a polish pass, to fix.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Registry API                                                        */
/* ------------------------------------------------------------------ */

/** All posts, newest first. Returns a fresh array each call. */
export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Posts of one content type, newest first (pure filter of getAllPosts). */
export function getPostsByType(type: PostType): BlogPost[] {
  return getAllPosts().filter((p) => p.type === type);
}
