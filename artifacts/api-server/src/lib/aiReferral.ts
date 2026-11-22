/**
 * AI-search referral tracking (Randy, Nov 22 2026, Granola AEO playbook: "measure Google and AI separately").
 * Pure, no Node imports: shared by the client beacon, the server guide pages and the admin Business tab.
 * We only read the referrer HOST and utm_source. Never the full referrer, query, cookies or anything typed.
 *
 * Event name on /v1/ui-events: ai_ref.<source>.<site>   e.g. ai_ref.chatgpt.birch, ai_ref.perplexity.scale
 */
export const AI_SOURCES = ["chatgpt", "perplexity", "grok", "gemini", "copilot", "claude", "meta_ai", "deepseek"] as const;
export type AiSource = (typeof AI_SOURCES)[number];
export const AI_SOURCE_LABEL: Record<AiSource, string> = {
  chatgpt: "ChatGPT", perplexity: "Perplexity", grok: "Grok", gemini: "Gemini", copilot: "Copilot", claude: "Claude", meta_ai: "Meta AI", deepseek: "DeepSeek",
};

const HOSTS: ReadonlyArray<readonly [RegExp, AiSource]> = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)grok\.com$|(^|\.)x\.ai$/, "grok"],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, "gemini"],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, "copilot"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)meta\.ai$/, "meta_ai"],
  [/(^|\.)chat\.deepseek\.com$/, "deepseek"],
];
const UTM: ReadonlyArray<readonly [RegExp, AiSource]> = [
  [/^(chatgpt(\.com)?|openai|chat\.openai\.com)$/, "chatgpt"],
  [/^(perplexity(\.ai)?)$/, "perplexity"],
  [/^(grok(\.com)?|x\.ai|xai)$/, "grok"],
  [/^(gemini(\.google\.com)?|bard)$/, "gemini"],
  [/^(copilot(\.microsoft\.com)?|bing_chat|bingchat)$/, "copilot"],
  [/^(claude(\.ai)?|anthropic)$/, "claude"],
  [/^(meta\.ai|meta_ai)$/, "meta_ai"],
  [/^(deepseek(\.com)?)$/, "deepseek"],
];

function hostOf(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    return new URL(v).hostname.toLowerCase();
  } catch {
    return /^[a-z0-9.-]+$/i.test(v) ? v.toLowerCase() : null;
  }
}

/** Which AI assistant sent this visit, from the referrer (URL or host) and utm_source. null when none. */
export function aiSourceOf(i: { referrer?: string | null; utmSource?: string | null }): AiSource | null {
  const u = (i.utmSource ?? "").trim().toLowerCase();
  if (u) for (const [re, s] of UTM) if (re.test(u)) return s;
  const h = hostOf(i.referrer);
  if (h) for (const [re, s] of HOSTS) if (re.test(h)) return s;
  return null;
}

const EVENT_RE = new RegExp(`^ai_ref\\.(${AI_SOURCES.join("|")})\\.(birch|scale)$`);
export function isAiRefEvent(event: string): boolean {
  return EVENT_RE.test(event);
}
export function aiRefEvent(source: AiSource, site: "birch" | "scale"): string {
  return `ai_ref.${source}.${site}`;
}
export function parseAiRefEvent(event: string): { source: AiSource; site: "birch" | "scale" } | null {
  const m = EVENT_RE.exec(event);
  return m ? { source: m[1] as AiSource, site: m[2] as "birch" | "scale" } : null;
}

/**
 * Inline beacon for server-rendered pages: one ai_ref event per page load when the visit came from an AI assistant.
 * Uses window.__BR_MIRROR (Scale mirror) to tag the site and route the beacon through /intake/_m.
 */
export function aiRefBeaconScript(): string {
  const hosts = HOSTS.map(([re, s]) => [re.source, s]);
  const utm = UTM.map(([re, s]) => [re.source, s]);
  return `<script>(function(){try{var H=${JSON.stringify(hosts)},U=${JSON.stringify(utm)},s=null,q=new URLSearchParams(location.search),u=(q.get("utm_source")||"").toLowerCase();
if(u)for(var i=0;i<U.length;i++)if(new RegExp(U[i][0]).test(u)){s=U[i][1];break}
if(!s&&document.referrer){var h="";try{h=new URL(document.referrer).hostname.toLowerCase()}catch(e){}for(var j=0;j<H.length;j++)if(h&&new RegExp(H[j][0]).test(h)){s=H[j][1];break}}
if(!s)return;var M=window.__BR_MIRROR,site=M&&M.skin==="scale"?"scale":"birch",b=JSON.stringify({event:"ai_ref."+s+"."+site,path:(location.pathname||"/").slice(0,200)});
if(navigator.sendBeacon)navigator.sendBeacon("/v1/ui-events",new Blob([b],{type:"application/json"}));}catch(e){}})();</script>`;
}
