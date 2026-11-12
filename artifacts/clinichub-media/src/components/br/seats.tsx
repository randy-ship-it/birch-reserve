/**
 * Category seats (Randy, Nov 12 2026): availability strip, category cards with
 * one-click Hold ($190) / Lock ($490) / Waitlist, impression blocks, lock-request
 * form, founder snippet, proof + network, contact CTAs. Every submit posts to
 * /v1/seats/request -> Friday intake + instant email alert to Randy and sales.
 */
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Phone, Mail, X } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import {
  BLOCK_NOTE,
  CONTACT,
  FACE_BEFORE_FLIGHT,
  FOUNDER,
  HELD_MESSAGE,
  IMPRESSION_BLOCKS,
  LIVE_HUB_EXAMPLES,
  NETWORK,
  SEAT_CATEGORIES,
  SEAT_SKUS,
} from "../../../../api-server/src/lib/seats/catalog";
import { Field, inputClass, postJson, textareaClass } from "./ui";

type Status = "open" | "held" | "locked" | "unknown";
export type SeatsData = {
  source: "friday" | "ledger" | "none";
  as_of: string | null;
  total: number;
  open: number | null;
  categories: { slug: string; label: string; status: Status }[];
  note: string;
  checkout?: "open" | "held";
};

const FALLBACK: SeatsData = {
  source: "none",
  as_of: null,
  total: SEAT_CATEGORIES.length,
  open: null,
  categories: SEAT_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, status: "unknown" as Status })),
  note: `Live availability is being confirmed. Call ${CONTACT.phoneDisplay} and we'll confirm your category today.`,
};

