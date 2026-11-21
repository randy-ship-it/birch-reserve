/**
 * Shared step chrome for public forms (Randy, voice, Nov 21 2026: "guide them step by step, show them what to do").
 * "Step 2 of 3" + a bar + a one-line "what to do now" hint. Purely visual; each form owns its own state.
 */
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export function StepHeader({ step, total, title, hint, testId }: { step: number; total: number; title: string; hint: string; testId?: string }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-4" data-testid={testId ?? "form-step-header"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60" data-testid="form-step-count" aria-live="polite">Step {step} of {total}</p>
        <p className="text-[11px] font-semibold text-foreground/50">{title}</p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
        <div className="h-full rounded-full bg-lime-400 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold text-[#0b1f3a]" data-testid="form-step-hint">{hint}</p>
    </div>
  );
}

export function FieldError({ msg, id }: { msg: string; id?: string }) {
  if (!msg) return null;
  return <span id={id} role="alert" className="mt-1 block text-[13px] font-semibold text-[#b42318]" data-testid="field-error">{msg}</span>;
}

export function BackButton({ onClick, testId }: { onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground/70 ring-1 ring-foreground/20 hover:ring-foreground/50" data-testid={testId ?? "form-back"}>
      <ArrowLeft className="size-4" aria-hidden /> Back
    </button>
  );
}

export function SavedNote({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null;
  return (
    <p className="mb-3 rounded-xl bg-lime-50 px-3 py-2 text-[13px] text-[#0b1f3a]" data-testid="form-restored">
      We kept what you typed last time. <button type="button" onClick={onClear} className="font-semibold underline underline-offset-2">Start over</button>
    </p>
  );
}

export function SuccessPanel({ title, children, next, testId }: { title: string; children?: ReactNode; next?: ReactNode; testId?: string }) {
  return (
    <div className="rounded-2xl border border-foreground/15 bg-lime-50 p-5 md:p-6" data-testid={testId} role="status">
      <p className="flex items-center gap-2 font-display text-2xl text-[#0b1f3a]"><CheckCircle2 className="size-6 text-lime-600" aria-hidden />{title}</p>
      {children ? <div className="mt-2 text-sm text-foreground/80">{children}</div> : null}
      {next ? <div className="mt-4 border-t border-foreground/10 pt-4 text-sm" data-testid="success-next"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">What happens next</p><div className="mt-1.5">{next}</div></div> : null}
    </div>
  );
}

export const primaryBtn = "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-7 text-base font-bold text-white shadow-lg transition hover:bg-lime-300 hover:text-[#0b1f3a] disabled:opacity-60 sm:w-auto sm:min-w-[14rem]";
