/**
 * Page-wide price text in the visitor's currency (BR-15 move 4 follow-up, Nov 21 2026).
 * Randy's rule: a Canadian visitor sees every price in CAD, everyone else USD; the same number in both currencies
 * unless a CAD table exists. Many pages carry hard-coded USD copy, so when the visitor's currency is CAD this:
 *   - rewrites $190 / $490 to the CAD table ($270 / $690 CAD, from the same /api/currency source);
 *   - relabels every other USD label as CAD with the same number (no CAD table exists for those);
 * and restores the original text when the visitor switches back to USD.
 * Facts that are not our prices (third-party benchmarks, signed-contract values, data inputs) opt out with
 * data-currency-fixed. Components with their own CAD table (sponsor packs) render CAD themselves.
 * Legal pages state both currencies themselves and are skipped.
 */
import { useEffect } from "react";
import { localizePrices, useCurrency } from "@/lib/currency";

const SKIP_PATHS = /^\/(terms|privacy|sample-io)(\/|$)/;
const SKIP_SEL = "script,style,textarea,input,[role=group],[data-testid^=currency],[data-currency-fixed],[contenteditable]";
const HAS_PRICE = /\$(190|490)(?![0-9,]|\.[0-9])|\bUSD\b/;

const AMT = String.raw`\$[0-9][0-9,]*(?:\.[0-9]{2})?`;
/** "$490 USD (or $690 CAD if you're in Canada)", "$190 USD ($270 CAD in Canada)", "$490 USD / $690 CAD", "$490 USD (CAD $690)":
 * the text already names the CAD amount, so keep just that one (Randy, Nov 23 2026: the chat read "$690 CAD (or $690 CAD if
 * you're in Canada)" after the USD half was rewritten). Only the amount the copy itself states is used; nothing is converted. */
const DUAL_PAREN = new RegExp(String.raw`(${AMT})(?:\s*USD)?\s*\((?:or\s+)?(?:(${AMT})\s*CAD|CAD\s*(${AMT}))\b[^)]*\)`, "g");
const DUAL_SLASH = new RegExp(String.raw`(${AMT})\s*USD\s*/\s*(?:(${AMT})\s*CAD|CAD\s*(${AMT}))\b`, "g");
const REPEAT_CAD = new RegExp(String.raw`\s*\((?:or\s+)?(${AMT})\s*CAD(?:\s+(?:in|for|if you're in|if you are in|for visitors in)\s+Canada)?\)`, "g");
export function preferCadAmount(text: string): string {
  const keep = (_m: string, _usd: string, cad?: string, cad2?: string) => `${cad ?? cad2} CAD`;
  return text.replace(DUAL_PAREN, keep).replace(DUAL_SLASH, keep);
}

/** CAD copy: CAD table for $190 / $490, every other USD label becomes CAD with the same number. */
export function toCadText(text: string, prices?: Parameters<typeof localizePrices>[2]): string {
  const out = localizePrices(preferCadAmount(text), "cad", prices).replace(/\bUSD\b/g, "CAD").replace(/\bCAD(\s*[·,]?\s*)CAD\b/g, "CAD");
  // "$690 CAD reserve ($690 CAD in Canada)": the bracket now repeats a CAD amount already stated just before it.
  return out.replace(REPEAT_CAD, (m: string, amt: string, offset: number, all: string) =>
    all.slice(Math.max(0, offset - 120), offset).includes(`${amt} CAD`) ? "" : m);
}

/** Text just before this node inside its block: all previous siblings ("$" + "190" + " USD"), or, for a
 * "<span>USD</span>" right after "$690", the previous siblings of the wrapper. */
function textBefore(node: Node): string {
  let cur: Node | null = node;
  while (cur && !cur.previousSibling && cur.parentNode && cur.parentNode.nodeType === Node.ELEMENT_NODE && cur.parentNode.childNodes.length === 1) cur = cur.parentNode;
  let out = "";
  for (let n = cur?.previousSibling ?? null; n && out.length < 40; n = n.previousSibling) out = (n.textContent ?? "") + out;
  return out;
}

export function CurrencyText() {
  const { currency, prices } = useCurrency();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const originals = new Map<Text, string>();
    const localize = (node: Text, base: string): string => {
      let next = toCadText(base, prices);
      // "$490" became "$690 CAD" and a separate "USD" node follows it: drop the duplicate label.
      if (/^\s*USD\b/.test(base) && /CAD\s*$/.test(textBefore(node))) next = next.replace(/^(\s*)CAD\b\s?/, "$1");
      return next;
    };
    const fix = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_SEL)) return;
      const base = originals.get(node) ?? node.data;
      if (!HAS_PRICE.test(base)) return;
      const next = localize(node, base);
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
          if (orig !== undefined && t.data !== localize(t, orig)) originals.delete(t);
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
