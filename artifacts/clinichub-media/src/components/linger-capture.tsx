/**
 * Linger email capture (Randy 6:50pm): a quiet 2026-style slide-in.
 *   desktop: bottom-right card, triggered by exit intent
 *   mobile:  bottom sheet, after ~35s on the page or 50% scroll
 * Once per visitor (localStorage, 30 days; also set on submit / close). Never while
 * the chat is open, and the chat launcher hides while this is showing (overlay-bus).
 * Hook (Randy 7:03pm): "Get the media kit". After the email saves, the success
 * state offers the PDF (/birch-reserve-media-kit.pdf) plus a link to /kit; if the PDF
 * isn't deployed yet, the download button falls back to /kit. Email required, company
 * optional, honeypot. Saves via POST /api/launch/email-capture (source email_capture:
 * Birch DB leads row, Friday push, Randy + Jon email; skipped for QA traffic).
 * Copy rules: no raw URLs as text, no invented metrics, public SKUs only ($190 / $490).
 * QA / screenshots: add ?linger=show to force it open.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Download, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";
import { HoneypotField, withFormGuards } from "@/lib/form-guards";
import { track } from "@/lib/analytics";
import { CHAT_STATE_EVENT, isChatOpen, setLingerOpen } from "@/lib/overlay-bus";
import { OPEN_RANDY_CHAT_EVENT } from "@/lib/book-call";

const SEEN_KEY = "birch_linger_seen_v1";
const SEEN_TTL_MS = 30 * 24 * 60 * 60_000;
const MOBILE_DELAY_MS = 35_000;
const DESKTOP_MIN_DWELL_MS = 4_000;
const MEDIA_KIT_PDF = "/birch-reserve-media-kit.pdf";
const MEDIA_KIT_PAGE = "/kit";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const HIDDEN_PREFIXES = ["/kit", "/marketplace", "/sales", "/editorial", "/success", "/splash", "/sign-in", "/sign-up"];

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
    /* storage blocked: shows at most once per page view */
  }
}

function forced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("linger") === "show";
  } catch {
    return false;
  }
}

function anotherDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

function isDesktop(): boolean {
  return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
}

