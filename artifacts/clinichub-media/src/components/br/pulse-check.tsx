import { type FormEvent, useRef, useState } from "react";
import { Footprints, LayoutGrid, Loader2, Store } from "lucide-react";
import { inputClass, postJson, textareaClass } from "./ui";
import { skinText } from "@/lib/siteSkin";

/**
 * Rapid pulse check (Randy, Nov 26 2026): a compact card on /agencies (and the /fit alias) where an agency leaves an
 * email and a couple of sentences about its client base. A person replies within one business day. No automated email
 * goes back, no counts are shown. POST /v1/pulse-check: honeypot (company_url), render time (t), throttled server-side.
 */
const CHANNELS = [
  { Icon: LayoutGrid, t: "Branded clinic layers", d: "A co-branded storefront for the client." },
  { Icon: Store, t: "Retail network micro-store clinic layers", d: "Small shop clinic layers inside partner retailers." },
  { Icon: Footprints, t: "Street Team", d: "Samples, door-to-door and partner-retailer drop-offs." },
] as const;

const CONFIRMATION = "Thanks. We'll reply within one business day with where you'd fit best.";

export function PulseCheckCard({ id = "pulse-check", fullFormHref = "#talk", className = "" }: { id?: string; fullFormHref?: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [blurb, setBlurb] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const renderedAt = useRef(Date.now());

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError("Add a valid email so we can reply.");
    if (blurb.trim().length < 15) return setError("Add a couple of sentences about your clients.");
    if (hp) return setDone(true); // honeypot: send nothing
    setBusy(true);
    try {
      const r = await postJson<{ ok?: boolean; error?: string }>("/v1/pulse-check", { email: email.trim(), blurb: blurb.trim(), company_url: hp, t: renderedAt.current });
      if (!r.ok) setError(r.data.error ?? "Couldn't send. Email randy@scalehealth.ca.");
      else setDone(true);
    } catch {
      setError("Couldn't send. Email randy@scalehealth.ca.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside id={id} className={`scroll-mt-24 border border-[#0b1f3a]/20 bg-white p-5 shadow-sm md:p-6 ${className}`} data-testid="pulse-check" aria-labelledby={`${id}-h`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55">For agencies</p>
      <h2 id={`${id}-h`} className="mt-1 font-display text-2xl leading-tight text-[#0b1f3a]">Rapid pulse check</h2>
      <p className="mt-1 text-sm text-foreground/65">Tell us about your clients. We&apos;ll point you to the right fit.</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3" aria-label="Channels you might fit" data-testid="pulse-channels">
        {CHANNELS.map(({ Icon, t, d }) => (
          <li key={t} className="flex items-start gap-2.5 border border-[#0b1f3a]/12 bg-[#f9f8f6] p-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-[#0b1f3a]" aria-hidden />
            <span className="min-w-0 text-[12.5px] leading-snug text-foreground/70"><b className="block text-[13px] font-semibold text-[#0b1f3a]">{skinText(t)}</b>{d}</span>
          </li>
        ))}
      </ul>

      {done ? (
        <p className="mt-5 border border-[#1d875c]/30 bg-[#e8f5ee] p-4 text-sm font-medium text-[#0b3b2a]" role="status" data-testid="pulse-done">{CONFIRMATION}</p>
      ) : (
        <form onSubmit={onSubmit} className="relative mt-5 space-y-3" noValidate data-testid="pulse-form">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/70">Email</span>
            <input type="email" name="email" autoComplete="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@agency.com" data-testid="pulse-email" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/70">Your client base</span>
            <textarea name="blurb" required maxLength={1500} value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={4} className={`${textareaClass} min-h-24`} placeholder="A couple of sentences about your client base and ICP: who they sell to and what they do." data-testid="pulse-blurb" />
          </label>
          <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          {error ? <p className="text-sm text-red-700" role="alert" data-testid="pulse-error">{error}</p> : null}
          <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-60" data-testid="pulse-submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Send
          </button>
          <p className="text-center text-xs text-foreground/55">Want to share more? <a href={fullFormHref} className="underline underline-offset-2" data-testid="pulse-full-form">Use the full agency form</a>.</p>
        </form>
      )}
    </aside>
  );
}

/** /fit and /fit-check: a direct-link alias that shows only the card (same component, same endpoint). */
export default function BrFit() {
  return (
    <div className="container mx-auto max-w-xl px-6 py-12 md:py-20" data-testid="br-fit">
      <PulseCheckCard id="pulse-check-direct" fullFormHref="/agencies#talk" />
    </div>
  );
}
