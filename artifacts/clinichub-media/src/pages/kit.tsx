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

export default function Kit() {
  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">Kit</p>
      <h1 className="mt-4 font-display text-5xl">Display beside the product they already trust.</h1>
      <p className="mt-6 text-lg">
        Eight category seats inside signed Scale Health hubs. Not an open auction. Not a guaranteed impression buy.
      </p>
      <p className="mt-6">
        Live proof: <a className="underline" href="https://physio.drhonow.com">https://physio.drhonow.com</a>
      </p>
      <p className="mt-2 text-muted-foreground">Caption on every mock: Illustrative — not your receipt.</p>
      <h2 className="mt-10 font-display text-3xl">Eight seats</h2>
      <p className="mt-3">{CATEGORIES.join(" · ")}</p>
      <p className="mt-3">Hubs are the rooms. The seat is the exclusive shelf in those rooms.</p>
      <h2 className="mt-10 font-display text-3xl">Launching cohort</h2>
      <p className="mt-3">DR-HO’S · Kalaya · Jill Health · Jack Health · Integrity Fitness · Bird & Be · NutriProCan · Roll Recovery</p>
      <p className="mt-2 text-muted-foreground">Logos, not reach.</p>
      <h2 className="mt-10 font-display text-3xl">Planning ranges, not sold performance</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>End customer: 30–65, Canada / U.S., recovery / topical / sleep / nutrition / care shopper, often paramedical-insured, mid-to-upper household.</li>
        <li>Context: just checked out, on a plan, or just booked. Not a cold feed impression.</li>
        <li>Brand buyer: founder or brand manager already adjacent to those names.</li>
        <li>Analog only: open-web wellness CPM often $8–25; owned / retail-media $20–80. Birch is priced as a credit, not a CPM guarantee.</li>
      </ul>
      <h2 className="mt-10 font-display text-3xl">Formats</h2>
      <p className="mt-3">post_checkout · recovery_plan · scheduled_service · member_hub · motion_15s</p>
      <h2 className="mt-10 font-display text-3xl">Rate card USD</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>hold-190 · $190 · 7-day look · refund or credit · does not consume a seat. Credit, not a flight.</li>
        <li>reserve-490 · $490 · named category seat · 100% media credit · IO before flight · 12-month credit. Credit, not a flight.</li>
        <li>custom · Book a call · multi-hub / exclusive / on-prem. Credit, not a flight.</li>
        <li>reserve-899 remains unpublished/legacy so live Stripe sessions still match.</li>
      </ul>
      <h2 className="mt-10 font-display text-3xl">Studio / clinic-hub path</h2>
      <p className="mt-3">
        Studios that already own a local audience can add a Scale Clinic Hub (store + booking) and then a Birch unit on that hub. Care, commerce, and display stay three separate contracts. <a className="underline" href="https://scalehealth.ca/clinichubs">scalehealth.ca/clinichubs</a>
      </p>
      <h2 className="mt-10 font-display text-3xl">Legal floor</h2>
      <p className="mt-3">
        100% media credit. Delivery only under an approved IO that names the surface. Cash refund if no approved surface can be named within 60 days. Credit expires at 12 months. After IO: IAB cancel / makegood. Aggregate reporting only. No PHI. No clinical pixels.
      </p>
      <p className="mt-4">
        Seller: Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3 · randy@silverbirchgrowth.com
      </p>
      <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Draft /terms until counsel stamps.</p>
    </article>
  );
}
