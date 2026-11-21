import type { Page } from "@playwright/test";

export type Hit = { kind: "overflow" | "overlap" | "clip"; a: string; b?: string; detail: string };

/** Open every <details>, then report horizontal overflow and overlapping / clipped text boxes. Runs in the page. */
export async function auditPage(page: Page): Promise<Hit[]> {
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")));
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const hits: { kind: "overflow" | "overlap" | "clip"; a: string; b?: string; detail: string }[] = [];
    const vw = document.documentElement.clientWidth;
    const de = document.documentElement;
    const name = (el: Element) => {
      const t = (el.getAttribute("data-testid") || "") ;
      return `${el.tagName.toLowerCase()}${t ? `[${t}]` : ""}:${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)}`;
    };
    if (de.scrollWidth > vw + 1) hits.push({ kind: "overflow", a: "document", detail: `scrollWidth ${de.scrollWidth} > ${vw}` });
    // Any element (fixed header included) poking past the viewport whose parent fits: a layout that ignores the width.
    document.querySelectorAll("body *").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || e.closest("[class*=overflow-x-auto],[class*=animate-marquee],elevenlabs-convai,svg,.sr-only,[aria-hidden=true]")) return;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "absolute") return;
      if (r.right > vw + 1 && (!e.parentElement || e.parentElement.getBoundingClientRect().right <= vw + 1) && (e.textContent || "").trim()) hits.push({ kind: "overflow", a: name(e), detail: `right ${Math.round(r.right)} > ${vw}` });
    });
    type Box = { el: Element; r: DOMRect };
    const boxes: Box[] = [];
    const skip = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return true;
        if (cs.position === "fixed" || cs.position === "sticky") return true; // floating chrome has its own checks
        if (n.matches("script,style,noscript,svg,[aria-hidden=true],.sr-only,[data-testid=activity-pulse],[data-testid=activity-pulse-inline]")) return true;
        if (n.closest("elevenlabs-convai")) return true;
      }
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const txt = (n.textContent || "").trim();
      const el = n.parentElement;
      if (!txt || !el || skip(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const raw of Array.from(range.getClientRects())) {
        // Clip to ancestors that hide/scroll their overflow (truncated text and carousels are not overlaps).
        let L = raw.left, R = raw.right, T = raw.top, B = raw.bottom;
        for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
            const pr = p.getBoundingClientRect();
            if (cs.overflowX !== "visible") { L = Math.max(L, pr.left); R = Math.min(R, pr.right); }
            if (cs.overflowY !== "visible") { T = Math.max(T, pr.top); B = Math.min(B, pr.bottom); }
          }
        }
        const r = new DOMRect(L, T, Math.max(0, R - L), Math.max(0, B - T));
        if (r.width < 2 || r.height < 4) continue;
        boxes.push({ el, r });
        if (r.right > vw + 1 || r.left < -1) {
          // text clipped by an ancestor with overflow hidden/auto is a scroller, not a bug
          let scroller = false;
          for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden") { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1 && pr.left >= -1) { scroller = true; break; } }
          }
          if (!scroller) hits.push({ kind: "clip", a: name(el), detail: `text box ${Math.round(r.left)}..${Math.round(r.right)} outside 0..${vw}` });
        }
      }
    }
    // pairwise overlap between text boxes of different, unrelated elements
    boxes.sort((x, y) => x.r.top - y.r.top);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        if (b.r.top > a.r.bottom) break;
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 3 && h > Math.min(a.r.height, b.r.height) * 0.4) {
          // allow deliberate layering: either element is positioned absolutely over an image/background
          const pa = getComputedStyle(a.el).position, pb = getComputedStyle(b.el).position;
          if (pa === "absolute" || pb === "absolute") continue;
          hits.push({ kind: "overlap", a: name(a.el), b: name(b.el), detail: `${Math.round(w)}x${Math.round(h)}px at y=${Math.round(a.r.top + scrollY)}` });
          if (hits.length > 60) return hits;
        }
      }
    }
    return hits;
  });
}
