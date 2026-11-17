import { useEffect } from "react";
import { useRoute } from "wouter";
import { Cta, H1, usePageMeta } from "@/components/br/ui";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { PlacementVisual } from "@/components/br/placement-example";
import NotFound from "@/pages/not-found";
import {
  getBrandFit,
  statusLabel,
  type BrandFit,
  type FitLink,
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

function Links({ links }: { links?: FitLink[] }) {
  if (!links?.length) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
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

function BrandFitPage({ fit }: { fit: BrandFit }) {
  useNoIndex();
  usePageMeta(`${fit.name} customer fit | Birch Reserve`, fit.lede);

  return (
    <div className="for-brand overflow-x-hidden" data-testid="br-for-brand" data-brand={fit.slug}>
      <section className="border-b border-background/15 bg-foreground text-background">
        <div className="container mx-auto max-w-5xl px-5 pb-10 pt-10 md:px-6 md:pb-14 md:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/55">{fit.eyebrow}</p>
          <H1 className="mt-3 text-background">{fit.headline}</H1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-background/80">{fit.lede}</p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {fit.heroVisuals.map((v) => {
              const img = (
                <img
                  src={v.src}
                  alt={v.alt}
                  width={1440}
                  height={900}
                  className="block h-auto w-full"
                  loading="eager"
                  decoding="async"
                />
              );
              return (
                <figure key={v.src} className="border border-background/20 bg-background p-1.5 text-foreground">
                  {v.href ? (
                    <a href={v.href} target="_blank" rel="noopener noreferrer" aria-label={v.hrefTitle ?? v.caption}>
                      {img}
                    </a>
                  ) : (
                    img
                  )}
                  <figcaption className="px-1 pt-2 text-[12px] leading-snug text-foreground/70">
                    {v.href && v.hrefTitle ? (
                      <a href={v.href} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                        {v.hrefTitle}
                      </a>
                    ) : (
                      v.caption
                    )}
                  </figcaption>
                </figure>
              );
            })}
            <figure className="border border-background/20 bg-background p-1.5 text-foreground">
              <div className="pointer-events-none select-none overflow-hidden bg-secondary/40" aria-hidden>
                <PlacementVisual k="post_purchase" />
              </div>
              <figcaption className="px-1 pt-2 text-[12px] leading-snug text-foreground/70">
                Post-purchase — the moment after a booking or order
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Customer profile</p>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">Who RAD already talks to.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {fit.profile.map((p) => (
              <article key={p.label} className="border border-foreground/15 bg-white p-4">
                <h3 className="font-display text-xl leading-snug">{p.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-sm">
            From{" "}
            <a href={fit.site.href} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
              {fit.site.title}
            </a>
            , plus what was shared with Scale Health. Details in the sources note below.
          </p>
        </div>
      </section>

      <section className="border-b border-border/70 bg-secondary/40">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Overlap</p>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">Where that customer already meets our network.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {fit.overlap.map((item) => (
              <article key={item.title} className="border border-foreground/15 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">{statusLabel(item.status)}</p>
                <h3 className="mt-1 font-display text-xl leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.line}</p>
                <Links links={item.links} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Best fit for {fit.name}</p>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">The four channels that make the most sense.</h2>
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {fit.bestFits.map((item, i) => (
              <li key={item.title} className="grid gap-2 py-5 md:grid-cols-[2.5rem_1fr] md:gap-4">
                <span className="font-display text-2xl text-foreground/35">{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl leading-snug md:text-2xl">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:text-base">{item.why}</p>
                  <Links links={item.links} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border/70 bg-secondary/40">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Cataloged brands launching</p>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">The company you'd be in.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{fit.launchingNote}</p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fit.launchingBrands.map((b) => {
              const inner = (
                <>
                  {b.logoSrc ? (
                    <img src={b.logoSrc} alt="" className="h-10 w-auto max-w-full object-contain" />
                  ) : null}
                  <span className={b.logoSrc ? "text-sm font-medium" : "font-display text-lg"}>{b.name}</span>
                </>
              );
              return (
                <li key={b.name} className="flex min-h-24 flex-col items-start justify-center gap-2 border border-foreground/15 bg-white p-4">
                  {b.href ? (
                    <a href={b.href} className="flex flex-col items-start gap-2 underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">
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

      <section className="border-b border-border/70 bg-foreground text-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/55">Start</p>
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
        <div className="container mx-auto max-w-5xl px-5 py-8 md:px-6">
          <details className="group border border-foreground/15 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl">
              Sources
              <span className="text-2xl leading-none transition group-open:rotate-45">+</span>
            </summary>
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

export default function BrForBrand() {
  const [, params] = useRoute("/for/:slug");
  const fit = getBrandFit(params?.slug);
  if (!fit) return <NotFound />;
  return <BrandFitPage fit={fit} />;
}
