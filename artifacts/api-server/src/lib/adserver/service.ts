/**
 * Ad system service: serve → viewable impression → click → conversion, plus paid-order hooks and the Friday sync.
 * Every count shown anywhere comes from rows these functions write. Nothing is modelled or padded here.
 */
import type Stripe from "stripe";
import { AD_DEFAULTS, EXCLUSIVE_RATE_BPS, MICROS, adsServingEnabled, findSlot, isBotUa, type AdSlot } from "./config";
import { canSpend, eventCostMicros, landingUrl, pickAd, type Campaign } from "./engine";
import { hashRef, pixelId, randomId, sign, verify, visitorHash } from "./auth";
import * as store from "./store";
import { afterOrderCampaign } from "./promo";
import { isTestIdentity } from "../testTraffic";

export type ServeInput = { slot: string; vid?: string | null; test?: boolean; ua?: string; dnt?: boolean; origin: string; now?: number };
export type ServeResult =
  | { fill: false; reason: string }
  | { fill: true; id: string; slot: string; campaign: string; brand: string; creative: { src: string; width: number; height: number; alt: string }; click: string; view: string; label: string; test: boolean };

type ServeClaims = { c: string; r: string; s: string; t: number; v: string | null; i: string; q: number };

let cache: { at: number; rows: Awaited<ReturnType<typeof store.servableCandidates>> } | null = null;
const CACHE_MS = 10_000;
export function resetServeCacheForTests(): void {
  cache = null;
}
async function candidates(now: number) {
  if (cache && now - cache.at < CACHE_MS) return cache.rows;
  const rows = await store.servableCandidates(new Date(now));
  cache = { at: now, rows };
  return rows;
}

export async function serve(input: ServeInput): Promise<ServeResult> {
  const now = input.now ?? Date.now();
  if (!adsServingEnabled()) return { fill: false, reason: "paused" };
  const slot = findSlot(input.slot);
  if (!slot) return { fill: false, reason: "unknown_slot" };
  if (!slot.live) return { fill: false, reason: "slot_not_live" };
  if (isBotUa(input.ua)) return { fill: false, reason: "filtered" };
  const vidHash = !input.dnt && input.vid ? visitorHash(input.vid, now) : null;
  const rows = await candidates(now);
  const ids = rows.map((r) => r.campaign.id);
  const views = vidHash ? await store.viewsTodayFor(vidHash, ids) : new Map<string, number>();
  const picked = pickAd(slot, rows.map((r) => ({ ...r, viewsToday: views.get(r.campaign.id) ?? 0 })), now, { test: Boolean(input.test) });
  if (!picked) return { fill: false, reason: "no_eligible_campaign" };
  const creative = (await store.listCreatives({ campaignId: picked.campaign.id, status: "approved" })).find((c) => c.id === picked.creativeId);
  if (!creative) return { fill: false, reason: "no_creative" };
  const i = randomId(12);
  const token = sign("s", { c: picked.campaign.id, r: creative.id, s: slot.key, t: now, v: vidHash, i, q: picked.campaign.isTest ? 1 : 0 } satisfies ServeClaims, AD_DEFAULTS.tokenTtlMs, now);
  await store.insertEvent({ kind: "serve", campaignId: picked.campaign.id, creativeId: creative.id, slotKey: slot.key, eligibility: picked.eligibility, isTest: picked.campaign.isTest, at: new Date(now) });
  const o = input.origin.replace(/\/+$/, "");
  return {
    fill: true,
    id: i,
    slot: slot.key,
    campaign: picked.campaign.id.slice(0, 8),
    brand: picked.campaign.brand,
    creative: { src: `${o}/v1/ads/cr/${creative.id}`, width: creative.width, height: creative.height, alt: creative.alt || `${picked.campaign.brand} (sponsored)` },
    click: `${o}/v1/ads/c?t=${encodeURIComponent(token)}`,
    view: `${o}/v1/ads/v?t=${encodeURIComponent(token)}`,
    label: "Sponsored",
    test: picked.campaign.isTest,
  };
}

export type BeaconResult = { counted: boolean; billed: boolean; reason?: string };

