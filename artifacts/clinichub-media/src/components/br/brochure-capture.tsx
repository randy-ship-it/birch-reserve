/**
 * Brochure email capture on /media-kit (Randy voice, Nov 21 2026 11:57 AM ET).
 *   BrochureInline  : quiet block mid-page; instant PDF link after submit (never gated).
 *   BrochureSlideIn : one soft corner card (no modal, no scrim), by 55% scroll, 45s, or desktop exit intent.
 * Leads post to /api/launch/email-capture (same leads table) with source brochure_inline | brochure_slidein
 * and the street-team `st` tag when present. No visitor auto-email: a person follows up.
 * Shared "seen" key with the linger card: shown once per visitor (30 days), never after a submit or dismiss.
 */
import { skinText } from "@/lib/siteSkin";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Loader2, X } from "lucide-react";
import { HoneypotField, withFormGuards } from "@/lib/form-guards";
import { track } from "@/lib/analytics";
import { trackIntake } from "@/lib/intakeTrack";
import { MEDIA_KIT_ONE_PAGER_HREF, MEDIA_KIT_ONE_PAGER_NAME } from "@/lib/seller-identity";
import { CHAT_STATE_EVENT, isChatOpen, setLingerOpen } from "@/lib/overlay-bus";

type Src = "brochure_inline" | "brochure_slidein";
const SEEN_KEY = "birch_linger_seen_v1";
const SEEN_TTL_MS = 30 * 24 * 60 * 60_000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const BROCHURE_EVENT = "birch:brochure-submitted";

function seenRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(SEEN_KEY) ?? "0");
    return Number.isFinite(at) && at > 0 && Date.now() - at < SEEN_TTL_MS;
  } catch {
    return false;
  }
}
function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* blocked: at most once per page view */
  }
}
function streetTeamTag(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("st");
    if (fromUrl && /^[A-Za-z0-9_-]{1,40}$/.test(fromUrl)) {
      window.localStorage.setItem("birch_st", fromUrl);
      return fromUrl;
    }
    const kept = window.localStorage.getItem("birch_st");
    return kept && /^[A-Za-z0-9_-]{1,40}$/.test(kept) ? kept : undefined;
  } catch {
    return undefined;
  }
}

function useBrochureForm(source: Src, onDone?: () => void) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      setState("error");
      setError("Please enter a valid email.");
      return;
    }
    setState("sending");
    setError("");
    try {
      const st = streetTeamTag();
      const body = withFormGuards(
        {
          email: v,
          ...(company.trim() ? { company: company.trim().slice(0, 200) } : {}),
          pagePath: "/media-kit",
          source,
          ...(st ? { st } : {}),
        },
        honeypotRef,
      );
      const res = await fetch("/api/launch/email-capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(res.status === 429 && data.error ? data.error : "Something went wrong. The brochure is still below, or try again.");
      }
      markSeen();
      track("email_capture", { source });
      trackIntake("advertiser", "submit", source);
      setState("done");
      window.dispatchEvent(new CustomEvent(BROCHURE_EVENT, { detail: { source } }));
      onDone?.();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };
  return { email, setEmail, company, setCompany, state, setState, error, submit, honeypotRef };
}

