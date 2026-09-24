import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Terms() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        DRAFT — Gordon stamps before the first real card
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Terms of sale
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Birch Reserve is operated by Silver Birch Growth Inc. These terms are
          a draft for the $899 USD Access Reserve (<span className="text-foreground">reserve-899</span>).
          They are not in force for a live card until Gordon stamps this draft.
        </p>
        <p>
          The $899 payment is a media credit and a category hold in the shared
          reserve pool. It is not a live flight, not an impression guarantee,
          and not delivery of media. Nothing runs until a final insertion order
          names the surface.
        </p>
        <p>
          A cash refund is available only if no approved surface is named
          within 60 days of payment. Otherwise the amount stays as media
          credit. Unused credit expires 12 months after payment.
        </p>
        <p>
          After an insertion order is in place, cancellation and makegood
          follow IAB. The sample insertion order in the repository
          (<span className="text-foreground">docs/legal/DRAFT-access-reserve-899-insertion-order.md</span>)
          is the working draft of that document.
        </p>
        <p>
          Checkout is Stripe-hosted. Silver Birch Growth Inc. does not store
          full card numbers. Questions:{" "}
          <a className="text-foreground underline" href="mailto:randy@silverbirchgrowth.com">
            randy@silverbirchgrowth.com
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
