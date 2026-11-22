/**
 * AI crawler / assistant detection for visit logging (CrowdReply / Ramp playbook, Nov 21 2026).
 * Logs bot family, agent token and path only. Never IPs, query strings, cookies or bodies (no PII).
 */
export type AiBotHit = { family: string; agent: string; suspect?: string };

const AGENTS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [/OAI-SearchBot/i, "openai", "OAI-SearchBot"],
  [/ChatGPT-User/i, "openai", "ChatGPT-User"],
  [/GPTBot/i, "openai", "GPTBot"],
  [/Claude-SearchBot/i, "anthropic", "Claude-SearchBot"],
  [/Claude-User/i, "anthropic", "Claude-User"],
  [/ClaudeBot/i, "anthropic", "ClaudeBot"],
  [/Claude-Web|anthropic-ai/i, "anthropic", "anthropic-other"],
  [/Perplexity-User/i, "perplexity", "Perplexity-User"],
  [/PerplexityBot/i, "perplexity", "PerplexityBot"],
  [/Google-CloudVertexBot/i, "google", "Google-CloudVertexBot"],
  [/GoogleOther/i, "google", "GoogleOther"],
  [/Googlebot/i, "google", "Googlebot"],
  [/bingbot/i, "microsoft", "Bingbot"],
  [/Applebot/i, "apple", "Applebot"],
  [/meta-externalagent/i, "meta", "meta-externalagent"],
  [/meta-externalfetcher/i, "meta", "meta-externalfetcher"],
  [/FacebookBot/i, "meta", "FacebookBot"],
  [/DeepSeek/i, "deepseek", "DeepSeekBot"],
  [/Amazonbot/i, "amazon", "Amazonbot"],
  [/Bytespider/i, "bytedance", "Bytespider"],
  [/CCBot/i, "commoncrawl", "CCBot"],
  [/DuckAssistBot/i, "duckduckgo", "DuckAssistBot"],
  [/MistralAI-User/i, "mistral", "MistralAI-User"],
  [/cohere-ai|cohere-training/i, "cohere", "cohere"],
  [/YouBot/i, "you", "YouBot"],
  [/xAI|Grok/i, "xai", "xAI"],
];

/** Named AI agents, plus browser-looking UAs that are likely disguised crawlers (very old Chrome, headless). */
export function classifyAiBot(ua: string | undefined | null): AiBotHit | null {
  if (!ua) return null;
  for (const [re, family, agent] of AGENTS) if (re.test(ua)) return { family, agent };
  if (/HeadlessChrome/i.test(ua)) return { family: "unknown", agent: "browser-like", suspect: "headless-chrome" };
  const m = ua.match(/Chrome\/(\d+)\./);
  if (m && Number(m[1]) < 90 && !/Edg|OPR|SamsungBrowser/i.test(ua)) return { family: "unknown", agent: "browser-like", suspect: `old-chrome-${m[1]}` };
  return null;
}

/** One JSON line per hit, picked up by Vercel runtime logs. Path only (query string dropped). */
export function logAiBotHit(site: string, ua: string | undefined | null, path: string, status?: number): AiBotHit | null {
  const hit = classifyAiBot(ua);
  if (!hit) return null;
  console.log(JSON.stringify({ evt: "ai_bot_hit", site, ...hit, path: path.split("?")[0], ...(status ? { status } : {}) }));
  return hit;
}