let shared: Promise<SeatsData> | null = null;
export function useSeats(): { data: SeatsData; loaded: boolean } {
  const [data, setData] = useState<SeatsData>(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    shared ??= fetch("/v1/seats/availability.json")
      .then((r) => (r.ok ? (r.json() as Promise<SeatsData>) : FALLBACK))
      .catch(() => FALLBACK);
    let live = true;
    void shared.then((d) => {
      if (live) {
        setData(d && Array.isArray(d.categories) && d.categories.length === SEAT_CATEGORIES.length ? d : FALLBACK);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return { data, loaded };
}

function money(usd: number, cad: number, currency: "usd" | "cad") {
  return currency === "cad" ? `$${cad.toLocaleString("en-US")} CAD` : `$${usd.toLocaleString("en-US")} USD`;
}

type Req = { action: "hold" | "lock" | "waitlist" | "block_request"; category?: string; block?: string; title: string; sub: string };

/* ---------- Request sheet (shared by every one-click button) ---------- */
const SheetCtx: { open: ((r: Req) => void) | null } = { open: null };

function saved(): { brand?: string; email?: string; phone?: string } {
  try {
    return JSON.parse(localStorage.getItem("br_buyer") ?? "{}") as { brand?: string; email?: string; phone?: string };
  } catch {
    return {};
  }
}

function isTest(): boolean {
  return typeof window !== "undefined" && /[?&]seats_test=1/.test(window.location.search);
}

export function SeatRequestSheet() {
  const [req, setReq] = useState<Req | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { currency } = useCurrency();
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    SheetCtx.open = (r) => {
      setReq(r);
      setMsg("");
      setDone(false);
    };
    return () => {
      SheetCtx.open = null;
    };
  }, []);
  useEffect(() => {
    if (!req || !formRef.current) return;
    const s = saved();
    const f = formRef.current;
    (f.elements.namedItem("brand") as HTMLInputElement).value = s.brand ?? "";
    (f.elements.namedItem("email") as HTMLInputElement).value = s.email ?? "";
    (f.elements.namedItem("phone") as HTMLInputElement).value = s.phone ?? "";
  }, [req]);
  if (!req) return null;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { action: req.action, category: req.category, block: req.block, brand: String(fd.get("brand") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""), company_url: String(fd.get("company_url") ?? ""), currency, ...(isTest() ? { test: true } : {}) };
    setBusy(true);
    setMsg("Sending…");
    const r = await postJson<{ message?: string; error?: string; checkout_url?: string }>("/v1/seats/request", body);
    setBusy(false);
    if (r.data.checkout_url) {
      window.location.assign(r.data.checkout_url);
      return;
    }
    setMsg(r.ok ? (r.data.message ?? HELD_MESSAGE) : (r.data.error ?? `Could not send. Call ${CONTACT.phoneDisplay}.`));
    if (r.ok) {
      setDone(true);
      try {
        localStorage.setItem("br_buyer", JSON.stringify({ brand: body.brand, email: body.email, phone: body.phone }));
      } catch {
        /* ignore */
      }
    }
  };
  const btn = req.action === "waitlist" ? "Join the waitlist" : req.action === "block_request" ? "Request block" : req.action === "hold" ? "Confirm hold" : "Confirm lock";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="seat-sheet-title" onClick={() => setReq(null)} data-testid="seat-sheet">
      <div className="relative w-full max-w-md border border-foreground bg-background p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setReq(null)} className="absolute right-3 top-3 p-2" aria-label="Close">
          <X className="size-5" />
        </button>
        <h3 id="seat-sheet-title" className="pr-8 font-display text-2xl">{req.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{req.sub}</p>
        <form ref={formRef} onSubmit={submit} className="mt-5 grid gap-3">
          <Field label="Brand or business">
            <input name="brand" required maxLength={160} autoComplete="organization" className={inputClass} />
          </Field>
          <Field label="Work email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </Field>
          <Field label="Phone (optional, fastest)">
            <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} />
          </Field>
          <input name="company_url" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" />
          {!done ? (
            <button type="submit" disabled={busy} className="h-12 bg-accent font-semibold text-accent-foreground transition hover:bg-foreground hover:text-background disabled:opacity-60" data-testid="seat-sheet-submit">
              {btn}
            </button>
          ) : null}
          <p role="status" className="min-h-6 text-sm font-semibold" data-testid="seat-sheet-msg">{msg}</p>
          <p className="text-xs text-muted-foreground">
            No charge today while checkout is being switched on. {HELD_MESSAGE} Prefer to talk? <a className="underline" href={CONTACT.tel}>{CONTACT.phoneDisplay}</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function openSheet(r: Req) {
  SheetCtx.open?.(r);
}

/* ---------- Availability strip ---------- */
export function AvailabilityStrip({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { data } = useSeats();
  const dark = tone === "dark";
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 border p-4 ${dark ? "border-background/25 bg-background/5 text-background" : "border-foreground/15 bg-white"}`} data-testid="availability-strip" data-source={data.source} data-open={data.open ?? ""}>
      <p className="text-base">
        {data.open === null ? (
          <>
            <b className="font-display text-2xl">Call to confirm</b> which of {data.total} categories are open today
          </>
        ) : (
          <>
            <b className="font-display text-3xl" data-testid="seats-open-count">
              {data.open} of {data.total}
            </b>{" "}
            categories open
          </>
        )}
      </p>
      <span className="flex gap-1" aria-hidden>
        {data.categories.map((c) => (
          <span key={c.slug} title={`${c.label}: ${c.status}`} className={`size-3.5 border ${dark ? "border-accent" : "border-foreground"} ${c.status === "open" ? (dark ? "bg-accent" : "bg-accent") : c.status === "unknown" ? "border-dashed opacity-60" : dark ? "bg-background/60" : "bg-foreground"}`} />
        ))}
      </span>
      <a href="#seats" className="text-sm font-semibold underline underline-offset-4">Hold or lock yours</a>
      <a href={CONTACT.tel} className="text-sm font-semibold underline underline-offset-4">{CONTACT.phoneDisplay}</a>
      <p className={`w-full text-xs ${dark ? "text-background/65" : "text-muted-foreground"}`}>{data.note} One brand per category; we confirm every hold.</p>
    </div>
  );
}

/* ---------- Category cards ---------- */
export function CategoryCards() {
  const { data } = useSeats();
  const { currency } = useCurrency();
  const hold = SEAT_SKUS[0];
  const lock = SEAT_SKUS[1];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="seat-cards">
      {data.categories.map((c) => {
        const taken = c.status === "held" || c.status === "locked";
        const label = c.status === "open" ? "Open" : c.status === "held" ? "On hold" : c.status === "locked" ? "Locked" : "Call to confirm";
        return (
          <article key={c.slug} className="flex flex-col gap-3 border border-foreground/20 bg-white p-4" data-testid={`seat-card-${c.slug}`} data-status={c.status}>
            <span className={`w-fit px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.status === "open" ? "bg-accent text-accent-foreground" : taken ? "bg-foreground text-background" : "border border-dashed border-foreground/50"}`}>{label}</span>
            <h3 className="font-display text-xl leading-tight">{c.label}</h3>
            {taken ? (
              <button type="button" onClick={() => openSheet({ action: "waitlist", category: c.slug, title: "Join the waitlist", sub: c.label })} className="mt-auto h-12 bg-foreground text-sm font-semibold text-background hover:bg-accent hover:text-accent-foreground" data-testid={`waitlist-${c.slug}`}>
                Join the waitlist
              </button>
            ) : (
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openSheet({ action: "hold", category: c.slug, title: `Hold for 7 days · ${money(hold.usd, hold.cad, currency)}`, sub: `${c.label}. ${hold.line}` })} className="min-h-12 border border-foreground/30 px-2 text-sm font-semibold hover:border-foreground" data-testid={`hold-${c.slug}`}>
                  Hold 7 days
                  <span className="block text-xs font-normal">{money(hold.usd, hold.cad, currency)}</span>
                </button>
                <button type="button" onClick={() => openSheet({ action: "lock", category: c.slug, title: `Lock the seat · ${money(lock.usd, lock.cad, currency)}`, sub: `${c.label}. ${lock.line}` })} className="min-h-12 bg-accent px-2 text-sm font-semibold text-accent-foreground hover:bg-foreground hover:text-background" data-testid={`lock-${c.slug}`}>
                  Lock seat
                  <span className="block text-xs font-normal">{money(lock.usd, lock.cad, currency)}</span>
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ---------- Impression blocks ---------- */
export function ImpressionBlocks() {
  const { currency } = useCurrency();
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="impression-blocks">
        {IMPRESSION_BLOCKS.map((b) => (
          <article key={b.key} className="flex flex-col border border-foreground/15 bg-white p-4" data-testid={`block-${b.key}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">{b.surfaceLabel}</p>
            <h3 className="mt-1 font-display text-lg leading-tight">
              {b.name} · {b.views.toLocaleString("en-US")} views
            </h3>
            <span className="mt-1 w-fit border border-dashed border-foreground/40 px-1.5 text-[10px] font-semibold uppercase tracking-wider">Estimate</span>
            <p className="mt-3 font-display text-3xl">{money(b.usd, b.cad, currency)}</p>
            <p className="text-xs text-muted-foreground">Starter rate ${b.starterCpmUsd} CPM USD</p>
            <button type="button" onClick={() => openSheet({ action: "block_request", block: b.key, title: "Request this block", sub: `${b.name} · ${b.views.toLocaleString("en-US")} views (estimated) · ${money(b.usd, b.cad, currency)}` })} className="mt-4 h-11 border border-foreground/30 text-sm font-semibold hover:border-foreground hover:bg-foreground hover:text-background" data-testid={`request-${b.key}`}>
              Request this block
            </button>
          </article>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">{BLOCK_NOTE}</p>
    </div>
  );
}

/* ---------- Lock request + waitlist form ---------- */
export function LockRequestForm() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { currency } = useCurrency();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const fd = new FormData(f);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.action = "lock_request";
    body.sku = "reserve-490";
    body.waitlist_if_taken = fd.get("waitlist_if_taken") === "on";
    body.currency = currency;
    if (isTest()) body.test = true;
    setBusy(true);
    setMsg("Sending…");
    const r = await postJson<{ message?: string; error?: string }>("/v1/seats/request", body);
    setBusy(false);
    setMsg(r.ok ? (r.data.message ?? HELD_MESSAGE) : (r.data.error ?? `Could not send. Call ${CONTACT.phoneDisplay}.`));
  };
  const s = typeof window !== "undefined" ? saved() : {};
  return (
    <form onSubmit={submit} className="grid gap-4 border border-foreground bg-white p-5 md:p-7" data-testid="lock-request-form">
      <Field label="Category">
        <select name="category" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Pick your category
          </option>
          {SEAT_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand or business">
          <input name="brand" required maxLength={160} defaultValue={s.brand} autoComplete="organization" className={inputClass} />
        </Field>
        <Field label="Your name">
          <input name="name" maxLength={120} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Work email">
          <input name="email" type="email" required defaultValue={s.email} autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Phone (optional)">
          <input name="phone" type="tel" maxLength={40} defaultValue={s.phone} autoComplete="tel" className={inputClass} />
        </Field>
      </div>
      <Field label="Website (optional)">
        <input name="website" maxLength={300} inputMode="url" className={inputClass} />
      </Field>
      <Field label="When do you want to start?">
        <select name="timing" className={inputClass}>
          <option>This month</option>
          <option>Next 30–60 days</option>
          <option>Next quarter</option>
          <option>Just exploring</option>
        </select>
      </Field>
      <Field label="Anything else (optional)">
        <textarea name="message" maxLength={2000} className={textareaClass} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="waitlist_if_taken" defaultChecked className="mt-1" /> If my category is taken, put me on the waitlist.
      </label>
      <input name="company_url" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" />
      <button type="submit" disabled={busy} className="h-12 bg-accent font-semibold text-accent-foreground transition hover:bg-foreground hover:text-background disabled:opacity-60" data-testid="lock-request-submit">
        Request a category lock
      </button>
      <p role="status" className="min-h-6 text-sm font-semibold" data-testid="lock-request-msg">{msg}</p>
    </form>
  );
}

