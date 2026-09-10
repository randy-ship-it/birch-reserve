import './_group.css';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Target, 
  Award, 
  Crown, 
  CheckCircle2, 
  LayoutTemplate,
  Inbox,
  Search,
  Plus,
  Minus,
  Loader2,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  BarChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Data ─────────────────────────────────────────────────────────────────

const INVENTORY = [
  {
    id: 'inv_signal',
    eyebrow: 'Entry Placement',
    name: 'Signal Block',
    run: '30-Day Run',
    description: 'High-visibility display integration within contextual content streams. Ideal for testing new offers or localized lead magnets.',
    amount: 499,
    features: [
      'In-stream display block (Desktop & Mobile)',
      '1 curated newsletter inclusion',
      'Standard end-of-run performance report'
    ],
    callToAction: 'Secure Placement',
    featured: false,
    icon: Target,
  },
  {
    id: 'inv_spotlight',
    eyebrow: 'Featured Ownership',
    name: 'Category Spotlight',
    run: '90-Day Run',
    description: 'Own your specific wellness category. Premium real estate across high-intent discovery and resource pages.',
    amount: 2900,
    features: [
      'Category-exclusive banner placement',
      'Top-of-fold native article integration',
      '3 dedicated newsletter inclusions',
      'Bi-weekly performance tracking',
      '14-day right of first refusal on renewal'
    ],
    callToAction: 'Claim Category',
    featured: true,
    icon: Award,
  },
  {
    id: 'inv_anchor',
    eyebrow: 'Premium Exclusivity',
    name: 'Anchor Partner',
    run: '6-Month Run',
    description: 'The highest tier of integration. Become the definitive recommended solution for your specialized vertical.',
    amount: 9900,
    features: [
      'Global site-wide footer presence',
      'Exclusive "Presented By" header on top category',
      '1 dedicated solo email broadcast per month',
      'Custom API/CRM direct lead routing',
      'Quarterly strategy session with Clinichub Media'
    ],
    callToAction: 'Apply for Anchor',
    featured: false,
    icon: Crown,
  },
];

const FAQS = [
  {
    q: 'How does category exclusivity work?',
    a: 'For Category Spotlight and Anchor Partner tiers, we will not sell overlapping inventory to a direct competitor during your run. For example, if you claim the "IV Therapy" category, no other IV clinic will be featured in those specific ad slots.'
  },
  {
    q: 'Can I swap my creative during the run?',
    a: 'Yes. Signal Block partners can swap creative once per 30 days. Spotlight and Anchor partners can swap creative bi-weekly to test different offers or messaging.'
  },
  {
    q: 'Do you guarantee leads or traffic?',
    a: 'No. We guarantee premium placement, share of voice, and deliverability of the ad units across Scale Health Hub. Conversion volume depends entirely on the strength of your offer, creative, and landing page.'
  },
  {
    q: 'What happens when my run ends?',
    a: 'Spotlight and Anchor partners have a 14-day right of first refusal to renew their placement before it is opened back up to the public inventory.'
  }
];

// ─── Components ───────────────────────────────────────────────────────────

