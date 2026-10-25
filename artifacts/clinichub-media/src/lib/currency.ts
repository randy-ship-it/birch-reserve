/**
 * Visitor currency for the two public SKUs (USD or CAD).
 *
 * The server decides (GET /api/currency: ?currency, then the br_currency
 * cookie, then Canada -> CAD, else USD). A visible toggle lets anyone switch;
 * the choice is saved in a cookie and localStorage so no one is stuck.
 * The currency a visitor sees is sent with the checkout request, so the page
 * and the Stripe page always agree.
 */
import { useSyncExternalStore } from "react";

export type Currency = "usd" | "cad";
export const CURRENCIES: readonly Currency[] = ["usd", "cad"] as const;
export const CURRENCY_COOKIE = "br_currency";

type Prices = Record<string, Record<Currency, number>>;

/** Fallback only. The live numbers come from the server (single source of truth). */
const DEFAULT_PRICES: Prices = {
  "hold-190": { usd: 190, cad: 270 },
  "reserve-490": { usd: 490, cad: 690 },
};

export function parseCurrency(value: unknown): Currency | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "usd" || v === "cad" ? v : null;
}

function readStored(): Currency | null {
  try {
    const fromStorage = parseCurrency(window.localStorage.getItem(CURRENCY_COOKIE));
    if (fromStorage) return fromStorage;
  } catch {
    /* storage can be blocked */
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]+)`));
  return m ? parseCurrency(decodeURIComponent(m[1]!)) : null;
}

function persist(currency: Currency): void {
  try {
    window.localStorage.setItem(CURRENCY_COOKIE, currency);
  } catch {
    /* ignore */
  }
  document.cookie = `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

type State = { currency: Currency; prices: Prices };
let state: State = { currency: "usd", prices: DEFAULT_PRICES };
let started = false;
const listeners = new Set<() => void>();

function emit(next: State): void {
  state = next;
  listeners.forEach((l) => l());
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const params = new URLSearchParams(window.location.search);
  const forced = parseCurrency(params.get("currency"));
  const stored = forced ?? readStored();
  if (forced) persist(forced);
  if (stored) emit({ ...state, currency: stored });
  void fetch(`/api/currency${forced ? `?currency=${forced}` : ""}`, {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: unknown) => {
      if (!data || typeof data !== "object") return;
      const d = data as { currency?: unknown; prices?: Record<string, Record<string, { dueToday?: number }>> };
      const prices: Prices = { ...state.prices };
      for (const [sku, byCurrency] of Object.entries(d.prices ?? {})) {
        const usd = byCurrency?.["usd"]?.dueToday;
        const cad = byCurrency?.["cad"]?.dueToday;
        if (typeof usd === "number" && typeof cad === "number") prices[sku] = { usd, cad };
      }
      // A saved choice wins over geography; otherwise take the server's decision.
      const next = readStored() ?? parseCurrency(d.currency) ?? state.currency;
      emit({ currency: next, prices });
    })
    .catch(() => undefined);
}

export function setCurrency(currency: Currency): void {
  persist(currency);
  emit({ ...state, currency });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void; prices: Prices } {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return { currency: snapshot.currency, setCurrency, prices: snapshot.prices };
}

export function priceFor(sku: string, currency: Currency, prices: Prices = state.prices): number {
  return (prices[sku] ?? DEFAULT_PRICES[sku] ?? DEFAULT_PRICES["reserve-490"]!)[currency];
}

/** "$270 CAD" / "$190 USD" */
export function priceLabel(sku: string, currency: Currency, prices?: Prices): string {
  return `$${priceFor(sku, currency, prices).toLocaleString("en-US")} ${currency.toUpperCase()}`;
}

/**
 * Rewrite hard-coded USD price copy for the visitor's currency. "$490 USD" and a
 * bare "$490" become the CAD seat price; "$190" likewise. USD copy is unchanged.
 */
export function localizePrices(text: string, currency: Currency, prices: Prices = state.prices): string {
  if (currency === "usd") return text;
  let out = text;
  for (const [sku, usd] of [["hold-190", 190], ["reserve-490", 490]] as const) {
    const label = priceLabel(sku, currency, prices);
    out = out.split(`$${usd} USD`).join(label);
    out = out.replace(new RegExp(`\\$${usd}(?![0-9,.])`, "g"), label);
  }
  return out;
}

/** Hook form: `const t = usePriceText(); t("Reserve — $490")`. */
export function usePriceText(): (text: string) => string {
  const { currency, prices } = useCurrency();
  return (text: string) => localizePrices(text, currency, prices);
}

/** Non-hook form for strings built inside event handlers (chat bubbles). */
export function localizeNow(text: string): string {
  start();
  return localizePrices(text, state.currency, state.prices);
}
