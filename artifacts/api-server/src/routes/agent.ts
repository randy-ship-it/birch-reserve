/** Item 9: endpoints for AI buying agents. Checkout is gated by the existing env flags. */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { agentCard, agentCatalog, agentOpenApi, agentQuote, publicOffers, HANDOFF_EMAIL } from "../lib/overhaul/agent";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { AUDIENCE_LABEL, audienceMode, hubAudiences, ioRateGuidance, publicSummary, quoteAudience } from "../lib/overhaul/hubAudience";
import { BRAND_HUBS } from "../lib/overhaul/model";
import type { CreateSession } from "./overhaul";

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export function createAgentRouter(deps: { createSession?: CreateSession; log?: (msg: string, extra?: unknown) => void } = {}): IRouter {
  const router = Router();
  const log = deps.log ?? (() => {});
  const cors = (_req: Request, res: Response, next: () => void) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    next();
  };

  router.get("/v1/agent/catalog.json", cors, (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.json(agentCatalog());
  });

  router.get("/v1/agent/quote", cors, async (req, res) => {
    const q = agentQuote({ offer: str(req.query.offer, 40) });
    res.set("Cache-Control", "no-store");
    const hubKey = str(req.query.hub, 60);
    if (!q.ok || !hubKey) {
      res.status(q.ok ? 200 : 400).json(q);
      return;
    }
    const hub = BRAND_HUBS.find((h) => h.key === hubKey);
    if (!hub) {
      res.status(400).json({ ok: false, error: "Unknown hub." });
      return;
    }
    // Hub-reported audience (Friday): pricing and targeting only. The SKU amount above never changes.
    const a = (await hubAudiences()).get(hub.key) ?? null;
    const mode = audienceMode(process.env, req.query.audience_mode);
    res.json({
      ...q,
      hub: { key: hub.key, name: hub.name },
      hub_audience: a ? quoteAudience(a) : null,
      io_rate_guidance: ioRateGuidance(a, str(req.query.category, 80)),
      ...(mode === "summary" ? { public_summary: publicSummary(a) } : {}),
      audience_mode: mode,
    });
  });

  // Public listing summaries. Mode "private" (default) returns no items: nothing renders on public pages.
  router.get("/v1/hubs/audience-summaries", cors, async (req, res) => {
    const mode = audienceMode(process.env, req.query.audience_mode);
    res.set("Cache-Control", mode === "summary" ? "public, max-age=300" : "no-store");
    if (mode !== "summary") {
      res.json({ mode, label: AUDIENCE_LABEL, items: [] });
      return;
    }
    const map = await hubAudiences();
    const items = [...map.entries()].map(([hub_key, a]) => ({ hub_key, summary: publicSummary(a) })).filter((i) => i.summary);
    res.json({ mode, label: AUDIENCE_LABEL, items });
  });

  router.get("/v1/agent/openapi.json", cors, (_req, res) => res.json(agentOpenApi()));
  router.get("/.well-known/agent.json", cors, (_req, res) => res.json(agentCard()));
  router.options(["/v1/agent/checkout", "/v1/agent/quote"], cors, (_req, res) => res.status(204).end());

  // Agent checkout is on hold (Randy, Nov 17 2026): record the request, never charge. Humans pay on /buycalc.
  router.post("/v1/agent/checkout", cors, express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const offer = publicOffers().find((o) => o.offer_key === str(body.offer, 40));
    if (!offer) {
      res.status(400).json({ status: "error", error: "Unknown offer. Use hold-190 or reserve-490 (GET /v1/agent/catalog.json)." });
      return;
    }
    const email = str(body.email, 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.agree !== true) {
      res.status(400).json({ status: "error", error: "Send a valid email and agree:true after showing the buyer the terms and price." });
      return;
    }
    let stored = "skipped";
    try {
      const friday = await sendIntake({
        kind: "agent_checkout",
        email,
        company: str(body.brand, 160) || undefined,
        website: str(body.website, 200) || undefined,
        path: "/v1/agent/checkout",
        meta: { offer: offer.offer_key, agent: str(body.agent, 120) || undefined, checkout_open: false, amount: offer.price_usd, currency: "usd", channel: "ai_agent" },
      });
      stored = friday.status;
    } catch (err) {
      log("agent checkout intake failed", err);
    }
    res.status(202).json({ status: "held", offer: offer.offer_key, amount: offer.price_usd, currency: "usd", human_checkout: offer.human_checkout, message: `Agent checkout is on hold. Request recorded; we'll reply from ${HANDOFF_EMAIL}. No charge was made. The buyer can pay now at human_checkout.`, stored });
  });

  return router;
}
