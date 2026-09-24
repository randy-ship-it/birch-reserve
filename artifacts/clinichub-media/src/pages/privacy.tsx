import { Link } from "wouter";
import { SELLER_IDENTITY } from "@/lib/seller-identity";

export default function Privacy() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        DRAFT — Gordon stamps before the first real card
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
        Privacy
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          This draft describes what Birch Reserve collects to sell the $899
          Access Reserve. It is not in force until Gordon stamps it.
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
          pixels, or patient-level reporting. Placement reporting, when an
          insertion order later authorizes a flight, is aggregate only.
        </p>
        <p>
          Contact{" "}
          <a className="text-foreground underline" href="mailto:randy@silverbirchgrowth.com">
            randy@silverbirchgrowth.com
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
