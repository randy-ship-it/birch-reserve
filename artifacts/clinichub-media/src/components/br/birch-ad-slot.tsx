import { useEffect, useRef, useState } from "react";

/**
 * Birch ad slot for Birch / Scale marketing and intake pages. Only MARKETING_SLOTS keys belong here; hubs are off unless
 * Randy or Jon enable them in the ad system.
 *
 * NOT PLACED anywhere right now (Randy, Nov 21 2026 5:54 PM): no live ads on the Birch site. The Calm Joints creative
 * appears only as an illustration inside the example-hub mockups (components/br/calm-example-ad.tsx). Placing this slot
 * on a page again needs Randy's say-so.
 *
 * No layout shift: the box is reserved up front (creative ratio + the embed's "Sponsored" label row) and the embed renders
 * on top of it. If nothing fills, the reserved box collapses (an empty slot never sits on the page).
 */
const EMBED_SRC = "https://birchreserve.net/ads/embed.js";
const LABEL_ROW_PX = 22;

function loadEmbed(): void {
  if (typeof document === "undefined") return;
  const w = window as unknown as { __brAds?: { scan: () => void } };
  if (w.__brAds) {
    w.__brAds.scan();
    return;
  }
  if (document.querySelector(`script[src="${EMBED_SRC}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = EMBED_SRC;
  document.head.appendChild(s);
}

export function BirchAdSlot({ slot, ratio = [1200, 628], format = "landscape", testId, className = "" }: { slot: string; ratio?: [number, number]; format?: string; testId?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    loadEmbed();
    const el = ref.current;
    if (!el) return;
    const check = () => setEmpty(el.getAttribute("data-br-state") === "house");
    const mo = new MutationObserver(check);
    mo.observe(el, { attributes: true, attributeFilter: ["data-br-state"] });
    check();
    return () => mo.disconnect();
  }, []);
  if (empty) return null;
  return (
    <aside aria-label="Sponsored" className={`mx-auto w-full max-w-[600px] ${className}`} data-testid={testId}>
      <div style={{ position: "relative" }}>
        <div aria-hidden style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }} />
        <div aria-hidden style={{ height: LABEL_ROW_PX }} />
        <div ref={ref} data-br-slot={slot} data-br-format={format} data-br-text="off" style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      </div>
    </aside>
  );
}
