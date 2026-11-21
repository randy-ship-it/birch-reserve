/**
 * Friday sync (existing intake integration, lib/fridayPush.ts config + endpoint). Aggregates only: one record per
 * campaign (budget, spent, viewable impressions, clicks, conversions, pacing) and one per APPROVED royalty statement.
 * No visitor-level data is ever sent. Test campaigns are sent only when asked and are tagged birch:qa-test.
 */
import { fridayConfig, fridayIntakeUrl } from "../fridayPush";
import { MICROS, placementLabel } from "./config";
import { pacingState, type Campaign } from "./engine";
import * as store from "./store";

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
let fetchImpl: Fetch = (u, i) => fetch(u, i);
export function setAdsFridayFetchForTests(f: Fetch | null): void {
  fetchImpl = f ?? ((u, i) => fetch(u, i));
}

const major = (m: number) => Math.round(m / 10_000) / 100;

export function campaignPayload(c: Campaign, t: store.Totals, cfg: { workspace: string; stage: string }, now = Date.now()): Record<string, unknown> {
  const lines = [
    `Birch Reserve ad campaign (${c.status}, pacing ${pacingState(c, now).replace("_", " ")}).`,
    `Bought: ${placementLabel(c.primaryPlacement)} · ${c.pricing.toUpperCase()}${c.allowSubstitute ? " · auto-move on" : ""}`,
    `Budget ${major(c.budgetMicros)} ${c.currency.toUpperCase()} · spent ${major(c.spentMicros)} · left ${major(Math.max(0, c.budgetMicros - c.spentMicros))}`,
    `Delivery (aggregate): ${t.views} viewable impressions, ${t.clicks} clicks, ${t.convs} conversions`,
    c.flightStart ? `Flight ${c.flightStart.toISOString().slice(0, 10)} to ${c.flightEnd?.toISOString().slice(0, 10) ?? "?"}` : "Flight not set yet",
    c.orderRef ? `Order: ${c.orderRef}` : "",
    c.isTest ? "QA TEST CAMPAIGN (is_test): safe to ignore / delete." : "",
    `Admin: https://birchreserve.net/ads/admin#campaigns · campaign ${c.id}`,
  ].filter(Boolean);
  return {
    externalId: `birch-ads-campaign-${c.id}`,
    email: c.accountEmail,
    company: c.brand,
    message: lines.join("\n"),
    site: "birchreserve.net",
    org: cfg.workspace,
    source: "Birch ad system",
    kind: "form",
    path: "/ads/admin",
    stage: cfg.stage,
    tags: ["birch-inbound", "birch:ads-campaign", `birch:ads-${c.status}`, ...(c.isTest ? ["birch:qa-test"] : [])],
    value: major(c.budgetMicros),
    meta: {
      ads_campaign_id: c.id, ads_status: c.status, ads_currency: c.currency, ads_budget: major(c.budgetMicros), ads_spent: major(c.spentMicros),
      ads_views: t.views, ads_clicks: t.clicks, ads_conversions: t.convs, ads_conversion_value: Math.round((t.convValueMicros / MICROS) * 100) / 100, is_test: c.isTest,
    },
  };
}

async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> {
  const cfg = fridayConfig();
  if (!cfg) return { ok: false, status: 0, error: "friday_not_configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetchImpl(fridayIntakeUrl(cfg.url), {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json", "x-birch-lead-id": String(payload.externalId) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    await res.text().catch(() => "");
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: `Friday HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message.slice(0, 120) : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

export const fridayReady = () => fridayConfig() !== null;

export async function syncToFriday(opts: { campaignId?: string; includeTest?: boolean; royalties?: boolean } = {}): Promise<{ sent: number; failed: number; skipped: number; errors: string[] }> {
  const cfg = fridayConfig();
  const out = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };
  if (!cfg) {
    out.errors.push("friday_not_configured");
    return out;
  }
  let campaigns = opts.campaignId ? [await store.getCampaign(opts.campaignId)].filter((c): c is Campaign => c !== null) : await store.listCampaigns();
  if (!opts.includeTest && !opts.campaignId) campaigns = campaigns.filter((c) => !c.isTest);
  const totals = await store.totalsByCampaign(campaigns.map((c) => c.id));
  for (const c of campaigns) {
    const r = await post(campaignPayload(c, totals.get(c.id) ?? { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 }, cfg));
    if (r.ok) out.sent += 1;
    else {
      out.failed += 1;
      if (r.error) out.errors.push(r.error);
    }
  }
  if (opts.royalties !== false && !opts.campaignId) {
    for (const r of (await store.royalties(3)).filter((x) => x.status === "approved")) {
      const res = await post({
        externalId: `birch-ads-royalty-${r.partner}-${r.month}-${r.currency}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 160),
        company: r.partner,
        message: `Birch Reserve royalty statement ${r.month} (${r.currency.toUpperCase()}), APPROVED by ${r.approvedBy}.\nDelivered spend ${major(r.grossMicros)} · share ${(r.shareBps ?? 0) / 100}% · payable ${major(r.payableMicros ?? 0)}.\nCalculated from delivered ads on this partner's hub slots. Payment is sent manually by Randy; nothing pays automatically.`,
        site: "birchreserve.net", org: cfg.workspace, source: "Birch ad system", kind: "form", path: "/ads/admin#royalties", stage: cfg.stage,
        tags: ["birch:ads-royalty"], value: major(r.payableMicros ?? 0),
        meta: { royalty_partner: r.partner, royalty_month: r.month, royalty_currency: r.currency, royalty_gross: major(r.grossMicros), royalty_payable: major(r.payableMicros ?? 0) },
      });
      if (res.ok) out.sent += 1;
      else {
        out.failed += 1;
        if (res.error) out.errors.push(res.error);
      }
    }
  }
  await store.audit("system", "friday.sync", opts.campaignId ?? "all", JSON.stringify(out));
  return out;
}
