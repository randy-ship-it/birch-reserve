/**
 * Fast mode result (Randy, Nov 18 2026 11:36 PM ET; Friday contract v1.3): an instant on-page quick estimate shown
 * right after the one-click submit. Values Friday auto-filled from the brand's public pages carry a small
 * "from your site" tag; gaps (needs_input) become prompts in "Add detail to sharpen your numbers". Defaults are
 * labelled. Friday's full report is reviewed by a person first. Birch never fetches the brand's site itself.
 */
import { ArrowRight, Plus, Rocket, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ReportV2 } from "@/components/br/report-v2";
import { LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import { IntakeWarnings } from "@/components/br/intake-warnings";
import { QUICK_DEFAULTS, quickReport } from "@/lib/fridayMockReport";
import { RT, RT_SANS, RT_SERIF } from "@/lib/reportTokens";
import type { IntakeSide } from "@/lib/intakeTrack";
import type { Autofill, IntakeRef } from "@/lib/fridayBrandIntake";
import { fridayIntake } from "@/lib/fridayBrandIntake";
import type { IntakePayload } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { IntakeDetails, type SharedAnswers } from "@/components/br/intake-details";
import { mockExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { trackIntake } from "@/lib/intakeTrack";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { FRIDAY_CATEGORIES } from "../../../../api-server/src/lib/kitCalc/fridayV12";

export type QuickResult = { side: IntakeSide; roles: string[]; host: string; autofill: Autofill | null; fallback: boolean; typedMarket: Market | null; held: boolean; ref?: IntakeRef; payload?: IntakePayload; contact?: { email: string; website: string }; shared?: SharedAnswers; brand?: string | null; category?: string | null };
const DEFAULT_CAT = "recovery_devices";
const catLabel = (k: string) => FRIDAY_CATEGORIES.find((c) => c.key === k)?.label ?? k;
const geoText = (g?: { sells?: string[] } | null) => (g?.sells?.length ? g.sells.map((c) => (c === "CA" ? "Canada" : c === "US" ? "USA" : c)).join(" + ") : null);

/** needs_input → the prompt shown in the upgrade box. */
export function needPrompt(key: string, notes: string[] = []): string {
  const cad = notes.some((n) => /CAD|currency/i.test(n));
  return (
    {
      avg_cart_usd: cad ? "Your average cart in USD (your site lists prices in CAD; we don't convert)" : "Your average cart in USD",
      category: "Your category",
      geo: "Where you sell and ship",
      company_name: "Your brand name",
      orders_per_month: "Orders a month",
      purchases_per_year: "How often customers buy again",
      margin_band: "Your gross margin band",
    } as Record<string, string>
  )[key] ?? key.replace(/_/g, " ");
}

const FromSite = () => <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: RT.mint, color: RT.mintInk }} data-testid="from-site-tag">from your site</span>;
const Dflt = () => <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: RT.track, color: RT.mute }}>default</span>;

