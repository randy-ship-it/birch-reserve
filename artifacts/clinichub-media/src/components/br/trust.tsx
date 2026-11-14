/**
 * Public trust blocks for Birch Reserve (Nov 13 2026).
 * Every figure and term here already appears on the site. No invented
 * testimonials, logos, case studies or campaign results. Sample report
 * figures are illustrative and labelled Sample.
 */
import { BRAND_HUBS } from "../../../../api-server/src/lib/overhaul/model";
import { AUDIENCE_SNAPSHOT, REGION_MIX } from "../../../../api-server/src/lib/overhaul/audiences";
import {
  MEDIA_KIT_ONE_PAGER_HREF,
  MEDIA_KIT_ONE_PAGER_NAME,
  OPERATOR_CITY,
  OPERATOR_LINE,
  SALES_CONTACT_NAME,
  SALES_EMAIL,
  SALES_EMAIL_HREF,
  SALES_REPLY_LINE,
} from "@/lib/seller-identity";
import { Eyebrow, Faq, H2, Section } from "./ui";

export const TRUST_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What are the refund terms?",
    a: "The $190 7-day look is a 100% credit if you reserve for $490 within 7 days; otherwise it is a cash refund. The $490 reserve is 100% media credit that spends down over 6 months on live hubs after your deposit lands. Unused credit can be refunded or extended month by month. The $490 reserve is also fully refundable until 14 days before the launch date on your insertion order; after that date the credit stays usable for 12 months. A cash refund is also available if no approved surface is named within 60 days of payment. These terms are draft until counsel stamps the terms page.",
  },
  {
    q: "How is privacy handled?",
    a: "Reporting is aggregate only. No personal data is shared with brands. No PHI. No clinical pixels.",
  },
  {
    q: "Who sees the data?",
    a: "Brands see aggregated, de-identified results at the cohort level: views, clicks, tagged visits, promo-code redemptions and attributed orders. Never names, contact details or health information.",
  },
  {
    q: "How often will we get reports?",
    a: "Campaign results are reported per hub and surface from your UTM links and promo codes. A regular reporting schedule and a self-serve dashboard are coming soon; the schedule will be confirmed on your insertion order.",
  },
];

const HOW_STEPS = [
  { n: "1", t: "Choose a placement", d: "Four surfaces in every hub: post-purchase (inquire-only), the hub home page, product and services pages, and the member dashboard behind login. Display or CPC." },
  { n: "2", t: "Pick how to start", d: "A $190 7-day look, a $490 reserve, or an inquiry for premium slots (including post-purchase and larger commitments)." },
  { n: "3", t: "The insertion order names the hub", d: "Nothing runs until an insertion order names the hub and surface. Your payment is media credit, not a live flight and not an impression guarantee." },
  { n: "4", t: "Credit spends down over 6 months", d: "Credit draws down on live hubs after your deposit lands. Unused credit can be refunded or extended month by month." },
  { n: "5", t: "We report what ran", d: "Views, clicks, UTM-tagged visits and promo-code redemptions, per hub and surface. Aggregate only. A self-serve dashboard is coming soon." },
];

const YOU_GET = [
  { t: "A placement in a private member experience", d: "Ads run inside co-branded hubs, not on the open web. Every brand is hand-picked to fit the audience." },
  { t: "Media credit toward display or CPC", d: "The $190 look and the $490 seat are 100% media credit (the look credits over if you convert within 7 days)." },
  { t: "Aggregate campaign reporting", d: "Your UTMs on every placement, an optional promo code, and results per hub and surface. A reporting dashboard is coming soon." },
  { t: "Agency cash, if you place a client", d: "The agency of record earns 10% of media spend, paid in cash." },
];

const SAMPLE_ROWS = [
  { surface: "Hub home", views: "12,400", clicks: "62", visits: "41", codes: "9" },
  { surface: "Product & services", views: "8,100", clicks: "28", visits: "19", codes: "4" },
  { surface: "Member dashboard", views: "5,600", clicks: "22", visits: "15", codes: "3" },
] as const;

function BasisTag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center border border-foreground bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
      {children}
    </span>
  );
}

export function OperatorLine({ className = "" }: { className?: string }) {
  return (
    <p className={className} data-testid="operator-line">
      {OPERATOR_LINE} {OPERATOR_CITY}.
    </p>
  );
}

export function PrivacyNote({ className = "" }: { className?: string }) {
  return (
    <p className={className} data-testid="privacy-note">
      Privacy-first: brands receive aggregated, de-identified results only. No personal data, names, contact details or health information is shared with brands.
    </p>
  );
}