export function ExclusiveMarketplace() {
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCheckout = (offerId: string) => {
    setSelectedOfferId(offerId);
    setIsCheckingOut(true);
    // No-op for mockup
    setTimeout(() => {
      setIsCheckingOut(false);
      setSelectedOfferId(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans flex flex-col">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display font-extrabold text-xl tracking-tight">Scale Health Hub</span>
            <div className="hidden md:flex h-4 w-px bg-border" />
            <span className="hidden md:flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="uppercase tracking-widest text-[10px]">Represented by</span>
              <span className="text-foreground">Clinichub Media</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            <a href="#inventory" className="hover:text-foreground transition-colors">Inventory</a>
            <a href="#placements" className="hover:text-foreground transition-colors">Placements</a>
            <a href="#economics" className="hover:text-foreground transition-colors">Fit</a>
          </nav>
          
          <Button variant="default" size="sm" asChild className="rounded-none">
            <a href="#inventory">View Availabilities</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10" />
          <div className="container mx-auto px-6">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold tracking-widest mb-8 uppercase border border-border"
              >
                <div className="size-2 bg-primary rounded-full animate-pulse" />
                <span>Premium Ad Inventory</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-5xl md:text-7xl lg:text-[5.5rem] font-display font-extrabold tracking-tight leading-[0.95] mb-8"
              >
                Own the conversation in health & wellness.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-12 leading-relaxed font-medium"
              >
                Direct access to Scale Health Hub's audience. No bidding wars, no unpredictable algorithms—just premium, category-exclusive placements for serious clinics and health brands.
              </motion.p>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-border/50"
            >
              {[
                { label: 'Pricing', value: 'Fixed & Transparent' },
                { label: 'Exclusivity', value: 'Category Protection' },
                { label: 'Delivery', value: '100% Share of Voice' },
                { label: 'Management', value: 'Direct Buy' }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</div>
                  <div className="font-display font-bold text-lg">{stat.value}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Inventory (Pricing) ───────────────────────────────────────── */}
        <section id="inventory" className="py-24 bg-card border-y border-border">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-4">Available Inventory</h2>
                <p className="text-lg text-muted-foreground font-medium">
                  We sell time-based placement blocks, not impressions. Secure your run and dominate your category.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold bg-secondary px-4 py-2 text-secondary-foreground">
                <ShieldAlert className="size-4 text-primary" />
                <span>Inventory is strictly limited per category.</span>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {INVENTORY.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={cn(
                    'relative bg-background border flex flex-col p-8',
                    inv.featured 
                      ? 'border-primary shadow-2xl shadow-primary/5 lg:-translate-y-4' 
                      : 'border-border hover:border-primary/30 transition-colors'
                  )}
                >
                  {inv.featured && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold uppercase tracking-widest">
                      High Demand
                    </div>
                  )}
                  
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "size-10 flex items-center justify-center rounded-sm",
                        inv.featured ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      )}>
                        <inv.icon className="size-5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{inv.eyebrow}</span>
                    </div>
                    
                    <h3 className="text-3xl font-display font-extrabold mb-2">{inv.name}</h3>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-xs font-bold uppercase tracking-wider mb-4">
                      {inv.run}
                    </div>
                    
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium h-20">
                      {inv.description}
                    </p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-extrabold">${inv.amount.toLocaleString()}</span>
                      <span className="text-muted-foreground font-bold text-sm"> / one-time</span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border mb-8" />

                  <ul className="space-y-4 mb-10 flex-1">
                    {inv.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm font-medium leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    variant={inv.featured ? 'default' : 'outline'}
                    className={cn(
                      'w-full rounded-none h-14 font-bold tracking-wide uppercase text-sm',
                      !inv.featured && 'border-2'
                    )}
                    onClick={() => handleCheckout(inv.id)}
                    disabled={isCheckingOut && selectedOfferId !== inv.id}
                  >
                    {isCheckingOut && selectedOfferId === inv.id ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      inv.callToAction
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Placements ─────────────────────────────────────────────────── */}
        <section id="placements" className="py-24 bg-background">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-6">
                Where your brand lives.
              </h2>
              <p className="text-lg text-muted-foreground font-medium">
                Sponsor blocks are natively integrated into the Scale Health Hub ecosystem. We prioritize visibility in high-intent environments over run-of-network filler.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: LayoutTemplate,
                  title: 'Contextual Articles',
                  desc: 'In-stream native ad blocks placed naturally within top-performing educational content and resource guides.'
                },
                {
                  icon: Inbox,
                  title: 'Newsletter Inclusions',
                  desc: 'Curated sponsor slots in our weekly dispatch, delivered directly to health consumers and practitioners.'
                },
                {
                  icon: Search,
                  title: 'Directory Discovery',
                  desc: 'Premium positioning on category search pages, ensuring you capture users actively looking for solutions.'
                }
              ].map((item, i) => (
                <div key={i} className="p-8 border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <item.icon className="size-8 text-primary mb-6" />
                  <h3 className="text-xl font-display font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Economic Fit ───────────────────────────────────────────────── */}
        <section id="economics" className="py-24 bg-foreground text-background">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
              <div className="flex-1 max-w-2xl">
                <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-6">
                  Is this a fit for your unit economics?
                </h2>
                <p className="text-muted text-lg mb-8 leading-relaxed">
                  Scale Health Hub advertising isn't for every business. It works best for clinics and brands with high patient lifetime values (LTV). Below are illustrative customer-value bands to help you determine if our inventory aligns with your acquisition math.
                </p>
                <div className="p-6 bg-background/5 border border-background/10 text-sm text-muted">
                  <span className="font-bold text-background uppercase tracking-widest block mb-2">Important Disclosure</span>
                  These are illustrative planning ranges, not guaranteed returns. Actual value derived from a placement depends heavily on your specific service, profit margins, sales close rate, and patient retention.
                </div>
              </div>

              <div className="flex-1 w-full">
                <div className="space-y-4">
                  {[
                    {
                      band: '$500 – $2,500 LTV',
                      status: 'Moderate Fit',
                      desc: 'Requires high conversion volume. Signal Block ($499) recommended for testing.',
                      color: 'text-yellow-400',
                      bg: 'bg-yellow-400/10'
                    },
                    {
                      band: '$2,500 – $12,000 LTV',
                      status: 'Strong Fit',
                      desc: 'A single new patient covers the Spotlight tier ($2,900). Excellent math for specialty clinics.',
                      color: 'text-green-400',
                      bg: 'bg-green-400/10'
                    },
                    {
                      band: '$12,000 – $50,000+ LTV',
                      status: 'Ideal Fit',
                      desc: 'High-ticket surgical or concierge practices. Anchor tier ($9,900) yields massive asymmetric upside.',
                      color: 'text-primary',
                      bg: 'bg-primary/20'
                    }
                  ].map((tier, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-6 p-6 border border-background/20 bg-background/5 items-start">
                      <div className="w-48 shrink-0">
                        <div className="font-display font-bold text-xl mb-1">{tier.band}</div>
                        <div className={cn("text-xs font-bold uppercase tracking-widest px-2 py-1 inline-block mt-2", tier.bg, tier.color)}>
                          {tier.status}
                        </div>
                      </div>
                      <div className="flex-1 text-muted text-sm leading-relaxed border-t sm:border-t-0 sm:border-l border-background/20 pt-4 sm:pt-0 sm:pl-6">
                        {tier.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="py-24 bg-card border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-12 text-center">
              Frequently Asked Questions
            </h2>
            
            <div className="divide-y divide-border border-y border-border">
              {FAQS.map((faq, i) => (
                <div key={i} className="py-6">
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between text-left focus:outline-none group"
                  >
                    <span className="text-lg font-display font-bold group-hover:text-primary transition-colors">
                      {faq.q}
                    </span>
                    <span className="ml-6 flex-shrink-0 text-muted-foreground">
                      {openFaq === i ? <Minus className="size-5" /> : <Plus className="size-5" />}
                    </span>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="pt-4 text-muted-foreground leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-12 bg-background border-t border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
            <div>
              <div className="font-display font-bold text-lg tracking-tight mb-2">Scale Health Hub</div>
              <p className="text-sm text-muted-foreground max-w-sm">
                The premier destination for health and wellness discovery.
              </p>
            </div>
            <div className="md:text-right">
              <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                Exclusive Representation by
              </div>
              <div className="flex items-center md:justify-end gap-2">
                <div className="size-4 bg-primary rounded-[2px] flex items-center justify-center opacity-80">
                  <div className="size-1 bg-background rounded-full" />
                </div>
                <span className="font-display font-bold text-base tracking-tight">Clinichub Media</span>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p className="max-w-2xl text-[10px] leading-relaxed">
              Disclaimer: Ad placements do not guarantee clinical outcomes, traffic, or patient volume. Market conditions, competitive offers, and local variables affect all marketing efforts. Clinichub Media acts strictly as the media sales representative for Scale Health Hub inventory.
            </p>
            <div className="font-bold tracking-wide shrink-0">
              &copy; {new Date().getFullYear()} Clinichub Media.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
