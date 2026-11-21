import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { Field, inputClass, postJson, textareaClass } from "./ui";
import { BackButton, FieldError, SavedNote, StepHeader, SuccessPanel, primaryBtn } from "./form-steps";
import { autofillFor, fieldError, useSavedState } from "@/lib/form-save";

export type LeadField = { name: string; label: string; type?: "text" | "email" | "url" | "tel" | "textarea" | "select" | "hidden"; required?: boolean; options?: string[]; placeholder?: string; hint?: string; defaultValue?: string };

const CORE = ["email", "name", "company", "phone", "website", "message"];
const kindOf = (f: LeadField): "email" | "website" | "text" => (f.type === "email" || f.name === "email" ? "email" : f.type === "url" || f.name === "website" ? "website" : "text");

/**
 * Generic Friday-bound form (POST /v1/leads). Core fields map to Friday contact fields; the rest go in meta.
 * Guided (Randy, voice, Nov 21 2026): step 1 asks only the required contact fields, step 2 the required picks as
 * one-tap chips, and every optional field sits behind "Add details". Inline validation, autofill hints, answers
 * saved in this browser until sent, a Back button and a success panel with the next step.
 */
export function LeadForm({ kind, fields, submitLabel, done, testId, next, endpoint = "/v1/leads" }: { endpoint?: string; kind: string; fields: LeadField[]; submitLabel: string; done: ReactNode; testId?: string; next?: ReactNode }) {
  const visible = fields.filter((f) => f.type !== "hidden");
  const hidden = fields.filter((f) => f.type === "hidden");
  const contact = visible.filter((f) => f.required && f.type !== "select" && f.type !== "textarea");
  const picks = visible.filter((f) => f.type === "select" && f.required);
  const optionalPicks = visible.filter((f) => f.type === "select" && !f.required);
  const extras = visible.filter((f) => !f.required && f.type !== "select");
  const steps = picks.length || optionalPicks.length ? 2 : 1;
  const defaultsSig = visible.map((f) => f.defaultValue ?? "").join("\u0001");
  const initial = useMemo(() => Object.fromEntries(visible.map((f) => [f.name, f.defaultValue ?? ""])) as Record<string, string>, [defaultsSig]); // eslint-disable-line react-hooks/exhaustive-deps
  // Prefilled picks (e.g. the quick-buy summary) are part of the key, so a new pick never restores a stale summary.
  const sigHash = useMemo(() => { let h = 0; for (const c of defaultsSig) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); }, [defaultsSig]);
  const [v, setV, saved] = useSavedState<Record<string, string>>(`lead:${kind}:${testId ?? ""}:${sigHash}`, initial);
  const [restoredShown, setRestoredShown] = useState(saved.restored);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState(() => extras.some((f) => (v[f.name] ?? "") !== (f.defaultValue ?? "") && (v[f.name] ?? "").trim() !== ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [hp, setHp] = useState("");
  const top = useRef<HTMLFormElement>(null);

  const errOf = (f: LeadField) => {
    const val = v[f.name] ?? "";
    if (f.type === "select") return f.required && !val ? "Pick one." : "";
    return fieldError(kindOf(f), val, Boolean(f.required));
  };
  const stepFields = step === 1 ? [...contact, ...(steps === 1 ? extras : [])] : picks;
  const firstBad = (list: LeadField[]) => list.find((f) => errOf(f));
  const set = (name: string, val: string) => setV((cur) => ({ ...cur, [name]: val }));
  const focusField = (name: string) => window.setTimeout(() => top.current?.querySelector<HTMLElement>(`[name="${name}"], [data-chip="${name}"]`)?.focus(), 30);

  const advance = () => {
    const bad = firstBad(stepFields);
    if (bad) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(stepFields.map((f) => [f.name, true])) }));
      focusField(bad.name);
      return false;
    }
    return true;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!advance()) return;
    if (step < steps) {
      setStep(step + 1);
      top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const all = { ...Object.fromEntries(hidden.map((f) => [f.name, f.defaultValue ?? ""])), ...v };
    const extra = Object.fromEntries(Object.entries(all).filter(([k]) => !CORE.includes(k)));
    if (hp) return setOk(true); // honeypot: send nothing
    setBusy(true);
    try {
      const r = await postJson<{ ok?: boolean; error?: string }>(endpoint, { kind, ...Object.fromEntries(CORE.map((k) => [k, (all[k] ?? "").trim()])), path: typeof window === "undefined" ? "" : window.location.pathname, company_url: hp, fields: extra });
      if (!r.ok) setError(r.data.error ?? "Couldn't send. Email sales@silverbirchgrowth.com.");
      else {
        saved.clear();
        setOk(true);
      }
    } catch {
      setError("Couldn't send. Check your connection and press the button again, or email sales@silverbirchgrowth.com.");
    } finally {
      setBusy(false);
    }
  };

  if (ok)
    return (
      <SuccessPanel title="Sent. You're all set." testId={testId ? `${testId}-done` : undefined} next={next ?? <p>We reply by email within 1 business day. Nothing is booked or charged until you approve an insertion order.</p>}>
        {done}
      </SuccessPanel>
    );

  const input = (f: LeadField) => {
    const af = autofillFor(f.name, f.type);
    const showErr = touched[f.name] ? errOf(f) : "";
    const common = {
      name: f.name,
      value: v[f.name] ?? "",
      "aria-invalid": showErr ? true : undefined,
      "aria-describedby": showErr ? `${f.name}-err` : undefined,
      onBlur: () => setTouched((t) => ({ ...t, [f.name]: true })),
    };
    return (
      <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
        <Field label={`${f.label}${f.required ? "" : " (optional)"}`} hint={f.hint}>
          {f.type === "textarea" ? (
            <textarea {...common} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} className={textareaClass} />
          ) : (
            <input {...common} type={af.type ?? "text"} autoComplete={af.autoComplete} inputMode={af.inputMode} placeholder={f.placeholder ?? (kindOf(f) === "website" ? "yourbrand.com" : kindOf(f) === "email" ? "you@company.com" : undefined)} onChange={(e) => set(f.name, e.target.value)} className={`${inputClass} ${showErr ? "border-[#b42318]" : ""}`} />
          )}
        </Field>
        <FieldError msg={showErr} id={`${f.name}-err`} />
      </div>
    );
  };
  const chips = (f: LeadField) => {
    const showErr = touched[f.name] ? errOf(f) : "";
    return (
      <fieldset key={f.name} className="md:col-span-2" data-testid={`lead-pick-${f.name}`}>
        <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70">{f.label}{f.required ? "" : " (optional)"}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>
          {f.options!.map((o, i) => {
            const on = v[f.name] === o;
            return (
              <button key={o} type="button" role="radio" aria-checked={on} data-chip={i === 0 ? f.name : undefined} onClick={() => { set(f.name, on && !f.required ? "" : o); setTouched((t) => ({ ...t, [f.name]: true })); }} className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/80 ring-1 ring-foreground/20 hover:ring-foreground/50"}`}>
                {o}
              </button>
            );
          })}
        </div>
        <FieldError msg={showErr} />
      </fieldset>
    );
  };
  const last = step === steps;
  return (
    <form ref={top} onSubmit={onSubmit} noValidate className="scroll-mt-24" data-testid={testId} data-step={step}>
      <StepHeader
        step={step}
        total={steps}
        title={step === 1 ? "About you" : "Your picks"}
        hint={step === 1 ? `Add ${contact.map((f) => f.label.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}, then press ${last ? submitLabel : "Next"}.` : `Tap the option that fits${picks.length > 1 ? " for each" : ""}, then press ${submitLabel}. You can change it later.`}
        testId={testId ? `${testId}-steps` : undefined}
      />
      <SavedNote show={restoredShown && step === 1} onClear={() => { saved.clear(); setV(initial); setRestoredShown(false); setTouched({}); }} />
      <div className="grid gap-4 md:grid-cols-2">
        {step === 1 ? contact.map(input) : null}
        {step === steps ? <>{picks.map(chips)}{optionalPicks.map(chips)}</> : null}
      </div>
      {last && extras.length ? (
        <div className="mt-4">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline" data-testid={testId ? `${testId}-more` : "lead-more"}>
            <ChevronDown className={`size-4 transition ${more ? "rotate-180" : ""}`} aria-hidden />Add details (optional)
          </button>
          {more ? <div className="mt-3 grid gap-4 md:grid-cols-2">{extras.map(input)}</div> : null}
        </div>
      ) : null}
      <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {step > 1 ? <BackButton onClick={() => setStep(step - 1)} testId={testId ? `${testId}-back` : undefined} /> : null}
        <button type="submit" disabled={busy} className={primaryBtn} data-testid={testId ? `${testId}-submit` : undefined}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {busy ? "Sending…" : last ? submitLabel : "Next"} {busy ? null : <ArrowRight className="size-5" aria-hidden />}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-[#b42318]" role="alert">{error}</p> : <p className="mt-3 text-xs text-muted-foreground">Goes straight to our team. No newsletter unless you ask. Saved in this browser until you send it.</p>}
    </form>
  );
}
