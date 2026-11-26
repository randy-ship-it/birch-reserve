/**
 * Advertise the search API on every public HTML page (Cloudflare "Search for Agents" convention:
 * <meta name="agent:*"> in the head) plus a Link header. Skips gated, account, admin and API paths, and the Scale mirror
 * (scalehealth.ca speaks as Scale Health and advertises its own endpoint).
 */
import type { NextFunction, Request, Response } from "express";
import { SEARCH_PATH, agentMetaTags } from "../lib/agentSearchMeta";

const SKIP = /^\/(?:api|v1|ucp|ads|account|sales|sign-in|sign-up|editorial|ops|dev|for|inventory|tam|advertise\/brands|kit\/r|intake\/_m|splash|success|\.well-known)(?:\/|$)/;

export function agentDiscoveryEligible(path: string): boolean {
  return !SKIP.test(path);
}

export function agentDiscovery() {
  return (req: Request, res: Response, next: NextFunction) => {
    // mirrorHost has already stripped /intake/_m from req.url; originalUrl still shows the Scale mirror.
    if (req.method !== "GET" || !agentDiscoveryEligible(req.path) || req.query.br_mirror || req.originalUrl.startsWith("/intake/_m")) return next();
    const send = res.send.bind(res);
    res.send = ((body?: unknown) => {
      if (typeof body === "string" && body.includes("</head>") && /text\/html/i.test(String(res.get("Content-Type") ?? "")) && !body.includes('name="agent:endpoint"')) {
        res.append("Link", `<${SEARCH_PATH}?q={query}>; rel="search"; type="application/json"`);
        body = body.replace("</head>", `${agentMetaTags()}</head>`);
      }
      return send(body as never);
    }) as typeof res.send;
    next();
  };
}
