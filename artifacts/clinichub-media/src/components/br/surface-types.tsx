/**
 * "Three surface types" (Randy t420u, Nov 21 2026 5:05 PM): brand hubs, Calm Joints, provider network. Shown under the reel
 * player on /intake/reel (Scale) and mirrored as static HTML in public/reel/index.html (keep both in sync).
 * Rules: no counts, no forecasts, never call a hub open, no live hub ads; illustrations are labelled examples.
 */
export const SURFACE_ART = {
  hubs: `<svg viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="320" height="140" fill="#EEF6DD"/><rect x="58" y="18" width="204" height="108" rx="12" fill="#fff" stroke="#D3D7DE"/><rect x="58" y="18" width="204" height="20" rx="12" fill="#F6F7F3"/><rect x="58" y="30" width="204" height="8" fill="#F6F7F3"/><circle cx="72" cy="28" r="3" fill="#C9CFC2"/><circle cx="82" cy="28" r="3" fill="#C9CFC2"/><circle cx="92" cy="28" r="3" fill="#C9CFC2"/><rect x="74" y="50" width="34" height="34" rx="9" fill="#071A39"/><path d="M84 67h14M91 60v14" stroke="#C8F55A" stroke-width="3" stroke-linecap="round"/><text x="118" y="73" font-family="IBM Plex Sans,Arial" font-size="16" font-weight="700" fill="#9AA3B2">+</text><rect x="132" y="50" width="34" height="34" rx="9" fill="#BDEFD0"/><path d="M143 67h12M149 61v12" stroke="#173D2B" stroke-width="4" stroke-linecap="round"/><rect x="176" y="54" width="70" height="7" rx="3.5" fill="#071A39"/><rect x="176" y="67" width="52" height="6" rx="3" fill="#D3D7DE"/><rect x="74" y="94" width="52" height="20" rx="6" fill="#F6F7F3" stroke="#E4E6E0"/><rect x="134" y="94" width="52" height="20" rx="6" fill="#F6F7F3" stroke="#E4E6E0"/><rect x="194" y="94" width="52" height="20" rx="6" fill="#C8F55A"/><rect x="214" y="10" width="54" height="16" rx="8" fill="#FFF1C2" stroke="#E9CF73"/><text x="241" y="21.5" text-anchor="middle" font-family="IBM Plex Sans,Arial" font-size="8.5" font-weight="700" letter-spacing="1" fill="#6B5200">EXAMPLE</text></svg>`,
  calm: `<svg viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="320" height="140" fill="#173D2B"/><path d="M70 104 C120 104 120 60 168 60 S 222 98 262 92" fill="none" stroke="#BDEFD0" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" opacity=".8"/><g transform="translate(40 70)"><path d="M0 14 L22 2 L44 14 L44 40 L22 52 L0 40 Z" fill="#C8F55A"/><path d="M0 14 L22 26 L44 14 M22 26 V52" fill="none" stroke="#173D2B" stroke-width="2"/><path d="M11 8 L33 20" stroke="#173D2B" stroke-width="2"/></g><g transform="translate(150 34)"><path d="M18 0 C28 0 36 8 36 18 C36 31 18 44 18 44 C18 44 0 31 0 18 C0 8 8 0 18 0Z" fill="#fff"/><circle cx="18" cy="18" r="7" fill="#173D2B"/></g><g transform="translate(244 58)"><path d="M0 20 L20 4 L40 20 V44 H0 Z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><rect x="14" y="28" width="12" height="16" fill="#fff"/></g><circle cx="258" cy="36" r="13" fill="#C8F55A"/><path d="M252 36 l4 4 l8 -8" fill="none" stroke="#173D2B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  providers: `<svg viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="320" height="140" fill="#0B1B38"/><path d="M34 52 C60 30 110 26 150 34 C190 42 214 26 252 30 C280 33 296 52 290 74 C284 98 252 110 214 108 C176 106 150 118 112 114 C70 110 36 100 28 80 C24 68 26 60 34 52Z" fill="#132A4F"/><path d="M60 72 H270" stroke="#22406E" stroke-width="1.5" stroke-dasharray="4 5"/><g fill="#C8F55A"><circle cx="78" cy="60" r="5"/><circle cx="122" cy="88" r="5"/><circle cx="168" cy="54" r="5"/><circle cx="206" cy="92" r="5"/><circle cx="246" cy="62" r="5"/></g><g fill="none" stroke="#C8F55A" stroke-opacity=".35"><circle cx="78" cy="60" r="11"/><circle cx="168" cy="54" r="11"/><circle cx="246" cy="62" r="11"/></g><g transform="translate(176 14)"><rect width="78" height="30" rx="7" fill="#fff"/><rect x="7" y="7" width="16" height="16" rx="4" fill="#BDEFD0"/><rect x="29" y="8" width="40" height="5" rx="2.5" fill="#071A39"/><rect x="29" y="17" width="28" height="4" rx="2" fill="#D3D7DE"/></g><path d="M200 44 L170 52" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/></svg>`,
} as const;

export const SURFACES = [
  { key: "hubs", kicker: "Brand hubs", h: "Co-branded hubs for partner brands", line: "Your audience gets added value from a clinic layer, and your brand gets exposure across hubs.", more: "For supplier partner brands that want maximum exposure across hubs. Each co-branded hub pairs the brand's audience with a clinic layer. Ads on a hub run only with the owner's approval. Illustration is an example." },
  { key: "calm", kicker: "Calm Joints", h: "Scale's in-house consumer brand", line: "The consumer face of Scale Health, handling Recovery fulfillment, with Street Team ambassadors.", more: "Calm Joints fulfills Recovery orders and has full access to the Street Team ambassadors, who do on-site product sampling as well as door-to-door work." },
  { key: "providers", kicker: "Provider network", h: "Private retail providers, Canada and USA", line: "Digital and brick-and-mortar retail providers activate their own templated hubs.", more: "Scale's private network of retail providers, both digital and brick-and-mortar in-person retail, across Canada and the USA. Each provider can activate a templated hub with its own products and services, plus display and CPC inventory." },
] as const;

export function SurfaceTypes({ className = "" }: { className?: string }) {
  return (
    <section className={className} data-testid="surface-types" aria-labelledby="surface-types-h">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55">Where brands show up</p>
      <h2 id="surface-types-h" className="mt-1 font-display text-2xl md:text-3xl">Three surface types.</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {SURFACES.map((s) => (
          <article key={s.key} className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#D3D7DE] bg-white shadow-[0_10px_28px_-20px_rgba(7,26,57,.35)]" data-testid={`surface-${s.key}`}>
            <div className="aspect-[320/140] w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: SURFACE_ART[s.key] }} />
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/60">{s.kicker}</span>
              <h3 className="font-display text-xl leading-tight">{s.h}</h3>
              <p className="text-sm text-foreground/75">{s.line}</p>
              <details className="mt-auto border-t border-foreground/10 pt-2 text-sm">
                <summary className="cursor-pointer font-semibold">Details</summary>
                <p className="mt-1.5 text-foreground/75">{s.more}</p>
              </details>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
