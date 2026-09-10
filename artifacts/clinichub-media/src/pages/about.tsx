import { useEffect } from 'react';
import { ArrowRight, Building2, MapPinned, Network } from 'lucide-react';
import birchReserveMark from '@assets/brand/birch-reserve-mark-v2.svg';

const pageTitle = 'About Birch Reserve | Clinic Hubs Advertising';
const pageDescription =
  'Learn how Birch Reserve, a Silver Birch Growth portfolio project, connects Scale Health brand partners, Clinic Member Hubs, and trusted retail partners.';

const pillars = [
  {
    icon: Building2,
    eyebrow: 'Brand acceleration',
    title: 'A focused growth project',
    description:
      'Birch Reserve is part of the RDGDH portfolio and is built by Silver Birch Growth (SBG) to help Scale Health brand partners explore coordinated advertising and partnership pathways.',
  },
  {
    icon: Network,
    eyebrow: 'Connected audiences',
    title: 'Built around Clinic Member Hubs',
    description:
      'Through Clinic Member Hubs, Birch Reserve is designed to connect audiences from participating Scale Health brand partners with a network of trusted retail partners.',
  },
  {
    icon: MapPinned,
    eyebrow: 'Network direction',
    title: 'Canada today, U.S. next',
    description:
      'The network is rooted in Canada, with a planned expansion into the United States as the partner ecosystem develops.',
  },
];

export default function About() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = description?.content;

    document.title = pageTitle;
    description?.setAttribute('content', pageDescription);

    return () => {
      document.title = previousTitle;
      if (description && previousDescription) {
        description.setAttribute('content', previousDescription);
      }
    };
  }, []);

  const basePath = import.meta.env.BASE_URL;

  return (
    <div className="overflow-hidden">
      <section className="border-b border-border bg-secondary/20">
        <div className="container mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <img
                src={birchReserveMark}
                alt=""
                aria-hidden="true"
                className="size-8 rounded-lg"
              />
              About Birch Reserve
            </div>
            <h1 className="font-display text-5xl leading-[0.96] tracking-tight text-foreground md:text-7xl">
              Connecting trusted health and retail ecosystems.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Birch Reserve is a portfolio project within RDGDH, built by
              Silver Birch Growth (SBG) to accelerate Scale Health brand
              partners and help create thoughtful connections across Clinic
              Member Hubs and trusted retail networks.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-20 md:py-28">
        <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          {pillars.map(({ icon: Icon, eyebrow, title, description }) => (
            <article key={title} className="bg-background p-8 md:p-10">
              <Icon className="mb-10 size-6 text-accent" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-tight text-foreground">
                {title}
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-foreground text-background">
        <div className="container mx-auto grid gap-12 px-6 py-16 md:grid-cols-[1fr_auto] md:items-end md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">
              Founder
            </p>
            <h2 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">
              Founded by Randy Gilling.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-background/70">
              Birch Reserve brings together the operating perspective of
              Silver Birch Growth, the Scale Health partner ecosystem, and a
              growing network of trusted retail relationships.
            </p>
          </div>
          <a
            href={`${basePath}#splash-ad`}
            className="inline-flex h-12 items-center justify-center border border-background/30 px-6 text-sm font-medium transition-colors hover:bg-background hover:text-foreground"
          >
            Explore advertising <ArrowRight className="ml-2 size-4" />
          </a>
        </div>
      </section>
    </div>
  );
}