/**
 * /intake/gtm: B2B go-to-market note (Silver Birch Growth Inc.). Replaces the former $3,500 GTM setup offer.
 */
import { LeadForm } from "@/components/br/lead-form";
import { usePageMeta } from "@/components/br/ui";
import { lookHref } from "@/components/br/pricing";
import { isScaleSkin, SCALE_HOME } from "@/lib/siteSkin";
import { GTM_PARTNER_TYPES, GTM_SETUP, GTM_SETUP_KIND } from "../../../../api-server/src/lib/overhaul/gtmSetup";

export default function BrIntakeGtm() {
  const scale = isScaleSkin();
  usePageMeta("B2B go-to-market | Silver Birch Growth Inc.", GTM_SETUP.sub);
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="gtm-intake">
      <header className="container mx-auto max-w-2xl px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{GTM_SETUP.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl leading-[1.02] md:text-5xl">{GTM_SETUP.title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{GTM_SETUP.sub}</p>
        <p className="mt-2 text-sm text-foreground/70">{GTM_SETUP.separate}</p>
      </header>
      <section className="container mx-auto max-w-2xl px-4 pb-6">
        <div className="rounded-3xl bg-white p-5 shadow-md md:p-8">
          <LeadForm
            kind={GTM_SETUP_KIND}
            testId="form-gtm"
            submitLabel="Leave a strategic note"
            done={<p>Thanks. We received your note.</p>}
            next={<p>Silver Birch Growth takes on only rare strategic projects — if there is a fit, we will reply by email. <a href="/" className="font-semibold underline">Back to the home page</a> or <a href={lookHref("intake_gtm_look")} className="font-semibold underline">see the $190 USD 7-day look</a>.</p>}
            fields={[
              { name: "name", label: "Your name", required: true },
              { name: "company", label: "Company", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "what_they_sell", label: "What do you sell?", required: true, placeholder: "e.g. recovery product" },
              { name: "partner_type", label: "Who do you want partnerships with?", type: "select", required: true, options: [...GTM_PARTNER_TYPES] },
              { name: "website", label: "Website", type: "url" },
              { name: "message", label: "Why this is a strategic fit", type: "textarea" },
              { name: "offer", label: "Offer", type: "hidden", defaultValue: "sbg_gtm_strategic_note" },
            ]}
          />
        </div>
        <p className="mt-4 text-center text-sm">{scale ? <a href={SCALE_HOME} data-mirror-keep="" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to scalehealth.ca</a> : <a href="/" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to birchreserve.net</a>}</p>
      </section>
    </div>
  );
}
