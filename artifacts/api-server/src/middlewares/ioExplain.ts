import type { NextFunction, Request, Response } from "express";
import { IO_SCRIPT_TAG } from "../lib/ioExplain";

/**
 * Adds the "insertion order (IO)" first-use script to server-rendered HTML pages (the React site loads the same script
 * from its bundle, so SPA shells are skipped here). Pages without a plain "IO" are untouched in effect.
 */
export function ioExplain() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    const send = res.send.bind(res);
    res.send = ((body: unknown) => {
      const html = typeof body === "string" ? body : Buffer.isBuffer(body) && /html/i.test(String(res.getHeader("Content-Type") ?? "")) ? body.toString("utf8") : null;
      if (html === null || !/<\/body>/i.test(html) || /data-io-explain/.test(html) || /id=["']root["']/.test(html)) return send(body as never);
      return send(html.replace(/<\/body>/i, `${IO_SCRIPT_TAG}</body>`) as never);
    }) as Response["send"];
    next();
  };
}
