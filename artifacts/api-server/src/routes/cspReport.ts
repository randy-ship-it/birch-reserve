/**
 * CSP violation reports (Content-Security-Policy-Report-Only → report-uri /v1/csp-report). Logs a trimmed summary only:
 * no query strings, no bodies stored, no PII. Rate limited per IP. Always answers 204.
 */
import express, { Router, type IRouter } from "express";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { logger } from "../lib/logger";

const lim = new FixedWindowLimiter({ max: 30, windowMs: 60_000 });
const trimUrl = (v: unknown) => String(v ?? "").split(/[?#]/)[0]!.slice(0, 200);

export const cspReportRouter: IRouter = Router();
cspReportRouter.post(
  "/",
  express.json({ limit: "8kb", type: ["application/csp-report", "application/json", "application/reports+json"] }),
  (req, res) => {
    if (!lim.hit(req.ip ?? "?").limited) {
      const body = req.body as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
      const r = (Array.isArray(body) ? (body[0]?.body as Record<string, unknown>) : (body?.["csp-report"] as Record<string, unknown>)) ?? {};
      logger.warn(
        {
          csp: {
            directive: String(r["effective-directive"] ?? r["effectiveDirective"] ?? r["violated-directive"] ?? "").slice(0, 60),
            blocked: trimUrl(r["blocked-uri"] ?? r["blockedURL"]),
            page: trimUrl(r["document-uri"] ?? r["documentURL"]),
          },
        },
        "csp report-only violation",
      );
    }
    res.status(204).end();
  },
);
