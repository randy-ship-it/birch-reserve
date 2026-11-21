/** Promo code + street team browser script (single source: api-server/src/lib/adserver/promoBoxJs.ts). */
import { PROMO_BOX_JS } from "../../../api-server/src/lib/adserver/promoBoxJs";

declare global {
  interface Window {
    BRPromo?: { capture: () => void; mount: (el: HTMLElement, o?: { mode?: string; getEmail?: () => string }) => void };
  }
}

export function ensurePromo(): void {
  if (typeof window === "undefined" || window.BRPromo) return;
  try {
    const s = document.createElement("script");
    s.textContent = PROMO_BOX_JS;
    document.head.appendChild(s);
  } catch {
    /* best effort */
  }
}
