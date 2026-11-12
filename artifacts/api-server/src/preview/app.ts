/**
 * Preview-only server for birch-reserve-cad-preview: no DB, no Clerk, no live Stripe.
 * Serves the overhaul API, /sponsor + /kit, /api/currency, llms.txt, sitemap and
 * SPA shells with per-route SEO heads. Production keeps using src/app.ts.
 */
import express, { type Express } from "express";
import { createOverhaulRouter } from "../routes/overhaul";
import { createAgentRouter } from "../routes/agent";
import sponsorPageRouter from "../routes/sponsorPage";
import { getStripeClient } from "../lib/stripeClient";
import { decideCurrency, currencyCookieHeader } from "../lib/currency";
import { PUBLIC_RESERVE_OFFERS, RESERVE_CURRENCIES, offerAmountCents, offerPriceLabel } from "../lib/reserveOffers";
import { PUBLIC_SITEMAP_PATHS, SPA_SHELL_PATHS, normalizedPath, sitemapXml, withRouteSeo } from "../lib/publicSeo";
import { llmsTxt } from "../lib/overhaul/seo";

export function createPreviewApp(indexHtml: string): Express {
  const app = express();
  app.set("trust proxy", true);
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex"); // preview host only
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use(
    createOverhaulRouter({
      createSession: async (params) => {
        const s = await getStripeClient().checkout.sessions.create(params as never);
        return { url: s.url, livemode: s.livemode };
      },
      log: (msg, extra) => console.log(`overhaul ${msg}`, extra ?? ""),
    }),
  );
  app.use(
    createAgentRouter({
      createSession: async (params) => {
        const s = await getStripeClient().checkout.sessions.create(params as never);
        return { url: s.url, livemode: s.livemode };
      },
    }),
  );
  app.use(sponsorPageRouter);
  app.get("/api/currency", (req, res) => {
    const d = decideCurrency(req);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      currency: d.currency,
      country: d.country,
      source: d.source,
      prices: Object.fromEntries(
        PUBLIC_RESERVE_OFFERS.map((o) => [o.sku, Object.fromEntries(RESERVE_CURRENCIES.map((c) => [c, { amountCents: offerAmountCents(o, c), dueToday: offerAmountCents(o, c) / 100, label: offerPriceLabel(o, c) }]))]),
      ),
    });
  });
  app.post("/api/currency", (req, res) => {
    const c = String((req.body as { currency?: string })?.currency ?? "").toLowerCase();
    if (c === "cad" || c === "usd") res.setHeader("Set-Cookie", currencyCookieHeader(c));
    res.json({ ok: true });
  });
  app.post("/v1/ui-events", (_req, res) => res.status(204).end());
  app.get("/llms.txt", (_req, res) => res.type("text/plain").send(llmsTxt()));
  app.get("/sitemap.xml", (_req, res) => res.type("application/xml").send(sitemapXml(PUBLIC_SITEMAP_PATHS)));
  app.get("/robots.txt", (_req, res) => res.type("text/plain").send("User-agent: *\nDisallow: /\n"));
  const shells = new Set<string>([...SPA_SHELL_PATHS, "/"]);
  app.get(/.*/, (req, res) => {
    const p = normalizedPath(req.path);
    if (!shells.has(p) && !p.startsWith("/insights")) {
      res.status(200).type("html").send(indexHtml); // SPA handles its own 404
      return;
    }
    res.type("html").setHeader("Cache-Control", "no-store").send(withRouteSeo(indexHtml, p));
  });
  return app;
}
