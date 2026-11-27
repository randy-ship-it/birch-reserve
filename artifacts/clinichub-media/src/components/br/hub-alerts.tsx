/**
 * "Get hub launch alerts" (Randy t422u, Nov 21 2026): email + categories (+ optional brand) so people hear when hubs launch
 * in the categories they care about. Posts to /api/launch/email-capture with source hub_alerts (validated server-side,
 * honeypot, same per-IP limiter as the brochure capture). Never says a hub is open. No PII in URLs.
 *   <HubAlerts />          full card (media kit, next to the inventory block)
 *   <HubAlerts compact />  one tight row (home, reel)
 */
import { useId, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { HoneypotField, withFormGuards } from "@/lib/form-guards";
import { track } from "@/lib/analytics";
import { trackIntake } from "@/lib/intakeTrack";
import { HUB_ALERT_CATEGORIES } from "../../../../api-server/src/lib/overhaul/hubAlerts";
import { skinText } from "@/lib/siteSkin";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const inputCls = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none";

function streetTeamTag(): string | undefined {
  try {
    const kept = window.localStorage.getItem("birch_st");
    return kept && /^[A-Za-z0-9_-]{1,40}$/.test(kept) ? kept : undefined;
  } catch {
    return undefined;
  }
}

export function HubAlerts({ compact = false, where = "media_kit", pagePath = "/media-kit", dark = false }: { compact?: boolean; where?: string; pagePath?: string; dark?: boolean }) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const hp = useRef<HTMLInputElement>(null);

  const toggle = (c: string) => {
    setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
    if (state === "error") setState("idle");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) { setState("error"); setError("Please enter a valid email."); return; }
    if (!cats.length) { setState("error"); setError("Pick at least one category."); return; }
    setState("sending");
    setError("");
    try {
      const st = streetTeamTag();
      const body = withFormGuards(
        { email: v, ...(company.trim() ? { company: company.trim().slice(0, 200) } : {}), categories: HUB_ALERT_CATEGORIES.filter((c) => cats.includes(c)), pagePath, source: "hub_alerts", ...(st ? { st } : {}) },
        hp,
      );
      const res = await fetch("/api/launch/email-capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error && (res.status === 429 || res.status === 400) ? data.error : "Something went wrong. Please try again.");
      }
      track("email_capture", { source: "hub_alerts", where });
      trackIntake("advertiser", "submit", "hub_alerts");
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const shell = dark ? "bg-white/[0.06] text-white ring-1 ring-white/15" : "bg-white text-slate-900 ring-1 ring-foreground/10 shadow-sm";
  const sub = dark ? "text-white/70" : "text-foreground/70";

  if (state === "done") {
    return (
      <div id={compact ? undefined : "hub-alerts"} className={`rounded-2xl p-4 ${shell}`} role="status" data-testid={`hub-alerts-done-${where}`}>
        <p className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="size-4" aria-hidden /></span> You're on the list.</p>
        <p className={`mt-1 text-sm ${sub}`}>We'll email you when clinic layers launch in {cats.length === 1 ? "that category" : "those categories"}. No spam.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`relative rounded-2xl ${compact ? "p-3.5" : "p-4 md:p-5"} ${shell}`} id={compact ? undefined : "hub-alerts"} data-testid={`hub-alerts-${where}`} aria-labelledby={`${uid}-h`}>
      <HoneypotField inputRef={hp} idSuffix={`hub-alerts-${where}`} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={`${uid}-h`} className={`font-display leading-tight ${compact ? "text-lg" : "text-xl md:text-2xl"}`}>Get clinic layer launch alerts</h3>
        <p className={`text-[12.5px] ${sub}`}>Hear when clinic layers launch in the categories your audience cares about.</p>
      </div>
      <fieldset className="mt-2.5">
        <legend className="sr-only">Categories</legend>
        <div className="flex flex-wrap gap-1.5" data-testid={`hub-alerts-cats-${where}`}>
          {HUB_ALERT_CATEGORIES.map((c) => {
            const on = cats.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)} className={`min-h-10 rounded-full border px-3 text-[13px] font-semibold transition-colors ${on ? "border-[#0b1f3a] bg-[#0b1f3a] text-white" : dark ? "border-white/30 text-white/85 hover:bg-white/10" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}>
                {on ? "✓ " : ""}{c}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className={`mt-2.5 grid gap-2 ${compact ? "sm:grid-cols-[1.3fr_1fr_auto]" : "sm:grid-cols-[1.3fr_1fr_auto]"}`}>
        <div>
          <label className="sr-only" htmlFor={`${uid}-e`}>Email (required)</label>
          <input id={`${uid}-e`} type="email" inputMode="email" autoComplete="email" required maxLength={254} placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }} aria-invalid={state === "error" || undefined} className={inputCls} data-testid={`hub-alerts-email-${where}`} />
        </div>
        <div>
          <label className="sr-only" htmlFor={`${uid}-c`}>Brand or company (optional)</label>
          <input id={`${uid}-c`} type="text" autoComplete="organization" maxLength={200} placeholder="Brand or company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} data-testid={`hub-alerts-company-${where}`} />
        </div>
        <button type="submit" disabled={state === "sending"} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60" data-testid={`hub-alerts-submit-${where}`}>
          {state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <>Alert me <ArrowRight className="size-4" aria-hidden /></>}
        </button>
      </div>
      {state === "error" && error && <p role="alert" className="mt-1.5 text-[13px] text-red-500">{error}</p>}
      <p className={`mt-2 text-[12px] leading-snug ${dark ? "text-white/60" : "text-slate-500"}`}>
        {skinText("By submitting, you agree we may email you about Birch Reserve clinic layer launches. No spam.")} <a href="/privacy" className="underline underline-offset-2">Privacy</a>
      </p>
    </form>
  );
}
