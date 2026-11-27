import { Link, useLocation } from 'wouter';
import { ReactNode, useEffect, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import birchReserveMark from '@assets/brand/birch-reserve-mark-v2.svg';
import { MEDIA_KIT_ONE_PAGER_HREF, SELLER_EMAIL_HREF, SELLER_IDENTITY } from '@/lib/seller-identity';
import { OperatorLine, PrivacyNote, SalesContact } from '@/components/br/trust';
import { RandyChat } from '@/components/randy-chat';
import { LingerCapture } from '@/components/linger-capture';
import { CurrencyToggle } from '@/components/currency-toggle';
import { CurrencyText } from '@/components/currency-text';
import { KitCta, StickyKitCta, intakeHref } from '@/components/br/kit-cta';
import { logArrival, logCtaClick } from '@/lib/shareTrack';
import { isScaleSkin } from '@/lib/siteSkin';
import { ScaleFooter, ScaleHeader } from '@/components/scale-chrome';

const NAV_GROUPS = [
  {
    label: 'Advertise',
    items: [
      { href: '/advertise/brands', label: 'Brands', sub: 'Start at $190 or $490 USD' },
      { href: '/advertise/local', label: 'Local businesses & studios', sub: 'Reach clinic layer members near you' },
      { href: '/audiences', label: 'Audience insights', sub: 'Who the launch brands bring' },
    ],
  },
  {
    label: 'Publish',
    items: [
      { href: '/publish/brands', label: 'Brands', sub: 'Co-branded clinic layer or display / CPC inquiry' },
      { href: '/publish/studios', label: 'Studios & retail', sub: '$500 cash or $700+ ad credit to activate' },
    ],
  },
] as const;

const NAV_LINKS = [
  { href: '/match', label: 'Match' },
  { href: '/rates', label: 'Rates' },
  { href: '/hubs', label: 'Clinic layers' },
  { href: '/media-kit', label: 'Media kit' },
  { href: '/agencies', label: 'Agencies' },
  { href: '/buyers', label: 'Buyers' },
] as const;

const FOOTER_COLS = [
  { label: 'Advertise', items: [{ href: '/advertise/brands', label: 'Brands' }, { href: '/advertise/local', label: 'Local businesses & studios' }, { href: '/rates', label: 'Rates' }, { href: '/match', label: 'Match your audience' }, { href: '/audiences', label: 'Audience insights' }, { href: '/media-kit', label: 'Media kit' }, { href: MEDIA_KIT_ONE_PAGER_HREF, label: 'Media kit PDF' }] },
  { label: 'Publish', items: [{ href: '/publish/brands', label: 'Brands' }, { href: '/publish/studios', label: 'Studios & retail' }, { href: 'https://www.scalehealth.ca/clinichubs', label: 'scalehealth.ca/clinichubs' }] },
  { label: 'More', items: [{ href: '/blog', label: 'Blog' }, { href: '/hubs', label: 'Clinic layers' }, { href: '/agencies', label: 'Agencies' }, { href: '/partners', label: 'Partnerships' }, { href: '/media-buyers', label: 'Media buyers' }, { href: '/buyers', label: 'Buyers' }, { href: '/llms.txt', label: 'llms.txt' }, { href: '/inventory', label: 'Partner inventory' }, { href: '/insights', label: 'Insights' }, { href: '/about', label: 'About' }, { href: '/terms', label: 'Terms' }, { href: '/privacy', label: 'Privacy' }] },
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
  // Share + referral arrivals (?ref=… / utm_*): logged once per page load (lib/shareTrack.ts).
  useEffect(() => logArrival(), [location]);


  // Staff screens (/sales/*): a plain internal shell. No public nav, kit CTA, phone button or chat squirrel (BR-15).
  if (/^\/sales(\/|$)/.test(location)) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans" data-shell="staff">
        <header className="border-b border-border bg-background print:hidden">
          <div className="container mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex min-h-10 items-center gap-2">
              <img src={birchReserveMark} alt="" aria-hidden="true" className="h-7 w-7" />
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#071A39]">Birch Reserve</span>
              <span className="text-[13px] text-muted-foreground">Staff</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  // Scale skin (scalehealth.ca/intake): Scale's own header + footer around the unchanged intake (lib/siteSkin.ts).
  if (isScaleSkin()) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans" data-skin-root="scale">
        <ScaleHeader />
        <main className="flex-1 flex flex-col pt-16 print:pt-0">{children}</main>
        <ScaleFooter />
        <div className="print:hidden">
          <RandyChat />
          <LingerCapture />
        </div>
        <StickyKitCta path={location} />
        <CurrencyText />
      </div>
    );
  }

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
          <nav className="hidden lg:flex items-center gap-4 xl:gap-5 text-sm [&>a]:whitespace-nowrap text-foreground" data-testid="main-nav">
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
            <span className="hidden xl:inline-flex"><CurrencyToggle className="[&_button]:min-h-8 [&_button]:min-w-9" /></span>
            <KitCta placement="nav" size="sm" sub={null} testId="nav-kit-cta" />
          </nav>

          <div className="lg:hidden flex items-center gap-2">
            <a
              href={intakeHref('nav_mobile')}
              onClick={() => logCtaClick('nav_mobile')}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-lime-300 px-3 py-2 text-sm font-bold text-[#0b1f3a] shadow"
              data-testid="nav-kit-cta-mobile"
            >
              Get my kit
            </a>
            <button
              className="-mr-2 grid size-10 place-items-center text-foreground"
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
            <div className="mb-5 flex items-center justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/50">Currency</span><CurrencyToggle /></div>
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
              Display space across private health and wellness clinic layers. Your payment is media credit until an insertion order.
            </p>
            <div className="mb-4">
              <SalesContact />
            </div>
            <OperatorLine className="text-xs leading-relaxed text-foreground" />
            <p className="mt-2 text-xs leading-relaxed text-foreground">
              {SELLER_IDENTITY} · <a href={SELLER_EMAIL_HREF} className="underline underline-offset-2 hover:text-accent">Email sales</a>
            </p>
            <PrivacyNote className="mt-3 text-xs leading-relaxed text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-6">
              In Partnership With<br/>
              <span className="text-foreground mt-1 block mb-1"><a href="https://scalehealth.ca" className="hover:text-accent" target="_blank" rel="noopener noreferrer">Scale Health Network Inc.</a></span>
              <span className="text-foreground block"><a href="https://rdgdh.com" className="hover:text-accent" target="_blank" rel="noopener noreferrer">RDG Digital Holdings Inc.</a></span>
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-16">
            {FOOTER_COLS.map((c) => (
              <div key={c.label} className="flex min-w-0 flex-col gap-0 text-sm md:gap-3">
                <span className="text-xs font-medium uppercase tracking-widest text-foreground/50 mb-1">{c.label}</span>
                {c.items.map((it) => (
                  <a key={it.href} href={it.href} className="break-words py-2.5 hover:text-foreground/70 transition-colors md:py-0">{/* URL-style labels break after the slash, not mid-word (design cal, Nov 23 2026). */}{it.label.includes("/") ? <>{it.label.slice(0, it.label.indexOf("/") + 1)}<wbr />{it.label.slice(it.label.indexOf("/") + 1)}</> : it.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="container mx-auto px-6 mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Silver Birch Growth Inc. All rights reserved. Birch Reserve is operated by Silver Birch Growth Inc., Toronto, Ontario.
          </div>
        </div>
      </footer>

      {/* Chat (bottom-right). No call widget (Randy, Nov 23 2026). */}
      <div className="print:hidden">
        <RandyChat />
        <LingerCapture />
      </div>
      <StickyKitCta path={location} />
        <CurrencyText />
    </div>
  )
}