export function SalesContact({ tone = "light" }: { tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-background/70" : "text-muted-foreground";
  const link = tone === "dark" ? "underline underline-offset-2 hover:text-accent" : "underline underline-offset-2 hover:text-accent";
  return (
    <div data-testid="sales-contact">
      <p className="font-semibold">{SALES_CONTACT_NAME}</p>
      <p className={`mt-1 text-sm ${muted}`}>
        <a href={SALES_EMAIL_HREF} className={link}>
          {SALES_EMAIL}
        </a>
      </p>
      <p className={`mt-1 text-sm ${muted}`}>{SALES_REPLY_LINE}</p>
    </div>
  );
}

/** Styled download link for the one-page media kit PDF. */
export function MediaKitPdfLink({
  className = "",
  variant = "line",
  testId = "media-kit-pdf",
  children = "Download the one-page media kit (PDF)",
}: {
  className?: string;
  variant?: "lime" | "ink" | "line" | "lineDark";
  testId?: string;
  children?: string;
}) {
  const v =
    variant === "lime"
      ? "bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
      : variant === "ink"
        ? "bg-foreground text-background hover:bg-accent hover:text-accent-foreground"
        : variant === "lineDark"
          ? "border border-background/45 text-background hover:border-background hover:bg-background hover:text-foreground"
          : "border border-foreground/25 text-foreground hover:border-foreground hover:bg-foreground hover:text-background";
  return (
    <a
      href={MEDIA_KIT_ONE_PAGER_HREF}
      download={MEDIA_KIT_ONE_PAGER_NAME}
      className={`inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-semibold transition-colors ${v} ${className}`}
      data-testid={testId}
    >
      {children}
    </a>
  );
}

export function ProofStrip() {
  const quebec = REGION_MIX.find((r) => r.label === "Quebec")?.pct;
  const ontario = REGION_MIX.find((r) => r.label === "Ontario")?.pct;
  return (
    <div data-testid="proof-strip" className="overflow-x-hidden">
      <ul className="grid grid-cols-1 gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-3">
        <li className="bg-background p-5">
          <p className="font-display text-4xl tabular-nums">{AUDIENCE_SNAPSHOT.launchBrands}</p>
          <p className="mt-1 text-sm text-muted-foreground">launch brands feeding the audience</p>
          <div className="mt-2">
            <BasisTag>Measured</BasisTag>
          </div>
        </li>
        <li className="bg-background p-5">
          <p className="font-display text-4xl tabular-nums">{AUDIENCE_SNAPSHOT.racquetPages.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">racquet-sport pages live on Calm Joints</p>
          <div className="mt-2">
            <BasisTag>Measured</BasisTag>
          </div>
        </li>
        <li className="bg-background p-5">
          <p className="font-display text-4xl tabular-nums">
            {quebec}% / {ontario}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">hub sessions from Quebec / Ontario</p>
          <div className="mt-2">
            <BasisTag>Measured</BasisTag>
          </div>
        </li>
      </ul>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5" data-testid="proof-logo-strip">
        {BRAND_HUBS.map((h) => (
          <li key={h.key} className="flex h-10 items-center opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0">
            <img src={h.logo} alt={h.name} className="max-h-9 w-auto max-w-[130px] object-contain" />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Logos are the launch brands already listed on Scale Health hubs. Session shares are first-party analytics, aggregated and de-identified, over the {AUDIENCE_SNAPSHOT.measuredWindow}.
      </p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <div data-testid="how-it-works">
      <ol className="grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-5">
        {HOW_STEPS.map((s) => (
          <li key={s.n} className="bg-background p-5">
            <p className="font-display text-2xl text-foreground/35">{s.n}</p>
            <p className="mt-2 font-semibold leading-snug">{s.t}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WhatYouGet() {
  return (
    <ul className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2" data-testid="what-you-get">
      {YOU_GET.map((item) => (
        <li key={item.t} className="bg-background p-5">
          <p className="font-semibold">{item.t}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.d}</p>
        </li>
      ))}
    </ul>
  );
}

export function SampleReport() {
  return (
    <div className="relative overflow-x-hidden border border-foreground/15 bg-white" data-testid="sample-report">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-secondary/50 px-4 py-3 md:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/55">Campaign report</p>
          <p className="mt-1 font-display text-xl md:text-2xl">Example Brand · Sample hub</p>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative 30-day window · per hub and surface</p>
        </div>
        <span className="inline-flex items-center border-2 border-foreground bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-accent-foreground" data-testid="sample-report-badge">
          Sample
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-4 py-3 md:px-5">Surface</th>
              <th className="px-4 py-3 text-right md:px-5">Views</th>
              <th className="px-4 py-3 text-right md:px-5">Clicks</th>
              <th className="px-4 py-3 text-right md:px-5">UTM-tagged visits</th>
              <th className="px-4 py-3 text-right md:px-5">Promo-code redemptions</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROWS.map((r) => (
              <tr key={r.surface} className="border-t border-border">
                <td className="px-4 py-3 md:px-5">{r.surface}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{r.views}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{r.clicks}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{r.visits}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{r.codes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground md:px-5">
        Sample layout only. These figures are illustrative and are not a real campaign. Your report will show what actually delivered, per hub and surface, from your UTMs and promo codes. Aggregate reporting only; no personal data is shared with brands. A self-serve dashboard is coming soon.
      </p>
    </div>
  );
}

export function TrustBand() {
  return (
    <>
      <Section id="how-it-works" tone="soft">
        <Eyebrow>How it works</Eyebrow>
        <H2>From a look to a live placement.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground">Five steps, using the terms already on the site. Nothing runs until an insertion order names the hub.</p>
        <div className="mt-8">
          <HowItWorks />
        </div>
        <div className="mt-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">What you get</p>
          <WhatYouGet />
        </div>
      </Section>
      <Section id="sample-report">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <Eyebrow>Reporting</Eyebrow>
            <H2>What a brand report looks like.</H2>
            <p className="mt-4 text-muted-foreground">
              Views, clicks, UTM-tagged visits and promo-code redemptions, broken out by hub and surface. The layout below is a sample, not a live campaign.
            </p>
            <PrivacyNote className="mt-4 text-sm text-muted-foreground" />
          </div>
        </div>
        <div className="mt-8">
          <SampleReport />
        </div>
      </Section>
    </>
  );
}

export function TrustFaq() {
  return (
    <div data-testid="trust-faq">
      <Faq items={TRUST_FAQ} />
    </div>
  );
}

export { MEDIA_KIT_ONE_PAGER_HREF };
