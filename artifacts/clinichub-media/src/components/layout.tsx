import { Link, useLocation } from 'wouter';
import { ReactNode, useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import birchReserveMark from '@assets/brand/birch-reserve-mark-v2.svg';
import { SELLER_IDENTITY } from '@/lib/seller-identity';
import { trackCta } from '@/lib/track-cta';
import { RandyChat } from '@/components/randy-chat';

export function Layout({ children }: { children: ReactNode }) {
  const basePath = import.meta.env.BASE_URL;
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: `${basePath}#placements`, label: 'Ad Examples' },
    { href: `${basePath}#splash-ad`, label: 'Advertise' },
    { href: `/insights`, label: 'Insights' },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="fixed top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src={birchReserveMark}
              alt=""
              aria-hidden="true"
              className="size-8 rounded-[0.65rem] shadow-sm transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
            />
            <span className="font-display text-2xl text-foreground tracking-tight italic">Birch Reserve</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-foreground">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-accent transition-colors"
                onClick={() => {
                  if (link.label === "Insights") trackCta("nav_insights");
                }}
              >
                {link.label}
              </a>
            ))}
            <Link href="/about" className="hover:text-accent transition-colors">About</Link>
            <div className="w-px h-4 bg-border" />
            <Link href="/marketplace" className="hover:text-accent transition-colors font-medium">Partner Workspace</Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 -mr-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-background border-b border-border p-6 flex flex-col gap-6">
            <nav className="flex flex-col gap-4 text-base">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-foreground hover:text-accent transition-colors py-2 border-b border-border/50"
                  onClick={() => {
                    if (link.label === "Insights") trackCta("nav_insights");
                    setMobileMenuOpen(false);
                  }}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/about"
                className="text-foreground hover:text-accent transition-colors py-2 border-b border-border/50"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/marketplace"
                className="text-foreground hover:text-accent transition-colors py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Partner Workspace
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col pt-16">
        {children}
      </main>

      <footer className="border-t border-border pt-16 pb-16 md:py-24 bg-background mt-auto">
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
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Eight category seats inside signed Scale Health hubs. Credit, not a flight.
            </p>
            <p className="text-xs leading-relaxed text-foreground">
              {SELLER_IDENTITY}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-6">
              In Partnership With<br/>
              <span className="text-foreground mt-1 block mb-1">Scale Health Network Inc. (<a href="https://scalehealth.ca" className="hover:text-accent" target="_blank" rel="noreferrer">scalehealth.ca</a>)</span>
              <span className="text-foreground block">RDG Digital Holdings Inc. (<a href="https://rdgdh.com" className="hover:text-accent" target="_blank" rel="noreferrer">rdgdh.com</a>)</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-12 sm:gap-24">
             <div className="flex flex-col gap-4 text-sm">
                <span className="text-xs font-medium uppercase tracking-widest text-foreground/50 mb-2">Platform</span>
                  <a href={`${basePath}#placements`} className="hover:text-accent transition-colors">Ad Examples</a>
                 <a href={`${basePath}#splash-ad`} className="hover:text-accent transition-colors">Advertise</a>
                 <Link href="/about" className="hover:text-accent transition-colors">About</Link>
                <Link href="/kit" className="hover:text-accent transition-colors">Kit</Link>
                <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
                <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
             </div>
             <div className="flex flex-col gap-4 text-sm">
                <span className="text-xs font-medium uppercase tracking-widest text-foreground/50 mb-2">Access</span>
                <Link href="/marketplace" className="hover:text-accent transition-colors">Partner Workspace</Link>
             </div>
          </div>
        </div>
        <div className="container mx-auto px-6 mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Silver Birch Growth Inc. All rights reserved.
          </div>
        </div>
      </footer>

      {/* DRAFT: Chat Randy — site-wide; Book a call opens this, not Cal */}
      <RandyChat />
    </div>
  )
}