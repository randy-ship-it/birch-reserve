/**
 * /intake/street-team: street team program inquiry (coming 2027). Not a new form stack: the same LeadForm as the other
 * public forms (autosave, inline validation, Back, success panel) -> /v1/leads -> the same lead storage + sales alert.
 * Under /intake so scalehealth.ca/intake/street-team serves it through the mirror with the Scale logo. ?tier= prefills.
 */
import { LeadForm } from "@/components/br/lead-form";
import { usePageMeta } from "@/components/br/ui";
import { STREET_TEAM, STREET_TEAM_BUDGET, STREET_TEAM_KIND, STREET_TEAM_TIERS, STREET_TEAM_TIMING } from "../../../../api-server/src/lib/overhaul/streetTeam";

const TIER_OPTIONS = STREET_TEAM_TIERS.map((t) => t.name);

export default function BrIntakeStreetTeam() {
  usePageMeta("Street team program inquiry (2027) | Birch Reserve", "Tell us your brand, tier and routes for the 2027 street team program. A minimum campaign size applies. Nothing is charged.");
  const q = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tier") ?? "";
  const pre = STREET_TEAM_TIERS.find((t) => t.key === q)?.name ?? "";
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="street-team-intake">
      <header className="container mx-auto max-w-2xl px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{STREET_TEAM.badge} · {STREET_TEAM.eyebrow}</p>
        <h1 className="font-display text-4xl leading-[1.02] md:text-5xl">Tell us about your brand.</h1>
        <p className="mt-3 text-base text-muted-foreground">Two quick steps. We reply by email. Nothing is charged here.</p>
        <p className="mt-2 text-sm text-foreground/70">{STREET_TEAM.outside} {STREET_TEAM.minimum}</p>
      </header>
      <section className="container mx-auto max-w-2xl px-4 pb-6">
        <div className="rounded-3xl bg-white p-5 shadow-md md:p-8">
          <LeadForm
            kind={STREET_TEAM_KIND}
            testId="form-street-team"
            submitLabel="Send my inquiry"
            done={<p>Thanks. We have your street team inquiry.</p>}
            next={<p>We reply by email within 1 business day. A minimum campaign size applies and we confirm it then. <a href="/street-team" className="font-semibold underline">See the program</a> or <a href="/" className="font-semibold underline">go back to the home page</a>.</p>}
            fields={[
              { name: "name", label: "Contact name", required: true },
              { name: "company", label: "Brand", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "target_routes", label: "Target cities or routes", required: true, placeholder: "e.g. Toronto north, Mississauga" },
              { name: "tier_of_interest", label: "Tier of interest", type: "select", required: true, options: [...TIER_OPTIONS], defaultValue: pre },
              { name: "timing", label: "Timing", type: "select", required: true, options: [...STREET_TEAM_TIMING] },
              { name: "budget_range", label: "Rough budget range (USD)", type: "select", options: [...STREET_TEAM_BUDGET] },
              { name: "website", label: "Website", type: "url" },
              { name: "message", label: "Anything else we should know", type: "textarea" },
              { name: "offer", label: "Offer", type: "hidden", defaultValue: "street_team_2027" },
            ]}
          />
        </div>
        <p className="mt-4 text-center text-sm"><a href="/street-team" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to the street team program</a></p>
      </section>
    </div>
  );
}
