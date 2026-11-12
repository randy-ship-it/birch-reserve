import { type FormEvent, type ReactNode, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, inputClass, postJson, textareaClass } from "./ui";

export type LeadField = { name: string; label: string; type?: "text" | "email" | "url" | "tel" | "textarea" | "select"; required?: boolean; options?: string[]; placeholder?: string; hint?: string };

/** Generic Friday-bound form (POST /v1/leads). Core fields map to Friday contact fields; the rest go in meta. */
export function LeadForm({ kind, fields, submitLabel, done, testId }: { kind: string; fields: LeadField[]; submitLabel: string; done: ReactNode; testId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)]));
    const core = ["email", "name", "company", "phone", "website", "message"];
    const extra = Object.fromEntries(Object.entries(v).filter(([k]) => !core.includes(k)));
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{ ok?: boolean; error?: string }>("/v1/leads", { kind, ...Object.fromEntries(core.map((k) => [k, v[k] ?? ""])), fields: extra });
      if (!r.ok) setError(r.data.error ?? "Couldn't send. Email sales@silverbirchgrowth.com.");
      else setOk(true);
    } catch {
      setError("Couldn't send. Email sales@silverbirchgrowth.com.");
    } finally {
      setBusy(false);
    }
  };
  if (ok)
    return (
      <div className="flex items-start gap-3 border border-foreground/15 bg-accent/30 p-5" data-testid={testId ? `${testId}-done` : undefined}>
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>{done}</div>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2" data-testid={testId}>
      {fields.map((f) => (
        <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
          <Field label={`${f.label}${f.required ? "" : " (optional)"}`} hint={f.hint}>
            {f.type === "textarea" ? (
              <textarea name={f.name} required={f.required} placeholder={f.placeholder} className={textareaClass} />
            ) : f.type === "select" ? (
              <select name={f.name} required={f.required} className={inputClass} defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {f.options!.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} className={inputClass} />
            )}
          </Field>
        </div>
      ))}
      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="inline-flex h-12 items-center bg-foreground px-6 text-sm font-semibold text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60">
          {busy ? "Sending…" : submitLabel}
        </button>
        {error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">Goes straight to our team. No newsletter unless you ask.</p>}
      </div>
    </form>
  );
}
