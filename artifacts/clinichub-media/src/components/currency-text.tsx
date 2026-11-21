/**
 * Page-wide price text in the visitor's currency (BR-15 move 4 follow-up, Nov 21 2026).
 * Many pages still carry the $190 / $490 copy as plain text. When the visitor's currency is CAD, this rewrites
 * those text nodes to the CAD table ($270 / $690 CAD, from the same /api/currency source) and restores the
 * original text when they switch back to USD. Amounts that are USD-only (sponsor packs, CPMs, agency tests)
 * are never touched: only $190 and $490. Opt out a block with data-currency-fixed (e.g. USD-based math).
 * Legal pages state both currencies themselves and are skipped.
 */
import { useEffect } from "react";
import { localizePrices, useCurrency } from "@/lib/currency";

const SKIP_PATHS = /^\/(terms|privacy|sample-io)(\/|$)/;
const HAS_PRICE = /\$(190|490)(?![0-9,]|\.[0-9])/;

export function CurrencyText() {
  const { currency, prices } = useCurrency();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const originals = new Map<Text, string>();
    const fix = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,textarea,input,[data-currency-fixed],[contenteditable]")) return;
      const base = originals.get(node) ?? node.data;
      if (!HAS_PRICE.test(base)) return;
      const next = localizePrices(base, "cad", prices);
      if (next !== base) {
        originals.set(node, base);
        if (node.data !== next) node.data = next;
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return fix(root as Text);
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) fix(n as Text);
    };
    if (currency !== "cad" || SKIP_PATHS.test(window.location.pathname.replace(/^\/intake\/_m/, ""))) return;
    walk(document.body);
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          // React re-rendered this node with its own (USD) text: forget the old original and localize again.
          const orig = originals.get(t);
          if (orig !== undefined && t.data !== localizePrices(orig, "cad", prices)) originals.delete(t);
          fix(t);
        } else m.addedNodes.forEach(walk);
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      mo.disconnect();
      originals.forEach((orig, node) => {
        if (node.isConnected) node.data = orig;
      });
    };
  }, [currency, prices]);
  return null;
}