export function FastReport({ q: q0, onAddDetail }: { q: QuickResult; onAddDetail: () => void }) {
  // "Add my hub" after a supplier-only submit adds the hub role to the SAME record (PATCH), never a second form.
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const q = useMemo(() => ({ ...q0, roles: [...new Set([...q0.roles, ...extraRoles])] }), [q0, extraRoles]);
  const f = q.autofill?.fields ?? {};
  const name = q.brand ?? f.company_name?.value ?? null;
  const cat = q.category ?? f.category?.value ?? DEFAULT_CAT;
  const aov = typeof f.avg_cart_usd?.value === "number" ? f.avg_cart_usd.value : null;
  const report = useMemo(() => quickReport({ roles: q.roles, category: cat, host: q.host, name, aovUsd: aov }), [q, cat, name, aov]);
  const isPub = q.side === "publisher";
  const oneForm = q.roles.includes("supplier") || q.roles.includes("publisher");
  const hasKit = q.roles.includes("kit");
  const [adding, setAdding] = useState<string | null>(null);
  // "Add my hub" / "Add Accelerate" after the submit update the SAME record (PATCH), never a second form.
  const addRole = async (role: "publisher" | "kit", detail: "add_hub" | "accelerate") => {
    if (!q.ref || !q.payload) return;
    setAdding(role);
    trackIntake("advertiser", "cta_click", detail);
    try {
      await fridayIntake().update(q.ref, { ...q.payload, roles: [...new Set([...(q.payload.roles ?? []), ...extraRoles, role])] as IntakePayload["roles"] });
      setExtraRoles((x) => [...new Set([...x, role])]);
    } catch {
      /* keep the current view; the button stays available */
    } finally {
      setAdding(null);
    }
  };
  const exposure = useMemo(() => mockExposure(q.typedMarket ?? undefined), [q.typedMarket]);
  const supplierOnly = q.roles.includes("supplier") && !q.roles.includes("publisher");
  const earnCta = supplierOnly && q.ref ? (
    <button type="button" onClick={() => addRole("publisher", "add_hub")} disabled={!!adding} data-testid="report-add-hub" className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-bold" style={{ background: RT.forest, color: "#fff" }}><Plus className="size-4" />{adding === "publisher" ? "Adding…" : "Add my hub to unlock max exposure"}</button>
  ) : undefined;
  const accCta = q.roles.includes("supplier") && !q.roles.includes("kit") && q.ref ? (
    <button type="button" onClick={() => addRole("kit", "accelerate")} disabled={!!adding} data-testid="report-add-accelerate" className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-bold" style={{ background: RT.mint, color: RT.forest }}><Rocket className="size-4" />{adding === "kit" ? "Adding…" : "Add Accelerate to my request"}</button>
  ) : undefined;
  const needs = [...new Set([...(q.autofill?.needs_input ?? (q.fallback ? ["category", "avg_cart_usd", "geo"] : [])), ...(isPub ? [] : ["orders_per_month", "purchases_per_year", "margin_band"])])].filter((k) => !(k === "geo" && q.typedMarket));
  const rows: Array<{ k: string; label: string; value: ReactNode; tag: ReactNode }> = [
    { k: "name", label: "Brand", value: name ?? q.host, tag: name ? <FromSite /> : null },
    { k: "category", label: "Category", value: catLabel(cat), tag: f.category ? <FromSite /> : <Dflt /> },
    { k: "geo", label: "Sells / ships", value: geoText(q.typedMarket ? { sells: q.typedMarket.sells_in } : f.geo?.value) ?? "Canada + USA", tag: q.typedMarket ? null : f.geo ? <FromSite /> : <Dflt /> },
    ...(isPub
      ? [{ k: "surfaces", label: "Surfaces", value: "Post-purchase, hub home, product pages, member dashboard, newsletter", tag: <Dflt /> }]
      : [
          { k: "aov", label: "Average cart", value: `$${aov ?? QUICK_DEFAULTS.aov_usd} USD`, tag: aov != null ? <FromSite /> : <Dflt /> },
          { k: "orders", label: "Orders", value: `${QUICK_DEFAULTS.orders_per_month} a month`, tag: <Dflt /> },
          { k: "repeat", label: "Repeat · margin", value: `${QUICK_DEFAULTS.repeat_label} · ${QUICK_DEFAULTS.margin_label}`, tag: <Dflt /> },
        ]),
  ];
  const upgrade = (where: string) => (
    <div className="rounded-2xl p-4" style={{ background: RT.forest, color: "#fff" }} data-testid={`fast-upgrade-${where}`}>
      <button type="button" onClick={onAddDetail} data-testid="fast-add-detail" className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-bold shadow-lg" style={{ background: RT.mint, color: RT.forest }}>
        <Sparkles className="size-5" />Add detail to sharpen your numbers<ArrowRight className="size-5" />
      </button>
      {needs.length ? (
        <ul className="mt-3 grid gap-1 text-[13px] text-white/85 md:grid-cols-2" data-testid={`fast-needs-${where}`}>
          {needs.map((k) => <li key={k}>• {needPrompt(k, q.autofill?.notes)}</li>)}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-white/60">Updates the same request. What you type always replaces what we read from your site.</p>
    </div>
  );
  return (
    <section data-testid="fast-report" className="space-y-4" style={{ fontFamily: RT_SANS }}>
      <div className="rounded-3xl bg-white p-5 shadow-xl md:p-6" style={{ border: `1px solid ${RT.line}` }}>
        <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: RT.goldBg, color: RT.gold, border: `1px solid ${RT.goldLine}` }} data-testid="fast-label">Quick estimate from your website + defaults</span>
        <h2 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Here's your quick estimate for {name ?? q.host}.</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] md:grid-cols-2" data-testid="fast-values">
          {rows.map((r) => (
            <div key={r.k} className="flex flex-wrap items-baseline gap-1" style={{ color: RT.mute }}>
              <dt>{r.label}:</dt><dd className="font-semibold" style={{ color: RT.ink }}>{r.value}</dd>{r.tag}
            </div>
          ))}
        </dl>
        {q.autofill?.mock ? <p className="mt-2 text-[11px]" style={{ color: RT.mute }} data-testid="fast-autofill-mock">Preview · mock data: we don't read your site on this preview, so every value is a default.</p> : null}
        {q.fallback ? <p className="mt-2 text-[11px]" style={{ color: RT.mute }} data-testid="fast-fallback">Site auto-fill is not switched on yet, so these are defaults.</p> : null}
        <div className="mt-4 rounded-2xl p-3 text-sm" style={{ background: RT.paper, color: RT.body }} data-testid="fast-in-review">
          <strong>Your full report is in review.</strong> We sent your request to Birch Reserve. A person reviews it before the full report is released{q.held ? ", after we confirm brand ownership (usually within one business day)" : ""}.
        </div>
        <LeadGatesStatus gates={{ review: "pending_review" }} testId="fast-lead-gates" />
        <IntakeWarnings testId="fast-warnings" />
        {hasKit || !oneForm ? <div className="mt-4">{upgrade("top")}</div> : null}
        {hasKit || !oneForm ? <div className="mt-3"><PrimaryCta side={q.side} where="done" /></div> : null}
      </div>
      {oneForm && q.ref && q.payload ? <IntakeDetails key={q.roles.join(",")} intake={q.ref} payload={{ ...q.payload, roles: q.roles as IntakePayload["roles"] }} roles={q.roles} shared={q.shared ?? { brand: "", categories: [], skus: "", audience: "" }} /> : null}
      <ReportV2 report={report} exposure={exposure} exposureSource="mock" earnCta={earnCta} supplierCta={supplierOnly ? earnCta : undefined} onAccelerate={accCta} />
      {hasKit || !oneForm ? upgrade("bottom") : null}
    </section>
  );
}
