import { useEffect, type ReactNode } from "react";
import { useRoute } from "wouter";
import { ShoppingBag, Trophy, Stethoscope, Users } from "lucide-react";
import { Cta, H1, usePageMeta } from "@/components/br/ui";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import NotFound from "@/pages/not-found";
import {
  getBrandFit,
  statusLabel,
  strengthLabel,
  type BestFitIcon,
  type BrandFit,
  type FitLink,
  type FitStrength,
} from "../../../../api-server/src/lib/overhaul/brandFits";

function useNoIndex() {
  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    const previous = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, nofollow");
    return () => {
      if (created) robots?.remove();
      else if (previous) robots?.setAttribute("content", previous);
      else robots?.removeAttribute("content");
    };
  }, []);
}

function Links({ links, className = "" }: { links?: FitLink[]; className?: string }) {
  if (!links?.length) return null;
  return (
    <p className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm ${className}`}>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="underline underline-offset-4 hover:text-accent"
          target="_blank"
          rel="noopener noreferrer"
        >
          {l.title}
        </a>
      ))}
    </p>
  );
}

const ICONS: Record<BestFitIcon, typeof ShoppingBag> = {
  purchase: ShoppingBag,
  racquet: Trophy,
  clinic: Stethoscope,
  street: Users,
};

function StrengthChip({ strength }: { strength: FitStrength }) {
  const strong = strength === "strong";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
        strong ? "bg-accent text-accent-foreground" : "border border-current/30"
      }`}
    >
      {strengthLabel(strength)}
    </span>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-background/55" : "text-foreground/60"}`}>
      {children}
    </p>
  );
}

