import { SELLER_EMAIL_HREF, SELLER_IDENTITY } from "@/lib/seller-identity";
import { useEffect } from "react";
import { Download, Mail } from "lucide-react";

/** Optional static print of this page (headless Chromium print-to-PDF). */
const MEDIA_KIT_PDF_HREF = "/birch-reserve-media-kit.pdf" as const;

const PAGE_TITLE = "Creative brief — Birch Reserve placements";

const CATEGORIES = [
  "Pain relief / topicals",
  "Recovery hardware",
  "Nutrition",
  "Sleep",
  "Meal prep",
  "Women’s health",
  "Men’s health",
  "Diagnostics / services",
] as const;

const FORMATS = [
  "post_checkout",
  "scheduled_service",
  "recovery_plan",
  "member_hub",
  "motion_15s",
] as const;

export default function Kit() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content =
        "What to send for Birch Reserve category placements: square still, optional 15s silent motion, destination URL, category, and contact.";
    }
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
    };
  }, []);

  return (
    <div className="kit-page bg-background text-foreground" data-testid="kit-page">
      <section className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-6 py-16 md:py-24">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Birch Reserve · Creative brief
          </p>
          <h1 className="font-display text-4xl leading-[0.95] tracking-tight md:text-5xl">
            Creative brief for Birch Reserve placements
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">{SELLER_IDENTITY}</p>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
            This page is the creative brief for a Birch Reserve category placement. It is not a
            media-kit demos dump. Captions and mock placements are illustrative until an insertion
            order names the hub.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SELLER_EMAIL_HREF}
              className="inline-flex h-12 items-center gap-2 rounded-none bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90"
              data-testid="link-kit-email-sales"
            >
              <Mail className="size-4" aria-hidden />
              Email sales
            </a>
            <a
              href="/buycalc"
              className="inline-flex h-12 items-center gap-2 rounded-none border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
              data-testid="link-kit-buycalc"
            >
              Open /buycalc
            </a>
            <a
              href={MEDIA_KIT_PDF_HREF}
              download
              className="kit-download inline-flex h-12 items-center gap-2 rounded-none border border-border px-6 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted print:hidden"
              data-testid="button-download-media-kit"
            >
              <Download className="size-4" aria-hidden />
              Optional PDF
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <h2 className="font-display text-2xl tracking-tight">What to send</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li>Square still (primary creative)</li>
            <li>Optional 15-second silent motion</li>
            <li>Destination URL</li>
            <li>One of the eight advertiser categories</li>
            <li>Contact email for creative and IO follow-up</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Caption: illustrative until an insertion order names the hub.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <h2 className="font-display text-2xl tracking-tight">Eight categories, early slots open</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((label) => (
              <li key={label} className="border border-border px-4 py-3 text-sm">
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Categories stay open to more than one brand; no brand gets more than 20%. Not eight websites.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <h2 className="font-display text-2xl tracking-tight">Formats (context only)</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Placement formats for IO discussion — not CTR or impression guarantees:
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {FORMATS.map((format) => (
              <li
                key={format}
                className="border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs"
              >
                {format}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <h2 className="font-display text-2xl tracking-tight">Contact</h2>
          <p className="mt-4 text-base">
            <a href={SELLER_EMAIL_HREF} className="underline underline-offset-4 hover:text-accent">
              sales@silverbirchgrowth.com
            </a>
            {" · "}
            <a href="/buycalc" className="underline underline-offset-4 hover:text-accent">
              /buycalc
            </a>
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <a href="/sample-io" className="underline underline-offset-2 hover:text-accent">
              Sample insertion order
            </a>
            {" · "}
            <a href="/terms" className="underline underline-offset-2 hover:text-accent">
              Terms
            </a>
          </p>
          <p className="mt-8 text-xs text-muted-foreground">
            Seller: {SELLER_IDENTITY} ·{" "}
            <a href={SELLER_EMAIL_HREF} className="underline underline-offset-2 hover:text-accent">
              Email sales
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
