import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Privacy() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        DRAFT — counsel stamps before the first real card
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Privacy
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          This draft describes what Birch Reserve collects to sell the public
          $190 and $490 reservations. This page is not in force until counsel
          stamps it.
        </p>
        <p>
          Reservation checkout collects the brand legal name, work email,
          optional website, format preference, and an idempotency key so a
          repeated request does not open a second hold. Stripe hosts the card
          form. Silver Birch Growth Inc. receives payment status from Stripe
          and does not store full card numbers on Birch Reserve servers.
        </p>
        <p>
          Birch Reserve does not collect protected health information, clinical
          pixels, or patient-level reporting. Birch Guide does not collect
          patient or PHI data. Placement reporting, when an insertion order
          later authorizes a flight, is aggregate only.
        </p>
        <p>
          The Stripe descriptor should read SCALE HEALTH*BIRCH or BIRCH RESERVE.
          <a className="text-foreground underline" href="mailto:randy@silverbirchgrowth.com">
            Email Randy
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
      <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Draft until counsel stamps.
      </p>
    </article>
  );
}
