import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDown } from 'lucide-react';

export function Flywheel() {
  return (
    <div className="w-full flex flex-col items-center py-20 relative">
      <div className="text-center mb-16 max-w-2xl mx-auto px-6">
        <h2 className="text-4xl font-display text-foreground mb-4 italic">Scale Health Ecosystem</h2>
        <p className="text-muted-foreground leading-relaxed">
          Birch Reserve strictly coordinates review-controlled display advertising. If you are looking for storefronts, clinics, or provider fulfillment, navigate the Scale Health ecosystem below.
        </p>
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden lg:flex relative w-full max-w-5xl aspect-[4/3] items-center justify-center">

        {/* Center Circle */}
        <div className="absolute z-10 w-40 h-40 rounded-full border border-border bg-background flex flex-col items-center justify-center text-center p-4">
          <span className="text-xs font-medium text-foreground uppercase tracking-widest leading-relaxed">
            network<br/>routing<br/>map
          </span>
        </div>

        {/* Circular Path with SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 750" fill="none">
          {/* Subtle guide ring */}
          <circle cx="500" cy="375" r="230" stroke="currentColor" className="text-border" strokeWidth="1" strokeDasharray="4 4" />

          {/* Active Arrows (Vivid Green) */}
          <g className="text-accent" stroke="currentColor" strokeWidth="2" fill="none">
            {/* Top Right Arrow */}
            <path d="M 660 220 C 690 250 710 280 720 310" />
            <path d="M 710 300 L 720 310 L 730 295" strokeLinecap="square" strokeLinejoin="miter" />

            {/* Bottom Right Arrow */}
            <path d="M 720 440 C 700 480 670 510 640 530" />
            <path d="M 655 525 L 640 530 L 645 515" strokeLinecap="square" strokeLinejoin="miter" />

            {/* Bottom Left Arrow */}
            <path d="M 360 530 C 330 500 310 470 300 440" />
            <path d="M 310 450 L 300 440 L 290 455" strokeLinecap="square" strokeLinejoin="miter" />

            {/* Top Left Arrow */}
            <path d="M 300 310 C 320 270 350 240 380 220" />
            <path d="M 365 225 L 380 220 L 375 235" strokeLinecap="square" strokeLinejoin="miter" />
          </g>
        </svg>

        {/* Cards */}
        {/* Top: Demand */}
        <motion.a
          href="https://www.scalehealth.ca/embedded-recovery-clinic"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="absolute top-[3%] left-1/2 -translate-x-1/2 w-[320px] bg-background border border-border p-6 shadow-sm z-20 group hover:border-accent transition-colors block cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground">BRANDS</div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For product and wellness brands seeking a branded clinic layer across post-checkout, email, or loyalty.
          </p>
        </motion.a>

        {/* Right: Placements */}
        <motion.a
          href="https://www.scalehealth.ca/clinichubs"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="absolute top-1/2 right-[3%] -translate-y-1/2 w-[320px] bg-background border border-border p-6 shadow-sm z-20 group hover:border-accent transition-colors block cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground">INFLUENCERS & CREATORS</div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For creators or digital audiences with no retail location who want a Scale-operated storefront and product listing.
          </p>
        </motion.a>

        {/* Bottom: Fulfillment */}
        <motion.a
          href="https://www.scalehealth.ca/providers"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-[3%] left-1/2 -translate-x-1/2 w-[320px] bg-background border border-border p-6 shadow-sm z-20 group hover:border-accent transition-colors block cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground">PHYSIO CLINICS</div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For traditional physio or booking-ready clinics able to receive in-person patients. Join the provider network for overflow and fulfillment.
          </p>
        </motion.a>

        {/* Left: Signals */}
        <motion.a
          href="#placements"
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="absolute top-1/2 left-[3%] -translate-y-1/2 w-[320px] bg-secondary/50 border border-border p-6 shadow-sm z-20 group hover:border-foreground/30 transition-colors block cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground">DISPLAY ADVERTISERS</div>
            <ArrowDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For brands, retailers, and agencies looking to purchase review-controlled display placements across the Birch Reserve network.
          </p>
        </motion.a>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-6 relative">
          <div className="absolute left-1/2 top-10 bottom-10 w-px bg-border -translate-x-1/2 z-0" />

         {[
           {
             title: 'BRANDS',
              desc: 'For product and wellness brands seeking a branded clinic layer across post-checkout, email, or loyalty.',
             href: 'https://www.scalehealth.ca/embedded-recovery-clinic',
             external: true
           },
           {
             title: 'INFLUENCERS & CREATORS',
             desc: 'For creators or digital audiences with no retail location who want a Scale-operated storefront and product listing.',
             href: 'https://www.scalehealth.ca/clinichubs',
             external: true
           },
           {
             title: 'PHYSIO CLINICS',
             desc: 'For traditional physio or booking-ready clinics able to receive in-person patients. Join the provider network for overflow.',
             href: 'https://www.scalehealth.ca/providers',
             external: true
           },
           {
             title: 'DISPLAY ADVERTISERS',
             desc: 'For brands and agencies looking to purchase review-controlled display placements across the Birch Reserve network.',
             href: '#placements',
             external: false
           }
         ].map((item, i) => (
            <motion.a
              key={item.title}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`block w-full border border-border p-6 shadow-sm z-10 relative group transition-colors ${item.external ? 'bg-background hover:border-accent' : 'bg-secondary/50 hover:border-foreground/30'}`}
            >
               <div className="absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-background border border-border flex items-center justify-center lg:hidden z-20">
                 <div className="size-1.5 bg-accent rounded-full" />
              </div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-foreground">{item.title}</div>
                {item.external ? (
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
                ) : (
                  <ArrowDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.a>
         ))}
      </div>
    </div>
  );
}
