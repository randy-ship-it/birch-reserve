import { KitEntry } from "@/components/br/pilot-path";
import { CheckCircle2 } from "lucide-react";
import { LeadForm } from "@/components/br/lead-form";
import { BuyPaths, InventorySpec, IoProcess } from "@/components/br/agency-showcase";
import { MB_BUY_PATHS, MEASUREMENT_STEPS, MEDIA_BUYER_FAQ, MIX_ROWS } from "../../../../api-server/src/lib/overhaul/mediaBuyers";
import { LOOK_HREF, RESERVE_HREF, lookHref} from "@/components/br/pricing";
import { Cta, Eyebrow, Faq, H1, H2, Lede, Modelled, Section, usePageMeta } from "@/components/br/ui";

/**
 * /media-buyers (Nov 18 2026 preview): for teams already running display and paid-channel campaigns.
 * Positions Birch as one incremental line item in an existing mix. Same two USD offers (as a card vs IO compare), same premium
 * inquiry, same refund and IO rules as /media-kit. No impression, CTR or ROAS claims.
 */
export default function BrMediaBuyers() {
  usePageMeta(
    "For media buyers & performance marketers | Birch Reserve",
    "Already running display, retargeting and paid social? Add one first-party health and wellness channel as its own line item: hand-placed placements inside private hubs, tracked with your UTM links and promo codes. Test from $190 USD.",
  );
  return (
    <div data-testid="br-media-buyers">
      <KitEntry from="media-buyers" />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>For media buyers &amp; performance marketers</Eyebrow>
            <H1>Add one first-party health channel to the display mix you already run.</H1>
            <Lede>
              Your programmatic, retargeting and paid social stay as they are. Birch Reserve adds hand-placed display inside private health and wellness hubs, on the pages members use right after they buy or book, and when they log back in. It runs as its own line item, tagged with your UTM links and promo codes.
            </Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href={lookHref("media_buyers_look")} variant="ink" testId="mb-cta-look">Start a test · $190 USD 7-day look</Cta>
              <Cta href={RESERVE_HREF} testId="mb-cta-reserve">Reserve · $490 USD</Cta>
              <Cta href="#talk" variant="line" testId="mb-cta-brief">Send a brief</Cta>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              The look converts in full to the reserve within 7 days, or it's refunded. The reserve is media credit, fully refundable until 14 days before your launch date.
            </p>
          </div>
          <div className="border border-foreground/15 bg-white p-6" data-testid="mb-at-a-glance">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">At a glance</p>
            <ul className="mt-3 space-y-3 text-sm">
              {[
                "Incremental: a separate line item, not a replacement for your DSP or social buys",
                "Four placements: post-purchase, hub home, product / services, member dashboard",
                "Display (per thousand views) or CPC (per click); public starting rates",
                "Measured with your UTM links and promo codes; aggregate reporting per hub and surface",
                "Prepaid media credit; nothing runs until the insertion order names the hub and placement",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="soft" id="display-mix">
        <Eyebrow>Add to your display mix</Eyebrow>
        <H2>Where it sits next to what you already buy.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Keep every channel you run today. Birch is one more source, read on its own line in your reporting.</p>
        <div className="mt-8 grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-2" data-testid="mb-mix">
          {MIX_ROWS.map((r) => (
            <article key={r.key} className="bg-background p-6" data-testid={`mb-mix-${r.key}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">You already run</p>
              <h3 className="mt-1 font-display text-2xl leading-tight">{r.channel}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.youBuyItFor}</p>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Birch adds</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/85">{r.birchAdds}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="measurement">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Eyebrow>How measurement works</Eyebrow>
            <H2>Read it in the analytics you already use.</H2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              No new dashboard to trust. Birch traffic arrives on your UTM links, and redemptions arrive on your promo codes. Our report adds views and clicks per hub and surface.
            </p>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="mb-modelled-note">
              <Modelled /> Pre-launch view figures are modelled estimates, not measured delivery or a guarantee. No impression guarantees.
            </p>
          </div>
          <ol className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2" data-testid="mb-measurement">
            {MEASUREMENT_STEPS.map((s) => (
              <li key={s.k} className="bg-background p-5">
                <p className="font-display text-3xl leading-none text-foreground/35">{s.k}</p>
                <h3 className="mt-2 font-display text-xl leading-tight">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>Spec sheet</Eyebrow>
        <H2>Four placements. Public starting rates.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">The IO names the hub, surface, format and dates.</p>
        <div className="mt-8">
          <InventorySpec />
        </div>
      </Section>

      <Section>
        <Eyebrow>Start a test</Eyebrow>
        <H2>Two ways to buy.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Card for a first test today. An insertion order (IO) for premium or several hubs.</p>
        <div className="mt-8">
          <BuyPaths
            paths={MB_BUY_PATHS}
            labels={{ reserve: "Reserve · $490 USD", look: "or start with the $190 USD 7-day look", io: "Send a brief" }}
            reserveHref={RESERVE_HREF}
            lookHref={lookHref("media_buyers_paths_look")}
            testId="mb-buy-paths"
          />
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>From brief to live</Eyebrow>
        <H2>Six steps. Nothing runs before the IO.</H2>
        <div className="mt-8">
          <IoProcess />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Buying for clients? See <a className="underline underline-offset-2" href="/agencies">agencies &amp; brokers</a> for the 10% agency-of-record terms. Everything in one link: the <a className="underline underline-offset-2" href="/media-kit">media kit</a>.
        </p>
      </Section>

      <Section id="talk">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <H2>Send the brief.</H2>
            <p className="mt-4 text-sm text-muted-foreground">Tell us what you already run and what you want to test. We reply with hub fit and a draft insertion order.</p>
          </div>
          <LeadForm
            kind="display_cpc_inquiry"
            testId="form-media-buyer"
            submitLabel="Send"
            done={<p>Thanks. We'll reply with hub fit and a draft insertion order.</p>}
            fields={[
              { name: "source_page", label: "Source", type: "hidden", defaultValue: "media-buyers" },
              { name: "company", label: "Brand or team", required: true },
              { name: "name", label: "Your name", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "website", label: "Website", type: "url" },
              { name: "channels", label: "Channels you run today", type: "select", options: ["Programmatic display / retargeting", "Paid social", "Retail media", "Newsletter / creator sponsorships", "Several of these"] },
              { name: "test_budget", label: "Test budget", type: "select", options: ["$190 USD 7-day look", "$490 USD reserve", "Premium slot (inquiry)", "Not sure yet"] },
              { name: "message", label: "What you want to test", type: "textarea" },
            ]}
          />
        </div>
      </Section>

      <Section tone="soft">
        {/* FAQPage JSON-LD for /media-buyers is emitted once, server-side (seo.ts). */}
        <Faq items={MEDIA_BUYER_FAQ} schema={false} />
      </Section>
    </div>
  );
}
