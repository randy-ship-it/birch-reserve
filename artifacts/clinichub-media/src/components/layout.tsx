import { Link, useLocation } from 'wouter';
import { ReactNode, useEffect, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import birchReserveMark from '@assets/brand/birch-reserve-mark-v2.svg';
import { SELLER_EMAIL_HREF, SELLER_IDENTITY } from '@/lib/seller-identity';
import { RandyChat } from '@/components/randy-chat';
import { HearRandyElevenLabs } from '@/components/hear-randy-elevenlabs';
import { LingerCapture } from '@/components/linger-capture';
import { CurrencyToggle } from '@/components/currency-toggle';

const NAV_GROUPS = [
  {
    label: 'Advertise',
    items: [
      { href: '/advertise/brands', label: 'Brands', sub: 'Lock in spend across co-branded hubs' },
      { href: '/advertise/local', label: 'Local businesses & studios', sub: 'Lock down your 5 km area' },
    ],
  },
  {
    label: 'Publish',
    items: [
      { href: '/publish/brands', label: 'Brands', sub: 'Co-branded hub or display / CPC inquiry' },
      { href: '/publish/studios', label: 'Studios & retail', sub: '$500 cash or $700+ ad credit to activate' },
    ],
  },
] as const;

const NAV_LINKS = [
  { href: '/rates', label: 'Rates' },
  { href: '/hubs', label: 'Hubs' },
  { href: '/media-kit', label: 'Marketing kit' },
  { href: '/agencies', label: 'Agencies' },
  { href: '/ai-buyers', label: 'AI buyers' },
] as const;

const FOOTER_COLS = [
  { label: 'Advertise', items: [{ href: '/advertise/brands', label: 'Brands' }, { href: '/advertise/local', label: 'Lock down my area' }, { href: '/rates', label: 'Rates' }, { href: '/match', label: 'Match your audience' }, { href: '/media-kit', label: 'Marketing kit' }] },
  { label: 'Publish', items: [{ href: '/publish/brands', label: 'Brands' }, { href: '/publish/studios', label: 'Studios & retail' }, { href: 'https://www.scalehealth.ca/clinichubs', label: 'scalehealth.ca/clinichubs' }] },
  { label: 'More', items: [{ href: '/hubs', label: 'Hubs in queue' }, { href: '/agencies', label: 'Agencies' }, { href: '/ai-buyers', label: 'For AI buying agents' }, { href: '/llms.txt', label: 'llms.txt' }, { href: '/inventory', label: 'Live inventory' }, { href: '/insights', label: 'Insights' }, { href: '/about', label: 'About' }, { href: '/terms', label: 'Terms' }, { href: '/privacy', label: 'Privacy' }] },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const basePath = import.meta.env.BASE_URL;
  const [location] = useLocation();

  // SPA deep links (/advertise/brands#slots): the target renders after load, so the browser's
  // own fragment jump misses it. Scroll once it exists; [id] scroll-margin-top clears the fixed nav.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 20) {
        window.clearInterval(t);
        el?.scrollIntoView({ block: 'start' });
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [location]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="fixed top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md print:hidden">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <img
              src={birchReserveMark}
              alt=""
              aria-hidden="true"
              className="size-8 rounded-[0.65rem] shadow-sm transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
            />
            <span className="font-display text-2xl text-foreground tracking-tight italic">Birch Reserve</span>
          </Link>

          {/* Desktop Nav: Advertise (Brands / Local) · Publish (Brands / Studios) · tools */}
          <nav className="hidden lg:flex items-center gap-6 text-sm text-foreground" data-testid="main-nav">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="group relative">
                <button type="button" className="inline-flex items-center gap-1 py-5 font-medium hover:text-foreground/70" aria-haspopup="true">
                  {g.label} <ChevronDown className="size-3.5" />
                </button>
                <div className="invisible absolute left-0 top-full w-72 border border-border bg-background p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {g.items.map((it) => (
                    <a key={it.href} href={it.href} className="block px-3 py-2.5 hover:bg-secondary/60">
                      <span className="block font-semibold">{it.label}</span>
                      <span className="block text-xs text-muted-foreground">{it.sub}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground/70 transition-colors">{l.label}</a>
            ))}
            <a href="tel:+16479316278" className="font-medium whitespace-nowrap underline-offset-2 hover:underline" data-testid="header-call-birch">(647) 931-6278</a>
            <a
              href="/match"
              className="inline-flex items-center gap-1.5 bg-foreground px-3.5 py-2 font-semibold text-background transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
              data-testid="nav-match"
            >
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Match your audience
            </a>
          </nav>

          <div className="lg:hidden flex items-center gap-2">
            <a
              href="/match"
              className="inline-flex items-center gap-1.5 bg-foreground px-3 py-2 text-sm font-semibold text-background"
              data-testid="nav-match-mobile"
            >
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Match
            </a>
            <button
              className="p-2 -mr-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 w-full max-h-[calc(100dvh-4rem)] overflow-y-auto bg-background border-b border-border p-6" data-testid="mobile-menu">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mb-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/50">{g.label}</p>
                {g.items.map((it) => (
                  <a key={it.href} href={it.href} onClick={() => setMobileMenuOpen(false)} className="block border-b border-border/60 py-3">
                    <span className="block font-semibold">{it.label}</span>
                    <span className="block text-xs text-muted-foreground">{it.sub}</span>
                  </a>
                ))}
              </div>
            ))}
            <div className="flex flex-col">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)} className="border-b border-border/60 py-3 font-medium">{l.label}</a>
              ))}
              <a href="tel:+16479316278" className="py-3 font-medium">Call Birch: (647) 931-6278</a>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col pt-16 print:pt-0">
        {children}
      </main>

      <footer className="border-t border-border pt-16 pb-16 md:py-24 bg-background mt-auto print:hidden">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <img
                src={birchReserveMark}
                alt=""
                aria-hidden="true"
                className="size-9 rounded-xl shadow-sm"
              />
              <span className="font-display text-2xl tracking-tight italic">Birch Reserve</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The Reserve List: early slots inside listed Scale Health hubs, by category. Your payment is media credit, not airfare.
            </p>
            <p className="mb-4 text-sm">
              <a href="tel:+16479316278" className="font-medium text-accent hover:underline" data-testid="footer-call-birch">Call Birch: (647) 931-6278</a>
              <span className="block text-[11px] text-muted-foreground">Birch is our AI voice line, 24/7.</span>
            </p>
            <p className="text-xs leading-relaxed text-foreground">
              {SELLER_IDENTITY} · <a href={SELLER_EMAIL_HREF} className="underline underline-offset-2 hover:text-accent">Email sales</a>
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-6">
              In Partnership With<br/>
              <span className="text-foreground mt-1 block mb-1"><a href="https://scalehealth.ca" className="hover:text-accent" target="_blank" rel="noopener noreferrer">Scale Health Network Inc.</a></span>
              <span className="text-foreground block"><a href="https://rdgdh.com" className="hover:text-accent" target="_blank" rel="noopener noreferrer">RDG Digital Holdings Inc.</a></span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
            {FOOTER_COLS.map((c) => (
              <div key={c.label} className="flex flex-col gap-3 text-sm">
                <span className="text-xs font-medium uppercase tracking-widest text-foreground/50 mb-1">{c.label}</span>
                {c.items.map((it) => (
                  <a key={it.href} href={it.href} className="hover:text-foreground/70 transition-colors">{it.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="container mx-auto px-6 mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Silver Birch Growth Inc. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Chat Randy (bottom-right); Hear Randy ElevenLabs ConvAI (bottom-left) */}
      <div className="print:hidden">
        <RandyChat />
        <HearRandyElevenLabs />
        <LingerCapture />
      </div>
    </div>
  )
}