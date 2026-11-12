import { type FormEvent, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Cta, Eyebrow, Field, H1, Lede, Section, inputClass, postJson, textareaClass, usePageMeta } from "@/components/br/ui";

type MatchResponse = {
  score: number;
  label: string;
  reasons: Array<{ title: string; detail: string }>;
  topCategories: Array<{ key: string; label: string; strength: number }>;
  bestHubs: string[];
  recommended: { product: string; label: string; href: string; why: string };
  businessType: string;
  basis: string;
  site: { host: string; title: string; fetched: boolean; note: string | null };
  stored: string;
  error?: string;
};

function Ring({ score }: { score: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 180 180" className="size-44" aria-hidden>
      <circle cx="90" cy="90" r={r} fill="none" stroke="hsl(var(--foreground)/0.1)" strokeWidth="16" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="hsl(var(--accent))" strokeWidth="16" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 90 90)" style={{ transition: "stroke-dasharray 900ms ease" }} />
      <text x="90" y="98" textAnchor="middle" className="fill-foreground font-display" style={{ fontSize: 44 }}>
        {score}%
      </text>
    </svg>
  );
}

export default function BrMatch() {
  usePageMeta("Match your audience | Birch Reserve", "Enter your website and a short note. See how well your audience matches the Scale Activity launch audience profile, as a clean % with three reasons.");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<MatchResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const r = await postJson<MatchResponse>("/v1/match", { url: fd.get("url"), blurb: fd.get("blurb"), email: fd.get("email"), company: fd.get("company") });
      if (!r.ok) setErr(r.data.error ?? "Couldn't score that site.");
      else setRes(r.data);
    } catch {
      setErr("Couldn't reach the match service. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="br-match">
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Match your audience</Eyebrow>
            <H1>How well do your customers match ours?</H1>
            <Lede>Paste your website and tell us in a sentence who you sell to. We read your public pages and compare them with the Scale Activity launch audience profile. You get a % match, three reasons and the best way to start.</Lede>
            <form onSubmit={onSubmit} className="mt-8 grid gap-4" data-testid="match-form">
              <Field label="Your website">
                <input name="url" required placeholder="yourstudio.com" className={inputClass} data-testid="match-url" />
              </Field>
              <Field label="Who are your customers? (optional)" hint="A sentence or two helps, especially if your site is light on words.">
                <textarea name="blurb" placeholder="Busy parents in Oakville who want to get back to running after an injury." className={textareaClass} data-testid="match-blurb" />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Work email (optional)" hint="We'll send the full match report.">
                  <input name="email" type="email" className={inputClass} />
                </Field>
                <Field label="Company (optional)">
                  <input name="company" className={inputClass} />
                </Field>
              </div>
              <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-accent-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-60 md:w-auto md:px-8" data-testid="match-submit">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {busy ? "Reading your site…" : "Get my match"}
              </button>
              {err ? <p className="text-sm text-destructive">{err}</p> : null}
            </form>
          </div>

          <div className="border border-foreground/15 bg-white p-6 md:p-8" data-testid="match-result" aria-live="polite">
            {!res ? (
              <div className="flex h-full min-h-[320px] flex-col justify-center text-muted-foreground">
                <p className="font-display text-2xl text-foreground">Your match shows here.</p>
                <p className="mt-2 text-sm">Health, wellness, fitness, food and local service businesses usually land between 70% and 95%.</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li>· Recovery, pain relief and mobility</li>
                  <li>· Longevity, fitness, food and nutrition</li>
                  <li>· Wellness services, pets (in queue)</li>
                  <li>· Canadian and US adults</li>
                </ul>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-6">
                  <Ring score={res.score} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">{res.site.host}</p>
                    <p className="mt-1 font-display text-3xl" data-testid="match-score-label">
                      {res.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Modelled audience match</p>
                  </div>
                </div>
                {res.site.note ? <p className="mt-4 bg-secondary/60 p-3 text-xs text-muted-foreground">{res.site.note}</p> : null}
                <ol className="mt-6 space-y-4">
                  {res.reasons.map((r, i) => (
                    <li key={r.title} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center bg-foreground text-sm font-semibold text-background">{i + 1}</span>
                      <div>
                        <p className="font-semibold">{r.title}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 border-t border-border pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Recommended start</p>
                  <p className="mt-1 font-display text-2xl">{res.recommended.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{res.recommended.why}</p>
                  <div className="mt-4">
                    <Cta href={res.recommended.href} testId="match-recommended">{res.recommended.label}</Cta>
                  </div>
                </div>
                <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">{res.basis}</p>
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
