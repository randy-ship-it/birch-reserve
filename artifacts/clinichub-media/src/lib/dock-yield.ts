/**
 * Mobile dock courtesy (Randy Nov 21 4:20 PM): the floating squirrel + call buttons must never sit on top of a button,
 * link, field, heading or card. On the first screen (where nothing can scroll clear yet) the dock steps aside while it
 * would cover one of those, and returns once it would not. Below the first screen it always shows; the page keeps
 * bottom padding equal to the dock height so the last content scrolls clear.
 */
const COVERABLE = "a[href],button,input,select,textarea,summary,label,h1,h2,h3,h4,h5,h6,[role=button]";

function dockRects(): DOMRect[] {
  const out: DOMRect[] = [];
  const sq = document.querySelector(".birch-dock-squirrel");
  if (sq) out.push(sq.getBoundingClientRect());
  const host = document.querySelector("elevenlabs-convai");
  const btn = host?.shadowRoot?.querySelector("button");
  if (btn) out.push(btn.getBoundingClientRect());
  else if (host) out.push(new DOMRect(window.innerWidth - 12 - 56, window.innerHeight - 14 - 56, 56, 56));
  return out.filter((r) => r.width > 0 && r.height > 0);
}

function coversSomething(): boolean {
  for (const r of dockRects()) {
    const pts: [number, number][] = [];
    for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
    for (const [x, y] of pts) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el.closest(".birch-dock-squirrel,elevenlabs-convai,[data-testid=activity-pulse],[data-testid=activity-pulse-inline]")) continue;
        if (el.matches(COVERABLE)) return true;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) > 0 && el.getBoundingClientRect().height < 400) return true;
      }
    }
  }
  return false;
}

export function startDockYield(): () => void {
  const mq = window.matchMedia("(max-width: 767px)");
  const root = document.documentElement;
  let raf = 0;
  const run = () => {
    raf = 0;
    const yieldNow = mq.matches && window.scrollY < window.innerHeight * 0.7 && coversSomething();
    root.classList.toggle("br-dock-yield", yieldNow);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(run); };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  const t = window.setInterval(queue, 1000); // late-loading cards / widget
  queue();
  return () => {
    window.removeEventListener("scroll", queue);
    window.removeEventListener("resize", queue);
    window.clearInterval(t);
    if (raf) cancelAnimationFrame(raf);
    root.classList.remove("br-dock-yield");
  };
}
