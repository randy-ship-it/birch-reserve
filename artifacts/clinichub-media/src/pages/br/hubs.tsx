import { type FormEvent, useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { BrandBanners } from "@/components/br/brand-banners";
import { sponsorImps, slotPrice } from "@/components/br/rate-card";
import { Eyebrow, Field, H1, Lede, Modelled, Section, inputClass, postJson, usePageMeta } from "@/components/br/ui";
import { useCurrency } from "@/lib/currency";
import { BRAND_HUBS, SLOTS, type BrandHub } from "../../../../api-server/src/lib/overhaul/model";

const KEY = "br_hub_access_v1";

function HubDetail({ hub, unlocked }: { hub: BrandHub; unlocked: boolean }) {
  const { currency } = useCurrency();
  const core = SLOTS.filter((s) => s.core);
  return (
    <article className="relative border border-foreground/15 bg-white" data-testid={`hub-card-${hub.key}`}>
      <div className="flex items-center gap-4 border-b border-border p-5">
        <div className="flex h-12 w-32 items-center justify-center">
          <img src={hub.logo} alt={`${hub.name} logo`} className="max-h-10 w-auto object-contain" />
        </div>
        <div>
          <h3 className="font-display text-2xl">{hub.name}</h3>
          <p className="text-xs text-muted-foreground">
            {hub.category} · {hub.bannerStatus}
          </p>
        </div>
      </div>
      <div className={`p-5 ${unlocked ? "" : "pointer-events-none select-none blur-[5px]"}`} aria-hidden={!unlocked}>
        <p className="text-sm">
          <span className="font-semibold">Audience:</span> {hub.audience}
        </p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">Vertical:</span> {hub.recovery}
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-foreground/55">
              <th className="pb-2">Surface</th>
              <th className="pb-2">Views / mo</th>
              <th className="pb-2">Price / mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {core.map((s) => (
              <tr key={s.key}>
                <td className="py-2">{s.label}</td>
                <td className="py-2">{sponsorImps(hub, s.key).toLocaleString()}</td>
                <td className="py-2">${slotPrice(hub, s, currency).toLocaleString()} {currency.toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Per sponsor position <Modelled />. Basis: {hub.basis}.{hub.url ? " " : ""}
          {hub.url ? (
            <a href={hub.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              View the hub
            </a>
          ) : null}
        </p>
      </div>
      {!unlocked ? (
        <div className="absolute inset-x-0 bottom-0 top-[86px] flex items-center justify-center bg-background/40">
          <span className="inline-flex items-center gap-2 bg-foreground px-3 py-2 text-xs font-semibold text-background">
            <Lock className="size-3.5" /> Register your email to see details
          </span>
        </div>
      ) : null}
    </article>
  );
}

export default function BrHubs() {
  usePageMeta("Live brand hubs | Birch Reserve", "Effortless Admin, Jill Health, Jack Health, SOLE, DR-HO'S, Roll Recovery, Bird&Be and NutriProCan: register your email to see audience, surfaces and pricing.");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    try {
      setUnlocked(window.localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const r = await postJson<{ ok?: boolean; error?: string }>("/v1/leads", { kind: "hub_access", email: fd.get("email"), company: fd.get("company"), fields: { interest: fd.get("interest") } }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) {
      setErr(r?.data.error ?? "Couldn't register. Try again.");
      return;
    }
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  };
  return (
    <div data-testid="br-hubs">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <Eyebrow>Live brand hubs</Eyebrow>
            <H1>See inside the hubs.</H1>
            <Lede>Eight co-branded hubs are live inventory now, spending down over 6 months from when your deposit lands. 3x more is in queue by year end, and we're taking deposits for it too. Register your email to see each hub's audience, placements, modelled views and price.</Lede>
          </div>
          {unlocked ? (
            <p className="inline-flex items-center gap-2 bg-accent px-4 py-3 text-sm font-semibold" data-testid="hubs-unlocked">
              <Unlock className="size-4" /> Unlocked. Details below.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-3 border border-foreground/15 bg-white p-5" data-testid="hubs-gate">
              <Field label="Work email">
                <input name="email" type="email" required className={inputClass} data-testid="hubs-email" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company (optional)">
                  <input name="company" className={inputClass} />
                </Field>
                <Field label="I'm a">
                  <select name="interest" className={inputClass} defaultValue="Brand">
                    <option>Brand</option>
                    <option>Agency</option>
                    <option>Local business / studio</option>
                    <option>Publisher</option>
                  </select>
                </Field>
              </div>
              <button disabled={busy} className="h-12 bg-foreground text-sm font-semibold text-background hover:bg-accent hover:text-accent-foreground disabled:opacity-60" data-testid="hubs-submit">
                {busy ? "Unlocking…" : "Unlock hub details"}
              </button>
              {err ? <p className="text-sm text-destructive">{err}</p> : null}
            </form>
          )}
        </div>
      </Section>
      <Section tone="soft">
        <BrandBanners title="Live co-branded hubs" />
      </Section>
      <Section>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {BRAND_HUBS.map((h) => (
            <HubDetail key={h.key} hub={h} unlocked={unlocked} />
          ))}
        </div>
      </Section>
    </div>
  );
}