function BrandFitPage({ fit }: { fit: BrandFit }) {
  useNoIndex();
  usePageMeta(`${fit.name} customer fit | Birch Reserve`, fit.lede);
  const products = fit.products ?? [];
  const tiles = fit.hubTiles ?? [];
  const liveTiles = tiles.filter((t) => t.status === "live");
  const pageTiles = tiles.filter((t) => t.status !== "live");

  return (
    <div className="for-brand overflow-x-hidden" data-testid="br-for-brand" data-brand={fit.slug}>
      {/* Hero: brand products + headline */}
      <section className="border-b border-background/15 bg-foreground text-background">
        <div className="container mx-auto max-w-6xl px-5 pb-10 pt-8 md:px-6 md:pb-14 md:pt-12">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
            <div>
              {fit.logoSrc ? (
                <img
                  src={fit.logoSrc}
                  alt={fit.logoAlt ?? fit.name}
                  className="mb-6 h-12 w-auto md:h-14"
                  width={112}
                  height={88}
                />
              ) : null}
              <Eyebrow dark>{fit.eyebrow}</Eyebrow>
              <H1 className="mt-3 text-background">{fit.headline}</H1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-background/80 md:text-lg">{fit.lede}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Cta href={LOOK_HREF} variant="lime" testId="for-brand-look-hero" className="w-full sm:w-auto">
                  $190 USD look
                </Cta>
                <Cta href={RESERVE_HREF} variant="lineDark" testId="for-brand-lock-hero" className="w-full sm:w-auto">
                  $490 USD category lock
                </Cta>
              </div>
            </div>
            {products.length ? (
              <div>
                <ul className="grid grid-cols-3 gap-2 sm:gap-3">
                  {products.map((p) => {
                    const img = (
                      <img
                        src={p.src}
                        alt={p.alt}
                        className="aspect-square w-full object-cover"
                        width={700}
                        height={700}
                        loading="eager"
                        decoding="async"
                      />
                    );
                    return (
                      <li key={p.src} className="bg-background">
                        {p.href ? (
                          <a href={p.href} target="_blank" rel="noopener noreferrer" className="block" aria-label={p.title}>
                            {img}
                          </a>
                        ) : (
                          img
                        )}
                        <p className="px-2 py-2 text-center text-[11px] font-medium leading-tight text-foreground sm:text-xs">
                          {p.href ? (
                            <a href={p.href} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                              {p.title}
                            </a>
                          ) : (
                            p.title
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                {fit.photoCredit ? (
                  <p className="mt-2 text-right text-[11px] text-background/55">
                    {fit.photoCreditHref ? (
                      <a href={fit.photoCreditHref} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                        {fit.photoCredit}
                      </a>
                    ) : (
                      fit.photoCredit
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Hub and page tiles */}
      {tiles.length ? (
        <section className="border-b border-border/70 bg-background">
          <div className="container mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-12">
            <Eyebrow>Where they already show up</Eyebrow>
            <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">Live hubs and racquet pages.</h2>
            {liveTiles.length ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {liveTiles.map((t) => (
                  <li key={t.title}>
                    <HubCard tile={t} large />
                  </li>
                ))}
              </ul>
            ) : null}
            {pageTiles.length ? (
              <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${liveTiles.length ? "mt-3" : "mt-6"}`}>
                {pageTiles.map((t) => (
                  <li key={t.title}>
                    <HubCard tile={t} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Overlap graphic */}
      <section className="border-b border-border/70 bg-secondary/40">
        <div className="container mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-12">
          <Eyebrow>Audience overlap</Eyebrow>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">Same person, already in the room.</h2>
          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-0">
            <div className="border border-foreground/15 bg-white p-5 md:rounded-none">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">{fit.name}'s customer</p>
              <ul className="mt-3 space-y-2 text-sm leading-snug">
                {fit.profile.slice(0, 3).map((p) => (
                  <li key={p.label} className="border-l-2 border-accent pl-3">
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center bg-foreground px-5 py-6 text-center text-background md:min-w-44 md:px-6">
              <p className="font-display text-xl leading-tight md:text-2xl">The overlap</p>
            </div>
            <div className="border border-foreground/15 bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Our hubs and rooms</p>
              <ul className="mt-3 space-y-2">
                {fit.overlap
                  .filter((o) => o.strength)
                  .map((o) => (
                    <li key={o.title} className="flex flex-wrap items-center justify-between gap-2 text-sm leading-snug">
                      <span>{o.title}</span>
                      {o.strength ? <StrengthChip strength={o.strength} /> : null}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Fit is qualitative — Strong or Good — not a measured share or invented percentage.</p>
          <details className="group mt-5 border border-foreground/15 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-display text-lg">
              Why these fit
              <span className="text-2xl leading-none transition group-open:rotate-45">+</span>
            </summary>
            <ul className="space-y-4 border-t border-foreground/10 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
              {fit.overlap.map((item) => (
                <li key={item.title}>
                  <span className="font-medium text-foreground">{item.title}. </span>
                  <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/55">{statusLabel(item.status)}</span>
                  {item.strength ? <StrengthChip strength={item.strength} /> : null}
                  <span className="mt-1 block">{item.line}</span>
                  <Links links={item.links} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      {/* Best-fit channel cards */}
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-12">
          <Eyebrow>Best fit for {fit.name}</Eyebrow>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">The channels that make the most sense.</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {fit.bestFits.map((item) => {
              const Icon = item.icon ? ICONS[item.icon] : ShoppingBag;
              return (
                <li key={item.title} className="border border-foreground/15 bg-white p-5">
                  <Icon className="size-6 text-foreground/70" aria-hidden />
                  <h3 className="mt-3 font-display text-xl leading-snug md:text-2xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.why}</p>
                  <Links links={item.links} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Launching brands logo strip */}
      <section className="border-b border-border/70 bg-secondary/40">
        <div className="container mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-12">
          <Eyebrow>Cataloged brands launching</Eyebrow>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">The company you'd be in.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{fit.launchingNote}</p>
          <ul className="mt-6 flex flex-wrap items-center gap-3">
            {fit.launchingBrands.map((b) => {
              const inner = (
                <>
                  {b.logoSrc ? (
                    <img src={b.logoSrc} alt="" className="h-8 w-auto max-w-[7rem] object-contain" />
                  ) : null}
                  <span className="text-sm font-medium">{b.name}</span>
                </>
              );
              return (
                <li key={b.name} className="flex h-16 items-center gap-2 border border-foreground/15 bg-white px-4">
                  {b.href ? (
                    <a href={b.href} className="flex items-center gap-2 underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border/70 bg-foreground text-background">
        <div className="container mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-14">
          <Eyebrow dark>Start</Eyebrow>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">Look for $190 USD, or lock the category for $490 USD.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-background/75">
            Pricing, live hubs and how category locks work are in the{" "}
            <a href="/media-kit" className="underline underline-offset-4 hover:text-accent">
              Birch Reserve media kit
            </a>
            . {fit.performanceOnlyLine}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href={LOOK_HREF} variant="lime" testId="for-brand-look" className="w-full sm:w-auto">
              $190 USD look
            </Cta>
            <Cta href={RESERVE_HREF} variant="lineDark" testId="for-brand-lock" className="w-full sm:w-auto">
              $490 USD category lock
            </Cta>
            <Cta href="/media-kit" variant="lineDark" testId="for-brand-kit" className="w-full sm:w-auto">
              Media kit
            </Cta>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-5 py-8 md:px-6">
          <details className="group border border-foreground/15 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl">
              Who they are, and sources
              <span className="text-2xl leading-none transition group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fit.profile.map((p) => (
                <article key={p.label} className="border border-foreground/10 p-3">
                  <h3 className="font-display text-lg leading-snug">{p.label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                </article>
              ))}
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {fit.sources.map((s) => (
                <li key={s.label}>
                  <span className="font-medium text-foreground">{s.label}. </span>
                  {s.text}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}

function HubCard({
  tile,
  large = false,
}: {
  tile: NonNullable<BrandFit["hubTiles"]>[number];
  large?: boolean;
}) {
  const img = (
    <img
      src={tile.imageSrc}
      alt={tile.imageAlt}
      className={`w-full object-cover object-top ${large ? "aspect-[16/10]" : "aspect-[16/9]"}`}
      width={1440}
      height={900}
      loading="lazy"
      decoding="async"
    />
  );
  return (
    <article className="group border border-foreground/15 bg-white">
      <div className="relative overflow-hidden">
        {tile.href ? (
          <a href={tile.href} target="_blank" rel="noopener noreferrer" aria-label={tile.hrefTitle ?? tile.title}>
            {img}
          </a>
        ) : (
          img
        )}
        {tile.status === "live" ? (
          <span className="absolute left-2 top-2 bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-foreground">
            Live
          </span>
        ) : tile.badge ? (
          <span className="absolute left-2 top-2 bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-background">
            {tile.badge}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {tile.logoSrc ? <img src={tile.logoSrc} alt="" className="h-6 w-auto object-contain" /> : null}
        <h3 className="font-display text-base leading-snug md:text-lg">
          {tile.href ? (
            <a href={tile.href} className="underline-offset-4 group-hover:underline" target="_blank" rel="noopener noreferrer">
              {tile.hrefTitle ?? tile.title}
            </a>
          ) : (
            tile.title
          )}
        </h3>
      </div>
    </article>
  );
}

export default function BrForBrand() {
  const [, params] = useRoute("/for/:slug");
  const fit = getBrandFit(params?.slug);
  if (!fit) return <NotFound />;
  return <BrandFitPage fit={fit} />;
}
