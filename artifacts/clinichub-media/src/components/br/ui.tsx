import { type ReactNode, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getAttribution } from "@/lib/attribution";

export * as M from "../../../../api-server/src/lib/overhaul/model";

export function Section({ id, children, className = "", tone = "plain" }: { id?: string; children: ReactNode; className?: string; tone?: "plain" | "soft" | "ink" }) {
  const toneClass = tone === "ink" ? "bg-foreground text-background" : tone === "soft" ? "bg-secondary/40" : "bg-background";
  return (
    <section id={id} className={`${toneClass} scroll-mt-20 border-b border-border/70 ${className}`}>
      <div className="container mx-auto px-6 py-16 md:py-24">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60 ${className}`}>{children}</p>;
}

export function H1({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-4xl leading-[1.02] tracking-tight md:text-6xl ${className}`}>{children}</h1>;
}

export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-3xl leading-tight tracking-tight md:text-5xl ${className}`}>{children}</h2>;
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground ${className}`}>{children}</p>;
}

export function Modelled({ children = "Modelled" }: { children?: ReactNode }) {
  return (
    <span className="ml-1 inline-flex items-center border border-foreground/20 bg-secondary/60 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-foreground/70" title="Modelled from the TAM feed (scalehealth.ca/tam). Not measured delivery.">
      {children}
    </span>
  );
}

export function Cta({ href, children, variant = "lime", className = "", onClick, testId }: { href: string; children: ReactNode; variant?: "lime" | "ink" | "line"; className?: string; onClick?: () => void; testId?: string }) {
  const v =
    variant === "lime"
      ? "bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
      : variant === "ink"
        ? "bg-foreground text-background hover:bg-accent hover:text-accent-foreground"
        : "border border-foreground/25 text-foreground hover:border-foreground hover:bg-foreground hover:text-background";
  return (
    <a href={href} onClick={onClick} data-testid={testId} className={`inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-semibold transition-colors ${v} ${className}`}>
      {children} <ArrowRight className="size-4" aria-hidden />
    </a>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputClass = "h-12 w-full border border-foreground/20 bg-white px-3 text-base text-foreground outline-none transition focus:border-foreground focus:ring-2 focus:ring-accent";
export const textareaClass = "min-h-28 w-full border border-foreground/20 bg-white p-3 text-base text-foreground outline-none transition focus:border-foreground focus:ring-2 focus:ring-accent";

export async function postJson<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T }> {
  const attribution = getAttribution();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, utm: attribution, path: window.location.pathname }),
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = { error: "Something went wrong. Email sales@silverbirchgrowth.com." } as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export type OverhaulStatus = { areaLockCheckout: boolean; depositCheckout: boolean; stripeMode: string; friday: boolean };

export function useOverhaulStatus(): OverhaulStatus | null {
  const [s, setS] = useState<OverhaulStatus | null>(null);
  useEffect(() => {
    fetch("/v1/overhaul/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setS(d))
      .catch(() => setS(null));
  }, []);
  return s;
}

/** Simple per-page <title>/<meta description> for the SPA; the server also rewrites the head for crawlers. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", description);
  }, [title, description]);
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((it) => (
        <details key={it.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl">
            {it.q}
            <span className="text-2xl leading-none transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{it.a}</p>
        </details>
      ))}
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) }} />
    </div>
  );
}
