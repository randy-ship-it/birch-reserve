/** Shared bits for the Birch brand intake (preview). Mobile-first; fine print lives in popovers. */
import { CHANNEL_GEO, type Eligibility, type Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { EligChip, eligibilityOf } from "@/components/br/intake-geo";
import { CtaBand, LeadGatesStatus, PrimaryCta, sideOf } from "@/components/br/intake-sell";
import { errorDetail, fieldStart, trackIntake } from "@/lib/intakeTrack";
import { reviewGates, type LeadGates } from "@/lib/fridayBrandIntake";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { Info, Store, Megaphone, Target, Check, CloudUpload, FlaskConical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHANNEL_TILES, CHANNEL_TILES_FINE, CHANNEL_TILES_LABEL, INTAKE_TERMS_VERSION, type IntakePayload, type IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { loadPrefill } from "@/lib/intakePrefill";
import { adapterMode, onAdapterModeChange, fridayIntake, loadRef, saveRef, type IntakeRef } from "@/lib/fridayBrandIntake";

export function EstimateTag({ children = "Estimate" }: { children?: ReactNode }) {
  return (
    <span data-testid="estimate-tag" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-amber-300">
      {children}
    </span>
  );
}

export function InfoPop({ label, title, children, testId, dark = false }: { label?: string; title: string; children: ReactNode; testId?: string; dark?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger
        data-testid={testId}
        className={`inline-flex items-center gap-1 text-xs font-semibold underline decoration-dotted underline-offset-4 ${dark ? "text-background/80 hover:text-background" : "text-foreground/70 hover:text-foreground"}`}
        aria-label={label ?? title}
      >
        <Info className="size-3.5" aria-hidden /> {label ?? "Details"}
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,22rem)] rounded-xl border border-foreground/10 bg-white p-4 text-sm leading-relaxed shadow-2xl" data-testid={testId ? `${testId}-content` : undefined}>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/60">{title}</p>
        <div className="space-y-2 text-foreground/85">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function CountUp({ value, prefix = "$", className = "" }: { value: number; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const from = last.current;
    last.current = value;
    const node = ref.current;
    if (!node) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      node.textContent = `${prefix}${Math.round(value).toLocaleString("en-US")}`;
      return;
    }
    const c = animate(from, value, { duration: 0.6, ease: "easeOut", onUpdate: (v) => (node.textContent = `${prefix}${Math.round(v).toLocaleString("en-US")}`) });
    return () => c.stop();
  }, [value, prefix]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{`${prefix}${Math.round(value).toLocaleString("en-US")}`}</span>;
}

export function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? "bg-accent ring-2 ring-foreground" : "bg-foreground/15"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, testId }: { value: T; options: Array<{ v: T; l: string; tone?: string }>; onChange: (v: T) => void; testId?: string }) {
  return (
    <div role="radiogroup" data-testid={testId} className="inline-flex rounded-full bg-foreground/[0.06] p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`min-w-14 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${value === o.v ? (o.tone ?? "bg-foreground text-background shadow") : "text-foreground/60 hover:text-foreground"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function MockBanner() {
  const [mode, setMode] = useState<"mock" | "live">(() => adapterMode());
  useEffect(() => onAdapterModeChange(() => setMode(adapterMode())), []);
  if (mode !== "mock") return null;
  return (
    <div data-testid="mock-adapter-banner" className="flex items-center justify-center gap-2 bg-violet-700 px-4 py-1.5 text-center text-xs font-semibold text-white">
      <FlaskConical className="size-3.5" aria-hidden /> Preview · mock data: nothing is sent from this preview; saves stay in this browser.
    </div>
  );
}

/** Two sides (Randy via Emma, 10:44 PM ET): Advertiser = Brand kit · Supplier · Sponsor; Publisher on its own. */
const ROLE_SIDES: Array<{ side: "advertiser" | "publisher"; label: string; roles: Array<{ key: IntakeRole; label: string; href: string; icon: typeof Store }> }> = [
  { side: "advertiser", label: "Supplier", roles: [
    { key: "kit", label: "Monetization Kit", href: "/brand-kit#my-kit", icon: Target },
    { key: "supplier", label: "Performance only", href: "/intake/supplier", icon: Target },
    { key: "sponsor", label: "Accelerate", href: "/intake/sponsor", icon: Megaphone },
  ] },
  { side: "publisher", label: "Hub", roles: [{ key: "publisher", label: "Max exposure", href: "/intake/publisher", icon: Store }] },
];

export function RoleTabs({ active }: { active?: IntakeRole }) {
  const side = active ? sideOf(active) : "advertiser";
  useEffect(() => {
    if (active) trackIntake(side, "view", active === "kit" ? "brand_kit" : active, { dedupe: true });
    else trackIntake(side, "view", "intake", { dedupe: true });
  }, [active, side]);
  return (
    <>
      <nav aria-label="Choose your side" className="sticky top-16 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container mx-auto flex items-center gap-3 overflow-x-auto px-4 py-2">
          {ROLE_SIDES.map((g) => (
            <div key={g.side} data-testid={`role-side-${g.side}`} className={`flex shrink-0 items-center gap-1 rounded-full p-1 ${side === g.side && active ? "bg-foreground/[0.06]" : ""}`}>
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-foreground/55">{g.label}</span>
              {g.roles.map((r) => (
                <a key={r.key} href={r.href} data-testid={`role-tab-${r.key}`} aria-current={active === r.key ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active === r.key ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/5"}`}>
                  <r.icon className="size-4" aria-hidden /> {r.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </nav>
      {active ? <CtaBand side={side} where={active === "kit" ? "brand_kit" : active} /> : null}
    </>
  );
}

/**
 * Autosave: PATCHes an existing Friday record only (one created by a final submit with email). It never creates a
 * record, so nothing reaches Friday before the visitor clicks the final button with an email (Randy, 11:36 PM).
 */
export function useAutosave(role: IntakeRole, payload: IntakePayload, enabled: boolean) {
  const [ref, setRef] = useState<IntakeRef | null>(() => (typeof window === "undefined" ? null : loadRef(role)));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const key = JSON.stringify(payload);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(async () => {
      setState("saving");
      try {
        const api = fridayIntake();
        if (!ref) return setState("idle"); // inputs stay on this device until the final submit
        const next = await api.update(ref, payload).catch(() => ref); // never re-create a draft on a failed autosave
        saveRef(role, next);
        setRef(next);
        setState("saved");
      } catch {
        setState("error");
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { ref, state, setRef };
}

export function SaveChip({ state, version }: { state: "idle" | "saving" | "saved" | "error"; version?: number }) {
  const txt = state === "saving" ? "Saving…" : state === "saved" ? `Saved · v${version ?? 1}` : state === "error" ? "Not saved yet" : "Autosaves as you go";
  return (
    <span data-testid="save-chip" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${state === "error" ? "bg-red-50 text-red-800" : "bg-foreground/[0.06] text-foreground/70"}`}>
      {state === "saved" ? <Check className="size-3.5" aria-hidden /> : <CloudUpload className="size-3.5" aria-hidden />} {txt}
    </span>
  );
}

export const basePayload = (role: IntakeRole): IntakePayload => ({ schema: "birch-brand-intake/v1-draft", role, site: "birchreserve.net", terms_version: INTAKE_TERMS_VERSION });

/* ---------------------------------- channel tiles ---------------------------------- */

const TILE_ART: Record<string, ReactNode> = {
  "scale-hubs": (
    <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g-hub" cx="70%" cy="30%" r="80%"><stop offset="0" stopColor="#d9f99d" stopOpacity=".9" /><stop offset="1" stopColor="#0b1f3a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="200" height="120" fill="url(#g-hub)" />
      {[...Array(18)].map((_, i) => (
        <circle key={i} cx={20 + ((i * 37) % 170)} cy={15 + ((i * 53) % 95)} r={2 + (i % 4)} fill="#d9f99d" opacity={0.35 + (i % 3) * 0.2} />
      ))}
      {[...Array(10)].map((_, i) => (
        <line key={`l${i}`} x1={20 + ((i * 37) % 170)} y1={15 + ((i * 53) % 95)} x2={20 + (((i + 3) * 37) % 170)} y2={15 + (((i + 3) * 53) % 95)} stroke="#d9f99d" strokeOpacity=".25" />
      ))}
    </svg>
  ),
  "calm-joints": (
    <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g-cj" x1="0" x2="1"><stop offset="0" stopColor="#99f6e4" /><stop offset="1" stopColor="#0b1f3a" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M0 ${70 + i * 8} C 50 ${40 + i * 8}, 120 ${100 + i * 6}, 200 ${55 + i * 9}`} stroke="url(#g-cj)" strokeWidth="2" fill="none" opacity={0.8 - i * 0.12} />
      ))}
    </svg>
  ),
  "retail-network": (
    <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      {[...Array(40)].map((_, i) => (
        <rect key={i} x={10 + (i % 10) * 19} y={20 + Math.floor(i / 10) * 22} width="12" height="12" rx="2" fill="#fde68a" opacity={((i * 7) % 10) / 12 + 0.12} />
      ))}
    </svg>
  ),
};

export function ChannelTiles({ market, fridayGeo }: { market?: Market | null; fridayGeo?: Array<{ key: string; eligibility: Eligibility; label?: string }> } = {}) {
  const geoOf = (k: string) => CHANNEL_GEO.find((g) => g.key === k);
  const rows = CHANNEL_TILES.map((t) => ({ t, g: geoOf(t.key), el: geoOf(t.key) ? eligibilityOf(geoOf(t.key)!.key, market, fridayGeo).e : ("now" as Eligibility) }));
  const shown = rows.filter((r) => r.el !== "not_available");
  const hidden = rows.filter((r) => r.el === "not_available");
  return (
    <section data-testid="channel-tiles" className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Grow your reach with Scale</p>
          <h2 className="font-display text-3xl md:text-4xl">{hidden.length ? "Channels in your markets" : "Four channels, one intake"}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-900 ring-1 ring-sky-300" data-testid="network-figures-label">{CHANNEL_TILES_LABEL}</span>
          <InfoPop title={CHANNEL_TILES_LABEL} testId="tiles-fine">
            <p>{CHANNEL_TILES_FINE}</p>
          </InfoPop>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map(({ t, g, el }) => (
          <article key={t.key} data-testid={`channel-tile-${t.key}`} data-eligibility={el} className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-2xl bg-[#0b1f3a] p-5 text-white shadow-lg">
            {"image" in t && t.image ? (
              <img src={t.image} alt="Street team route areas shown as an area-level heat map. No homes or addresses." className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" loading="lazy" />
            ) : (
              <div className="absolute inset-0 -z-10">{TILE_ART[t.key]}</div>
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1f3a] via-[#0b1f3a]/70 to-transparent" />
            {g ? <div className="mb-2"><EligChip e={el} geo={g.label} /></div> : null}
            <h3 className="font-display text-2xl">{t.name}</h3>
            {t.stats.length ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {t.stats.map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd className="font-display text-2xl leading-none text-lime-200">{s.v}</dd>
                    <dd className="mt-0.5 text-[11px] leading-tight text-white/75">{s.l}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-white/80">{t.line}</p>
            {"imageNote" in t && t.imageNote ? <p className="mt-1 text-[10px] text-white/60">{t.imageNote}</p> : null}
          </article>
        ))}
      </div>
      {hidden.length ? <p className="mt-3 text-xs text-muted-foreground" data-testid="channel-tiles-hidden-note">{hidden.map((h) => `${h.t.name} (${h.g?.label ?? ""})`).join(", ")}: not in your markets yet, so not shown.</p> : null}
    </section>
  );
}

/** Contact + submit bar for a role view: submits the autosaved draft to Friday (lead → submitted, pending review). */
export function ContactSubmit({ role, payload, draft, setRef, label }: { role: IntakeRole; payload: IntakePayload; draft: IntakeRef | null; setRef: (r: IntakeRef) => void; label: string }) {
  const pre = typeof window === "undefined" ? null : loadPrefill();
  const [email, setEmail] = useState(pre?.email ?? "");
  const [website, setWebsite] = useState(pre?.website ?? "");
  const isUpdate = !!draft && draft.version >= 1; // expanded mode after a fast submit: PATCH the same record
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [gates, setGates] = useState<LeadGates | null>(null);
  const t0 = useRef(Date.now());
  const side = sideOf(role);
  async function go() {
    setErr(null);
    if (hp) return setState("done");
    trackIntake(side, "step_complete", "contact");
    setState("busy");
    try {
      const api = fridayIntake();
      const r = draft ?? (await api.create(payload));
      const res = await api.submit(r, payload, { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current });
      const next = { ...r, version: res.version };
      saveRef(role, next);
      setRef(next);
      setGates(reviewGates(res, res.mock));
      trackIntake(side, "submit", isUpdate ? "update" : role === "kit" ? "kit" : role);
      trackIntake(side, "mode", "expanded");
      setState("done");
    } catch (e) {
      const c = (e as Error).message;
      trackIntake(side, "submit_error", errorDetail(c));
      setErr(c === "email" ? "Add a valid work email." : c === "website" ? "Add your website." : c === "too_fast" ? "One moment, then try again." : "Couldn't send that. Nothing was sent.");
      setState("error");
    }
  }
  return (
    <div id={`${role}-contact-submit`} data-testid={`${role}-contact-submit`} className="scroll-mt-32 rounded-2xl border border-foreground/15 bg-white p-4">
      {state === "done" ? (
        <div>
          <p data-testid={`${role}-pending-review`} className="text-sm">Received as <strong>pending approval</strong>. A person at Birch Reserve reviews every request; nothing is accepted automatically and nothing is booked or charged.</p>
          <LeadGatesStatus gates={gates} testId={`${role}-lead-gates`} />
          {side === "advertiser" ? <div className="mt-4"><PrimaryCta side="advertiser" where="done" /></div> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input data-testid={`${role}-website`} onFocus={fieldStart(side, "website")} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" aria-label="Website" className="h-11 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
            <input data-testid={`${role}-email`} onFocus={fieldStart(side, "email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" aria-label="Work email" className="h-11 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
            <button type="button" data-testid={`${role}-submit`} onClick={go} disabled={state === "busy"} className="h-11 rounded-full bg-foreground px-5 text-sm font-bold text-background">{isUpdate ? "Update my numbers" : label}</button>
          </div>
          <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          {err ? <p className="mt-2 text-sm font-semibold text-red-700">{err}</p> : null}
          <p className="mt-2 text-[11px] text-muted-foreground">Interest only, subject to approval. Used only to review your request; never shown on any page. No checkout.</p>
        </>
      )}
    </div>
  );
}
