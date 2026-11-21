/**
 * /intake/activate: the "getting your ads turned on" step as its own page, for hubs, providers and brands that onboard
 * outside the supplier form (approval emails and the ad admin link here). ?email=&company=&role=&hub= prefill.
 * Under /intake so scalehealth.ca/intake/activate serves it through the mirror.
 */
import { AdActivation } from "@/components/br/ad-activation";
import { usePageMeta } from "@/components/br/ui";
import { skinText } from "@/lib/siteSkin";
import { ACT_ROLES, type ActRole } from "../../../../api-server/src/lib/overhaul/adActivation";

export default function BrIntakeActivate() {
  usePageMeta("Get your ads turned on | Birch Reserve", "Share a rough inventory estimate and which ads can run on your hubs. Every ad is reviewed and nothing runs without approval.");
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const role = ACT_ROLES.find((r) => r.key === q.get("role"))?.key as ActRole | undefined;
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="intake-activate">
      <header className="container mx-auto max-w-2xl px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{skinText("Birch Reserve")} · Ads on</p>
        <h1 className="font-display text-4xl leading-[1.02] md:text-5xl">Getting your ads turned on.</h1>
        <p className="mt-3 text-base text-muted-foreground">Two quick questions. Ranges are fine.</p>
      </header>
      <section className="container mx-auto max-w-2xl px-4 pb-10">
        <AdActivation standalone role={role} email={q.get("email") ?? ""} company={q.get("company") ?? ""} hubSlug={q.get("hub") ?? ""} />
      </section>
    </div>
  );
}