/* ---------- Contact CTAs ---------- */
export function ContactCtas({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      <a href={CONTACT.tel} className="inline-flex h-12 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-accent-foreground hover:bg-foreground hover:text-background" data-testid="cta-call">
        <Phone className="size-4" aria-hidden /> Call {CONTACT.phoneDisplay}
      </a>
      <a href={CONTACT.mailto} className={`inline-flex h-12 items-center justify-center gap-2 border px-6 text-sm font-semibold ${dark ? "border-background/45 text-background hover:bg-background hover:text-foreground" : "border-foreground/25 hover:bg-foreground hover:text-background"}`} data-testid="cta-email">
        <Mail className="size-4" aria-hidden /> {CONTACT.email}
      </a>
    </div>
  );
}

/* ---------- Founder ---------- */
export function FounderSnippet({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <figure className={`border-l-4 border-accent p-4 ${dark ? "bg-background/5 text-background" : "bg-secondary/50"}`} data-testid="founder-snippet">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${dark ? "text-accent" : "text-foreground/60"}`}>Hear from the Founder</p>
      {FOUNDER.videoUrl ? <video controls preload="none" src={FOUNDER.videoUrl} className="mt-3 w-full" /> : null}
      <blockquote className="mt-2 font-display text-lg leading-snug md:text-xl">&ldquo;{FOUNDER.quote}&rdquo;</blockquote>
      <figcaption className={`mt-2 text-xs ${dark ? "text-background/70" : "text-muted-foreground"}`}>
        {FOUNDER.name}, {FOUNDER.title}. {FOUNDER.videoUrl ? null : FOUNDER.videoStatus}{" "}
        <a href={FOUNDER.pageUrl} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
          Hear Randy on the demand flywheel
        </a>
      </figcaption>
    </figure>
  );
}

/* ---------- Proof + network ---------- */
export function ProofSection() {
  return (
    <div className="grid gap-8" data-testid="proof-section">
      <div className="grid gap-4 md:grid-cols-2">
        {LIVE_HUB_EXAMPLES.map((h) => (
          <figure key={h.name} className="border border-foreground/15 bg-white">
            <img src={h.image} alt={h.name} loading="lazy" className="h-56 w-full object-cover object-top" />
            <figcaption className="p-4 text-sm">
              <span className="font-display text-lg">{h.name}</span> <span className="ml-1 bg-[#1f8a4c] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Live</span>
              <p className="mt-1 text-muted-foreground">{h.note}</p>
              {h.url ? (
                <a href={h.url} target="_blank" rel="noopener" className="mt-2 inline-block font-semibold underline underline-offset-4">
                  Open the hub
                </a>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="border border-foreground/15 bg-white p-5 md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">{FACE_BEFORE_FLIGHT.title}</p>
        <p className="mt-2 text-lg leading-relaxed">{FACE_BEFORE_FLIGHT.line}</p>
        <a href={FACE_BEFORE_FLIGHT.href} className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">
          Read how the preview works
        </a>
      </div>
      <div className="bg-foreground p-6 text-background md:p-8" data-testid="network-section">
        <p className="font-display text-2xl leading-snug md:text-3xl">{NETWORK.line}</p>
        <p className="mt-4 text-sm text-background/75">
          <a href={NETWORK.mapUrl} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
            See the local demand map
          </a>{" "}
          · postal-code map of trusted places and brand vibe estimates. {NETWORK.estimateNote}{" "}
          <a href={NETWORK.clinicHubsUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
            Clinic hubs
          </a>
        </p>
      </div>
    </div>
  );
}

/* ---------- Hero helpers (currency-aware labels) ---------- */
export function useSeatPrices() {
  const { currency } = useCurrency();
  const hold = SEAT_SKUS.find((s) => s.sku === "hold-190")!;
  const lock = SEAT_SKUS.find((s) => s.sku === "reserve-490")!;
  const short = (usd: number, cad: number) => (currency === "cad" ? `C$${cad}` : `$${usd}`);
  return { hold: short(hold.usd, hold.cad), lock: short(lock.usd, lock.cad), holdFull: money(hold.usd, hold.cad, currency), lockFull: money(lock.usd, lock.cad, currency) };
}
