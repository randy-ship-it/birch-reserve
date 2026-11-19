/** Fast → Expanded hand-off (same browser tab session). Brand-level fields only; cleared when the tab closes. */
import type { Market } from "../../../api-server/src/lib/kitCalc/channelGeo";
export type IntakePrefill = { website: string; email: string; market?: Market; category?: string; categorySource?: "site" | "default"; brand?: string; /** avg cart in USD from Friday auto-fill (USD sites only) */ aov?: number; needs?: string[] };
const K = "br_intake_prefill_v1";
export function savePrefill(p: IntakePrefill) {
  try {
    sessionStorage.setItem(K, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}
export function loadPrefill(): IntakePrefill | null {
  try {
    return typeof window === "undefined" ? null : (JSON.parse(sessionStorage.getItem(K) || "null") as IntakePrefill | null);
  } catch {
    return null;
  }
}
