/**
 * Activate your own hub, earn $100: public form + upload, admin review. See lib/adserver/hubProof.ts.
 *   GET  /hub-proof                          form (Birch or Scale branding by host)
 *   POST /v1/hub-proof                       JSON {hub_name, hub_url, name, email, channel, reach, note, terms, file:{data(base64)}}
 *   GET  /ads/admin/hub-proof/:id/file       admin only
 *   POST /ads/admin/hub-proof/:id/approve|reject   admin only (issues the $100 credit on approve)
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { adminEmails } from "../lib/adserver/config";
import { verify } from "../lib/adserver/auth";
import { siteOf } from "../lib/adserver/promoContext";
import * as hp from "../lib/adserver/hubProof";
import { sendSalesAlert } from "../lib/salesAlert";
import { isTestIdentity } from "../lib/testTraffic";

const router: IRouter = Router();
const json = express.json({ limit: "5mb" });
const small = express.json({ limit: "8kb" });
const lim = new FixedWindowLimiter({ max: 5, windowMs: 10 * 60_000 });
const str = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const cookieOf = (req: Request, name: string): string | null => {
  for (const part of (req.get("cookie") ?? "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
};
const sameOrigin = (req: Request) => {
  const o = req.get("origin");
  if (!o) return req.get("sec-fetch-site") !== "cross-site";
  try {
    const h = new URL(o).host;
    return h === (req.get("x-forwarded-host") ?? req.get("host")) || h === "scalehealth.ca" || h === "www.scalehealth.ca";
  } catch {
    return false;
  }
};
const adminOf = (req: Request) => {
  const t = verify<{ e: string }>("adm", cookieOf(req, "br_ads_adm"));
  return t && adminEmails().includes(t.e) ? t.e : null;
};
async function safe(res: Response, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "hub proof route failed");
    if (!res.headersSent) res.status(500).json({ ok: false, message: "Something went wrong. Try again, or email randy@scalehealth.ca." });
  }
}

router.post("/v1/hub-proof", json, (req, res) =>
  safe(res, async () => {
    res.set("Cache-Control", "no-store");
    if (!sameOrigin(req) || lim.hit(`hp:${req.ip ?? "?"}`).limited) return void res.status(429).json({ ok: false, message: "Too many tries. Wait a few minutes." });
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (str(b.fax)) return void res.json({ ok: true }); // honeypot
    if (b.terms !== true) return void res.status(400).json({ ok: false, message: "Tick the box to accept the terms." });
    const fileB64 = str((b.file as Record<string, unknown> | undefined)?.data, 5 * 1024 * 1024);
    const file = Buffer.from(fileB64, "base64");
    if (!file.length) return void res.status(400).json({ ok: false, message: "Add your proof screenshot." });
    const r = await hp.submitProof({
      hubName: str(b.hub_name, 160), hubUrl: str(b.hub_url, 300), contactName: str(b.name, 120), email: str(b.email, 254), channel: str(b.channel, 20),
      reach: Number(b.reach), note: str(b.note, 500), file, site: siteOf(req),
    });
    if (!r.ok) return void res.status(400).json(r);
    const email = str(b.email, 254).toLowerCase();
    // Form audit Nov 26 2026: awaited (no freeze before send) and the team now gets an internal alert too, not just the submitter.
    await hp.mailReceived({ email, hubName: str(b.hub_name, 160) });
    await sendSalesAlert({
      event: "inquiry",
      tag: "BIRCH HUB PROOF",
      title: `Hub proof: ${str(b.hub_name, 160)}`,
      rows: [
        ["Form", "Activate your own hub (/hub-proof)"],
        ["Hub", str(b.hub_name, 160)],
        ["Hub URL", str(b.hub_url, 300)],
        ["Name", str(b.name, 120)],
        ["Email", email],
        ["Channel", str(b.channel, 20)],
        ["Reach", String(Number(b.reach) || "")],
        ["Note", str(b.note, 500)],
        ["Proof id", r.id],
        ["Review", "Open /ads/admin to approve or reject"],
      ],
      replyTo: email,
      isTest: isTestIdentity({ email, name: str(b.hub_name, 160) }),
    });
    res.json({ ok: true, message: "Got it. We emailed you a confirmation. A person reviews every submission." });
  }),
);

router.get("/ads/admin/hub-proof/:id/file", (req, res) =>
  safe(res, async () => {
    if (!adminOf(req)) return void res.status(401).send("Sign in again.");
    const f = await hp.proofFile(String(req.params.id));
    if (!f) return void res.status(404).send("Not found.");
    res.set({ "Content-Type": f.mime, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" }).send(f.data);
  }),
);
for (const action of ["approve", "reject"] as const) {
  router.post(`/ads/admin/hub-proof/:id/${action}`, small, (req, res) =>
    safe(res, async () => {
      const who = adminOf(req);
      if (!who || !sameOrigin(req)) return void res.status(401).json({ message: "Sign in again." });
      const r = await hp.reviewProof(String(req.params.id), action, who, str((req.body as Record<string, unknown>)?.note, 200));
      res.status(r.ok ? 200 : 400).json({ message: r.message });
    }),
  );
}

const PAGE_CSS = `*{box-sizing:border-box}body{margin:0;background:#F9F8F6;color:#071A39;font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif}main{max-width:620px;margin:0 auto;padding:24px 16px 56px}h1{font:400 clamp(1.8rem,7vw,2.4rem)/1.12 Fraunces,Georgia,serif;margin:6px 0 8px}.eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;opacity:.65;margin:0}.pill{display:inline-block;background:#C8F55A;border-radius:999px;padding:2px 10px;font-weight:700;font-size:13px}.card{background:#fff;border:1px solid #d5d9df;border-radius:20px;padding:20px;margin-top:16px}label{display:block;font-weight:600;font-size:14px;margin:12px 0 4px}input,select,textarea{width:100%;min-height:46px;padding:10px 12px;border:1px solid #071A39;border-radius:12px;font:inherit;background:#fff}button{min-height:50px;width:100%;margin-top:16px;border:0;border-radius:999px;background:#C8F55A;color:#071A39;font:700 16px inherit;cursor:pointer}button:disabled{opacity:.6}.fine{font-size:13px;opacity:.75}.msg{margin-top:10px;font-weight:600}.hp{position:absolute;left:-9999px}details{margin-top:12px}summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}ul{padding-left:20px}`;

router.get(["/hub-proof", "/intake/hub-proof"], (req, res) => {
  const scale = siteOf(req) === "scale";
  const base = scale ? "/intake/_m" : "";
  const brand = scale ? "Scale Health" : "Birch Reserve";
  res.set("Cache-Control", "no-store").type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Activate your hub, earn $100 | ${brand}</title><style>${PAGE_CSS}</style></head><body><main>
<img src="${base}${scale ? "/brand/scale/favicon.svg" : "/favicon.svg"}" alt="${brand}" width="36" height="36" style="display:block;border-radius:8px;margin-bottom:10px">
<p class="eyebrow">${brand} · Hub owners</p><h1>Activate your own hub. <span class="pill">Earn $100</span></h1>
<p>Brands are already buying placements, so your hub can earn from ads from day one. Send your hub to 1,000 or more people, show us it went out, and we add a $100 ad credit to your account.</p>
<form class="card" id="f" novalidate><label for="hn">Hub name</label><input id="hn" name="hub_name" required maxlength="160" autocomplete="organization">
<label for="hu">Hub link</label><input id="hu" name="hub_url" maxlength="300" inputmode="url" placeholder="yourhub.com">
<label for="nm">Your name</label><input id="nm" name="name" maxlength="120" autocomplete="name"><label for="em">Email</label><input id="em" name="email" type="email" required autocomplete="email">
<label for="ch">How did you send it?</label><select id="ch" name="channel"><option value="email">Email</option><option value="sms">Text message</option><option value="social">Social post</option><option value="other">Other</option></select>
<label for="rc">People reached (1,000 or more)</label><input id="rc" name="reach" type="number" min="1000" step="1" inputmode="numeric" required>
<label for="fl">Proof screenshot <span class="fine">(PNG, JPG, WebP or PDF, up to 3 MB)</span></label><input id="fl" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required>
<label for="nt">Anything we should know? <span class="fine">(optional)</span></label><textarea id="nt" name="note" maxlength="500" rows="2"></textarea>
<div class="hp" aria-hidden="true"><input name="fax" tabindex="-1" autocomplete="off"></div>
<label style="display:flex;gap:10px;align-items:flex-start;font-weight:500"><input id="tm" type="checkbox" style="width:22px;min-height:22px;margin-top:2px"><span>I agree to the terms below.</span></label>
<button id="go" type="submit">Send my proof</button><p class="msg" id="m" role="status" aria-live="polite"></p>
<details><summary>Terms</summary><ul>${hp.HUB_PROOF_TERMS.map((t) => `<li>${t}</li>`).join("")}</ul></details></form>
<p class="fine">One credit per hub. Aggregate reporting only. Nothing here guarantees ad demand or earnings.</p></main>
<script>(function(){var f=document.getElementById("f"),m=document.getElementById("m"),b=document.getElementById("go");
f.addEventListener("submit",function(e){e.preventDefault();m.textContent="";if(!f.reportValidity())return;var fl=document.getElementById("fl").files[0];if(!fl){m.textContent="Add your proof screenshot.";return}if(fl.size>3*1024*1024){m.textContent="That file is over 3 MB.";return}if(!document.getElementById("tm").checked){m.textContent="Tick the box to accept the terms.";return}
b.disabled=true;m.textContent="Sending…";var r=new FileReader();r.onload=function(){var d=String(r.result).split(",")[1]||"";var q=Object.fromEntries(new FormData(f));q.reach=Number(q.reach);q.terms=true;q.file={data:d};
fetch("${base}/v1/hub-proof",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(q)}).then(function(x){return x.json().catch(function(){return{}}).then(function(j){if(j.ok){f.innerHTML='<h2 style="font-family:Fraunces,Georgia,serif;font-weight:400">Got it.</h2><p>'+j.message+'</p>'}else{m.textContent=j.message||"That didn't work. Try again.";b.disabled=false}})}).catch(function(){m.textContent="Could not send. Try again or email randy@scalehealth.ca.";b.disabled=false})};r.readAsDataURL(fl)})})();</script></body></html>`);
});

export default router;
