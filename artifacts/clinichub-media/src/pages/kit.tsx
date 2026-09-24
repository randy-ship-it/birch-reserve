import { RANDY_TEL_HREF } from "@/lib/randy-chat-knowledge";
import { useEffect } from "react";
import { Download } from "lucide-react";

/** Static print of this page (headless Chromium print-to-PDF of the /kit build). */
const MEDIA_KIT_PDF_HREF = "/birch-reserve-media-kit.pdf" as const;

const CATEGORIES = [
  "Pain relief / topicals",
  "Recovery hardware",
  "Nutrition",
  "Sleep",
  "Meal prep",
  "Women’s health",
  "Men’s health",
  "Diagnostics / services",
];

const CALL_BACK_TEL = RANDY_TEL_HREF;

const PAGE_TITLE = "Media kit — Birch Reserve | Thank-you first inventory";

export default function Kit() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content =
        "Birch Reserve media kit. Thank-you after Scale buy or book first. MODELED demos. $190 hold / $490 seat.";
    }
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
    };
  }, []);

  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
        Birch Reserve · Media kit
      </p>
      <h1 className="mt-4 font-display text-5xl">Display beside the product they already trust.</h1>
      <a
        href={MEDIA_KIT_PDF_HREF}
        download
        className="kit-download mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent print:hidden"
        data-testid="button-download-media-kit"
      >
        <Download className="size-4" aria-hidden />
        Download media kit (PDF)
      </a>
      <p className="mt-6 text-lg">
        Eight category seats inside signed Scale Health hubs. Not an open auction. Not a guaranteed impression buy.
        First story: thank-you after Scale buy or book — then in-experience display.
      </p>
      <p className="mt-6">
        Live proof:{" "}
        <a className="underline" href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer">
          Tour the DR-HO hub
        </a>
      </p>
      <p className="mt-2 text-muted-foreground">Caption on every mock: Illustrative — not your receipt.</p>

      <h2 className="mt-10 font-display text-3xl">Eight seats</h2>
      <p className="mt-3">{CATEGORIES.join(" · ")}</p>
      <p className="mt-3">Hubs are the rooms. The seat is the exclusive shelf in those rooms.</p>

      <h2 className="mt-10 font-display text-3xl">Launching cohort</h2>
      <p className="mt-3">
        DR-HO’S · Kalaya · Jill Health · Jack Health · Integrity Fitness · Bird & Be · NutriProCan · Roll Recovery
      </p>
      <p className="mt-2 text-muted-foreground">Logos, not reach.</p>

      <h2 className="mt-10 font-display text-3xl">Demographics (MODELED — not measured census)</h2>
      <p className="mt-3 text-muted-foreground">
        <strong className="text-foreground">MODELED</strong> from Activity Clinic Hubs launching cohort (logos only).
        Never sell as measured census. No invented reach / CTR / LTV.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          End customer: 30–65, Canada / U.S., recovery / topical / sleep / nutrition / care shopper, often
          paramedical-insured, mid-to-upper household.
        </li>
        <li>Context: thank-you after buy or book, on a plan, or in-hub. Not a cold feed impression.</li>
        <li>Brand buyer: founder or brand manager already adjacent to those names.</li>
        <li>Birch is priced as a credit, not a CPM guarantee.</li>
      </ul>

      <h2 className="mt-10 font-display text-3xl">Formats (thank-you first)</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <strong>post_checkout / thank-you (after Scale buy)</strong> — HERO · first placement story
        </li>
        <li>
          <strong>scheduled_service / post-book thank-you (after Scale book)</strong> — HERO twin
        </li>
        <li>recovery_plan · member_hub · motion_15s (in-experience next; Phase-1 stubs OK)</li>
      </ol>
      <p className="mt-3 text-muted-foreground">
        Mockup narrative order: 02 post-checkout first · 04 scheduled · 01 member hub · 03 size map. DR-HO / Kalaya =
        proof context only.
      </p>

      <h2 className="mt-10 font-display text-3xl">Shopify / hub activation (Phase-1)</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          Shopify buy thank-you: Checkout UI Extension{" "}
          <code className="text-xs">purchase.thank-you</code> +{" "}
          <code className="text-xs">customer-account.order-status</code> → format{" "}
          <code className="text-xs">post_checkout</code> (same unit + attribution)
        </li>
        <li>
          Hub book thank-you: embed / snippet → format <code className="text-xs">scheduled_service</code>
        </li>
        <li>
          Same agnostic Birch unit — not a second product. No App Store install counts. Location kit ≠ Birch format
          keys.
        </li>
        <li>
          Starting sizes (mockup 03 <strong>DRAFT</strong>): ~656×280 splash · ~360×640 vertical — final IO wins.
        </li>
      </ul>

      <h2 className="mt-10 font-display text-3xl">Partner activation (same Birch unit)</h2>
      <p className="mt-3">
        Shopify-agnostic embed / snippet so Scale Clinic Hub / partner hubs can enable thank-you + in-experience display
        without custom one-offs. Scale Activation owns Shopify coordination. Care · commerce · display stay three
        contracts.{" "}
        <a className="underline" href="https://scalehealth.ca/clinichubs" target="_blank" rel="noopener noreferrer">
          See Scale Health clinic hubs
        </a>
      </p>

      <h2 className="mt-10 font-display text-3xl">Rate card USD</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>hold-190 · $190 · 7-day look · refund or credit · does not consume a seat. Credit, not a flight.</li>
        <li>
          reserve-490 · $490 · named category seat · 100% media credit · IO before flight · 12-month credit. Credit, not
          a flight.
        </li>
        <li>custom · Get a call back · multi-hub / exclusive / on-prem. Credit, not a flight.</li>
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <a className="underline" href={CALL_BACK_TEL}>
          Get a call back
        </a>
      </p>

      <h2 className="mt-10 font-display text-3xl">Studio / clinic-hub path</h2>
      <p className="mt-3">
        Studios that already own a local audience can add a Scale Clinic Hub (store + booking) and then a Birch unit on
        that hub. Care, commerce, and display stay three separate contracts.{" "}
        <a className="underline" href="https://scalehealth.ca/clinichubs" target="_blank" rel="noopener noreferrer">
          See Scale Health clinic hubs
        </a>
      </p>

      <h2 className="mt-10 font-display text-3xl">Legal floor</h2>
      <p className="mt-3">
        100% media credit. Delivery only under an approved IO that names the surface. Cash refund if no approved surface
        can be named within 60 days. Credit expires at 12 months. After IO: IAB cancel / makegood. Aggregate reporting
        only. No PHI. No clinical pixels.
      </p>
      <p className="mt-4">
        Seller: Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3 ·{" "}
        <a className="underline" href="mailto:randy@silverbirchgrowth.com">Email Randy</a>
      </p>
      <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
        Terms are draft until counsel stamps
      </p>
    </article>
  );
}