export function LingerCapture() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [kitHref, setKitHref] = useState<string>(MEDIA_KIT_PDF);
  const [desktop, setDesktop] = useState(() => (typeof window !== "undefined" ? isDesktop() : true));
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const shownRef = useRef(false);
  const titleId = useId();
  const descId = useId();

  const hiddenRoute = HIDDEN_PREFIXES.some((p) => location.startsWith(p));

  const show = useCallback(() => {
    if (shownRef.current || isChatOpen() || anotherDialogOpen()) return;
    shownRef.current = true;
    markSeen();
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setDesktop(isDesktop());
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  // Success: confirm the PDF is actually deployed (SPA fallback would serve HTML).
  useEffect(() => {
    if (state !== "done") return;
    let alive = true;
    fetch(MEDIA_KIT_PDF, { method: "HEAD" })
      .then((r) => {
        const pdf = r.ok && (r.headers.get("content-type") ?? "").toLowerCase().includes("pdf");
        if (alive) setKitHref(pdf ? MEDIA_KIT_PDF : MEDIA_KIT_PAGE);
      })
      .catch(() => alive && setKitHref(MEDIA_KIT_PAGE));
    return () => {
      alive = false;
    };
  }, [state]);

  // Tell the chat widget (launcher hides while we're up).
  useEffect(() => {
    setLingerOpen(open);
    if (!open && restoreFocusRef.current && document.contains(restoreFocusRef.current)) {
      restoreFocusRef.current.focus?.();
      restoreFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => () => setLingerOpen(false), []);

  // Triggers.
  useEffect(() => {
    if (hiddenRoute) return;
    if (forced()) {
      const t = window.setTimeout(show, 300);
      return () => window.clearTimeout(t);
    }
    if (seenRecently()) return;
    const startedAt = Date.now();
    const cleanups: Array<() => void> = [];
    if (isDesktop()) {
      const onOut = (e: MouseEvent) => {
        if (e.relatedTarget || e.clientY > 8) return;
        if (Date.now() - startedAt < DESKTOP_MIN_DWELL_MS) return;
        show();
      };
      document.addEventListener("mouseout", onOut);
      cleanups.push(() => document.removeEventListener("mouseout", onOut));
    } else {
      const t = window.setTimeout(show, MOBILE_DELAY_MS);
      cleanups.push(() => window.clearTimeout(t));
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max >= 0.5) show();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }
    return () => cleanups.forEach((c) => c());
  }, [hiddenRoute, show]);

  // Chat opening (from any CTA) closes us; never both on screen.
  useEffect(() => {
    const onChat = (e: Event) => {
      if ((e as CustomEvent<{ open: boolean }>).detail?.open) setOpen(false);
    };
    const onOpenChat = () => setOpen(false);
    window.addEventListener(CHAT_STATE_EVENT, onChat);
    window.addEventListener(OPEN_RANDY_CHAT_EVENT, onOpenChat);
    return () => {
      window.removeEventListener(CHAT_STATE_EVENT, onChat);
      window.removeEventListener(OPEN_RANDY_CHAT_EVENT, onOpenChat);
    };
  }, []);

  // Focus into the card, Esc closes, Tab stays inside (focus trap).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => (state === "done" ? cardRef.current : emailRef.current)?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const items = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([tabindex="-1"]):not([disabled])'),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !cardRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !cardRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      setState("error");
      setError("Please enter a valid work email.");
      emailRef.current?.focus();
      return;
    }
    setState("sending");
    setError("");
    try {
      const body = withFormGuards(
        {
          email: v,
          ...(company.trim() ? { company: company.trim().slice(0, 200) } : {}),
          pagePath: /^\/[A-Za-z0-9._~/?=&%-]{0,199}$/.test(window.location.pathname) ? window.location.pathname : "/",
        },
        honeypotRef,
      );
      const res = await fetch("/api/launch/email-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(res.status === 429 && data.error ? data.error : "Something went wrong. Please try again.");
      }
      markSeen();
      track("email_capture", { source: "linger" });
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (hiddenRoute) return null;

  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : desktop
      ? {
          initial: { opacity: 0, y: 24, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 16, scale: 0.98 },
          transition: { type: "spring" as const, stiffness: 320, damping: 30 },
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
          transition: { type: "spring" as const, stiffness: 300, damping: 34 },
        };

  return (
    <AnimatePresence>
      {open && (
        <>
          {!desktop && (
            <motion.div
              key="linger-scrim"
              className="fixed inset-0 z-[55] bg-slate-950/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-hidden="true"
              data-testid="linger-scrim"
            />
          )}
          <motion.div
            key="linger-card"
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            {...motionProps}
            className={
              desktop
                ? "fixed bottom-6 right-6 z-[56] w-[380px] overflow-hidden rounded-3xl border border-black/5 bg-white/95 text-slate-900 shadow-[0_24px_60px_-18px_rgba(7,26,57,0.45)] backdrop-blur-xl focus:outline-none"
                : "fixed inset-x-0 bottom-0 z-[56] max-h-[85dvh] overflow-y-auto rounded-t-[28px] border-t border-black/5 bg-white text-slate-900 shadow-[0_-18px_50px_-20px_rgba(7,26,57,0.45)] focus:outline-none"
            }
            style={desktop ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
            data-testid="linger-capture"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent/70 to-transparent" aria-hidden />
            {!desktop && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              data-testid="linger-close"
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className={desktop ? "p-6 pt-7" : "px-5 pb-6 pt-4"}>
              {state === "done" ? (
                <div className="flex flex-col items-start gap-3 py-2" role="status">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-5" aria-hidden />
                  </span>
                  <h2 id={titleId} className="font-display text-2xl leading-tight">
                    Your media kit is ready.
                  </h2>
                  <p id={descId} className="text-[14px] leading-relaxed text-slate-600">
                    Thanks. We&apos;ll also send a short note when seats open or fill.
                  </p>
                  <a
                    href={kitHref}
                    {...(kitHref === MEDIA_KIT_PDF ? { download: "birch-reserve-media-kit.pdf" } : {})}
                    onClick={() => track("media_kit_download", { via: kitHref === MEDIA_KIT_PDF ? "pdf" : "kit_page" })}
                    className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    data-testid="linger-download"
                  >
                    <Download className="size-4" aria-hidden />
                    Download media kit (PDF)
                  </a>
                  <a
                    href={MEDIA_KIT_PAGE}
                    className="self-center text-[14px] font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                    data-testid="linger-kit-link"
                  >
                    View the media kit online
                  </a>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Free download</p>
                  <h2 id={titleId} className="mt-2 pr-8 font-display text-[26px] leading-[1.1] tracking-tight">
                    Get the media kit.
                  </h2>
                  <p id={descId} className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    Placements, formats and how category seats work inside the recovery hubs, in one PDF. Holds start at
                    $190; a full seat is $490.
                  </p>
                  <form onSubmit={submit} className="relative mt-4 flex flex-col gap-2.5" noValidate data-testid="linger-form">
                    <HoneypotField inputRef={honeypotRef} idSuffix="linger" />
                    <label className="sr-only" htmlFor="linger-email">
                      Work email (required)
                    </label>
                    <input
                      ref={emailRef}
                      id="linger-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="Work email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state === "error") setState("idle");
                      }}
                      aria-invalid={state === "error" || undefined}
                      aria-describedby={state === "error" ? "linger-error" : undefined}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
                      data-testid="linger-email"
                    />
                    <label className="sr-only" htmlFor="linger-company">
                      Company (optional)
                    </label>
                    <input
                      id="linger-company"
                      type="text"
                      autoComplete="organization"
                      maxLength={200}
                      placeholder="Company (optional)"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
                      data-testid="linger-company"
                    />
                    {state === "error" && error && (
                      <p id="linger-error" role="alert" className="text-[13px] text-red-600">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={state === "sending"}
                      className="group mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      data-testid="linger-submit"
                    >
                      {state === "sending" ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <>
                          Get the media kit
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                        </>
                      )}
                    </button>
                    <p className="text-[12px] leading-snug text-slate-500">
                      Plus occasional seat updates. Unsubscribe anytime.{" "}
                      <a href="/privacy" className="underline underline-offset-2 hover:text-slate-900">
                        Privacy
                      </a>
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
