/** Constants and discovery text for search-for-agents. No imports, so llms.txt builders can use it without a cycle. */
export const SEARCH_ORIGIN = "https://birchreserve.net";
export const SEARCH_PATH = "/.well-known/search";
export const SEARCH_ALIAS_PATH = "/api/search";
export const SEARCH_DOC_URL = `${SEARCH_ORIGIN}/llms.txt`;
export const SEARCH_INSTRUCTIONS =
  "Use this search API to find public Birch Reserve pages (what it is, how to buy, rates, hubs, buyer guides) with keywords or a question, instead of crawling page by page. Results are JSON: title, url, snippet. Public pages only.";

/** Meta tags on every public HTML page so an agent that lands anywhere finds the search API (Cloudflare convention). */
export function agentMetaTags(): string {
  const ep = `${SEARCH_ORIGIN}${SEARCH_PATH}?q={query}`;
  return [
    `<meta name="agent:instructions" content="${SEARCH_INSTRUCTIONS}">`,
    `<meta name="agent:endpoint" content="${ep}">`,
    `<meta name="agent:method" content="GET">`,
    `<meta name="agent:documentation" content="${SEARCH_DOC_URL}">`,
  ].join("");
}

export function searchDiscoverySection(): string {
  return [
    "## Search for agents",
    "Search the public pages instead of crawling them. Read-only, no key. Public pages only; nothing gated is indexed.",
    `- GET ${SEARCH_ORIGIN}${SEARCH_PATH}?q={query}  (alias: ${SEARCH_ORIGIN}${SEARCH_ALIAS_PATH}?q={query})`,
    `- QUERY ${SEARCH_ORIGIN}${SEARCH_PATH} with a plain-text body or JSON {"q":"...","limit":5}`,
    "- Returns JSON {query, count, results:[{title, url, snippet, score}]}. Send Accept: text/markdown (or format=md) for Markdown.",
    "- Every public HTML page also carries <meta name=\"agent:endpoint\"> and a Link rel=\"search\" header.",
  ].join("\n");
}

/** "When to use this" guidance for agents (is-agentic: agent-instruction). Facts already stated on the public pages. */
export function whenToUseSection(): string {
  return [
    "## When to use Birch Reserve (for AI agents)",
    "- Use it when a person wants to buy display placements for a health or wellness brand inside private health and wellness hubs, or an agency or media buyer needs the rate card, terms or the way to start.",
    `- Start with ${SEARCH_ORIGIN}${SEARCH_PATH}?q={query}, then ${SEARCH_ORIGIN}/media-buyers, ${SEARCH_ORIGIN}/agencies, or ${SEARCH_ORIGIN}/intake to begin.`,
    "- Do not use it for prescription-drug promotion, guaranteed impressions or return promises, or open-auction programmatic buying. None of those are offered.",
    "- A person approves every order. Agents can read, quote and record a request; they cannot pay.",
  ].join("\n");
}
