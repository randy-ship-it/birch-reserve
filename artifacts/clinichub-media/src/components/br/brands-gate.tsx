/**
 * /advertise/brands public totals + access-code gate.
 * The named brand list and per-clinic-layer volumes are fetched from
 * POST/GET /v1/advertise/brands-access after the server checks the code.
 * This file loads detail rows only from the access API.
 */
import { type FormEvent, useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { CLAIM_LINE, PUBLIC_BRAND_TOTALS, PUBLIC_CATEGORIES, PUBLIC_FINE } from "../../../../api-server/src/lib/overhaul/publicBrandTotals";
import { type BrandsAccessHub, type BrandsAccessPayload } from "../../../../api-server/src/lib/overhaul/brandsAccessTypes";
import { Field, inputClass, postJson, Modelled } from "./ui";

const TOKEN_KEY = "br_brands_access_v1";

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeToken(token: string) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function PublicBrandTotals({ compact = false }: { compact?: boolean }) {
  return (
    <div data-testid="public-brand-totals">
      <div className={`grid grid-cols-2 gap-x-6 gap-y-7 ${compact ? "" : "sm:grid-cols-4"}`}>
        {PUBLIC_BRAND_TOTALS.map((x) => (
          <div key={`${x.v}-${x.l}`}>
            <div className={`font-display ${compact ? "text-3xl leading-none" : "text-4xl leading-none md:text-5xl"}`}>{x.v}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {x.l}
              {"estimate" in x && x.estimate ? <span className="block text-[11px] uppercase tracking-wider">Estimate</span> : null}
              {"note" in x && x.note ? <span className="block text-[11px] uppercase tracking-wider">{x.note}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Categories · {PUBLIC_CATEGORIES.join(" · ")}</p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{PUBLIC_FINE}</p>
    </div>
  );
}

function UnlockedHubs({ hubs }: { hubs: BrandsAccessHub[] }) {
  const brands = hubs.filter((h) => h.kind === "brand");
  return (
    <div className="space-y-10" data-testid="brands-unlocked">
      <p className="inline-flex items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold" data-testid="brands-unlocked-flag">
        <Unlock className="size-4" /> Brand list and per-clinic-layer volumes
      </p>
      {brands.some((h) => h.logo) ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5" data-testid="gated-logo-strip">
          {brands.map((h) =>
            h.logo ? (
              <li key={h.key} className="flex h-10 items-center">
                <img src={h.logo} alt={h.name} className="max-h-9 w-auto max-w-[130px] object-contain" />
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      <div className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 [scrollbar-width:none]">
        {brands.map((h) => (
          <figure key={h.key} className="w-[300px] shrink-0 snap-start md:w-[380px]" data-testid={`gated-banner-${h.key}`}>
            <div className="border border-foreground/15 bg-white shadow-[0_18px_40px_-24px_rgba(7,26,57,0.45)]">
              <div className="flex items-center gap-1.5 border-b border-foreground/10 bg-secondary/50 px-3 py-2">
                <span className="size-2 rounded-full bg-foreground/25" />
                <span className="size-2 rounded-full bg-foreground/25" />
                <span className="size-2 rounded-full bg-foreground/25" />
                <span className="ml-2 truncate text-[11px] text-foreground/45">{h.name}</span>
              </div>
              {h.banner ? (
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={h.banner} alt={`${h.name} clinic layer`} className="h-full w-full object-cover object-top" />
                </div>
              ) : null}
            </div>
            <figcaption className="mt-3 flex items-center gap-2">
              <span className="font-display text-lg">{h.name}</span>
              {h.bannerStatus ? <span className={`${h.bannerStatus === "Live" ? "bg-[#1f8a4c]" : "bg-foreground/60"} px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white`}>{h.bannerStatus}</span> : null}
              {h.recovery ? <span className="ml-auto text-xs text-muted-foreground">{h.recovery}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="grid gap-3 md:hidden" data-testid="gated-rate-card-mobile">
        {hubs.map((h) => (
          <article key={h.key} className="border border-foreground/15 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl leading-tight">{h.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{h.category}{h.audience ? ` · ${h.audience}` : ""}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Core / mo</p>
                <p className="font-semibold">${h.corePackageUsd.toLocaleString()} USD</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              {h.surfaces.map((s) => (
                <div key={s.key}>
                  <dt className="text-[11px] font-semibold leading-snug text-foreground/70">{s.label}</dt>
                  <dd>{s.views.toLocaleString()} views</dd>
                  <dd className="text-xs text-muted-foreground">${s.priceUsd.toLocaleString()} · from ${s.cpmUsd} CPM USD</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block" data-testid="gated-rate-card">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="py-3 pr-3 font-semibold">Clinic layer</th>
              {hubs[0]?.surfaces.map((s) => (
                <th key={s.key} className="py-3 pr-3 font-semibold">
                  {s.label}
                  <span className="block text-[11px] font-normal text-muted-foreground">from ${s.cpmUsd} CPM USD</span>
                </th>
              ))}
              <th className="py-3 font-semibold">Core package / mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hubs.map((h) => (
              <tr key={h.key}>
                <td className="py-3 pr-3">
                  <span className="font-medium">{h.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{h.category}</span>
                </td>
                {h.surfaces.map((s) => (
                  <td key={s.key} className="py-3 pr-3">
                    {s.views.toLocaleString()} views
                    <span className="block text-xs text-muted-foreground">${s.priceUsd.toLocaleString()}</span>
                  </td>
                ))}
                <td className="py-3 font-semibold">${h.corePackageUsd.toLocaleString()} USD</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {CLAIM_LINE}. <Modelled /> {hubs[0]?.basis ? "Basis follows each clinic layer row." : ""} Per-hub views and starting-at rates are illustrative estimates, not sold rates or a quote; your insertion order sets the final rate.
      </p>
    </div>
  );
}

export function BrandsAccessGate() {
  const [payload, setPayload] = useState<BrandsAccessPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let cancelled = false;
    fetch("/v1/advertise/brands-access", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BrandsAccessPayload | null) => {
        if (!cancelled && d?.ok && Array.isArray(d.hubs)) setPayload(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const r = await postJson<BrandsAccessPayload & { error?: string }>("/v1/advertise/brands-access", { code: String(fd.get("code") ?? "") }).catch(() => null);
    setBusy(false);
    if (!r?.ok || !r.data.ok || !r.data.token || !Array.isArray(r.data.hubs)) {
      setErr((r?.data as { error?: string } | undefined)?.error ?? "That code didn't match.");
      return;
    }
    writeToken(r.data.token);
    setPayload(r.data);
  };

  if (payload) return <UnlockedHubs hubs={payload.hubs} />;

  return (
    <form onSubmit={onSubmit} className="grid gap-3 border border-foreground/15 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-end" data-testid="brands-access-gate">
      <Field label="Access code" hint="The full brand list and per-clinic-layer volumes stay behind this code.">
        <input name="code" type="password" autoComplete="off" required className={inputClass} data-testid="brands-access-code" />
      </Field>
      <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 bg-foreground px-5 text-sm font-semibold text-background hover:bg-accent hover:text-accent-foreground disabled:opacity-60" data-testid="brands-access-submit">
        <Lock className="size-3.5" />
        {busy ? "Checking…" : "Show the list"}
      </button>
      {err ? <p className="sm:col-span-2 text-sm text-destructive" data-testid="brands-access-error">{err}</p> : null}
    </form>
  );
}

export function BrandsAccessCta() {
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      Starting-at rates by surface are on the <a href="/rates" className="underline underline-offset-2">rate card</a>. Per-hub volumes are in the list above, after the access code.
    </p>
  );
}