/** Viewable impression beacon (50% in view for 1s, measured by the embed). Counted once per served ad. */
export async function recordView(token: unknown, ua: string | undefined, now = Date.now()): Promise<BeaconResult> {
  const t = verify<ServeClaims>("s", token, now);
  if (!t) return { counted: false, billed: false, reason: "bad_token" };
  if (isBotUa(ua)) return { counted: false, billed: false, reason: "filtered" };
  if (now - t.t < 900) return { counted: false, billed: false, reason: "too_fast" }; // cannot be 1s in view yet
  const c = await store.getCampaign(t.c);
  const slot = findSlot(t.s);
  if (!c || !slot) return { counted: false, billed: false, reason: "unknown" };
  const id = await store.insertEvent({ kind: "view", campaignId: c.id, creativeId: t.r, slotKey: slot.key, vidHash: t.v, dedupeKey: `v:${t.i}`, isTest: c.isTest, at: new Date(now) });
  if (id === null) return { counted: false, billed: false, reason: "duplicate" };
  return { counted: true, billed: await bill(id, c, slot, "view", now) };
}

async function bill(eventId: number, c: Campaign, slot: AdSlot, kind: "view" | "click", now: number): Promise<boolean> {
  const cost = eventCostMicros(c, slot, kind);
  if (cost <= 0 || !canSpend(c, cost, now)) return false;
  const ok = await store.chargeEvent(eventId, c, slot.key, cost, new Date(now));
  if (ok) cache = null;
  return ok;
}

/** Click redirect. Counts a click once per served ad, bills CPC campaigns, returns the tagged landing URL. */
export async function recordClick(token: unknown, ua: string | undefined, now = Date.now()): Promise<{ location: string } & BeaconResult> {
  const t = verify<ServeClaims>("s", token, now - 0) ?? verify<ServeClaims>("s", token, now - 23 * 3600_000);
  if (!t) return { location: "https://birchreserve.net/", counted: false, billed: false, reason: "bad_token" };
  const c = await store.getCampaign(t.c);
  const slot = findSlot(t.s);
  if (!c || !slot) return { location: "https://birchreserve.net/", counted: false, billed: false, reason: "unknown" };
  const clickId = t.i;
  const location = landingUrl(c.clickUrl || slot.hubUrl, { campaignId: c.id, slot, clickId, brand: c.brand });
  const fresh = now - t.t <= AD_DEFAULTS.tokenTtlMs;
  if (!fresh) return { location, counted: false, billed: false, reason: "expired" };
  if (isBotUa(ua)) return { location, counted: false, billed: false, reason: "filtered" };
  if (now - t.t < AD_DEFAULTS.minClickMs) return { location, counted: false, billed: false, reason: "too_fast" };
  const id = await store.insertEvent({ kind: "click", campaignId: c.id, creativeId: t.r, slotKey: slot.key, vidHash: t.v, dedupeKey: `c:${t.i}`, clickId, isTest: c.isTest, at: new Date(now) });
  if (id === null) return { location, counted: false, billed: false, reason: "duplicate" };
  return { location, counted: true, billed: await bill(id, c, slot, "click", now) };
}

export type ConversionInput = {
  source: "pixel" | "postback";
  pixel?: string | null; // pixel tag id (pixel source)
  accountEmail?: string | null; // resolved from the postback key (postback source)
  clickId?: string | null;
  viewIds?: string[];
  value?: number | null; // major units
  currency?: string | null;
  orderId?: string | null;
  now?: number;
};

