/**
 * The intake is the main thing on birchreserve.net (Randy via Emma, Nov 19 2026 8:35 AM ET). One high-contrast CTA
 * used in heroes, the nav and a sticky mobile bar. Every placement carries its own ?ref so clicks and arrivals show
 * up in share/referral tracking (lib/shareTrack.ts).
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { logCtaClick } from "@/lib/shareTrack";

export const KIT_CTA_LABEL = "Get my Monetization Kit";
export const intakeHref = (ref: string) => `/intake?ref=${encodeURIComponent(ref)}`;

export function KitCta({ placement, size = "lg", tone = "lime", label = KIT_CTA_LABEL, sub, className = "", testId }: { placement: string; size?: "sm" | "md" | "lg"; tone?: "lime" | "ink"; label?: string; sub?: string | null; className?: string; testId?: string }) {
  const h = size === "lg" ? "h-14 px-7 text-base md:text-lg" : size === "md" ? "h-12 px-5 text-base" : "h-9 px-3.5 text-sm";
  const colors = tone === "lime" ? "bg-lime-300 text-[#0b1f3a] shadow-lime-400/40 hover:bg-white" : "bg-[#0b1f3a] text-white shadow-black/20 hover:bg-lime-300 hover:text-[#0b1f3a]";
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <a href={intakeHref(placement)} onClick={() => logCtaClick(placement)} data-testid={testId ?? `kit-cta-${placement}`} className={`group inline-flex items-center justify-center gap-2 rounded-full font-bold shadow-lg ring-2 ring-[#0b1f3a]/10 transition ${h} ${colors}`}>
        <Sparkles className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
        {label}
        <ArrowRight className={`${size === "sm" ? "size-4" : "size-5"} transition-transform group-hover:translate-x-0.5`} aria-hidden />
      </a>
      {sub === null ? null : sub ? <span className="text-xs opacity-75">{sub}</span> : null}
    </span>
  );
}

/** Pages that ARE a form: the sticky bar never shows there (Randy, Nov 21 2026: it covered the form's buttons on phones). */
export const STICKY_HIDDEN_PATH = /^\/(intake|kit\/r|sales|sign-in|sign-up|success|agencies|media-buyers|buy|buycalc|sponsor|exclusive)(\/|$)/;
const FORM_PRIMARY = "form button[type=submit], form input[type=submit], [data-form-primary]";
const FIELD = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select";

/**
 * Sticky bottom bar on phones. Hidden on form pages, private reports and staff pages. Elsewhere it steps aside
 * while a form field is focused or any form's primary button is on screen, and while it shows, the page gets
 * bottom padding equal to its height so nothing at the bottom is ever covered.
 */
export function StickyKitCta({ path }: { path: string }) {
  const hiddenPath = STICKY_HIDDEN_PATH.test(path);
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [primaryInView, setPrimaryInView] = useState(false);
  useEffect(() => {
    if (hiddenPath) return;
    const isField = (t: EventTarget | null) => t instanceof Element && t.matches(FIELD);
    const onIn = (e: FocusEvent) => { if (isField(e.target)) setFocused(true); };
    const onOut = (e: FocusEvent) => { if (isField(e.target) && !isField(e.relatedTarget)) setFocused(false); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    const visible = new Set<Element>();
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const en of entries) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); }
      setPrimaryInView(visible.size > 0);
    }, { rootMargin: "0px 0px 96px 0px" });
    const watched = new Set<Element>();
    const scan = () => {
      if (!io) return;
      document.querySelectorAll(FORM_PRIMARY).forEach((el) => { if (!watched.has(el) && !el.closest("[data-testid=sticky-kit-cta]")) { watched.add(el); io.observe(el); } });
      for (const el of [...watched]) if (!el.isConnected) { watched.delete(el); visible.delete(el); io.unobserve(el); }
      setPrimaryInView(visible.size > 0);
    };
    scan();
    let t = 0;
    const mo = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(scan, 150); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); io?.disconnect(); mo.disconnect(); window.clearTimeout(t); };
  }, [hiddenPath, path]);
  const show = !hiddenPath && !focused && !primaryInView;
  // Reserve the bar's height at the bottom of the page while it can show (phones only; the bar is lg:hidden).
  useEffect(() => {
    if (hiddenPath) return;
    const apply = () => {
      const h = ref.current && window.matchMedia("(max-width: 1023px)").matches ? ref.current.offsetHeight : 0;
      document.body.style.paddingBottom = h ? `${h}px` : "";
    };
    apply();
    window.addEventListener("resize", apply);
    return () => { window.removeEventListener("resize", apply); document.body.style.paddingBottom = ""; };
  }, [hiddenPath]);
  if (hiddenPath) return null;
  return (
    <div ref={ref} aria-hidden={show ? undefined : true} className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#0b1f3a]/10 bg-[#0b1f3a]/95 px-4 py-2.5 backdrop-blur transition-transform duration-200 lg:hidden print:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`} data-testid="sticky-kit-cta" data-state={show ? "shown" : "hidden"} style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
      <a href={intakeHref("sticky_mobile")} tabIndex={show ? undefined : -1} onClick={() => logCtaClick("sticky_mobile")} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-300 text-base font-bold text-[#0b1f3a]">
        <Sparkles className="size-5" aria-hidden />{KIT_CTA_LABEL}<ArrowRight className="size-5" aria-hidden />
      </a>
    </div>
  );
}
