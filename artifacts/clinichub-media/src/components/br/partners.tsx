/**
 * Partnerships (Randy, voice, Nov 21 2026, refined 4:57 PM): (A) service vendors, (B) inventory and reach partners.
 * Short and visual; detail collapsed. Copy lives in api-server/src/lib/overhaul/partners.ts. No numbers, no guarantees,
 * no wholesale prices, no client names.
 */
import { ArrowRight, Footprints, Megaphone, Newspaper, Palette, Wrench } from "lucide-react";
import { Details } from "@/components/br/details";
import { PARTNERS, PARTNERS_HREF, PARTNER_CATEGORIES, PARTNER_GROUPS, PARTNER_TRACKS } from "../../../../api-server/src/lib/overhaul/partners";
import { logCtaClick } from "@/lib/shareTrack";

const ICON = { flyer: Footprints, adbuying: Megaphone, creative: Palette, othervendor: Wrench, media: Newspaper } as const;

export const partnerHref = (track?: string) => (track ? `${PARTNERS_HREF}?track=${encodeURIComponent(track)}#apply` : `${PARTNERS_HREF}#apply`);

export function PartnersTeaser() {
  const links = [
    { k: "adbuying", label: "Service vendors", Icon: Megaphone },
    { k: "media", label: "Inventory and reach partners", Icon: Newspaper },
  ] as const;
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-8" data-testid="partners-teaser" id="partners">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{PARTNERS.eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{PARTNERS.teaserTitle}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{PARTNERS.teaserSub}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {links.map(({ k, label, Icon }) => (
          <li key={k}>
            <a href={partnerHref(k)} onClick={() => logCtaClick(`partners_teaser_${k}`)} data-testid={`partners-teaser-${k}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ecfccb]/70 px-4 py-2 text-sm font-semibold text-[#0b1f3a] ring-1 ring-[#0b1f3a]/10 transition hover:bg-lime-300">
              <Icon className="size-4" aria-hidden />{label}
            </a>
          </li>
        ))}
      </ul>
      <a href={PARTNERS_HREF} onClick={() => logCtaClick("partners_teaser")} data-testid="partners-teaser-cta" className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
        See partnerships <ArrowRight className="size-4" aria-hidden />
      </a>
    </div>
  );
}

function Card({ t, i }: { t: (typeof PARTNER_TRACKS)[number]; i: number }) {
  const Icon = ICON[t.key];
  return (
    <li className="flex flex-col rounded-2xl bg-[#ecfccb]/60 p-4" data-testid={`partner-card-${t.key}`}>
      <span className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{i + 1}</span>
        <Icon className="size-5 text-[#0E3B2A]" aria-hidden />
      </span>
      <p className="mt-2 font-display text-xl text-[#0b1f3a]">{t.name}</p>
      <p className="mt-1 text-sm text-foreground/70">{t.short}</p>
      <Details label="How it works" testId={`partner-details-${t.key}`}><p>{t.detail}</p></Details>
      <a href={partnerHref(t.key)} onClick={() => logCtaClick(`partners_card_${t.key}`)} data-testid={`partner-cta-${t.key}`} className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-bold text-[#0b1f3a] underline-offset-4 hover:underline">
        Apply for this track <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </li>
  );
}

export function PartnerGroups() {
  const [vendor, inventory] = PARTNER_GROUPS;
  const vendors = PARTNER_TRACKS.filter((t) => t.group === "vendor");
  const reseller = PARTNER_TRACKS.filter((t) => t.group === "inventory");
  return (
    <div className="space-y-6" data-testid="partner-cards">
      <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-8" data-testid="partner-group-vendor">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{vendor.eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{vendor.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{vendor.sub}</p>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[#0b1f3a]">{vendor.pitch}</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{vendors.map((t, i) => <Card key={t.key} t={t} i={i} />)}</ol>
      </div>
      <div className="rounded-3xl p-5 text-white md:p-8" style={{ background: "#0b1f3a" }} data-testid="partner-group-inventory">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#BFF3D6]">{inventory.eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight md:text-4xl">{inventory.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">{inventory.sub}</p>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/60">Curated demand audiences by category</p>
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="partner-categories">
          {PARTNER_CATEGORIES.map((c) => (
            <li key={c.name} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${c.live ? "bg-lime-300 text-[#0b1f3a]" : "bg-white/10 text-white ring-1 ring-white/20"}`}>
              {c.name} <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{c.live ? "Live" : "Queued"}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-3">
          {reseller.map((t) => (
            <div key={t.key} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15" data-testid={`partner-card-${t.key}`}>
              <p className="font-display text-xl">{t.name}</p>
              <p className="mt-1 text-sm text-white/80">{t.short}</p>
              <Details label="How it works" dark testId={`partner-details-${t.key}`}><p>{t.detail}</p></Details>
              <a href={partnerHref(t.key)} onClick={() => logCtaClick(`partners_card_${t.key}`)} data-testid={`partner-cta-${t.key}`} className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] transition hover:bg-white">
                Apply for this track <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-white/70">{inventory.pitch}</p>
      </div>
    </div>
  );
}
