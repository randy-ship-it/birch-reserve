/**
 * GET/QUERY /.well-known/search and /api/search: read-only search over public page copy (lib/agentSearch.ts).
 * QUERY is RFC 10008: the criteria ride in the body (plain text or JSON {"q","limit"}), safe and idempotent.
 */
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { SEARCH_ALIAS_PATH, SEARCH_PATH, agentSearch, searchMarkdown } from "../lib/agentSearch";

const router: IRouter = Router();
const MAX_BODY = 4096;
const WINDOW_MS = 60_000;
const LIMIT = 60;
const hits = new Map<string, { n: number; reset: number }>();

/** Best-effort per-instance limiter. The CDN absorbs repeats (s-maxage on GET); this stops a tight loop on one instance. */
export function rateCheck(key: string, now = Date.now()): { ok: boolean; remaining: number; retryAfter: number } {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  let e = hits.get(key);
  if (!e || e.reset < now) hits.set(key, (e = { n: 0, reset: now + WINDOW_MS }));
  e.n += 1;
  return { ok: e.n <= LIMIT, remaining: Math.max(0, LIMIT - e.n), retryAfter: Math.max(1, Math.ceil((e.reset - now) / 1000)) };
}

function readBody(req: Request): Promise<string> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

function common(res: Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, QUERY, HEAD, OPTIONS");
  res.set("Access-Control-Allow-Headers", "content-type, accept");
  res.set("Access-Control-Max-Age", "86400");
  res.set("Allow", "GET, QUERY, HEAD, OPTIONS");
  res.set("Accept-Query", '"application/json", "text/plain"');
  res.set("X-Robots-Tag", "noindex");
}

async function handle(req: Request, res: Response, _next: NextFunction) {
  common(res);
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") return void res.status(204).end();
  if (method !== "GET" && method !== "HEAD" && method !== "QUERY") {
    return void res.status(405).json({ error: "Use GET ?q=... or QUERY with a text/JSON body." });
  }
  const ip = req.ip || req.socket.remoteAddress || "anon";
  const rate = rateCheck(ip);
  res.set("RateLimit-Limit", String(LIMIT));
  res.set("RateLimit-Remaining", String(rate.remaining));
  res.set("RateLimit-Reset", String(rate.retryAfter));
  if (!rate.ok) {
    res.set("Retry-After", String(rate.retryAfter));
    res.set("Cache-Control", "no-store");
    return void res.status(429).json({ error: "Rate limit reached. Retry after the Retry-After seconds." });
  }

  let q = String(req.query.q ?? "");
  let limit = Number(req.query.limit) || 5;
  let wantMd = req.query.format === "md";
  if (method === "QUERY") {
    const raw = (await readBody(req)).trim();
    const type = String(req.headers["content-type"] ?? "");
    if (raw && (/json/i.test(type) || raw.startsWith("{"))) {
      try {
        const j = JSON.parse(raw) as { q?: unknown; query?: unknown; limit?: unknown };
        q = String(j.q ?? j.query ?? q);
        limit = Number(j.limit) || limit;
      } catch {
        return void res.status(400).json({ error: 'Body is not valid JSON. Send {"q":"..."} or plain text.' });
      }
    } else if (raw) {
      q = raw;
    }
  }
  const accept = String(req.headers.accept ?? "");
  if (/text\/markdown/i.test(accept) && !/application\/json/i.test(accept)) wantMd = true;
  q = q.trim().slice(0, 300);
  if (!q) {
    return void res.status(400).json({ error: "Missing q. Example: /.well-known/search?q=how+do+I+buy", example: `${SEARCH_PATH}?q=rate+card` });
  }
  const results = agentSearch(q, limit);
  res.vary("Accept");
  res.set("Cache-Control", method === "QUERY" ? "public, max-age=60" : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  if (wantMd) return void res.type("text/markdown; charset=utf-8").send(searchMarkdown(q, results));
  res.json({ query: q, count: results.length, results, source: "Public pages only. See https://birchreserve.net/llms.txt" });
}

router.all([SEARCH_PATH, SEARCH_ALIAS_PATH], (req, res, next) => {
  void handle(req, res, next);
});

export default router;
