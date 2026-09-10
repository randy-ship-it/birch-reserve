import './_group.css';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity, BarChart3, ShieldCheck, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Static offer data for the archived concept preview ─────────────────────

interface Offer {
  id: string;
  eyebrow: string;
  name: string;
  description: string;
  amount: number; // cents
  currency: string;
  features: string[];
  callToAction: string;
  featured: boolean;
}

const OFFERS: Offer[] = [
  {
    id: 'offer_foundation',
    eyebrow: 'Tier 01',
    name: 'Foundation',
    description: 'Core infrastructure and ad management for clinics ready to start acquiring patients systematically.',
    amount: 49900, // $499
    currency: 'usd',
    features: [
      'High-converting landing page build',
      'Google & Meta ad account setup',
      'Monthly ad spend management (up to $3k)',
      'CRM pipeline configuration',
      'Monthly performance report',
    ],
    callToAction: 'Get Started',
    featured: false,
  },
  {
    id: 'offer_growth',
    eyebrow: 'Tier 02',
    name: 'Growth Engine',
    description: 'Full-funnel patient acquisition with advanced tracking and dedicated growth strategy.',
    amount: 290000, // $2,900
    currency: 'usd',
    features: [
      'Everything in Foundation',
      'Multi-channel ad management (up to $15k spend)',
      'A/B split-testing cadence',
      'Full CRM automation & follow-up sequences',
      'Weekly strategy calls',
      'Unit economics dashboard',
    ],
    callToAction: 'Start Growing',
    featured: true,
  },
  {
    id: 'offer_scale',
    eyebrow: 'Tier 03',
    name: 'Scale',
    description: 'Enterprise-grade acquisition infrastructure for high-volume clinics targeting aggressive expansion.',
    amount: 990000, // $9,900
    currency: 'usd',
    features: [
      'Everything in Growth Engine',
      'Unlimited ad spend management',
      'Dedicated acquisition strategist',
      'Multi-location rollout support',
      'Custom analytics & BI integration',
      'Quarterly market expansion roadmap',
    ],
    callToAction: 'Scale Now',
    featured: false,
  },
];

// ─── Inlined Layout ───────────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Header / Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <div className="size-6 bg-primary rounded-[2px] flex items-center justify-center">
              <div className="size-2 bg-background rounded-full" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Clinichub Media</span>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            <a href="#methodology" className="hover:text-foreground transition-colors">Methodology</a>
            <a href="#services" className="hover:text-foreground transition-colors">Services</a>
          </nav>

          <Button variant="default" size="sm" asChild>
            <a href="#services">Work With Us</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12 md:py-16 bg-card mt-auto">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="size-5 bg-primary rounded-[2px] flex items-center justify-center opacity-80">
                <div className="size-1.5 bg-background rounded-full" />
              </div>
              <span className="font-display font-bold text-base tracking-tight">Clinichub Media</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs font-medium">
              The growth partner for serious clinic owners. We build scalable patient-acquisition systems.
            </p>
          </div>
          <div className="text-sm text-muted-foreground font-bold tracking-wide">
            &copy; {new Date().getFullYear()} Clinichub Media. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  // Stub checkout — no real API calls
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = (offerId: string) => {
    setSelectedOfferId(offerId);
    setIsCheckingOut(true);
    // No-op: stub — would normally call createCheckoutSession
    setTimeout(() => {
      setIsCheckingOut(false);
      setSelectedOfferId(null);
    }, 1500);
  };

  return (
    <div className="w-full">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-32 md:pt-32 md:pb-40 overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
        <div className="container mx-auto px-6">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-primary/10 text-primary text-xs font-bold tracking-widest mb-8 uppercase border border-primary/20"
            >
              <Activity className="size-4" />
              <span>Patient Acquisition Engine</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-6xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight leading-[1.05] mb-8"
            >
              We build growth systems for serious clinics.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-12 leading-relaxed font-medium"
            >
              Stop relying on referrals and unpredictable agencies. We engineer repeatable,
              data-driven acquisition funnels that scale your patient volume with precision.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Button size="lg" asChild className="group h-14 px-10 text-base">
                <a href="#services">
                  View Service Tiers
                  <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-14 px-10 text-base">
                <a href="#methodology">Our Methodology</a>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Methodology ──────────────────────────────────────────────────── */}
      <section id="methodology" className="py-24 md:py-32 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <h2 className="text-4xl md:text-6xl font-display font-extrabold mb-6">
              Engineered for predictability.
            </h2>
            <p className="text-xl text-muted-foreground font-medium">
              Most medical marketing relies on guesswork. We treat patient acquisition as a
              mathematics problem. High-converting infrastructure, rigorous tracking, and scalable
              ad structures.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: 'Infrastructure First',
                desc: "We don't just run ads. We build high-converting landing pages and CRM pipelines that ensure no lead falls through the cracks.",
              },
              {
                icon: BarChart3,
                title: 'Data Rigor',
                desc: 'Complete visibility into your unit economics. Know exactly what it costs to acquire a patient and your return on investment.',
              },
              {
                icon: Activity,
                title: 'Scalable Execution',
                desc: 'Once the baseline mathematics work, we turn the dial. Predictable, sustainable growth that fills your provider schedules.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card p-8 border border-border rounded-[2px]"
              >
                <div className="size-12 bg-primary flex items-center justify-center rounded-[2px] mb-6 text-primary-foreground shadow-sm">
                  <item.icon className="size-6" />
                </div>
                <h3 className="text-2xl font-extrabold font-display mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services / Pricing ───────────────────────────────────────────── */}
      <section id="services" className="py-24 md:py-32">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-4xl md:text-6xl font-display font-extrabold mb-6">Service Tiers</h2>
            <p className="text-xl text-muted-foreground font-medium">
              Transparent pricing. No long-term lock-ins. Select the infrastructure package that
              matches your growth mandate.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {OFFERS.map((offer, i) => {
              const isFeatured = offer.featured;
              return (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={cn(
                    'relative bg-card rounded-[2px] border-2 transition-all flex flex-col p-8 md:p-10',
                    isFeatured
                      ? 'border-primary shadow-xl shadow-primary/5 lg:-translate-y-4'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  {isFeatured && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-[2px] shadow-sm">
                      Recommended
                    </div>
                  )}

                  <div className="mb-6">
                    <h4 className="text-primary font-bold tracking-widest uppercase text-xs mb-3">
                      {offer.eyebrow}
                    </h4>
                    <h3 className="text-3xl md:text-4xl font-display font-extrabold mb-4">
                      {offer.name}
                    </h3>
                    <p className="text-muted-foreground h-16 font-medium leading-relaxed">
                      {offer.description}
                    </p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-display font-extrabold tracking-tight">
                        {(offer.amount / 100).toLocaleString('en-US', {
                          style: 'currency',
                          currency: offer.currency,
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      <span className="text-muted-foreground font-bold tracking-wide">/mo</span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border mb-8" />

                  <ul className="space-y-4 mb-10 flex-1">
                    {offer.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="size-5 text-primary shrink-0 mt-0.5" />
                        <span className="font-medium text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    variant={isFeatured ? 'default' : 'outline'}
                    className={cn('w-full h-14 px-10 text-base', !isFeatured && 'border-2')}
                    onClick={() => handleCheckout(offer.id)}
                    disabled={isCheckingOut && selectedOfferId !== offer.id}
                  >
                    {isCheckingOut && selectedOfferId === offer.id ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      offer.callToAction
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Exported mockup component ────────────────────────────────────────────────

export function Current() {
  return (
    <Layout>
      <HomePage />
    </Layout>
  );
}
