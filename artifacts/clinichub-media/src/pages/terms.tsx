import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Terms() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Terms of sale
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Birch Reserve is operated by Silver Birch Growth Inc. These terms are
          a draft. They are not in force for a live card until counsel stamps
          this page. Public prices are $190 USD, or $270 CAD for buyers in Canada (
          <span className="text-foreground">hold-190</span>, a 7-day category
          look that does not lock a category) and $490 USD, or $690 CAD
          for buyers in Canada (
          <span className="text-foreground">reserve-490</span>, one of 8 shared
          self-serve category seats; it does not lock the category). The currency you see at checkout is the currency you are
          charged, and you can switch between USD and CAD on the page before you pay.
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
          8 brand categories across hubs, not eight websites. Self-serve seats are a shared pool of 8 seats, open to more than one brand per category, and do not give category exclusivity. Only a premium slot ($25,000 to $50,000 USD, inquire only, set on an insertion order) locks one brand per category for its term. Reporting is aggregate only. No PHI. No clinical pixels.
        </p>
        <p>
          Checkout is Stripe-hosted. Silver Birch Growth Inc. does not store
          full card numbers. Questions:{" "}
          <a className="text-foreground underline" href="mailto:sales@silverbirchgrowth.com">
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
