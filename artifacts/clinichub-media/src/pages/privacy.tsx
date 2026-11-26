import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Privacy() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Privacy
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Draft. This page describes what Birch Reserve collects to sell the
          public $190 USD and $490 USD reservations and the $1,900 starter
          placement. Final terms for any purchase are in your insertion order.
        </p>
        <p>
          Reservation checkout collects the brand legal name, work email,
          optional website, format preference, and an idempotency key so a
          repeated request does not open a second hold. Stripe hosts the card
          form. Silver Birch Growth Inc. receives payment status from Stripe
          and does not store full card numbers on its servers.
        </p>
        <p>
          Birch Reserve does not collect protected health information, clinical
          pixels, or patient-level reporting. Birch Guide does not collect
          patient or PHI data. Placement reporting, when an insertion order
          later authorizes a flight, is aggregate only.
        </p>
        <p>
          Card statements show BIRCHRSV* followed by a short label (for
          example BIRCHRSV* RESERVE). The seller is Silver Birch Growth Inc.
          Contact{" "}
          <a className="text-foreground underline" href="mailto:randy@scalehealth.ca">
            randy@scalehealth.ca
          </a>{" "}
          to ask for a copy of reservation details or to correct a brand name
          or email on an unpaid hold.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/terms" className="underline">
          Terms of sale
        </Link>
      </p>
    </article>
  );
}
