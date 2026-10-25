import type { Request } from "express";
import {
  RESERVE_CURRENCY,
  parseReserveCurrency,
  type ReserveCurrency,
} from "./reserveOffers";

export const CURRENCY_COOKIE = "br_currency";

/** Edge/CDN headers that carry the visitor's ISO country. First match wins. */
const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-appengine-country",
  "x-country-code",
] as const;

export type CurrencyDecision = {
  currency: ReserveCurrency;
  country: string | null;
  /** Why this currency was chosen. */
  source: "query" | "cookie" | "country" | "default";
};

function headerValue(req: Pick<Request, "headers">, name: string): string | null {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function visitorCountry(req: Pick<Request, "headers">): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = headerValue(req, name)?.toUpperCase();
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") {
      return value;
    }
  }
  return null;
}

export function readCurrencyCookie(req: Pick<Request, "headers">): ReserveCurrency | null {
  const cookie = headerValue(req, "cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === CURRENCY_COOKIE) {
      return parseReserveCurrency(decodeURIComponent(part.slice(eq + 1).trim()));
    }
  }
  return null;
}

/**
 * Visible choice wins (query, then cookie), then Canada -> CAD, everyone else
 * (and unknown country) -> USD.
 */
export function decideCurrency(req: Pick<Request, "headers" | "query">): CurrencyDecision {
  const country = visitorCountry(req);
  const query = parseReserveCurrency(
    typeof req.query?.["currency"] === "string" ? req.query["currency"] : undefined,
  );
  if (query) return { currency: query, country, source: "query" };
  const cookie = readCurrencyCookie(req);
  if (cookie) return { currency: cookie, country, source: "cookie" };
  if (country === "CA") return { currency: "cad", country, source: "country" };
  return { currency: RESERVE_CURRENCY, country, source: "default" };
}

export function currencyCookieHeader(currency: ReserveCurrency): string {
  return `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}
