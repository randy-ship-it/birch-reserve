/**
 * "Track record" proof strip (Randy, voice, Nov 21 2026 5:59 PM ET). Home + media kit (and the Scale mirror media kit),
 * right under "How we got here". Ads-first: how the team got here through distribution, private display and partner
 * launches. Nameless by design: no client, partner, company or portfolio names, no location counts, no ownership talk,
 * never says a hub is open, no guarantees. Every figure is already public on the source page noted beside it.
 * Team / portfolio track record, NOT Birch Reserve campaign results.
 */
export type TrackRecordCard = {
  key: string;
  tag: string;
  stat: string;
  outcome: string;
  detail: string;
  /** Where each fact is published (internal reference only, not rendered). */
  sources: readonly string[];
};

export const TRACK_RECORD = {
  eyebrow: "Track record",
  title: "We've run these surfaces before.",
  cards: [
    {
      key: "distribution",
      tag: "Distribution",
      stat: "5.4×",
      outcome: "A service placed inside one host business grew 5.4× from its first month.",
      detail:
        "It ran inside an audience the business already had. The host didn't build, staff or market it, and signed a five-year term at month six. Launched February 2024, measured to July 2026.",
      sources: ["https://rdgdh.com/case-studies/align-store-level"],
    },
    {
      key: "network",
      tag: "A network that holds",
      stat: "<5%",
      outcome: "Partner churn cut from over 35% to under 5%.",
      detail:
        "The team rebuilt a partner network around partners that could hold, on five-year contracts. Net dollar retention runs above 120% (ramp-aware). Placements are only as steady as the partners behind them.",
      sources: ["https://rdgdh.com/case-studies/align-scale-health", "https://silverbirchgrowth.com/work"],
    },
    {
      key: "private-display",
      tag: "Private display",
      stat: "No build",
      outcome: "Post-purchase moments turned into a co-branded care layer, with no tech build for the brand.",
      detail:
        "We wrap a brand's existing post-purchase, email, loyalty and in-pack surfaces in real care, so its name sits next to registered physiotherapists, not affiliate banners. Each hub has four ad surfaces: the post-purchase thank-you page, the member dashboard, the hub home and product or service pages.",
      sources: ["https://silverbirchgrowth.com/work", "https://silverbirchgrowth.com/"],
    },
    {
      key: "partner-launch",
      tag: "Partner launch",
      stat: "19 days",
      outcome: "A virtual care partner went from first email to ready to sign in 19 days.",
      detail:
        "Our field sales bot ran the thread: 12 emails, each one scored, with the prospect's tone rising from 55 on the first reply to 94 at ready to sign (our read of the wording). It's the same GTM bot that brought in our partnerships and audiences fast.",
      sources: ["https://silverbirchgrowth.com/ (Case study · names withheld, Oct 28 to Nov 16, 2026)"],
    },
  ] as const satisfies readonly TrackRecordCard[],
  more: "How",
  note: "Team and portfolio track record. Internally reported and unaudited. Not Birch Reserve campaign results, and no outcomes are guaranteed.",
  lookCta: "Start with the $190 USD 7-day look",
  packKey: "sponsor-3000",
} as const;

/** One line for the chat prompt / llms.txt. */
export const TRACK_RECORD_FACT =
  "Team and portfolio track record (anonymous, internally reported, not Birch Reserve campaign results): a service placed inside one host business grew 5.4x from its first month and the host signed a five-year term at month six; a partner network rebuilt with churn cut from over 35% to under 5%; brands' existing post-purchase, email, loyalty and in-pack surfaces turned into a co-branded care layer with no tech build; a virtual care partner went from first email to ready to sign in 19 days through our field sales bot. Never name the companies involved and never present these as ad results.";
