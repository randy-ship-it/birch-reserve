/**
 * "Getting your ads turned on" step (Randy voice, Nov 21 2026 6:02 PM ET). Shown AFTER the first intake submit
 * (supplier/brand/hub), and standalone at /intake/activate for hubs and providers. Not asked at the start.
 *   1. Your inventory estimate: range chips (pages or hub screens, monthly views, email/SMS list) + optional other ad data.
 *   2. Which ads can run on your hubs: three choices, category exclusions, and the review note.
 * Posts to /v1/activation (lead row + /ads/admin + Friday). Never turns an ad on; never changes public inventory figures.
 * Same code serves scalehealth.ca/intake/_m/* via the mirror, so both sites behave identically.
 */
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Details } from "@/components/br/details";
import { FieldError, StepHeader } from "@/components/br/form-steps";
import { postJson } from "@/components/br/ui";
import { skinText } from "@/lib/siteSkin";
import { ACT_EXCLUSIONS, ACT_OPENNESS, ACT_OTHER_MAX, ACT_REVIEW_NOTE, ACT_ROLES, LIST_RANGES, PAGES_RANGES, VIEWS_RANGES, type ActExclusion, type ActRole, type Range } from "../../../../api-server/src/lib/overhaul/adActivation";

const chip = (on: boolean) => `min-h-10 rounded-full px-3.5 py-2 text-xs font-semibold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`;

function RangeChips({ legend, name, ranges, value, onPick }: { legend: string; name: string; ranges: Range[]; value: string; onPick: (k: string) => void }) {
  return (
    <fieldset data-testid={`act-${name}`} className="min-w-0">
      <legend className="text-[12px] font-bold text-foreground/75">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ranges.map((r) => <button key={r.key} type="button" aria-pressed={value === r.key} onClick={() => onPick(r.key)} data-testid={`act-${name}-${r.key}`} className={chip(value === r.key)}>{r.label}</button>)}
      </div>
    </fieldset>
  );
}

