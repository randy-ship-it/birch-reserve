/** Item 9: endpoints for AI buying agents. Checkout is gated by the existing env flags. */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { agentCard, agentCatalog, agentOpenApi, agentQuote, HANDOFF_EMAIL } from "../lib/overhaul/agent";
import { buildAreaLockSession, checkoutGate } from "../lib/overhaul/checkout";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { SLOT_LADDER } from "../lib/overhaul/model";
import { PREMIUM_INQUIRY_MESSAGE, isPremiumOffer } from "../lib/premiumInquireOnly";
import { buildDepositSession } from "./sponsorPage";
import type { CreateSession } from "./overhaul";

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

function gates() {
  const slots = checkoutGate(process.env, "SPONSOR_DEPOSITS_ENABLED", "SPONSOR_DEPOSITS_LIVE");
  const area = checkoutGate(process.env, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE");
  return { slots, area };
}

export function createAgentRouter(deps: { createSession?: CreateSession; log?: (msg: string, extra?: unknown) => void } = {}): IRouter {
  const router = Router();
  const log = deps.log ?? (() => {});
  const cors = (_req: Request, res: Response, next: () => void) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    next();
  };

  router.get("/v1/agent/catalog.json", cors, (_req, res) => {
    const g = gates();
    res.set("Cache-Control", "public, max-age=300");
    res.json(agentCatalog({ slotsCheckout: g.slots.open && !!deps.createSession, areaLockCheckout: g.area.open && !!deps.createSession && !isPremiumOffer("area-lock") }));
  });

  router.get("/v1/agent/quote", cors, (req, res) => {
    const q = agentQuote({ offer: str(req.query.offer, 40), currency: str(req.query.currency, 3), postal: str(req.query.postal, 12), term: str(req.query.term, 2) || undefined });
    res.set("Cache-Control", "no-store");
    res.status(q.ok ? 200 : 400).json(q);
  });

  router.get("/v1/agent/openapi.json", cors, (_req, res) => res.json(agentOpenApi()));
  router.get("/.well-known/agent.json", cors, (_req, res) => res.json(agentCard()));
  router.options(["/v1/agent/checkout", "/v1/agent/quote"], cors, (_req, res) => res.status(204).end());

  router.post("/v1/agent/checkout", cors, express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const offer = str(body.offer, 40);
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "birchreserve.net");
    const origin = `https://${host}`;
    const g = gates();
    let built: ReturnType<typeof buildAreaLockSession>;
    let gateOpen: boolean;
    if (offer === "area-lock") {
      built = buildAreaLockSession(body, origin);
      gateOpen = g.area.open;
    } else {
      const slot = SLOT_LADDER.find((s) => s.key === offer);
      if (!slot) {
        res.status(400).json({ status: "error", error: "Unknown offer. GET /v1/agent/catalog.json for offer keys." });
        return;
      }
      const cur = str(body.currency, 3).toLowerCase() === "cad" ? "cad" : "usd";
      built = buildDepositSession(
        slot.bonusPct ? { tier: slot.key, currency: cur, brand: str(body.brand, 160), email: str(body.email, 200), agree: body.agree === true } : { amount: cur === "cad" ? slot.cad : slot.usd, currency: cur, brand: str(body.brand, 160), email: str(body.email, 200), agree: body.agree === true },
        origin,
      );
      gateOpen = g.slots.open;
    }
    if (!built.ok) {
      res.status(400).json({ status: "error", error: built.error });
      return;
    }
    const meta = (built.params.metadata ?? {}) as Record<string, string>;
    (built.params.metadata as Record<string, string>).channel = "ai_agent";
    const friday = await sendIntake({
      kind: "agent_checkout",
      email: str(body.email, 320),
      company: str(body.brand || body.business, 160) || undefined,
      website: str(body.website, 200) || undefined,
      path: "/v1/agent/checkout",
      meta: { ...meta, offer, agent: str(body.agent, 120) || undefined, checkout_open: gateOpen, amount: built.amountCents / 100, currency: built.currency },
    });
    // PREMIUM_INQUIRE_ONLY: premium offers (area lock, category lock, view blocks) are never paid by card.
    if (isPremiumOffer(offer)) {
      res.status(202).json({ status: "held", inquire_only: true, offer, amount: built.amountCents / 100, currency: built.currency, message: `${PREMIUM_INQUIRY_MESSAGE} Inquiry recorded; we'll reply from ${HANDOFF_EMAIL}. No charge was made.`, stored: friday.status });
      return;
    }
    if (!gateOpen || !deps.createSession) {
      res.status(202).json({ status: "held", offer, amount: built.amountCents / 100, currency: built.currency, message: `Reserved by inquiry. We'll confirm within 1 business day from ${HANDOFF_EMAIL}. No charge was made.`, stored: friday.status });
      return;
    }
    try {
      const session = await deps.createSession(built.params);
      res.json({ status: "open", offer, amount: built.amountCents / 100, currency: built.currency, checkout_url: session.url, livemode: session.livemode, stored: friday.status, next: "Hand checkout_url to the buyer. Payment is on a Stripe-hosted page." });
    } catch (err) {
      log("agent checkout failed", err);
      res.status(502).json({ status: "error", error: `Checkout could not open. Email ${HANDOFF_EMAIL}.` });
    }
  });

  return router;
}