const inputCls = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none";
const btnCls = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function Consent({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-snug text-slate-500 ${className}`} data-testid="brochure-consent">
      {skinText("By submitting, you agree we may email you about Birch Reserve. No spam.")}{" "}
      <a href="/privacy" className="underline underline-offset-2 hover:text-slate-900">Privacy</a>
    </p>
  );
}

function BrochureLink({ testId }: { testId: string }) {
  return (
    <a
      href={MEDIA_KIT_ONE_PAGER_HREF}
      download={MEDIA_KIT_ONE_PAGER_NAME}
      onClick={() => track("media_kit_download", { via: "brochure_capture" })}
      className={`${btnCls} w-full sm:w-auto`}
      data-testid={testId}
    >
      <Download className="size-4" aria-hidden /> Open the brochure + rate card (PDF)
    </a>
  );
}

export function BrochureInline() {
  const f = useBrochureForm("brochure_inline");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) {
        trackIntake("advertiser", "view", "brochure_inline", { dedupe: true });
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} className="border-b border-border/70 bg-secondary/40" data-testid="brochure-inline" aria-labelledby="brochure-inline-h">
      <div className="container mx-auto max-w-5xl px-5 py-8 md:px-6 md:py-10">
        <div className="grid items-center gap-5 md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Free brochure</p>
            <h2 id="brochure-inline-h" className="mt-2 font-display text-2xl leading-tight md:text-3xl">Get the brochure + rate card by email</h2>
            <p className="mt-2 text-sm text-foreground/75">Placements, starter rates and how it works, on one page. You get the link right away.</p>
          </div>
          {f.state === "done" ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-foreground/10" role="status" data-testid="brochure-inline-done">
              <p className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="size-4" aria-hidden /></span> Thanks, you&apos;re all set.</p>
              <p className="mt-1 text-sm text-slate-600">Here it is now. We&apos;ll keep you posted, and our team may follow up personally.</p>
              <div className="mt-3"><BrochureLink testId="brochure-inline-download" /></div>
            </div>
          ) : (
            <form onSubmit={f.submit} noValidate className="relative flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-foreground/10" data-testid="brochure-inline-form">
              <HoneypotField inputRef={f.honeypotRef} idSuffix="brochure-inline" />
              <label className="sr-only" htmlFor="bi-email">Email (required)</label>
              <input id="bi-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} placeholder="Email" value={f.email} onChange={(e) => { f.setEmail(e.target.value); if (f.state === "error") f.setState("idle"); }} aria-invalid={f.state === "error" || undefined} className={inputCls} data-testid="brochure-inline-email" />
              <label className="sr-only" htmlFor="bi-company">Company (optional)</label>
              <input id="bi-company" type="text" autoComplete="organization" maxLength={200} placeholder="Company (optional)" value={f.company} onChange={(e) => f.setCompany(e.target.value)} className={inputCls} data-testid="brochure-inline-company" />
              {f.state === "error" && f.error && <p role="alert" className="text-[13px] text-red-600">{f.error}</p>}
              <button type="submit" disabled={f.state === "sending"} className={btnCls} data-testid="brochure-inline-submit">
                {f.state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <>Send me the brochure <ArrowRight className="size-4" aria-hidden /></>}
              </button>
              <Consent />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function BrochureSlideIn() {
  const [open, setOpen] = useState(false);
  /** Phones (Nov 23 2026 mobile QA: the full card covered the media kit's "Two tiers" heading): open as a one-line
   *  strip; the email form only expands when the visitor taps it. Desktop is unchanged. */
  const [expanded, setExpanded] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches);
  const shownRef = useRef(false);
  const f = useBrochureForm("brochure_slidein");

  const show = useCallback(() => {
    if (shownRef.current || seenRecently() || isChatOpen()) return;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    shownRef.current = true;
    markSeen();
    setOpen(true);
    trackIntake("advertiser", "open", "brochure_slidein");
  }, []);
  const dismiss = useCallback(() => {
    markSeen();
    setOpen(false);
    trackIntake("advertiser", "dismiss", "brochure_slidein");
  }, []);

  // Triggers: 55% scroll, 45s on page, desktop exit intent. Skipped after a submit anywhere.
  useEffect(() => {
    if (seenRecently()) return;
    const cleanups: Array<() => void> = [];
    const t = window.setTimeout(show, 45_000);
    cleanups.push(() => window.clearTimeout(t));
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.55) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));
    if (window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) {
      const started = Date.now();
      const onOut = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 8 && Date.now() - started > 4_000) show();
      };
      document.addEventListener("mouseout", onOut);
      cleanups.push(() => document.removeEventListener("mouseout", onOut));
    }
    const onSubmitted = (e: Event) => {
      shownRef.current = true;
      if ((e as CustomEvent<{ source: Src }>).detail?.source !== "brochure_slidein") setOpen(false); // own thank-you stays up
    };
    window.addEventListener(BROCHURE_EVENT, onSubmitted);
    cleanups.push(() => window.removeEventListener(BROCHURE_EVENT, onSubmitted));
    return () => cleanups.forEach((c) => c());
  }, [show]);

  // Hide the activity pulse and chat launcher while we are up; close if the chat opens.
  useEffect(() => {
    setLingerOpen(open);
  }, [open]);
  useEffect(() => () => setLingerOpen(false), []);
  useEffect(() => {
    const onChat = (e: Event) => { if ((e as CustomEvent<{ open: boolean }>).detail?.open) setOpen(false); };
    window.addEventListener(CHAT_STATE_EVENT, onChat);
    return () => window.removeEventListener(CHAT_STATE_EVENT, onChat);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;
  return (
    <aside
      aria-label="Get the brochure"
      className={`fixed bottom-[calc(var(--birch-dock-bottom,14px)_-_2px)] left-3 right-[84px] z-[56] rounded-2xl border border-black/5 bg-white ${expanded ? "p-4" : "px-3 py-1.5"} text-slate-900 shadow-[0_18px_50px_-16px_rgba(7,26,57,0.45)] md:bottom-6 md:left-auto md:right-6 md:w-[340px]`}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      data-testid="brochure-slidein"
    >
      <button type="button" onClick={dismiss} aria-label="Close" className={`absolute z-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${expanded ? "right-2 top-2 size-8" : "right-1 top-1/2 size-10 -translate-y-1/2"}`} data-testid="brochure-slidein-close">
        <X className="size-4" aria-hidden />
      </button>
      {!expanded && f.state !== "done" ? (
        <button type="button" onClick={() => setExpanded(true)} className="flex min-h-10 w-full items-center gap-2 pr-8 text-left font-display text-base leading-tight" data-testid="brochure-slidein-expand">
          <Download className="size-4 shrink-0" aria-hidden /> Get the brochure + rate card
        </button>
      ) : f.state === "done" ? (
        <div role="status" data-testid="brochure-slidein-done">
          <p className="pr-6 font-display text-lg leading-tight">Thanks, here it is.</p>
          <p className="mt-1 text-[13px] text-slate-600">We&apos;ll keep you posted.</p>
          <div className="mt-3"><BrochureLink testId="brochure-slidein-download" /></div>
        </div>
      ) : (
        <form onSubmit={f.submit} noValidate className="relative" data-testid="brochure-slidein-form">
          <HoneypotField inputRef={f.honeypotRef} idSuffix="brochure-slidein" />
          <p className="pr-6 font-display text-lg leading-tight">Get the brochure + rate card</p>
          <p className="mt-1 text-[13px] text-slate-600">One page. Instant link, we&apos;ll keep you posted.</p>
          <div className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor="bs-email">Email (required)</label>
            <input id="bs-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} placeholder="Email" value={f.email} onChange={(e) => { f.setEmail(e.target.value); if (f.state === "error") f.setState("idle"); }} aria-invalid={f.state === "error" || undefined} className={`${inputCls} min-w-0 flex-1`} data-testid="brochure-slidein-email" />
            <button type="submit" disabled={f.state === "sending"} className={`${btnCls} shrink-0 px-4`} data-testid="brochure-slidein-submit" aria-label="Send me the brochure">
              {f.state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
            </button>
          </div>
          {f.state === "error" && f.error && <p role="alert" className="mt-1.5 text-[13px] text-red-600">{f.error}</p>}
          <Consent className="mt-2" />
        </form>
      )}
    </aside>
  );
}
