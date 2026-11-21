/**
 * /gtm-bot (Randy t415u/t416u, Nov 21 2026): the GTM bot, SBG side. Explainer + its own intake form
 * (POST /v1/gtm-bot-lead -> source=gtm_bot, business line SBG, alert to randy@silverbirchgrowth.com).
 * Qualitative only. No client names, no growth stats, no guarantees.
 */
import { LeadForm } from "@/components/br/lead-form";
import { usePageMeta } from "@/components/br/ui";
import { GTM_BOT, GTM_BOT_BUSINESS_LINE, GTM_BOT_KIND, GTM_BOT_PREFS, GTM_BOT_SOURCE, GTM_BOT_STAGES } from "../../../../api-server/src/lib/overhaul/gtmBot";

export default function BrGtmBot() {
  usePageMeta("The GTM bot | Silver Birch Growth", "A go-to-market system built on decades of GTM experience and trained on Silver Birch Growth's own data. Set up selectively, then monthly ranges scoped to your needs.");
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="gtm-bot-page">
      <header className="container mx-auto max-w-3xl px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{GTM_BOT.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl leading-[1.02] text-[#0b1f3a] md:text-5xl">{GTM_BOT.title}</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">{GTM_BOT.sub}</p>
        <a href="#gtm-bot-form" className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]" data-testid="gtm-bot-hero-cta">{GTM_BOT.cta}</a>
      </header>

      <section className="container mx-auto max-w-3xl px-4 pb-6">
        <ul className="grid gap-3 md:grid-cols-3" data-testid="gtm-bot-points">
          {GTM_BOT.points.map((p) => (
            <li key={p.t} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-display text-xl text-[#0b1f3a]">{p.t}</p>
              <p className="mt-1 text-sm text-foreground/70">{p.d}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#ecfccb]/70 p-4" data-testid="gtm-bot-selective">
            <p className="font-display text-xl text-[#0b1f3a]">{GTM_BOT.selective.t}</p>
            <p className="mt-1 text-sm text-foreground/75">{GTM_BOT.selective.d}</p>
          </div>
          <div className="rounded-2xl bg-[#ecfccb]/70 p-4" data-testid="gtm-bot-pricing">
            <p className="font-display text-xl text-[#0b1f3a]">{GTM_BOT.pricing.t}</p>
            <p className="mt-1 text-sm text-foreground/75" data-currency-fixed>{GTM_BOT.pricing.d}</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 pb-6">
        <h2 className="font-display text-2xl text-[#0b1f3a] md:text-3xl">How it works</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {GTM_BOT.how.map((s) => (
            <li key={s.n} className="rounded-2xl border border-[#0b1f3a]/10 bg-white p-4">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{s.n}</span>
              <p className="mt-2 font-display text-lg text-[#0b1f3a]">{s.t}</p>
              <p className="mt-1 text-sm text-foreground/70">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mx-auto max-w-3xl px-4 pb-10" id="gtm-bot-form">
        <div className="rounded-3xl bg-white p-5 shadow-md md:p-8">
          <h2 className="font-display text-2xl text-[#0b1f3a] md:text-3xl">{GTM_BOT.cta}</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Two quick steps. We reply by email. Nothing is charged here.</p>
          <LeadForm
            kind={GTM_BOT_KIND}
            endpoint="/v1/gtm-bot-lead"
            testId="form-gtm-bot"
            submitLabel="Send to the team"
            done={<p>Thanks. We have your GTM bot inquiry.</p>}
            next={<p>We reply by email, usually within 1 business day, and tell you plainly whether it's a fit. Nothing is charged from this form. <a href="/" className="font-semibold underline">Back to the home page</a>.</p>}
            fields={[
              { name: "name", label: "Your name", required: true },
              { name: "company", label: "Company", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "what_they_sell", label: "What do you sell?", required: true, placeholder: "e.g. recovery product" },
              { name: "stage", label: "Where is the product today?", type: "select", required: true, options: [...GTM_BOT_STAGES] },
              { name: "bots_preference", label: "Your bots or ours?", type: "select", required: true, options: [...GTM_BOT_PREFS] },
              { name: "website", label: "Website", type: "url" },
              { name: "message", label: "Anything else we should know", type: "textarea" },
              { name: "source", label: "Source", type: "hidden", defaultValue: GTM_BOT_SOURCE },
              { name: "business_line", label: "Business line", type: "hidden", defaultValue: GTM_BOT_BUSINESS_LINE },
            ]}
          />
        </div>
        <p className="mt-3 text-center text-xs text-foreground/60">{GTM_BOT.note}</p>
      </section>
    </div>
  );
}
