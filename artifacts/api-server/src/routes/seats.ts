/**
 * Category seats API (Randy, Nov 12 2026). Standalone (no DB imports).
 *
 *  GET  /v1/seats/availability.json   live seat availability (Friday -> BR ledger -> call to confirm)
 *  GET  /v1/seats/catalog.json        seat SKUs, impression blocks, contact (public-safe)
 *  POST /v1/seats/request             hold | lock | waitlist | lock_request | block_request
 *        -> Friday intake (org=birchreserve) + instant email alert to Randy + sales.
 *        -> hold/lock open Stripe Checkout only when SEATS_ENABLED (+ SEATS_LIVE for live keys);
 *           otherwise "Reserved by inquiry; we'll confirm within 1 business day."
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { BLOCK_NOTE, CONTACT, HELD_MESSAGE, IMPRESSION_BLOCKS, SEAT_CATEGORIES, SEAT_SKUS, blockByKey, categoryBySlug, seatSku, SEATS_VERSION } from "../lib/seats/catalog";
import { getSeatAvailability } from "../lib/seats/availability";
import { buildSeatSession, seatsGate } from "../lib/seats/checkout";
import { sendIntakeAndAlert, type IntakeKind } from "../lib/overhaul/fridayIntake";
import { torontoTime } from "../lib/seats/alerts";
import type { CreateSession } from "./overhaul";

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIONS = ["hold", "lock", "waitlist", "lock_request", "block_request"] as const;
type Action = (typeof ACTIONS)[number];
const KIND: Record<Action, IntakeKind> = {
  hold: "seat_hold",
  lock: "seat_lock",
  waitlist: "seat_waitlist",
  lock_request: "seat_lock_request",
  block_request: "seat_block_request",
};

const hits = new Map<string, number[]>();
function limited(req: Request, max = 8, windowMs = 60_000): boolean {
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",").pop()!.trim() || "anon";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

function normalizeSite(v: string): string | undefined {
  if (!v) return undefined;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return u.hostname.includes(".") ? u.toString().slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}

export function seatsCatalog() {
  return {
    version: SEATS_VERSION,
    categories: SEAT_CATEGORIES,
    one_brand_per_category: true,
    skus: SEAT_SKUS.map((s) => ({ sku: s.sku, name: s.name, action: s.action, prices: { usd: s.usd, cad: s.cad }, media_credit: true, terms: s.line })),
    impression_blocks: IMPRESSION_BLOCKS.map((b) => ({ key: b.key, name: `${b.name} · ${b.views.toLocaleString("en-US")} views`, surface: b.surface, surface_label: b.surfaceLabel, views_estimated: b.views, starter_cpm_usd: b.starterCpmUsd, prices: { usd: b.usd, cad: b.cad }, guaranteed: false })),
    block_note: BLOCK_NOTE,
    rules: ["No impression guarantees.", "Aggregate reporting only.", "Estimates are labelled as estimates.", "No PHI, no clinical pixels."],
    endpoints: { availability: "/v1/seats/availability.json", request: "POST /v1/seats/request" },
    contact: { phone: CONTACT.phoneDisplay, tel: CONTACT.tel, email: CONTACT.email },
  };
}

export function createSeatsRouter(deps: { createSession?: CreateSession; log?: (msg: string, extra?: unknown) => void } = {}): IRouter {
  const router: IRouter = Router();
  const log = deps.log ?? (() => undefined);
  const cors = (_req: Request, res: Response, next: () => void) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    next();
  };

  router.get("/v1/seats/availability.json", cors, async (_req, res) => {
    const a = await getSeatAvailability();
    res.set("Cache-Control", "public, max-age=30");
    res.json({ ...a, checkout: seatsGate().open && !!deps.createSession ? "open" : "held" });
  });

  router.get("/v1/seats/catalog.json", cors, (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.json(seatsCatalog());
  });

  router.options("/v1/seats/request", cors, (_req, res) => res.status(204).end());

  router.post("/v1/seats/request", cors, express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Honeypot: bots fill "company_url"; answer like a success, send nothing.
    if (str(body.company_url, 200)) {
      res.json({ ok: true, held: true, message: HELD_MESSAGE });
      return;
    }
    if (limited(req)) {
      res.status(429).json({ error: `Too many requests. Call ${CONTACT.phoneDisplay} and we'll hold it by phone.` });
      return;
    }
    const action = str(body.action, 20) as Action;
    if (!ACTIONS.includes(action)) {
      res.status(400).json({ error: "Unknown action." });
      return;
    }
    const email = str(body.email, 320);
    const brand = str(body.brand, 160);
    const phone = str(body.phone, 40);
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Add a work email so we can confirm." });
      return;
    }
    if (!brand) {
      res.status(400).json({ error: "Add your brand or business name." });
      return;
    }
    const cat = categoryBySlug(body.category);
    const block = action === "block_request" ? blockByKey(body.block) : undefined;
    if (action === "block_request" && !block) {
      res.status(400).json({ error: "Pick an impression block." });
      return;
    }
    if (action !== "block_request" && !cat) {
      res.status(400).json({ error: "Pick your category." });
      return;
    }
    const sku = action === "hold" ? "hold-190" : action === "lock" ? "reserve-490" : action === "lock_request" ? (seatSku(body.sku)?.sku ?? "reserve-490") : action === "block_request" ? block!.key : seatSku(body.sku)?.sku;
    const currency = str(body.currency, 3).toLowerCase() === "cad" ? "cad" : "usd";
    const offer = seatSku(sku);
    const amount = offer ? (currency === "cad" ? offer.cad : offer.usd) : block ? (currency === "cad" ? block.cad : block.usd) : undefined;
    const test = body.test === true || body.is_test === true;
    const website = normalizeSite(str(body.website, 300));
    const at = new Date();
    const availability = await getSeatAvailability();
    const catStatus = cat ? availability.categories.find((c) => c.slug === cat.slug)?.status ?? "unknown" : undefined;
    const gate = seatsGate();
    const wantsCheckout = (action === "hold" || action === "lock") && catStatus === "open";
    const checkoutOpen = wantsCheckout && gate.open && !!deps.createSession;

    const result = await sendIntakeAndAlert(
      {
        kind: KIND[action],
        email,
        name: str(body.name, 120) || undefined,
        company: brand,
        phone: phone || undefined,
        website,
        message: str(body.message, 2000) || undefined,
        path: str(body.path, 200) || undefined,
        meta: {
          category: cat?.slug,
          category_label: cat?.label,
          sku,
          amount,
          currency,
          paid: false,
          lead_source: `birch-seats-${action.replace(/_/g, "-")}`,
          timing: str(body.timing, 80) || undefined,
          block_views_estimated: block?.views,
          availability_source: availability.source,
          category_status: catStatus,
          waitlist_if_taken: body.waitlist_if_taken === true || undefined,
          checkout_open: checkoutOpen,
          time_toronto: torontoTime(at),
          is_test: test || undefined,
        },
        utm: (() => {
          const u = (body.utm ?? {}) as Record<string, unknown>;
          return { utm_source: str(u.utm_source, 120) || undefined, utm_medium: str(u.utm_medium, 120) || undefined, utm_campaign: str(u.utm_campaign, 120) || undefined };
        })(),
      },
      {
        category: cat?.label ?? (block ? `${block.name} (${block.surfaceLabel})` : undefined),
        amount: amount !== undefined ? `$${amount.toLocaleString("en-US")} ${currency.toUpperCase()}` : undefined,
        checkout: checkoutOpen ? "opening Stripe checkout" : wantsCheckout ? "held (checkout off): reserved by inquiry" : "n/a (request)",
        at,
        test,
        extra: { "Category status": catStatus, "Availability source": availability.source, "Waitlist if taken": body.waitlist_if_taken === true ? "yes" : undefined, Timing: str(body.timing, 80) || undefined },
      },
    );
    log("seat request", { action, category: cat?.slug, sku, friday: result.status, alert: result.alert.status });

    const base = { ok: true, action, category: cat?.slug ?? null, sku, stored: result.status, alerted: result.alert.status };
    if (checkoutOpen) {
      const built = buildSeatSession({ sku, category: cat!.slug, brand, email, website, currency, test }, originOf(req));
      if (built.ok) {
        try {
          const session = await deps.createSession!(built.params);
          res.json({ ...base, held: false, checkout_url: session.url });
          return;
        } catch (err) {
          log("seat checkout failed", err);
        }
      }
    }
    const message =
      action === "waitlist"
        ? `You're on the waitlist for ${cat!.label}. We'll call you the moment it opens.`
        : action === "block_request"
          ? `Block request saved. We'll confirm supply and send the insertion order within 1 business day.`
          : action === "lock_request"
            ? `Lock request saved for ${cat!.label}. ${HELD_MESSAGE}`
            : catStatus === "open"
              ? HELD_MESSAGE
              : `We'll confirm ${cat!.label} with you today. ${HELD_MESSAGE}`;
    res.json({ ...base, held: true, message, phone: CONTACT.phoneDisplay });
  });

  return router;
}

function originOf(req: Request): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "birchreserve.net");
  return `https://${host}`;
}
