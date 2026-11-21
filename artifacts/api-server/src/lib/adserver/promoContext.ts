/**
 * Request-scoped street team + promo context (cookies br_st / br_pc, set first-party by the site for 30 days, last touch).
 * Read by the Stripe session builders so every Checkout Session carries st / promo / site in its metadata.
 * No imports: safe to load from anywhere.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

export type PromoCtx = { st: string | null; code: string | null; site: "birch" | "scale" };
const als = new AsyncLocalStorage<PromoCtx>();

export const ST_COOKIE = "br_st";
export const PC_COOKIE = "br_pc";
export const MEMBER_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
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

export function promoCtxOf(req: Pick<Request, "get" | "query">): PromoCtx {
  // The x-br-attr header (set by the site script on same-origin API calls) wins over cookies: cookies do not survive every proxy path (Scale mirror).
  const hdr = new URLSearchParams(req.get("x-br-attr") ?? "");
  const st = (hdr.get("st") ?? cookieOf(req, ST_COOKIE) ?? "").trim().toLowerCase();
  const code = (hdr.get("code") ?? cookieOf(req, PC_COOKIE) ?? "").trim().slice(0, 40);
  return { st: MEMBER_RE.test(st) ? st : null, code: /^[A-Za-z0-9 _-]{2,40}$/.test(code) ? code : null, site: siteOf(req) };
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
  if (c.code) out.promo = c.code;
  if (c.st || c.code) out.site = c.site;
  return out;
}
