/**
 * Security headers for every response the Express function sends (Randy voice, Nov 21 2026: security hardening).
 * Static files get the same set from the routing table (scripts/vercel-build.mjs, SECURITY_HEADERS).
 *
 * - Enforced CSP is deliberately small so nothing on the page can break: no <base> hijack, no plugins, and only Birch
 *   and the Scale mirror hosts may frame a page (scalehealth.ca/intake proxies Birch; MIRROR_FRAME_HOSTS adds more).
 * - The full allow-list policy ships as Content-Security-Policy-Report-Only first. Violations post to /v1/csp-report
 *   and land in the function logs; promote it to enforced once the logs are quiet.
 * - A route that sets its own stricter CSP (buy uploads, ad templates, hub proof files) still overrides this one.
 */
import type { NextFunction, Request, Response } from "express";
import { mirrorFrameAncestors } from "./mirrorFrame";

export const SCALE_FRAME_HOSTS = ["https://scalehealth.ca", "https://www.scalehealth.ca"] as const;

export function frameAncestors(env: NodeJS.ProcessEnv = process.env): string {
  const extra = mirrorFrameAncestors(env.MIRROR_FRAME_HOSTS)?.replace(/^frame-ancestors 'self'\s*/, "").split(/\s+/).filter(Boolean) ?? [];
  return `frame-ancestors 'self' ${[...new Set([...SCALE_FRAME_HOSTS, ...extra])].join(" ")}`;
}

export function enforcedCsp(env: NodeJS.ProcessEnv = process.env): string {
  return ["base-uri 'self'", "object-src 'none'", frameAncestors(env), "upgrade-insecure-requests"].join("; ");
}

export const CSP_REPORT_PATH = "/v1/csp-report";
// Absolute so reports from the Scale mirror (www.scalehealth.ca/intake) reach Birch instead of Scale's own /v1.
export const CSP_REPORT_URI = `https://birchreserve.net${CSP_REPORT_PATH}`;
// The Scale mirror page loads Birch scripts/API (embed.js, /v1/ads/serve, Clerk proxy) cross-origin.
const BIRCH = "https://birchreserve.net https://www.birchreserve.net";

/** Report-only allow-list. Kept wide on purpose (inline scripts, analytics, chat, voice, Stripe, Clerk, Turnstile). */
export function reportOnlyCsp(env: NodeJS.ProcessEnv = process.env): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${BIRCH} 'unsafe-inline' blob: https://plausible.io https://unpkg.com https://challenges.cloudflare.com https://js.stripe.com https://*.clerk.accounts.dev https://clerk.birchreserve.net https://www.googletagmanager.com https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https://*.elevenlabs.io",
    `connect-src 'self' ${BIRCH} https://plausible.io https://*.elevenlabs.io wss://*.elevenlabs.io https://api.x.ai wss://api.x.ai https://challenges.cloudflare.com https://api.stripe.com https://*.clerk.accounts.dev https://clerk.birchreserve.net https://*.google-analytics.com https://*.analytics.google.com https://vitals.vercel-insights.com`,
    `frame-src 'self' ${BIRCH} https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://cal.com https://*.elevenlabs.io`,
    "worker-src 'self' blob:",
    "form-action 'self' https://checkout.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
    frameAncestors(env),
    `report-uri ${CSP_REPORT_URI}`,
  ].join("; ");
}

export const PERMISSIONS_POLICY =
  "camera=(), geolocation=(), usb=(), serial=(), hid=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), payment=(self \"https://js.stripe.com\"), microphone=(self), browsing-topics=(), interest-cohort=()";

export function securityHeaderSet(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Content-Security-Policy": enforcedCsp(env),
    "Content-Security-Policy-Report-Only": reportOnlyCsp(env),
  };
}

export function securityHeaders(env: NodeJS.ProcessEnv = process.env) {
  const set = securityHeaderSet(env);
  return (_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("X-Powered-By");
    for (const [k, v] of Object.entries(set)) res.setHeader(k, v);
    next();
  };
}
