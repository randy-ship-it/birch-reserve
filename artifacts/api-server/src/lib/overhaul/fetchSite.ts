/** Server-side site fetch for the match tool: SSRF-guarded, size- and time-capped. */
import { lookup } from "node:dns/promises";
import { emptySignals, extractSignals, isPrivateAddress, type SiteSignals } from "./audienceMatch";

const UA = "Mozilla/5.0 (compatible; BirchReserveMatch/1.0; +https://birchreserve.net/match)";
const MAX_BYTES = 1_500_000;

async function guardedFetch(url: string, timeoutMs: number): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("blocked_address");
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.5", "accept-language": "en-CA,en;q=0.9" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("too_many_redirects");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export async function fetchSiteSignals(url: string): Promise<SiteSignals> {
  try {
    const res = await guardedFetch(url, 8000);
    if (!res.ok) {
      return emptySignals(url, res.status === 403 || res.status === 429 ? "Your site blocks automated visitors, so we scored from your URL and description." : `Your site answered ${res.status}, so we scored from your URL and description.`);
    }
    const html = await readCapped(res);
    let products: string[] = [];
    let categories: string[] = [];
    if (/cdn\.shopify\.com|myshopify/i.test(html)) {
      try {
        const pj = await guardedFetch(new URL("/products.json?limit=40", url).toString(), 5000);
        if (pj.ok) {
          const data = JSON.parse(await readCapped(pj)) as { products?: Array<{ title?: string; product_type?: string; tags?: string[] | string }> };
          products = (data.products ?? []).map((p) => String(p.title ?? "")).filter(Boolean);
          categories = (data.products ?? []).map((p) => String(p.product_type ?? "")).filter(Boolean);
        }
      } catch {
        /* optional */
      }
    }
    const s = extractSignals(url, html, products, categories);
    if (s.body.length < 200 && !s.title) s.fetchNote = "Your site renders mostly in JavaScript, so we read what we could plus your description.";
    return s;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return emptySignals(url, msg === "blocked_address" ? "That address isn't a public website." : "We couldn't reach your site in time, so we scored from your URL and description.");
  }
}
