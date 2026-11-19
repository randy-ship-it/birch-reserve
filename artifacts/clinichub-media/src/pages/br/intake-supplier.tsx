/**
 * /intake/supplier: NOT a separate form (Randy, Nov 19 2026 1:47 PM ET). It is the main /intake page and one form,
 * opened in the supplier-first preset (exposure ladder, ?brand= prefill, quiet fees, own hub pending approval).
 * See components/br/supplier-mode.tsx and IntakeShortForm preset="supplier".
 */
import BrIntake from "@/pages/br/intake";

export default function BrIntakeSupplier() {
  return <BrIntake preset="supplier" />;
}