/** Attribute a conversion to the last click (click window) or, on same-origin hub carts, the last viewable impression (view window). */
export async function recordConversion(input: ConversionInput): Promise<{ attributed: boolean; via?: "click" | "view"; duplicate?: boolean; reason?: string }> {
  const now = input.now ?? Date.now();
  const owns = (c: Campaign) => (input.source === "pixel" ? input.pixel === pixelId(c.accountEmail) : input.accountEmail === c.accountEmail);
  let hit: { campaign: Campaign; via: "click" | "view"; slotKey: string | null } | null = null;
  if (input.clickId) {
    const click = await store.findClick(input.clickId);
    if (click) {
      const c = await store.getCampaign(click.campaignId);
      if (c && owns(c) && now - click.at.getTime() <= c.clickWindowDays * 864e5) hit = { campaign: c, via: "click", slotKey: click.slotKey };
    }
  }
  if (!hit && input.viewIds?.length) {
    const keys = input.viewIds.filter((v) => /^[A-Za-z0-9_-]{10,40}$/.test(v)).slice(0, 20).map((v) => `v:${v}`);
    for (const v of await store.findViews(keys)) {
      const c = await store.getCampaign(v.campaignId);
      if (c && owns(c) && now - v.at.getTime() <= c.viewWindowDays * 864e5) {
        hit = { campaign: c, via: "view", slotKey: v.slotKey };
        break;
      }
    }
  }
  if (!hit) return { attributed: false, reason: "no_matching_click_or_view" };
  const value = typeof input.value === "number" && Number.isFinite(input.value) && input.value >= 0 && input.value < 1e7 ? Math.round(input.value * MICROS) : null;
  const order = input.orderId ? hashRef(String(input.orderId).slice(0, 200)) : null;
  const dedupe = order ? `conv:${hit.campaign.id}:${order}` : `conv:${hit.campaign.id}:${input.clickId ?? input.viewIds?.[0]}:${Math.floor(now / 60_000)}`;
  const id = await store.insertEvent({
    kind: "conv", campaignId: hit.campaign.id, slotKey: hit.slotKey, dedupeKey: dedupe, valueMicros: value,
    currency: input.currency && /^[a-z]{3}$/i.test(input.currency) ? input.currency.toLowerCase() : null, attributedVia: hit.via, isTest: hit.campaign.isTest, at: new Date(now),
  });
  return id === null ? { attributed: true, via: hit.via, duplicate: true } : { attributed: true, via: hit.via };
}

/* --------------------------------------------------------------------------------------------- paid orders → draft campaigns */
const clean = (v: unknown, n = 160) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

/**
 * A paid Stripe checkout opens a DRAFT campaign holding the media credit. Nothing serves until an admin approves a
 * creative, sets the flight and activates it (insertion order before flight). Idempotent per Checkout Session.
 * Never throws, so the Stripe webhook always gets its 2xx.
 */
export async function draftCampaignFromCheckoutSafe(session: Stripe.Checkout.Session, opts: { isTest?: boolean } = {}): Promise<"created" | "exists" | "ignored" | "error"> {
  try {
    if (session.payment_status !== "paid") return "ignored";
    const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (!email) return "ignored";
    const md = session.metadata ?? {};
    const currency = session.currency === "cad" ? "cad" : "usd";
    const isTest = opts.isTest ?? (!session.livemode || isTestIdentity({ email, name: md.brand ?? null }));
    let budgetCents = session.amount_total ?? 0;
    let orderKind = "paid checkout";
    let exclusive = false;
    let mult = 10_000;
    let notes: string | null = null;
    if (md.kind === "sponsorship_credit") {
      budgetCents = Number(md.credit_cents) || budgetCents;
      orderKind = `sponsor pack ${md.tier ?? ""}`.trim();
    } else if (md.kind === "exclusive_reserve") {
      orderKind = "exclusive display reserve";
      exclusive = true;
      mult = EXCLUSIVE_RATE_BPS;
      notes = "Reserve deposit. The full package budget is set when the insertion order is signed.";
    } else if (md.sku === "hold-190" || md.offer === "hold-190") {
      orderKind = "7-day look ($190)";
    } else if (md.sku === "reserve-490" || md.offer === "reserve-490" || md.reservationId) {
      orderKind = `reserve ${md.sku ?? "490"}`;
    }
    if (budgetCents <= 0) return "ignored";
    const r = await store.createCampaign({
      accountEmail: email, brand: clean(md.brand || session.customer_details?.name || email.split("@")[1] || "Brand"), category: clean(md.category, 80) || null,
      orderRef: session.id, orderKind, currency, budgetMicros: budgetCents * 10_000, exclusive, rateMultiplierBps: mult, isTest, notes, actor: "stripe-webhook",
    });
    try {
      await afterOrderCampaign(session, { id: r.campaign.id, currency: r.campaign.currency, brand: r.campaign.brand }, isTest);
    } catch (err) {
      await store.audit("stripe-webhook", "promo.error", session.id, err instanceof Error ? err.message : String(err));
    }
    return r.created ? "created" : "exists";
  } catch {
    return "error";
  }
}

export { pixelId };
