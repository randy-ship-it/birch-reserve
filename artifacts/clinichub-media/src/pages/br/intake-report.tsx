import { useEffect, useState } from "react";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner, RoleTabs } from "@/components/br/intake-kit";
import { fridayIntake, type BrandReport } from "@/lib/fridayBrandIntake";

/** Brand report from Friday: GET /api/public/brand-report/:reportToken (mock on previews). No personal data is shown. */
export default function BrIntakeReport() {
  usePageMeta("Your intake report | Birch Reserve", "Status of your Birch Reserve intake.");
  const [r, setR] = useState<BrandReport | null | undefined>(undefined);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    if (!t) return setR(null);
    fridayIntake().report(t).then(setR).catch(() => setR(null));
  }, []);
  const label = { draft: "Draft", submitted: "Pending approval", pending_review: "Pending approval", approved: "Approved", declined: "Declined" } as const;
  return (
    <div>
      <MockBanner />
      <RoleTabs />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl">Your intake report</h1>
        {r === undefined ? <p className="mt-4 text-sm">Loading…</p> : r === null ? <p className="mt-4 text-sm" data-testid="report-missing">No report found for this link.</p> : (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-md" data-testid="report">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Status</p>
            <p className="font-display text-3xl">{label[r.status]}</p>
            <p className="mt-2 text-sm text-muted-foreground">Role: {r.roles.join(", ") || "n/a"} · version {r.version} · updated {new Date(r.updated_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })} ET</p>
            {Object.keys(r.approvals).length ? <ul className="mt-3 text-sm">{Object.entries(r.approvals).map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: <strong>{v === "pending_review" ? "pending approval" : v}</strong></li>)}</ul> : null}
            <p className="mt-4 text-sm">Every request is reviewed by a person. Nothing is accepted automatically, booked or charged from this page.</p>
          </div>
        )}
      </section>
    </div>
  );
}
