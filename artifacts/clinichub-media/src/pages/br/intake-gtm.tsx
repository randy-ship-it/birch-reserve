/**
 * /intake/gtm (Randy t332u, Nov 21 2026): simple step-by-step inquiry for a GTM setup package. Same LeadForm pattern as
 * the other public forms (autosave, inline validation, Back, success panel). Goes to the same place as every lead
 * (/v1/leads -> Friday + sales alert). No visitor auto-email, no checkout. Served on scalehealth.ca/intake/gtm via the mirror.
 */
import { LeadForm } from "@/components/br/lead-form";
import { usePageMeta } from "@/components/br/ui";
import { LOOK_HREF } from "@/components/br/pricing";
import { isScaleSkin, SCALE_HOME } from "@/lib/siteSkin";
import { GTM_PARTNER_TYPES, GTM_SETUP, GTM_SETUP_KIND } from "../../../../api-server/src/lib/overhaul/gtmSetup";

export default function BrIntakeGtm() {
  const scale = isScaleSkin();
  usePageMeta("GTM setup packages from $3,500 USD | Birch Reserve", "We set up the partnership / B2B go-to-market bot and console we use, get your motion running, then hand over the keys.");
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="gtm-intake">
      <header className="container mx-auto max-w-2xl px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55" data-currency-fixed>{GTM_SETUP.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl leading-[1.02] md:text-5xl" data-currency-fixed>Start with a $3,500 USD setup.</h1>
        <p className="mt-3 text-base text-muted-foreground">Two quick steps. We reply by email. Nothing is charged here.</p>
        <p className="mt-2 text-sm text-foreground/70">{GTM_SETUP.separate}</p>
      </header>
      <section className="container mx-auto max-w-2xl px-4 pb-6">
        <div className="rounded-3xl bg-white p-5 shadow-md md:p-8">
          <LeadForm
            kind={GTM_SETUP_KIND}
            testId="form-gtm"
            submitLabel="Send my setup request"
            done={<p>Thanks. We have your GTM setup request.</p>}
            next={<p>We reply by email within 1 business day with next steps. Nothing is charged from this form. <a href="/" className="font-semibold underline">Back to the home page</a> or <a href={LOOK_HREF} className="font-semibold underline">see the $190 USD 7-day look</a>.</p>}
            fields={[
              { name: "name", label: "Your name", required: true },
              { name: "company", label: "Company", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "what_they_sell", label: "What do you sell?", required: true, placeholder: "e.g. recovery product" },
              { name: "partner_type", label: "Who do you want partnerships with?", type: "select", required: true, options: [...GTM_PARTNER_TYPES] },
              { name: "website", label: "Website", type: "url" },
              { name: "message", label: "Anything else we should know", type: "textarea" },
              { name: "offer", label: "Offer", type: "hidden", defaultValue: "gtm_setup_from_3500_usd" },
            ]}
          />
        </div>
        <p className="mt-4 text-center text-sm">{scale ? <a href={SCALE_HOME} data-mirror-keep="" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to scalehealth.ca</a> : <a href="/" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to birchreserve.net</a>}</p>
      </section>
    </div>
  );
}
