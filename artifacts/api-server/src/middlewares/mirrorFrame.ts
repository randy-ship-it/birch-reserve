/**
 * Scale mirror, iframe fallback only (SCALE-MIRROR.md; Randy via Emma, Nov 19 2026 10:21 AM ET).
 * Off unless MIRROR_FRAME_HOSTS is set (comma-separated https origins, e.g. "https://scalehealth.ca,https://www.scalehealth.ca").
 * When set, the intake pages may only be framed by Birch itself and those origins (CSP frame-ancestors). Other pages
 * are untouched. Invalid entries are ignored, so a typo can never open framing to everyone.
 */
import type { NextFunction, Request, Response } from "express";

const ORIGIN_RE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/;
export function mirrorFrameAncestors(raw: string | undefined): string | null {
  const hosts = (raw ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/\/$/, "")).filter((s) => ORIGIN_RE.test(s));
  return hosts.length ? `frame-ancestors 'self' ${[...new Set(hosts)].join(" ")}` : null;
}
export function mirrorFrame(env: NodeJS.ProcessEnv = process.env) {
  const policy = mirrorFrameAncestors(env.MIRROR_FRAME_HOSTS);
  return (req: Request, res: Response, next: NextFunction) => {
    if (policy && req.method === "GET" && /^\/intake(?:\/|$)/.test(req.path)) res.setHeader("Content-Security-Policy", policy);
    next();
  };
}
