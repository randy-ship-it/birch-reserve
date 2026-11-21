/**
 * /partners: Partnerships landing page. Three track cards + one intake (same LeadForm as the other public forms ->
 * /v1/leads -> sales alert to Randy + a row in the leads store with source=partners and the track). ?track=flyer|adbuying|media
 * preselects the track. No PII in the URL: the form posts JSON.
 */
import { LeadForm } from "@/components/br/lead-form";
import { PartnerGroups } from "@/components/br/partners";
import { usePageMeta } from "@/components/br/ui";
import { PARTNERS, PARTNER_TRACKS, partnerTrackKey, partnerTrackName } from "../../../../api-server/src/lib/overhaul/partners";
import { PARTNERS_KIND } from "../../../../api-server/src/lib/overhaul/partners";

export default function BrPartners() {
  usePageMeta("Partner with Birch Reserve | Service vendors and inventory partners", "Service vendors for ad buying, creative and distribution, and agencies, media houses and newspapers who want to offer our display inventory to their customers. Wholesale terms discussed directly.");
  const q = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("track") ?? "";
  const pre = partnerTrackName(partnerTrackKey(q));
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="partners-page">
      <section className="container mx-auto max-w-5xl px-4 pb-6 pt-8 md:pt-12">
        <div className="overflow-hidden rounded-3xl p-6 text-white md:p-10" style={{ background: "#0E3B2A" }} data-testid="partners-hero">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#BFF3D6]">{PARTNERS.eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] md:text-5xl">{PARTNERS.title}</h1>
          <p className="mt-3 max-w-2xl text-base text-white/80">{PARTNERS.sub}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {["Service vendors", "Inventory and reach partners"].map((t) => (
              <li key={t} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20">{t}</li>
            ))}
          </ul>
          <a href="#apply" data-testid="partners-hero-cta" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] transition hover:bg-white">{PARTNERS.cta}</a>
        </div>
      </section>
      <section className="container mx-auto max-w-5xl px-4 pb-8">
        <PartnerGroups />
      </section>
      <section id="apply" className="container mx-auto max-w-2xl scroll-mt-24 px-4 pb-6" data-testid="partners-apply">
        <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">Tell us about your business.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Two quick steps. We reply by email. {PARTNERS.terms}</p>
        <div className="mt-4 rounded-3xl bg-white p-5 shadow-md md:p-8">
          <LeadForm
            kind={PARTNERS_KIND}
            testId="form-partners"
            submitLabel="Send my partnership inquiry"
            done={<p>Thanks. We have your partnership inquiry.</p>}
            next={<p>We reply by email within 1 business day. {PARTNERS.terms} <a href="/" className="font-semibold underline">Back to the home page</a>.</p>}
            fields={[
              { name: "name", label: "Your name", required: true },
              { name: "company", label: "Company", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "partner_track", label: "Which fits you?", type: "select", required: true, options: PARTNER_TRACKS.map((t) => t.name), defaultValue: pre },
              { name: "phone", label: "Phone", type: "tel" },
              { name: "website", label: "Website", type: "url" },
              { name: "region", label: "Region or markets you cover", placeholder: "e.g. Toronto, Southern Ontario" },
              { name: "reach", label: "Reach or audience size", placeholder: "In your own words" },
              { name: "message", label: "Anything else we should know", type: "textarea" },
              { name: "offer", label: "Offer", type: "hidden", defaultValue: "partners" },
            ]}
          />
        </div>
        <p className="mt-4 text-center text-sm"><a href="/" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to birchreserve.net</a></p>
      </section>
    </div>
  );
}
