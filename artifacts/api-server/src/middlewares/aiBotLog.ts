/** Log AI crawler / assistant hits to Vercel runtime logs (lib/aiBots.ts). Bot family + path only, no PII. */
import type { NextFunction, Request, Response } from "express";
import { classifyAiBot } from "../lib/aiBots";

export function aiBotLog() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hit = classifyAiBot(req.headers["user-agent"]);
    if (hit) {
      const path = (req.originalUrl || req.url).split("?")[0];
      res.on("finish", () => {
        console.log(JSON.stringify({ evt: "ai_bot_hit", site: "birchreserve.net", ...hit, path, status: res.statusCode }));
      });
    }
    next();
  };
}
