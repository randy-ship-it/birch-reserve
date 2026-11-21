/**
 * Request-scoped street team + promo context (cookies br_st / br_pc / br_qr, set first-party by the site for 30 days, last touch;
 * see docs/ads/ARCHITECTURE.md "Referral attribution").
 * Read by the Stripe session builders so every Checkout Session carries st / promo / site in its metadata.
 * No imports: safe to load from anywhere.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

export type PromoCtx = { st: string | null; code: string | null; site: "birch" | "scale"; qr?: string | null };
const als = new AsyncLocalStorage<PromoCtx>();

export const ST_COOKIE = "br_st";
export const PC_COOKIE = "br_pc";
export const QR_COOKIE = "br_qr";
export const MEMBER_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
/** QR / link label carried with a member (e.g. "scale-intake-digital"). */
export const QR_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const SCALE_HOSTS = new Set(["scalehealth.ca", "www.scalehealth.ca"]);

function cookieOf(req: Pick<Request, "get">, name: string): string | null {
  const raw = req.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) {
      try {
        return decodeURIComponent(part.slice(i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function siteOf(req: Pick<Request, "get" | "query">): "birch" | "scale" {
  for (const h of ["origin", "referer"]) {
    const v = req.get(h);
    if (!v) continue;
    try {
      if (SCALE_HOSTS.has(new URL(v).host)) return "scale";
    } catch {
      /* ignore */
    }
  }
  return String(req.query?.br_mirror ?? "") === "scale" ? "scale" : "birch";
}

/** Origin that carries Scale mirror traffic back from Stripe (the request's own Scale host, else scalehealth.ca). */
export function scaleOriginOf(req: Pick<Request, "get" | "query">): string {
  for (const h of ["origin", "referer"]) {
    try {
      const u = new URL(req.get(h) ?? "");
      if (SCALE_HOSTS.has(u.host)) return `https://${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return "https://scalehealth.ca";
}

/** A Birch path for a redirect: through /intake/_m on the Scale mirror, unchanged on birchreserve.net. */
export function mirrorPathOf(req: Pick<Request, "get" | "query">, path: string): string {
  return siteOf(req) === "scale" ? `/intake/_m${path}` : path;
}

/** Base for Stripe return URLs: the Scale mirror when the checkout started there, else the given Birch base. */
export function returnBaseOf(req: Pick<Request, "get" | "query">, birchBase: string): string {
  return siteOf(req) === "scale" ? `${scaleOriginOf(req)}/intake/_m` : birchBase;
}

/** Checkout started from the Scale mirror returns to the matching scalehealth.ca/intake/_m page, not birchreserve.net. */
export function withScaleReturn<T extends { success_url?: string | null; cancel_url?: string | null }>(req: Pick<Request, "get" | "query">, params: T): T {
  if (siteOf(req) !== "scale") return params;
  const base = `${scaleOriginOf(req)}/intake/_m`;
  const swap = (u?: string | null) => (u ? u.replace(/^https?:\/\/[^/]+/, base) : u);
  return { ...params, success_url: swap(params.success_url), cancel_url: swap(params.cancel_url) };
}

export function promoCtxOf(req: Pick<Request, "get" | "query">): PromoCtx {
  // The x-br-attr header (set by the site script on same-origin API calls) wins over cookies: cookies do not survive every proxy path (Scale mirror).
  const hdr = new URLSearchParams(req.get("x-br-attr") ?? "");
  const st = (hdr.get("st") ?? cookieOf(req, ST_COOKIE) ?? "").trim().toLowerCase();
  const code = (hdr.get("code") ?? cookieOf(req, PC_COOKIE) ?? "").trim().slice(0, 40);
  // The QR label always travels with the member it came from (header pair, or cookie pair), never mixed.
  const qr = ((hdr.has("st") ? hdr.get("qr") : cookieOf(req, QR_COOKIE)) ?? "").trim().toLowerCase();
  const okSt = MEMBER_RE.test(st);
  return { st: okSt ? st : null, code: /^[A-Za-z0-9 _-]{2,40}$/.test(code) ? code : null, site: siteOf(req), qr: okSt && QR_RE.test(qr) ? qr : null };
}

export function promoContext() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    als.run(promoCtxOf(req), next);
  };
}

export const currentPromoCtx = (): PromoCtx | undefined => als.getStore();

/** Stripe metadata for the current request (empty when there is nothing to carry). */
export function promoMetadata(): Record<string, string> {
  const c = als.getStore();
  if (!c) return {};
  const out: Record<string, string> = {};
  if (c.st) out.st = c.st;
  if (c.st && c.qr) out.st_qr = c.qr;
  if (c.code) out.promo = c.code;
  if (c.st || c.code) out.site = c.site;
  // Randy, Nov 21 2026 4:30 PM: a checkout started on the Scale mirror is Scale Health direct (5% channel), going forward only.
  // Stamped at session creation so sessions opened before this shipped keep Birch; the webhook reads it (service.ts).
  if (c.site === "scale") {
    out.site = "scale";
    out.sold_by = "scale";
  }
  return out;
}

/** Merge the request's referral metadata into Checkout Session params. */
export function withPromoMetadata<T>(params: T): T {
  const carried = promoMetadata();
  if (!Object.keys(carried).length || !params || typeof params !== "object") return params;
  const p = params as { metadata?: Record<string, string> | null };
  return { ...params, metadata: { ...(p.metadata ?? {}), ...carried } };
}
