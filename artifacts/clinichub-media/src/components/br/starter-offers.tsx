import { Cta } from "@/components/br/ui";
import { LOOK_HREF, RESERVE_HREF, lookHref} from "@/components/br/pricing";
import { priceLabels, useAvailability } from "@/components/br/prime-hero";

/** The two public self-serve offers from the media kit (Nov 2026): $190 USD look, $490 USD category placement. USD only. */
export function StarterOffers({ testId = "starter-offers" }: { testId?: string }) {
  const price = priceLabels(useAvailability());
  return (
    <div data-testid={testId}>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col border border-foreground/20 bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">7-day category look</p>
          <p className="mt-2 font-display text-5xl leading-none">{price.look}</p>
          <p className="mt-4 text-sm text-foreground/80">Hold your category for 7 days. It converts in full to the {price.seat} category placement within 7 days, or it's refunded. It does not lock in a slot.</p>
          <div className="mt-6 sm:mt-auto sm:pt-6">
            <Cta href={lookHref("starter_offers_look")} variant="ink" testId={`${testId}-look`} className="w-full sm:w-auto">Take a 7-day look — {price.look}</Cta>
          </div>
        </article>
        <article className="flex flex-col border-2 border-foreground bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Category placement</p>
          <p className="mt-2 font-display text-5xl leading-none">{price.seat}</p>
          <p className="mt-4 text-sm text-foreground/80">A category placement across the hub network. Your payment is media credit, fully refundable until 14 days before your launch date and usable for 12 months.</p>
          <div className="mt-6 sm:mt-auto sm:pt-6">
            <Cta href={RESERVE_HREF} variant="lime" testId={`${testId}-reserve`} className="w-full sm:w-auto">Category placement — {price.seat}</Cta>
          </div>
        </article>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Priced in USD for every buyer. Pay by card on a Stripe-hosted page, no login. Nothing runs until you approve an insertion order naming the hub and placement. Premium slots are inquire-only; see the <a className="underline underline-offset-2" href="/media-kit#premium">media kit</a>.</p>
    </div>
  );
}
