/**
 * Attention metrics client (see api-server/src/lib/attentionEvents.ts for the event list and how to read them).
 * First-party /v1/ui-events (sendBeacon) mirrored to Plausible/GA4 when configured. Never sends user input.
 */
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { isAttentionEvent, tfiBucket } from "../../../api-server/src/lib/attentionEvents";

const fired = new Set<string>();

export function trackAttn(name: string, opts?: { once?: boolean }): void {
  const event = `attn.${name}`;
  if (typeof window === "undefined" || !isAttentionEvent(event)) return;
  const path = (window.location.pathname || "/").slice(0, 200);
  if (opts?.once) {
    const k = `${event}|${path}`;
    if (fired.has(k)) return;
    fired.add(k);
  }
  track("attention", { name, path });
  try {
    const body = JSON.stringify({ event, path });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/v1/ui-events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/v1/ui-events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    /* analytics must never break the page */
  }
}

/** Page view, scroll depth 25/50/75/100, first interaction + time to it, and which beats scrolled into view. */
export function useAttention(beats: Record<string, string>): void {
  useEffect(() => {
    const t0 = performance.now();
    trackAttn("view", { once: true });
    let touched = false;
    const touch = () => {
      if (touched) return;
      touched = true;
      trackAttn("first_touch", { once: true });
      trackAttn(tfiBucket(performance.now() - t0), { once: true });
      for (const ev of ["pointerdown", "keydown", "touchstart", "wheel"] as const) window.removeEventListener(ev, touch, true);
    };
    for (const ev of ["pointerdown", "keydown", "touchstart", "wheel"] as const) window.addEventListener(ev, touch, { capture: true, passive: true });
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      if (window.scrollY > 4) touch();
      const pct = (window.scrollY / total) * 100;
      for (const n of [25, 50, 75, 100]) if (pct >= n - (n === 100 ? 2 : 0)) trackAttn(`scroll_${n}`, { once: true });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        const name = (en.target as HTMLElement).dataset.attnBeat;
        if (name) { trackAttn(`beat.${name}`, { once: true }); io?.unobserve(en.target); }
      }
    }, { threshold: 0.35 });
    for (const [name, sel] of Object.entries(beats)) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && io) { el.dataset.attnBeat = name; io.observe(el); }
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      for (const ev of ["pointerdown", "keydown", "touchstart", "wheel"] as const) window.removeEventListener(ev, touch, true);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
