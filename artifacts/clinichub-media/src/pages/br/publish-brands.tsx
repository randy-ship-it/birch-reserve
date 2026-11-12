import { LeadForm } from "@/components/br/lead-form";
import { BrandBanners } from "@/components/br/brand-banners";
import { Eyebrow, H1, H2, Lede, Section, usePageMeta } from "@/components/br/ui";

export default function BrPublishBrands() {
  usePageMeta("Publish · Brands | Birch Reserve", "Brands with a recovery audience can apply for a co-branded hub. Otherwise, inquire about display or CPC-only opportunities outside hubs.");
  return (
    <div data-testid="br-publish-brands">
      <Section>
        <Eyebrow>Publish · Brands</Eyebrow>
        <H1>Turn your customers into a co-branded hub.</H1>
        <Lede>Co-branded hubs are open to brands with a Recovery audience: recovery, longevity and food today, pets in queue. We pick partners by fit and audience, so it starts with a short inquiry.</Lede>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="border-2 border-foreground bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Option A</p>
            <h3 className="mt-2 font-display text-2xl">Co-branded hub</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your brand and Scale on one hub for your customers, with care, member offers and our marketplace plugged in. Ad slots on your hub earn for you. Selected by fit.</p>
          </div>
          <div className="border border-foreground/20 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Option B</p>
            <h3 className="mt-2 font-display text-2xl">Display / CPC only, outside hubs</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Not a recovery audience? Tell us about your site, app or email list. If there's a fit for display or CPC outside hubs, we'll contact you.</p>
          </div>
        </div>
      </Section>
      <Section tone="soft" id="cobranded">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Option A</Eyebrow>
            <H2>Co-branded hub inquiry</H2>
            <p className="mt-4 text-sm text-muted-foreground">We reply by email.</p>
          </div>
          <LeadForm
            kind="cobranded_hub_inquiry"
            testId="form-cobranded"
            submitLabel="Send hub inquiry"
            done={<p>Thanks. We'll review your audience and reply by email.</p>}
            fields={[
              { name: "company", label: "Brand", required: true },
              { name: "website", label: "Website", type: "url", required: true, placeholder: "https://" },
              { name: "name", label: "Your name", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "vertical", label: "Recovery audience", type: "select", required: true, options: ["Recovery", "Pain relief", "Mobility / footwear", "Longevity", "Food / nutrition", "Pets (in queue)", "Women's / men's health", "Other"] },
              { name: "customers", label: "Customers a year", type: "select", required: true, options: ["Under 10k", "10k–50k", "50k–250k", "250k–1M", "Over 1M"] },
              { name: "countries", label: "Where they are", type: "select", required: true, options: ["Canada", "US", "Canada + US", "Other"] },
              { name: "phone", label: "Phone", type: "tel" },
              { name: "message", label: "Anything we should know", type: "textarea" },
            ]}
          />
        </div>
      </Section>
      <Section id="display-cpc">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Option B</Eyebrow>
            <H2>Display / CPC-only inquiry</H2>
            <p className="mt-4 text-sm text-muted-foreground">Outside hubs. We'll contact you if there's a fit.</p>
          </div>
          <LeadForm
            kind="display_cpc_inquiry"
            testId="form-display-cpc"
            submitLabel="Send inquiry"
            done={<p>Thanks. We'll contact you if there's a display or CPC fit.</p>}
            fields={[
              { name: "company", label: "Company", required: true },
              { name: "website", label: "Website or app", type: "url", required: true, placeholder: "https://" },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "inventory", label: "What you have", type: "select", required: true, options: ["Website display", "Email list", "App", "Post-purchase / thank-you page", "Other"] },
              { name: "monthly_views", label: "Monthly views or sends", type: "select", options: ["Under 50k", "50k–250k", "250k–1M", "Over 1M"] },
              { name: "message", label: "Notes", type: "textarea" },
            ]}
          />
        </div>
      </Section>
      <Section tone="soft">
        <BrandBanners title="Brands already listed with Scale" />
      </Section>
    </div>
  );
}
