/**
 * The short initial form at the top of /intake (Randy, Nov 18 2026 10:23 PM ET). Three fields. Every submission
 * creates a lead in Friday CRM: create (brand-intake-v1 POST) then submit, via Birch's server routes, which add
 * the intake secret server-side. Nothing is booked, charged or auto-accepted.
 */
import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Loader2, ShieldAlert } from "lucide-react";
import type { IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { HELD_COPY, fridayIntake, reportPath, saveRef, type IntakeRef } from "@/lib/fridayBrandIntake";
import { basePayload } from "@/components/br/intake-kit";

const ROLE_CHIPS: Array<{ key: IntakeRole; label: string; sub: string }> = [
  { key: "kit", label: "Brand", sub: "Get my kit" },
  { key: "publisher", label: "Publisher", sub: "I run a hub" },
  { key: "supplier", label: "Supplier", sub: "Performance brand" },
  { key: "sponsor", label: "Sponsor", sub: "Own a category or area" },
];
const input = "h-12 w-full rounded-xl border border-foreground/20 bg-white px-3 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-accent";
const ERR: Record<string, string> = { too_fast: "One sec: give it a moment and try again.", email: "Use a valid work email.", website: "Add your brand's website.", individual_data: "Please keep it to brand-level details.", rate_limited: "Too many tries. Please wait a minute." };

export function IntakeShortForm() {
  const [roles, setRoles] = useState<IntakeRole[]>(["kit"]);
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: IntakeRef; held: boolean } | null>(null);
  const t0 = useRef(Date.now());
  const toggle = (k: IntakeRole) => setRoles((r) => (r.includes(k) ? (r.length > 1 ? r.filter((x) => x !== k) : r) : [...r, k]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hp) return setDone({ ref: { id: "", editToken: "", reportToken: "", version: 0 }, held: false }); // honeypot: send nothing
    setBusy(true);
    try {
      const api = fridayIntake();
      const payload = { ...basePayload(roles[0]!), roles };
      const ref = await api.create(payload); // brand-intake-v1 POST → draft lead in Friday
      if (ref.legacy) {
        setDone({ ref, held: false });
        return;
      }
      const sub = await api.submit(ref, payload, { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current }); // → submitted lead, Randy emailed by Friday
      const next = { ...ref, version: sub.version };
      saveRef(roles[0]!, next);
      setDone({ ref: next, held: sub.public_mirror === "held" });
    } catch (x) {
      setErr(ERR[(x as Error).message] ?? "Couldn't reach Friday. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div data-testid="intake-short-done" className="rounded-3xl border border-foreground/10 bg-white p-6 shadow-xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-lime-200 px-3 py-1 text-xs font-bold uppercase tracking-wider"><Check className="size-3.5" />Received · pending review</p>
        <h2 className="mt-3 font-display text-3xl">Thanks. A person at Birch Reserve reviews every request.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nothing is booked, charged or accepted automatically.</p>
        {done.held ? <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="intake-held"><ShieldAlert className="size-4 shrink-0" />{HELD_COPY}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          {!done.held && done.ref.reportToken && !done.ref.legacy ? <Link href={reportPath(done.ref.reportToken)} className="underline" data-testid="intake-report-link">Open your report</Link> : null}
          <a href="/brand-kit#my-kit" className="underline">Add four numbers for your full kit</a>
          {roles.includes("publisher") ? <a href="/intake/publisher" className="underline">Publisher payouts</a> : null}
          {roles.includes("supplier") ? <a href="/intake/supplier" className="underline">Supplier first look</a> : null}
          {roles.includes("sponsor") ? <a href="/intake/sponsor" className="underline">Sponsor locks</a> : null}
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} data-testid="intake-short-form" className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      <fieldset>
        <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">I'm here as</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="intake-roles">
          {ROLE_CHIPS.map((r) => {
            const on = roles.includes(r.key);
            return (
              <button key={r.key} type="button" aria-pressed={on} onClick={() => toggle(r.key)} data-testid={`intake-role-${r.label.toLowerCase()}`} className={`rounded-2xl px-3 py-2.5 text-left transition ${on ? "bg-[#0b1f3a] text-white shadow" : "bg-foreground/[0.05] hover:bg-foreground/[0.09]"}`}>
                <span className="block text-sm font-bold">{r.label}</span>
                <span className={`block text-[11px] ${on ? "text-lime-200" : "text-foreground/60"}`}>{r.sub}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input data-testid="intake-website" aria-label="Brand website" required value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" autoComplete="url" className={input} />
        <input data-testid="intake-email" aria-label="Work email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbrand.com" autoComplete="email" className={input} />
        <button type="submit" disabled={busy} data-testid="intake-submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-bold text-accent-foreground shadow-lg shadow-lime-500/20 transition hover:bg-foreground hover:text-background">
          {busy ? <Loader2 className="size-5 animate-spin" /> : null} Get my kit <ArrowRight className="size-5" />
        </button>
      </div>
      <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {err ? <p className="mt-2 text-sm font-semibold text-red-700" data-testid="intake-error">{err}</p> : null}
      <p className="mt-3 text-[11px] text-muted-foreground">Brand-level only, no customer data. Your kit is an estimate, reviewed by a person. Nothing is booked or charged.</p>
    </form>
  );
}
