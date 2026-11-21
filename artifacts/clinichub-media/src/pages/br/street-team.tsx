/** /street-team: the street team program, coming 2027. Same block as the home page, standing alone. */
import { StreetTeamProgram } from "@/components/br/street-team";
import { usePageMeta } from "@/components/br/ui";

export default function BrStreetTeam() {
  usePageMeta("Street team program, coming 2027 | Birch Reserve", "Door-to-door by route: join a running campaign, run your own on specific routes, or door drop. The high-touch version runs today for Calm Joints only. Outside brands from 2027; minimum campaign size applies.");
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]" data-testid="street-team-page">
      <section className="container mx-auto max-w-5xl px-4 pb-10 pt-8 md:pt-12">
        <StreetTeamProgram where="page" />
        <p className="mt-4 text-center text-sm"><a href="/" className="font-semibold text-foreground/70 underline-offset-2 hover:underline">Back to birchreserve.net</a></p>
      </section>
    </div>
  );
}
