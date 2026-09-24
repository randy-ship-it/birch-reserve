import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Terms() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        DRAFT — counsel stamps before the first real card
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Terms of sale
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Birch Reserve is operated by Silver Birch Growth Inc. These terms are
          a draft. They are not in force for a live card until counsel stamps
          this page. Public prices are $190 USD (
          <span className="text-foreground">hold-190</span>, a 7-day category
          look that does not consume an 8-seat) and $490 USD (
          <span className="text-foreground">reserve-490</span>, a named category
          seat). $899 (<span className="text-foreground">reserve-899</span>) is
          a legacy SKU only, kept so existing Stripe Checkout sessions still
          match. It is not a public offer.
        </p>
        <p>
          hold-190 is a 100% credit if the buyer takes a seat within 7 days.
          Otherwise it is a cash refund. It does not consume an 8-seat.
          reserve-490 is 100% media credit. Credit expires 12 months after
          payment. A cash refund is available if no approved surface is named
          within 60 days of payment.
        </p>
        <p>
          Payment is a reservation credit, not a live flight and not an
          impression guarantee. Nothing runs until an insertion order names the
          surface. After that order, cancellation and makegood follow IAB. The
          public sample is <Link href="/sample-io" className="text-foreground underline">/sample-io</Link>.
        </p>
        <p>
          Eight seats means eight advertiser categories across hubs, not eight
          websites. Reporting is aggregate only. No PHI. No clinical pixels.
        </p>
        <p>
          Checkout is Stripe-hosted. Silver Birch Growth Inc. does not store
          full card numbers. Questions:{" "}
          <a className="text-foreground underline" href="mailto:randy@silverbirchgrowth.com">
            Email Randy
          </a>
          .
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </p>
      <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Draft until counsel stamps.
      </p>
    </article>
  );
}
