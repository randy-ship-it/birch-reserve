import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OVERHAUL_ROUTES, llmsTxt } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS, SPA_SHELL_PATHS } from "../src/lib/publicSeo";
import { agentCard, agentOpenApi } from "../src/lib/overhaul/agent";

const root = resolve(process.cwd(), "..");
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const layout = read("../clinichub-media/src/components/layout.tsx");
const home = read("../clinichub-media/src/pages/br/home.tsx");
const buyers = read("../clinichub-media/src/pages/br/ai-buyers.tsx");
const trust = read("../clinichub-media/src/components/br/trust.tsx");
const identity = read("../clinichub-media/src/lib/seller-identity.ts");
const mediaKit = read("../clinichub-media/src/pages/br/media-kit.tsx");
const publicBuying = read("src/routes/publicBuying.ts");
const llms = llmsTxt();
const publicPages = layout + home + buyers + trust + mediaKit + identity;

test("public chrome no longer advertises AI buyers, an AI voice line, or AI ad-matching", () => {
  assert.doesNotMatch(layout, /AI buyers|AI voice line|For AI buying agents/i);
  assert.doesNotMatch(home, /For AI buying agents|Buying media with AI/i);
  assert.doesNotMatch(buyers, /For AI buying agents|Point your AI buyer|AI ad-buying|Brands using AI/i);
  assert.doesNotMatch(publicPages, /ad-matching|AI matching|machine learning/i);
  assert.doesNotMatch(llms, /For AI buying agents/);
  assert.doesNotMatch(publicBuying, /For AI buyers/);
  assert.doesNotMatch(agentCard().description, /\bAI\b/);
  assert.doesNotMatch(agentOpenApi().info.description, /\bAI\b/);
});

test("buyers route is registered and the legacy /ai-buyers path remains", () => {
  assert.match(layout, /href: '\/buyers', label: 'Buyers'/);
  assert.ok(OVERHAUL_ROUTES["/buyers"]);
  assert.ok(OVERHAUL_ROUTES["/ai-buyers"]);
  assert.match(OVERHAUL_ROUTES["/buyers"]!.title, /For media buyers/);
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/buyers"));
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/ai-buyers"));
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/buyers"));
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/ai-buyers"));
  assert.match(llms, /https:\/\/birchreserve\.net\/buyers/);
});

test("operator line, founder contact, and one-page media kit are present", () => {
  assert.match(identity, /Birch Reserve is operated by Silver Birch Growth Inc\./);
  assert.match(identity, /Toronto, Ontario/);
  assert.match(identity, /Randy Gilling, founder/);
  assert.match(identity, /sales@silverbirchgrowth\.com/);
  assert.match(identity, /We reply within 1 business day\./);
  assert.match(identity, /\/birch-reserve-one-pager\.pdf/);
  assert.match(layout, /Call our sales line\./);
  assert.match(layout, /<OperatorLine/);
  assert.match(layout, /<SalesContact/);
  assert.match(layout, /<PrivacyNote/);
  assert.match(trust, /data-testid="operator-line"/);
  assert.match(trust, /data-testid="sales-contact"/);
  assert.match(home, /<ProofStrip/);
  assert.match(home, /<TrustBand/);
  assert.match(home, /<TrustFaq/);
  assert.match(trust, /data-testid="proof-strip"/);
  assert.match(trust, /data-testid="sample-report"/);
  assert.match(trust, /data-testid="how-it-works"/);
  assert.match(mediaKit, /testId="mk-pdf-hero"/);
  const pdf = resolve(root, "clinichub-media/public/birch-reserve-one-pager.pdf");
  assert.ok(existsSync(pdf), "one-pager PDF is in public/");
});

test("copy rules: 20mm+ allowed, no 8.7mm, no gross profit, no street address on public surfaces", () => {
  assert.doesNotMatch(publicPages, /8\.7\s*mm/i);
  assert.doesNotMatch(publicPages, /gross profit/i);
  assert.match(identity, /export const SELLER_IDENTITY = "Silver Birch Growth Inc\. · Toronto, Ontario"/);
  assert.doesNotMatch(identity, /777-2255|Queen St|M4E 1G3/i);
  assert.doesNotMatch(trust, /777-2255|Queen St|M4E 1G3/i);
  assert.doesNotMatch(home, /777-2255|Queen St|M4E 1G3|streetAddress/i);
  assert.doesNotMatch(mediaKit, /777-2255|Queen St|M4E 1G3/i);
  assert.doesNotMatch(llms, /777-2255|Queen St|M4E 1G3/i);
  assert.doesNotMatch(publicBuying, /777-2255|Queen St|M4E 1G3/i);
  assert.doesNotMatch(JSON.stringify(agentCard()), /777-2255|Queen St|M4E 1G3/i);
  const pdfText = read("../clinichub-media/public/birch-reserve-one-pager.pdf");
  // PDF is binary; still catch raw strings if present
  assert.doesNotMatch(pdfText, /8\.7\s*mm/i);
  assert.doesNotMatch(pdfText, /777-2255/);
  assert.doesNotMatch(pdfText, /Queen St/);
});

test("two-tier offers: SMB $190/$490 to start, premium $25K–$50K is the main event", () => {
  assert.match(home, /Start with a seat[.,] [Tt]hen lock the category/);
  assert.match(home, /UPGRADE_PATH_LINE/);
  assert.match(home, /Small business package/);
  assert.match(home, /Premium slots · the main event/);
  assert.match(home, /From \$25K, \$25K–\$50K/);
  assert.match(home, /Inquire only/);
  assert.match(mediaKit, /Start with a seat, then lock the category/);
  assert.match(mediaKit, /Small business package/);
  assert.match(mediaKit, /Premium slots · the main event/);
  assert.doesNotMatch(home + "\n" + mediaKit, /Test Rail|Category Lock|\$35K[–-]\$75K/);
});

test("sample report is labelled Sample and privacy note is aggregate-only", () => {
  assert.match(trust, /data-testid="sample-report-badge"/);
  assert.match(trust, /Sample layout only/);
  assert.match(trust, /No personal data, names, contact details or health information is shared with brands/);
  assert.match(trust, /coming soon/i);
  assert.match(trust, /10% of media spend, paid in cash/);
});
