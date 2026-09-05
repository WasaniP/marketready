/**
 * Copy generation for the audit engine: one diagnostic sentence plus a
 * representative "before" line and a benefit-led "after" rewrite per parameter,
 * extended with accordion content: a deeper rationale, positive signals, and
 * missing elements. All content adapts to the submitted businessModel /
 * launchStage / icp so the result feels specific rather than canned.
 *
 * The `before` strings are deliberately representative template lines (the
 * engine is a simulated first-pass assessment; live crawling lands later), so
 * nothing here claims to quote a verbatim line from the user's real site.
 */

import type { AssessmentInput } from "./types";

/** Internal prose band keys (not user-facing status labels; the display status
 * comes from engine.statusFor with its own vocabulary). */
type Band = "strong" | "NEEDS WORK" | "CRITICAL GAP";

function band(score: number): Band {
  if (score >= 75) return "strong";
  if (score >= 40) return "NEEDS WORK";
  return "CRITICAL GAP";
}

/** Short noun for the business model, e.g. "AI infrastructure platform" (no article; callers add "The " / "the only "). */
function modelNoun(model: string): string {
  switch (model) {
    case "B2B SaaS":
      return "B2B SaaS product";
    case "AI Infrastructure":
      return "AI infrastructure platform";
    case "Consumer AI":
      return "consumer AI app";
    case "Enterprise":
      return "enterprise platform";
    case "Marketplaces":
      return "two-sided marketplace";
    default:
      return "product";
  }
}

/** Feature-flavoured example language, varied by business model. */
function exampleJargon(model: string): string {
  switch (model) {
    case "AI Infrastructure":
      return "'LLM-native infrastructure', 'inference at scale', 'agent orchestration'";
    case "Consumer AI":
      return "'the AI that thinks like you', 'magical', 'next-gen assistant'";
    case "Enterprise":
      return "'enterprise-grade', 'SOC 2 Type II', 'best-in-class security'";
    case "Marketplaces":
      return "'the largest network of AI builders', 'seamless matching'";
    case "B2B SaaS":
      return "'AI-powered workflows', 'enterprise-grade AI', 'automation at scale'";
    default:
      return "'AI-powered', 'next-gen', 'enterprise-grade'";
  }
}

export interface ParamCopy {
  diagnostic: string;
  /** Direct, plain-spoken 1-sentence observation of what was FOUND or MISSING
   * on the page, grounded in the messaging/patterning detected on the site.
   * Deterministic per score band so the local fallback matches the live
   * /api/diagnose keyObservation shape. NOT a textbook definition. */
  keyObservation: string;
  /** 1-sentence business impact: the commercial risk (score below 70) or the
   * competitive advantage (score >= 70) the current site framing creates. The
   * UI relabels this single statement at the 70 threshold. */
  commercialRisk: string;
  before: string;
  after: string;
  /** Why this parameter matters + why it scored this way for THIS assessment. */
  rationale: string;
  /** Concrete signals working in the site's favor. */
  positives: string[];
  /** Concrete elements the parameter is missing. */
  missing: string[];
}

export type CopyBuilder = (input: AssessmentInput, score: number) => ParamCopy;

const buyer = (input: AssessmentInput): string => input.icp.trim() || "your target buyer";

const isPreLaunch = (input: AssessmentInput): boolean =>
  input.launchStage === "Pre-Launch / MVP";

