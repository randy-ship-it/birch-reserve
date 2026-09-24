/**
 * "Example hubs" gallery (Randy via Emma 2026-09-24 6:48pm ET).
 *
 * Real desktop homepage screenshots (1440×900, captured 2026-09-24) of live,
 * public co-branded Scale Health hubs. Examples of the hub network only —
 * these brands are NOT Birch advertisers or seat holders. Brand labels only,
 * no URLs as visible text. Only the DR-HO card links out (new tab).
 * Only add a hub here after verifying its homepage is live, public (HTTP 200,
 * real content, no login wall) — never a mockup or an unlaunched hub.
 */
import { ArrowUpRight } from "lucide-react";

export type ExampleHub = {
  id: string;
  name: string;
  kind: string;
  image: string;
  /** Only DR-HO links out. */
  href?: string;
};

export const EXAMPLE_HUBS: ReadonlyArray<ExampleHub> = [
  {
    id: "drho",
    name: "DR-HO'S",
    kind: "Product brand hub",
    image: "/hub-gallery/drho.webp",
    href: "https://physio.drhonow.com/dr-ho/portal",
  },
  { id: "kalaya", name: "Kalaya", kind: "Product brand hub", image: "/hub-gallery/kalaya.webp" },
  { id: "jill-health", name: "Jill Health", kind: "Health brand hub", image: "/hub-gallery/jill-health.webp" },
  { id: "jack-health", name: "Jack Health", kind: "Health brand hub", image: "/hub-gallery/jack-health.webp" },
  { id: "effortless-admin", name: "Effortless Admin", kind: "Benefits hub", image: "/hub-gallery/effortless-admin.webp" },
  { id: "integrity", name: "Integrity Fitness", kind: "Fitness location hub", image: "/hub-gallery/integrity.webp" },
];

function CardBody({ hub }: { hub: ExampleHub }) {
  return (
    <>
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
        <img
          src={hub.image}
          alt={`${hub.name} co-branded hub homepage screenshot`}
          width={1440}
          height={900}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight text-foreground">{hub.name}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/50">{hub.kind}</p>
        </div>
        {hub.href ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground transition-colors group-hover:text-accent">
            Tour the hub <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
    </>
  );
}

export function ExampleHubsGallery() {
  return (
    <section
      id="example-hubs"
      aria-labelledby="example-hubs-title"
      className="border-b border-border bg-secondary/10 py-16 md:py-20"
    >
      <div className="container mx-auto px-6">
        <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
              The co-branded hub network
            </p>
            <h3 id="example-hubs-title" className="font-display text-3xl tracking-tight text-foreground md:text-5xl">
              Example hubs
            </h3>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Live co-branded Scale Health hubs, shown as examples of the network. Featured brands are not Birch advertisers or seat holders.
          </p>
        </div>

        <ul
          className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
          data-testid="example-hubs-list"
        >
          {EXAMPLE_HUBS.map((hub) => (
            <li key={hub.id} className="w-[82%] shrink-0 snap-start sm:w-[60%] md:w-auto">
              {hub.href ? (
                <a
                  href={hub.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Tour the ${hub.name} hub (opens in a new tab)`}
                  className="group block h-full border border-border bg-background transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:hover:translate-y-0"
                  data-testid={`example-hub-${hub.id}`}
                >
                  <CardBody hub={hub} />
                </a>
              ) : (
                <figure
                  className="group m-0 h-full border border-border bg-background transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)] motion-reduce:hover:translate-y-0"
                  data-testid={`example-hub-${hub.id}`}
                >
                  <CardBody hub={hub} />
                </figure>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Homepage screenshots of the hubs as they appear today. Birch display runs only on a hub named in an approved insertion order.
        </p>
      </div>
    </section>
  );
}
