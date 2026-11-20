/**
 * Scale Health header + footer for the Scale skin (scalehealth.ca/intake). Mirrors scalehealth.ca's own nav and footer
 * (same links, same logo, same Plus Jakarta Sans type) so the intake feels like a Scale page. The form below is the
 * unchanged Birch intake. All links stay on scalehealth.ca (data-mirror-keep) except the intake itself.
 */
import scaleLogo from "@assets/brand/scalehealth-logo-srgb-v2.png";
import { SCALE_HOME } from "@/lib/siteSkin";
import { intakeHref } from "@/components/br/kit-cta";
import { logCtaClick } from "@/lib/shareTrack";

const NAV = [
  { href: `${SCALE_HOME}/brands`, label: "For Brands", testId: "scale-nav-brands" },
  { href: `${SCALE_HOME}/hub-examples`, label: "Hub examples", testId: "scale-nav-hub-examples" },
  { href: `${SCALE_HOME}/clinichubs`, label: "For Studios", testId: "scale-nav-studios" },
  { href: `${SCALE_HOME}/providers`, label: "Providers", testId: "scale-nav-providers" },
] as const;

const FOOTER = [
  { href: `${SCALE_HOME}/privacy`, label: "Privacy" },
  { href: `${SCALE_HOME}/team`, label: "Team" },
  { href: `${SCALE_HOME}/case-studies`, label: "Cases" },
  { href: `${SCALE_HOME}/blog`, label: "Field Notes" },
  { href: `${SCALE_HOME}/be-a-supplier`, label: "Suppliers" },
  { href: `${SCALE_HOME}/inquire`, label: "Contact" },
  { href: `${SCALE_HOME}/clinichubs`, label: "Start your clinic hub" },
] as const;

function Logo({ className }: { className: string }) {
  return <img src={scaleLogo} alt="ScaleHealth" width={354} height={68} className={className} data-testid="scale-logo" />;
}

export function ScaleHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl print:hidden" data-testid="scale-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href={SCALE_HOME} data-mirror-keep="" className="inline-flex min-h-11 shrink-0 items-center transition-transform hover:-translate-y-0.5" data-testid="scale-home-link">
          <Logo className="h-7 w-auto rounded-sm sm:h-8" />
        </a>
        <nav className="hidden items-center gap-6 text-[15px] font-semibold text-muted-foreground md:flex lg:gap-10" data-testid="main-nav">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} data-mirror-keep="" data-testid={l.testId} className="inline-flex min-h-11 items-center transition-colors hover:text-foreground">{l.label}</a>
          ))}
        </nav>
        <a
          href={intakeHref("nav_mobile")}
          onClick={() => logCtaClick("nav_mobile")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-[#1d875c] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#176f4b]"
          data-testid="nav-kit-cta"
        >
          Get my kit
        </a>
      </div>
    </header>
  );
}

export function ScaleFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-secondary/20 py-4 sm:py-5 print:hidden" data-testid="scale-footer">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <a href={SCALE_HOME} data-mirror-keep="" className="inline-flex min-h-11 items-center">
            <Logo className="h-6 w-auto rounded-sm" />
          </a>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5">
            {FOOTER.map((l) => (
              <a key={l.href} href={l.href} data-mirror-keep="" className="inline-flex min-h-11 min-w-11 items-center justify-center text-xs text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
            ))}
          </nav>
        </div>
        <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ScaleHealth. Health, recovery, and commerce infrastructure for North America.
          <span className="block mt-1 text-[11px]">Intake reviewed with our ad partner Birch Reserve (Silver Birch Growth Inc.).</span>
        </p>
      </div>
    </footer>
  );
}