export const COPY: Record<string, CopyBuilder> = {
  positioning: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP":
        "Your category frame is too generic for a buyer to tell in one line what space you own.",
      "NEEDS WORK":
        "You name a category, but the frame is broad enough that competitors blur together in it.",
      strong:
        "Your positioning stakes a clear, ownable category and names the buyer in the first screen.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP":
        "Visitors cannot quickly classify the product, driving up initial bounce rates. Every unclassified visitor opens the door for a competitor that states its category in one line.",
      "NEEDS WORK":
        "Buyers cannot tell why this product wins at a glance, lengthening evaluation and keeping generic alternatives in the running.",
      strong:
        "Visitors self-classify the product instantly, shortening the path from first visit to a qualified conversation.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP":
        "The hero headline relies on broad process terms rather than defining an explicit software category.",
      "NEEDS WORK":
        "The hero names a category, but the frame is broad enough that competitors blur together in it.",
      strong:
        "The first screen names a specific software category and the buyer it serves in one glance.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP":
        "Positioning measures whether a first-time visitor can tell, in one glance at the first screen, what category you own and who it's for. Right now the hero leans on generic category language, so a visitor scrolls past the first screen without a frame to file you under.",
      "NEEDS WORK":
        "Positioning measures how fast a visitor can name the category you own and who it serves. Yours names a category, but the frame is broad enough that the visitor has to keep reading to see who it's for and why it beats the alternatives.",
      strong:
        "Positioning measures whether a first-time visitor can name the category you own and the buyer you serve within the first screen. Your frame passes that test: category, buyer, and difference survive a five-second scan.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `Your homepage opens with generic category language, such as 'AI-powered', 'next-gen', and 'enterprise-grade', instead of naming the category you win.`,
      after: `Open with a category you can own: 'The ${modelNoun(
        input.businessModel,
      )} for ${buyer(input)}.' One sentence that makes the right buyer self-identify.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? [
              "The category is named in the first screen",
              "The buyer is identifiable from the hero alone",
              "Category language stays consistent across hero, nav, and CTAs",
            ]
          : b === "NEEDS WORK"
            ? ["A category name is present in the hero", "The product name and domain reinforce the space you play in"]
            : [
                "The product name and domain signal the space",
                pre
                  ? "Pre-launch is the right moment to lock the frame; nothing is baked in yet"
                  : "The hero has room to carry a sharper frame without a redesign",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep testing the frame against how real buyers describe the problem"]
          : b === "NEEDS WORK"
            ? [
                "A category frame narrow enough to be ownable",
                "A named buyer in the first screen: positioning for a role, not a crowd",
                pre ? "Validation that the category name resonates with early prospects" : "A line that frames how you differ inside the category",
              ]
            : [
                "A category frame that only you can own, but the hero reads as generic category language today",
                "A named buyer in the opening line",
                pre ? "At least one round of positioning interviews to pressure-test the frame" : "A 'why now' line that makes the category feel urgent",
              ],
    };
  },

  icp: (input, score) => {
    const b = band(score);
    const hasIcp = input.icp.trim().length > 0;
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP": hasIcp
        ? "You've named an ICP, but the site still speaks to a much broader crowd than that buyer."
        : "You haven't named a specific buyer, so your messaging spreads thin across 'everyone'.",
      "NEEDS WORK": hasIcp
        ? "Your ICP is defined on paper, but key pages pitch a generic audience instead of that buyer."
        : "The ICP is vague, so the pitch lands with no one in particular.",
      strong: "Your ICP is specific and the messaging consistently addresses that exact buyer.",
    };
    const impact: Record<Band, string> = hasIcp
      ? {
          "CRITICAL GAP":
            "The strongest-fit prospects are drowned in generic messaging aimed at no one in particular, so the pitch loses the buyers it most needs.",
          "NEEDS WORK":
            "Qualified buyers do not feel the pitch is for them, slowing the path from interest to a qualified conversation.",
          strong:
            "The right buyer immediately recognizes themselves in the pitch, compressing the discovery-to-conversation cycle.",
        }
      : {
          "CRITICAL GAP":
            "Copy spreads thin across everyone and lands with no one, so strangers do not convert into qualified conversations.",
          "NEEDS WORK":
            "The strongest-fit buyer is left uncertain whether the product is for them, slowing qualified conversions.",
          strong:
            "The named persona helps the strongest-fit buyer feel the pitch is aimed at them, accelerating qualified conversations.",
        };
    const observation: Record<Band, string> = hasIcp
      ? {
          "CRITICAL GAP":
            "The site still speaks to a much broader crowd than the buyer it names in the assessment.",
          "NEEDS WORK":
            "The ICP is defined on paper, but several key pages still pitch a broader crowd than that buyer.",
          strong:
            "The messaging consistently addresses a specific, named buyer by role and pain, not a generic crowd.",
        }
      : {
          "CRITICAL GAP":
            "No concrete buyer persona anchors the messaging, so the copy is aimed at everyone in general.",
          "NEEDS WORK":
            "The ICP is vague, so the pitch reads as written for a crowd rather than a person with a job to do.",
          strong:
            "A defined persona anchors the messaging, though sharpening role and pain would make it more concrete.",
        };
    const rationale: Record<Band, string> = hasIcp
      ? {
          "CRITICAL GAP": `ICP / Audience measures whether the messaging is aimed at a specific, named buyer and actually speaks to that person. You named ${buyer(
            input,
          )} in the assessment, but this parameter also checks the site itself, and key pages still pitch a much broader crowd.`,
          "NEEDS WORK": `You defined an ICP (${buyer(
            input,
          )}) on paper, but this parameter measures whether the buyer shows up in the messaging, and several pages still address a generic audience.`,
          strong: `ICP / Audience measures whether a specific, named buyer anchors the messaging. ${buyer(
            input,
          )} is named and the site's language consistently tracks that persona, which is exactly what converts strangers into qualified conversations.`,
        }
      : {
          "CRITICAL GAP":
            "ICP / Audience measures whether a specific, named buyer anchors the messaging. The assessment recorded no ICP, so the site has no persona to anchor to, so every message spreads thin across 'everyone' and lands with no one in particular.",
          "NEEDS WORK":
            "ICP / Audience measures whether a specific, named buyer anchors the messaging. The ICP described in the assessment is vague, so the pitch reads as written for a crowd rather than a person with a job to do.",
          strong:
            "ICP / Audience measures whether a specific, named buyer anchors the messaging. A defined persona is present, though sharpening the role, the pain, and the outcome would make it even more concrete.",
        };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `The site speaks to 'anyone building AI', with no job title, role, or persona to anchor the pitch.`,
      after: `Name the buyer in the first screen: '${buyer(
        input,
      )}', by role and pain, so the right people feel the pitch was written for them.`,
      rationale: rationale[b],
      positives: hasIcp
        ? [
            `You've named ${buyer(input)} as the target, a concrete persona to build messaging around`,
            b === "strong" ? "Key pages consistently address that persona" : "At least the hero signals the intended audience",
          ]
        : [
            "The product's feature set hints at a natural buyer",
            "The category is clear enough to infer a starting persona",
          ],
      missing: !hasIcp
        ? [
            "A named, specific buyer: the ICP field was left blank in the assessment",
            "Role-, pain-, and outcome-specific messaging that addresses that persona",
            "A user vs. decision-maker distinction if the sale is multi-party",
          ]
        : b === "strong"
          ? ["Nothing structural; watch for scope creep toward adjacent personas as you grow"]
          : [
              "Pages that speak to " + buyer(input) + " rather than 'everyone'",
              "A persona page or buyer-outcome section that names their job and pain",
            ],
    };
  },

  messaging: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP":
        "Messaging leads with technology and features, not the outcome the buyer actually wants.",
      "NEEDS WORK":
        "Messaging mixes feature talk with outcome talk, diluting the headline promise.",
      strong: "Messaging leads with the buyer's outcome and keeps jargon in the proof, not the pitch.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP":
        "Visitors must translate the pitch into value themselves and lose interest before the proof arrives.",
      "NEEDS WORK":
        "The diluted promise softens the pull that would keep the right buyer reading past the headline.",
      strong:
        "Value registers in the first screen, keeping qualified visitors engaged long enough to reach the proof and the next step.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP":
        "The headline leads with technology and features, not the outcome the buyer actually wants.",
      "NEEDS WORK":
        "The headline mixes feature talk with outcome talk, diluting the hero promise.",
      strong:
        "The headline leads with the buyer's outcome and keeps jargon in the proof section.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP":
        "Messaging measures whether headlines lead with the buyer's outcome or with the technology itself. Your headlines lead with " +
        exampleJargon(input.businessModel) +
        ", tech language that forces the buyer to do the translation work instead of the page doing it.",
      "NEEDS WORK":
        "Messaging measures whether headlines lead with the buyer's outcome. Yours mix outcome language with feature talk, so the headline promise gets diluted before the visitor reaches the proof.",
      strong:
        "Messaging measures whether headlines lead with the buyer's outcome. Yours do: the outcome is the headline, and jargon is confined to the proof section where it belongs.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `Headlines lead with ${exampleJargon(input.businessModel)}, tech language that dilutes the outcome.`,
      after: `Lead with the outcome: what concretely changes for ${buyer(
        input,
      )} in the first week of adoption. Jargon becomes proof, not the pitch.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["The hero names an outcome, not just a capability", "Proof sections carry the technical depth", "CTA language matches the outcome promise"]
          : b === "NEEDS WORK"
            ? ["Outcome language appears somewhere in the hero", "The product's technical depth is real and documented"]
            : [
                "The product's technical story is substantive; it just needs to move out of the headline",
                pre ? "Messaging is still malleable pre-launch, so the fix is cheap right now" : "The page structure can absorb a headline swap without a redesign",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep every new page on the same outcome-first template"]
          : b === "NEEDS WORK"
            ? ["A single outcome-led headline for the hero", "A messaging hierarchy: one promise, then proof, then features", "Consistent outcome-first CTA copy across pages"]
            : [
                "A headline that leads with the buyer's outcome instead of the technology",
                "A defined messaging hierarchy before more pages get written",
                pre ? "A message-testing pass with 5 to 8 prospects before launch" : "Jargon moved from the headline into the proof section",
              ],
    };
  },

  differentiation: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP":
        "Your differentiation is 'we're better / faster / cheaper', table stakes every competitor prints.",
      "NEEDS WORK":
        "You gesture at differentiation, but nothing on the site names what makes you the only one who can do this.",
      strong: "You own a specific, defensible difference and back it with proof buyers can verify.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP":
        "Buyers cannot tell why this product wins, so it gets evaluated on price and the deal compresses before it starts.",
      "NEEDS WORK":
        "Buyers keep alternatives in the running, which drags out evaluation and hands the decision to price.",
      strong:
        "Buyers can pre-commit to this product over alternatives, shortening evaluation and protecting the price.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP":
        "Differentiation rests on faster, better, cheaper claims that any competitor can print.",
      "NEEDS WORK":
        "The site gestures at a difference but never names what makes this the only product that can do it.",
      strong:
        "A specific, defensible difference is named and backed by proof buyers can verify.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP":
        "Differentiation measures whether the site names a difference competitors can't copy, such as a spec, a benchmark, a category, or a business model, rather than 'faster / better / cheaper' claims anyone can print. Yours currently reads as table stakes.",
      "NEEDS WORK":
        "Differentiation measures whether the site names a difference competitors can't copy. You gesture at one, but nothing on the page says what makes you the only one who can do this for the buyer.",
      strong:
        "Differentiation measures whether the site names a difference competitors can't copy. You own one and back it with proof buyers can verify; that's what turns a commodity into a category leader.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `The site differentiates with 'more powerful', 'faster setup', and 'best-in-class', claims any competitor can make.`,
      after: `Own one defensible difference: 'the only ${modelNoun(
        input.businessModel,
      )} that does X for ${buyer(input)}', and prove it with a spec, benchmark, or customer result.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["A specific difference is named and repeated", "Proof (spec, benchmark, or customer result) sits next to the claim", "The difference is tied to the buyer's outcome"]
          : b === "NEEDS WORK"
            ? ["A difference is gestured at somewhere on the site", "The team clearly has a technical edge to formalize"]
            : [
                pre
                  ? "Pre-launch, the technical edge can still be baked into the story"
                  : "The product appears to have a real technical difference under the surface",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep the proof current as the product evolves"]
          : b === "NEEDS WORK"
            ? [
                "A named, one-line difference competitors can't print",
                "Verifiable proof under the claim: benchmark, spec, or customer result",
              ]
            : [
                "A defensible difference: a spec, benchmark, or business-model edge no competitor can print",
                "Proof placed directly under the differentiation claim",
                pre ? "A competitive teardown (3 to 5 alternatives) to find the gap to own" : "A page section that names alternatives and the reason you win",
              ],
    };
  },

  "value-prop": (input, score) => {
    const b = band(score);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP":
        "The value proposition states what the product does, not the business outcome the buyer gets.",
      "NEEDS WORK":
        "The value prop hints at an outcome but lacks a metric or timeframe to make it credible.",
      strong: "The value prop leads with a quantified outcome and a named beneficiary.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP":
        "A capability statement gives the visitor no reason to act or to justify the purchase internally.",
      "NEEDS WORK":
        "The payoff stays unverified, slowing evaluation because buyers cannot size the benefit.",
      strong:
        "Buyers can size the payoff, making the purchase easier to justify and faster to decide.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP":
        "The value prop states what the product does, not the business outcome the buyer gets.",
      "NEEDS WORK":
        "The value prop hints at an outcome but lacks the metric or timeframe that makes it credible.",
      strong:
        "The value prop leads with a quantified, time-bound outcome for a named beneficiary.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP":
        "Value Proposition measures whether the hero promise names a quantified, time-bound outcome for a named beneficiary, or just describes what the product does. Yours is currently a capability statement: 'automate your AI workflows', with no metric, no timeframe, and no named beneficiary.",
      "NEEDS WORK":
        "Value Proposition measures whether the hero promise names a quantified, time-bound outcome for a named beneficiary. Yours hints at an outcome but lacks the metric or timeframe that makes a promise credible instead of aspirational.",
      strong:
        "Value Proposition measures whether the hero promise names a quantified, time-bound outcome for a named beneficiary. Yours does: the number makes the promise concrete and the buyer can pre-compute whether it's worth it.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `The hero value prop is a capability statement, such as 'automate your AI workflows', with no metric, timeframe, or named beneficiary.`,
      after: `Lead with the quantified outcome: 'Cut time-to-launch from months to days for ${buyer(
        input,
      )}.' Numbers make the promise credible.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["A metric anchors the hero promise", "The beneficiary is named in the value prop", "Supporting pages echo the same quantified outcome"]
          : b === "NEEDS WORK"
            ? ["An outcome is hinted at in the hero", "There's a real business result the product can back with numbers"]
            : [
                "The product delivers a real, documentable outcome; it just isn't quantified yet",
                "The hero has room for a stronger opening line",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep the metric honest as you scale"]
          : b === "NEEDS WORK"
            ? ["A metric that makes the promise credible (time, cost, or revenue)", "A named beneficiary in the opening line"]
            : [
                "A quantified outcome: time saved, cost cut, or revenue gained",
                "A named beneficiary for the promise",
                "A one-sentence value prop that fits above the fold",
              ],
    };
  },

  pricing: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP":
        "Pricing is opaque behind 'Contact sales', so buyers can't self-qualify and inbound quality suffers.",
      "NEEDS WORK":
        "Pricing exists but the packaging logic isn't tied to value, so buyers can't tell which tier fits.",
      strong: "Pricing and packaging are surfaced and mapped to value, so buyers self-select quickly.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP":
        "Hidden price points suppress inbound quality and extend every sales cycle because unqualified or under-budget buyers must be triaged by hand.",
      "NEEDS WORK":
        "This stalls evaluation at the moment of decision and pushes prospects toward a competitor that packages more clearly.",
      strong:
        "This raises inbound quality and pre-qualifies conversations before they start.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP":
        "Pricing is hidden behind a contact gate, so a buyer cannot tell if the product fits their budget before engaging.",
      "NEEDS WORK":
        "Pricing exists, but the packaging is not mapped to value, so a buyer cannot tell which tier fits them.",
      strong:
        "Pricing and packaging are surfaced and tied to value, so the right buyer self-selects the right tier.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP":
        "Pricing & Packaging measures how easily a buyer can evaluate fit and self-qualify. When pricing is hidden behind 'Contact sales', buyers can't tell if they're in the right ballpark, so inbound quality drops and the sales cycle lengthens.",
      "NEEDS WORK":
        "Pricing & Packaging measures whether packaging logic is tied to value. Pricing exists, but the tiers aren't mapped to buyer needs, so visitors can't tell which edition fits them and the evaluation stalls.",
      strong:
        "Pricing & Packaging measures how easily a buyer can self-qualify. Pricing is surfaced and mapped to value, so the right buyer picks the right tier and inbound conversations start pre-qualified.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `Pricing is hidden behind a 'Contact sales' gate with no packaging logic visible on the site.`,
      after: `Publish packaging tied to value, such as edition, seat, or usage tiers, so the right ${buyer(
        input,
      )} self-selects and inbound quality rises.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["Pricing is surfaced on the site", "Tiers map to distinct buyer needs", "A path to enterprise pricing exists without blocking evaluation"]
          : b === "NEEDS WORK"
            ? ["Pricing exists and is findable", "The team clearly has packaging thinking in progress"]
            : [
                pre
                  ? "Pre-launch is the ideal time to design packaging, before the wrong defaults get embedded"
                  : "The product's usage patterns suggest a natural packaging axis (seats, usage, or editions)",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep packaging logic tied to value as you add tiers"]
          : b === "NEEDS WORK"
            ? ["Tier definitions mapped to distinct buyer needs and outcomes", "A visible path for the buyer to self-select the right edition"]
            : [
                "Pricing surfaced on the site so buyers can self-qualify",
                "Packaging logic tied to value: edition, seat, or usage",
                pre ? "Early pricing conversations with 5 to 10 prospects to calibrate willingness to pay" : "A 'Contact sales' path that doesn't gate the entire evaluation",
              ],
    };
  },

  gtm: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "The go-to-market motion isn't defined yet: no clear channel, funnel, or offer for reaching buyers."
        : "No visible go-to-market motion; it's unclear how buyers find you, try you, and buy.",
      "NEEDS WORK": pre
        ? "A GTM direction is sketched, but the channel and funnel aren't concrete enough to execute."
        : "The GTM motion exists but channels and funnel aren't aligned to a repeatable path.",
      strong: "A repeatable channel-to-customer path is defined, with a concrete offer at the end.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "GTM Readiness measures whether there's a concrete, repeatable channel-to-customer path, including who you reach, where you reach them, and what offer closes the loop. At pre-launch this is expected to be thin, but it should at least be named before you start spending."
        : "GTM Readiness measures whether there's a concrete, repeatable channel-to-customer path. Right now it's unclear how buyers find you, try you, and buy, which means acquisition depends on luck, not a motion.",
      "NEEDS WORK": pre
        ? "GTM Readiness measures whether there's a concrete, repeatable channel-to-customer path. A direction is sketched, but the channel and funnel aren't concrete enough to execute against."
        : "GTM Readiness measures whether there's a concrete, repeatable channel-to-customer path. A motion exists, but channels and funnel aren't aligned to a repeatable path, so results won't compound.",
      strong:
        "GTM Readiness measures whether there's a concrete, repeatable channel-to-customer path. Yours is defined, with a concrete offer at the end, which means every dollar and hour spent compounds.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation:
        "GTM readiness depends on internal channel, funnel, and offer materials that a public crawl cannot access, so it is not scored from the URL.",
      commercialRisk:
        "Because these internal materials are not part of a public crawl, GTM Readiness is assessed in the MarketReady Audit.",
      before: `No visible go-to-market motion, with unclear channel, funnel, or offer for reaching ${buyer(
        input,
      )}.`,
      after: `Define a repeatable channel-to-customer path and put a concrete offer, such as demo, pilot, or trial, in front of ${buyer(
        input,
      )}.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["A named channel with a repeatable acquisition loop", "A concrete offer (demo, pilot, or trial) at the end of the funnel", "Funnel stages are defined and measurable"]
          : b === "NEEDS WORK"
            ? ["A GTM direction has been chosen", "Early channel experiments are happening"]
            : [
                pre
                  ? "Thinking about GTM before launch is exactly when it should be designed"
                  : "The product has clear buyer intent signals to build a motion around",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep measuring funnel conversion and doubling down on what wins"]
          : b === "NEEDS WORK"
            ? ["A named primary channel with owners and targets", "A funnel that's measurable stage by stage", "A concrete offer at the end of the path"]
            : [
                "A named channel plan for reaching " + buyer(input),
                "A funnel with defined stages and a concrete offer at the end",
                pre ? "A 90-day GTM plan: who, where, what offer, and how you'll measure it" : "A repeatable acquisition loop instead of one-off pushes",
              ],
    };
  },

  launch: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "At MVP stage the launch infrastructure (narrative, assets, channel plan) isn't in place yet."
        : "Launch assets and sequence aren't in place; launch day is a wish, not a dated plan.",
      "NEEDS WORK": pre
        ? "Launch planning is partial: some assets exist, but the narrative and channel plan aren't locked."
        : "The launch kit is incomplete: narrative and assets exist, but sequencing and targets don't.",
      strong: "A complete, dated launch sequence with narrative, assets, and channel plan is ready to run.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "Launch Readiness measures whether the launch kit (narrative, assets, target list, dated sequence with owners) actually exists. At MVP stage it typically doesn't yet, which is normal; the risk is launching without building it."
        : "Launch Readiness measures whether the launch kit actually exists: narrative, assets, target list, dated sequence, owners. Yours isn't in place, so launch day is a wish rather than a plan.",
      "NEEDS WORK": pre
        ? "Launch Readiness measures whether the launch kit actually exists. Some assets exist, but the narrative and channel plan aren't locked, so the launch would be improvised."
        : "Launch Readiness measures whether the launch kit actually exists. Narrative and assets exist, but sequencing and target lists don't, so the launch can't be executed as a plan.",
      strong:
        "Launch Readiness measures whether the launch kit actually exists. Yours is complete: narrative, assets, targets, and a dated sequence with owners, ready to execute.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation:
        "Launch readiness depends on a launch kit that a public crawl cannot access, so it is not scored from the URL.",
      commercialRisk:
        "Because these internal materials are not part of a public crawl, Launch Readiness is assessed in the MarketReady Audit.",
      before: `Launch narrative, target accounts, and channel plan aren't defined; launch day is a wish, not a date.`,
      after: `Build the launch kit: positioning doc, asset pack, target list, and a dated launch sequence with owners.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["A dated launch sequence exists with owners", "Narrative and assets are locked", "Target accounts and channels are named"]
          : b === "NEEDS WORK"
            ? ["Launch thinking has started and some assets exist", pre ? "The pre-launch runway is still available to finish the kit" : "A launch date or window has been chosen"]
            : [
                pre
                  ? "Pre-launch is exactly when the launch kit should be built; nothing has slipped yet"
                  : "The product has a clear story to package once the kit exists",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep the sequence dated and owned as the date approaches"]
          : b === "NEEDS WORK"
            ? ["A locked narrative (positioning doc)", "A dated sequence with owners and targets"]
            : [
                "A positioning doc that anchors the launch narrative",
                "An asset pack (homepage, demo, social, outreach) ready before launch day",
                pre ? "A launch plan with a date, owners, and channel targets" : "A dated launch sequence with named owners",
              ],
    };
  },

  conversion: (input, score) => {
    const b = band(score);
    const pre = isPreLaunch(input);
    const diagnostics: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "With no live offer or proof yet, the path from interest to action is untested and friction-heavy."
        : "The path from interest to action has friction: vague CTAs, no proof, and no obvious next step.",
      "NEEDS WORK": pre
        ? "The conversion path is a placeholder, with one CTA and no proof or next step around it."
        : "CTAs exist but proof and a single clear next step aren't aligned to convert visitors.",
      strong: "One clear CTA per page with proof directly beneath it, so the buyer always knows the next step.",
    };
    const impact: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "With no live offer or proof yet, every visitor lands on a dead end and demand leaks before it becomes a conversation."
        : "Interest leaks before it becomes a conversation because every extra step or doubt at the moment of decision costs pipeline.",
      "NEEDS WORK": pre
        ? "The placeholder conversion path leaves demand unharvested while the offer takes shape."
        : "Visitors hesitate at the moment of decision, quietly dropping a share of otherwise-qualified traffic.",
      strong:
        "The buyer always knows the next step, removing hesitation at the point of decision and converting more of the traffic already paying attention.",
    };
    const observation: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "With no live offer or proof yet, the path from interest to action is untested and friction-heavy."
        : "The path from interest to action carries friction: vague CTAs, no proof, and no obvious next step.",
      "NEEDS WORK": pre
        ? "The conversion path is a placeholder, one CTA with no proof or next step around it."
        : "CTAs exist, but proof and a single clear next step are not aligned to convert.",
      strong:
        "One clear CTA sits on each page with social proof directly beneath it.",
    };
    const rationale: Record<Band, string> = {
      "CRITICAL GAP": pre
        ? "Conversion Readiness measures the path from interest to action: one clear CTA per page, proof beneath it, a frictionless next step. Pre-launch there's no live offer or proof yet, so the path is untested, so every visitor lands on a dead end."
        : "Conversion Readiness measures the path from interest to action: one clear CTA per page, proof beneath it, a frictionless next step. Yours has friction (vague CTAs, missing proof, and no obvious next step), so interest leaks before it becomes a conversation.",
      "NEEDS WORK": pre
        ? "Conversion Readiness measures the path from interest to action. Yours is a placeholder, a single CTA with no proof or next step around it, which is common pre-launch but leaves demand unharvested."
        : "Conversion Readiness measures the path from interest to action. CTAs exist, but proof and a single clear next step aren't aligned, so visitors hesitate at the moment of decision.",
      strong:
        "Conversion Readiness measures the path from interest to action. Yours is tight: one clear CTA per page, proof directly beneath it, and the buyer always knows the next step.",
    };
    return {
      diagnostic: diagnostics[b],
      keyObservation: observation[b],
      commercialRisk: impact[b],
      before: `CTAs are generic ('Learn more') and proof (logos, metrics, testimonials) is missing above the fold.`,
      after: `One clear CTA per page, social proof directly under the hero, and a frictionless next step: demo, trial, or call.`,
      rationale: rationale[b],
      positives:
        b === "strong"
          ? ["One clear CTA per page", "Proof sits directly under the hero", "The next step is obvious on every page"]
          : b === "NEEDS WORK"
            ? ["CTAs exist on the main pages", "There's a natural next step to push visitors toward"]
            : [
                pre
                  ? "The waitlist or early-access hook can become the proof engine for launch"
                  : "Traffic is arriving; the leak is downstream, so the fix compounds",
              ],
      missing:
        b === "strong"
          ? ["Nothing structural; keep proof current and test the CTA once a quarter"]
          : b === "NEEDS WORK"
            ? ["Proof (logos, metrics, testimonials) placed above the fold", "A single primary CTA per page instead of competing ones"]
            : [
                "A single, unambiguous primary CTA per page",
                "Social proof (logos, metrics, testimonials) directly under the hero",
                pre ? "A waitlist or early-access path that captures interest before launch" : "A frictionless next step: demo, trial, or call",
              ],
    };
  },
};
