import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";
import { CARRY_OVER_CLAUSE, SPONSOR_PACK_TERMS } from "../../../api-server/src/lib/sponsorTerms";
import { EXCLUSIVE_RESERVE_TERMS } from "../../../api-server/src/lib/exclusiveReserveTerms";
import { SPEND_DOWN_TERM } from "../../../api-server/src/lib/inventoryPlan";

export default function Terms() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Terms of sale
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Birch Reserve is operated by Silver Birch Growth Inc. Public prices are $190 USD / $270 CAD (
          <span className="text-foreground">hold-190</span>, a 7-day category
          look that does not lock a category), $490 USD / $690 CAD (
          <span className="text-foreground">reserve-490</span>, a shared
          self-serve category placement; it does not lock the category) and $1,900 USD or CAD (the starter placement, below). Prices show in CAD for
          visitors in Canada and USD everywhere else, and you can switch on the page. Sponsorship packs are priced and charged in USD. The currency you see at checkout is the currency you are charged.
        </p>
        <p>
          hold-190 is a 100% credit if the buyer converts within 7 days.
          Otherwise it is a cash refund. It does not lock a category.
          reserve-490 is 100% display credit, fully refundable until 14 days
          before the launch date written in your insertion order. To cancel,
          reply to your confirmation email. We refund the full amount to the
          original card. After that date the credit is not refundable but stays
          usable for 12 months after payment. A cash refund is also available
          if no approved surface is named within 60 days of payment.
        </p>
        <p>
          Payment is a reservation credit, not a live flight and not an
          impression guarantee. Nothing runs until an insertion order names the
          surface. After that order, cancellation and makegood follow IAB. The
          public sample is <Link href="/sample-io" className="text-foreground underline">/sample-io</Link>.
        </p>
        <p>
          8 brand categories across hubs, not eight websites. reserve-490 is a shared self-serve category placement; it does not lock the category. More than one brand can reserve in a category. A category to yourself comes with a premium slot ($25,000 to $1.5M USD, set on an insertion order) or a package secured by the $1,900 starter placement (below). Reporting is aggregate only. No PHI. No clinical pixels.
        </p>
        <h2 id="sponsorship-packs" className="pt-4 font-display text-2xl text-foreground">Sponsorship packs</h2>
        <ul className="list-disc space-y-2 pl-5" data-testid="terms-sponsor-packs">
          {SPONSOR_PACK_TERMS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p id="carry-over" data-testid="terms-carry-over">
          <strong className="text-foreground">Carry-over.</strong> {CARRY_OVER_CLAUSE}
        </p>
        <p id="spend-down" data-testid="terms-spend-down">
          <strong className="text-foreground">Spend-down.</strong> {SPEND_DOWN_TERM}
        </p>
        <p id="promo-credit" data-testid="terms-promo-credit">
          <strong className="text-foreground">Promo credit.</strong> Promo codes (street-team and partner codes, each with its own stated USD credit) give free ad credit: ad spend only, no cash value, not transferable, one per business. Promo credit is valued and spent at regular rate-card rates, not a discounted package rate, and runs under the same review and insertion-order rules as paid credit.
        </p>
        <h2 id="exclusive" className="pt-4 font-display text-2xl text-foreground">Starter placement ($1,900 USD or CAD)</h2>
        <ul className="list-disc space-y-2 pl-5" data-testid="terms-exclusive">
          {EXCLUSIVE_RESERVE_TERMS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p>
          Checkout is Stripe-hosted. Silver Birch Growth Inc. does not store
          full card numbers. Questions:{" "}
          <a className="text-foreground underline" href="mailto:randy@scalehealth.ca">
            Email sales
          </a>
          .
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </article>
  );
}
