/** One label for every big modelled figure (Randy review, Nov 20 2026): page views, targets, network sizes. */
export const MODELLED_PLAN_LABEL = "Modelled planning estimate, not a delivery promise";

export function PlanChip({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${dark ? "bg-white/10 text-lime-200" : "bg-amber-100 text-amber-900"}`} data-testid="modelled-plan-chip">
      {MODELLED_PLAN_LABEL}
    </span>
  );
}