export function AdActivation({ role: role0, email: email0 = "", company: company0 = "", hubSlug = "", fridayId = "", standalone = false }: { role?: ActRole; email?: string; company?: string; hubSlug?: string; fridayId?: string; standalone?: boolean }) {
  const [role, setRole] = useState<ActRole | "">(role0 ?? "");
  const [email, setEmail] = useState(email0);
  const [company, setCompany] = useState(company0);
  const [pages, setPages] = useState("");
  const [views, setViews] = useState("");
  const [list, setList] = useState("");
  const [other, setOther] = useState("");
  const [openness, setOpenness] = useState("");
  const [excl, setExcl] = useState<ActExclusion[]>([]);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [hp, setHp] = useState("");
  const noncore = openness === "premium" || openness === "any";
  const needEmail = standalone || !email0;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!role) return setErr("Pick who you are.");
    if (needEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Add the work email you used for intake.");
    if (!pages || !views || !list) return setErr("Pick one range in each row. \"Not sure\" is fine.");
    if (!openness) return setErr("Pick which ads can run on your hubs.");
    if (!ack) return setErr("Tick the box to confirm every ad is reviewed first.");
    setBusy(true);
    const r = await postJson<{ error?: string }>("/v1/activation", { email: email.trim(), company: company.trim(), role, pages, views, list, other: other.trim(), openness, exclusions: noncore ? excl : [], ack, hub_slug: hubSlug, friday_id: fridayId, path: typeof window === "undefined" ? "" : window.location.pathname.replace(/^\/intake\/_m/, ""), company_url: hp }).catch(() => null);
    setBusy(false);
    if (r?.ok) return setDone(true);
    setErr(r?.data?.error ?? "Couldn't send that. Please try again.");
  }

  if (done)
    return (
      <div data-testid="act-done" className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-lime-200 px-3 py-1 text-xs font-bold uppercase tracking-wider"><Check className="size-3.5" />Saved</p>
        <h2 className="mt-3 font-display text-2xl leading-tight md:text-3xl">Thanks. Your estimate and ad choices are on file.</h2>
        <p className="mt-2 text-sm text-foreground/70">{skinText("Birch Reserve")} reviews every ad before it runs. You can change these answers any time by sending them again.</p>
      </div>
    );

  return (
    <form onSubmit={send} data-testid="ad-activation" className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6" noValidate>
      <StepHeader step={2} total={2} title="Getting your ads turned on" hint="Two quick questions. Ranges are fine, and nothing runs without approval." testId="act-steps" />
      <input tabIndex={-1} autoComplete="off" aria-hidden value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="company_url" />
      {(standalone || !role0) ? (
        <fieldset data-testid="act-role" className="mb-4 min-w-0">
          <legend className="text-[12px] font-bold text-foreground/75">Who are you?</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{ACT_ROLES.map((r) => <button key={r.key} type="button" aria-pressed={role === r.key} onClick={() => setRole(r.key)} data-testid={`act-role-${r.key}`} className={chip(role === r.key)}>{r.label}</button>)}</div>
        </fieldset>
      ) : null}
      {needEmail ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <input data-testid="act-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" aria-label="Work email" autoComplete="email" className="h-11 min-w-0 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
          <input data-testid="act-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Brand or hub (optional)" aria-label="Brand or hub name" maxLength={160} className="h-11 min-w-0 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
        </div>
      ) : null}

      <section aria-labelledby="act-h1" data-testid="act-inventory">
        <h3 id="act-h1" className="font-display text-xl leading-tight">Your inventory estimate</h3>
        <div className="mt-3 space-y-3">
          <RangeChips legend="Pages or hub screens" name="pages" ranges={PAGES_RANGES} value={pages} onPick={setPages} />
          <RangeChips legend="Monthly views or visitors" name="views" ranges={VIEWS_RANGES} value={views} onPick={setViews} />
          <RangeChips legend="Email or SMS list size (if you have one)" name="list" ranges={LIST_RANGES} value={list} onPick={setList} />
          <label className="block text-[12px] font-bold text-foreground/75">Other ad data (optional)
            <input data-testid="act-other" value={other} onChange={(e) => setOther(e.target.value.slice(0, ACT_OTHER_MAX))} placeholder="e.g. receipts, app screens, newsletter" maxLength={ACT_OTHER_MAX} className="mt-1.5 h-11 w-full min-w-0 rounded-full border border-foreground/20 bg-white px-4 text-sm font-normal" />
          </label>
        </div>
        <Details label="Why we ask" testId="act-inventory-help">
          <p>Rough ranges are all we need. We use them to plan how much ad inventory your hubs could add. They stay internal, are never published, and don't change any public figure.</p>
        </Details>
      </section>

      <section aria-labelledby="act-h2" className="mt-5 border-t border-foreground/10 pt-5" data-testid="act-openness">
        <h3 id="act-h2" className="font-display text-xl leading-tight">Which ads can run on your hubs?</h3>
        <div role="radiogroup" aria-labelledby="act-h2" className="mt-3 grid gap-2">
          {ACT_OPENNESS.map((o) => (
            <button key={o.key} type="button" role="radio" aria-checked={openness === o.key} onClick={() => setOpenness(o.key)} data-testid={`act-openness-${o.key}`} className={`flex min-w-0 items-start gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${openness === o.key ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/80 ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>
              <span aria-hidden className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-2 ${openness === o.key ? "bg-lime-300 ring-lime-300" : "ring-foreground/30"}`}>{openness === o.key ? <Check className="size-3 text-[#0b1f3a]" /> : null}</span>
              <span className="min-w-0">{o.label}<span className={`mt-0.5 block text-[12px] font-normal ${openness === o.key ? "text-white/70" : "text-foreground/55"}`}>{o.hint}</span></span>
            </button>
          ))}
        </div>
        {noncore ? (
          <fieldset className="mt-3 min-w-0" data-testid="act-exclusions">
            <legend className="text-[12px] font-bold text-foreground/75">Categories to exclude (pick any)</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ACT_EXCLUSIONS.map((x) => { const on = excl.includes(x.key); return <button key={x.key} type="button" aria-pressed={on} onClick={() => setExcl(on ? excl.filter((k) => k !== x.key) : [...excl, x.key])} data-testid={`act-excl-${x.key}`} className={chip(on)}>{x.label}</button>; })}
            </div>
          </fieldset>
        ) : null}
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-lime-50 px-3 py-2.5 text-[12px] text-[#0b1f3a]" data-testid="act-review-note"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{skinText(ACT_REVIEW_NOTE)}</span></p>
        <label className="mt-3 flex items-start gap-2 text-[13px] font-semibold text-foreground/80">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="act-ack" className="mt-0.5 size-5 shrink-0" />
          <span>I understand every ad is reviewed and nothing runs without approval.</span>
        </label>
        <Details label="How review works" testId="act-openness-help">
          <p>Curated keeps your hubs strictly health and wellness. Open to other premium brands lets high-value advertisers outside wellness in, minus anything you exclude. Open to any approved ad adds everything that passes review. You can change your choice later.</p>
        </Details>
      </section>

      <FieldError msg={err} id="act-error" />
      <button type="submit" disabled={busy} data-testid="act-submit" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] shadow hover:bg-lime-200 disabled:opacity-60 sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Save my estimate and ad choices
      </button>
    </form>
  );
}
