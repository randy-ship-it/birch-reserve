import { useState, useEffect, useRef, useCallback, type FocusEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import drHoHub from "@assets/hub-showcase/dr-ho-hub.png";
import jillHealthHub from "@assets/hub-showcase/jill-health-hub-clean.png";
import integrityHub from "@assets/hub-showcase/integrity-hub.png";
import birdAndBeHub from "@assets/hub-showcase/bird-and-be-hub.png";
import nutriprocanHub from "@assets/hub-showcase/nutriprocan-hub-clean.png";
import birdAndBePortal from "@assets/hub-showcase/bird-and-be-member-portal.png";
import nutriprocanPortal from "@assets/hub-showcase/nutriprocan-member-portal.png";

const HUBS = [
  {
    id: "dr-ho",
    name: "DR-HO'S",
    surface: "Care & product landing",
    displayUrl: "DR-HO'S hub",
    description: "Integrating virtual physiotherapy alongside established pain therapy product paths.",
    image: drHoHub,
    url: "https://physio.drhonow.com/dr-ho/portal"
  },
  {
    id: "jill-health",
    name: "Jill Health",
    surface: "Clinical services",
    displayUrl: "jill-health / wellness hub",
    description: "Women's wellness support expanding into hormone, weight, and movement guidance.",
    image: jillHealthHub,
    url: "https://jill-health.replit.app/my-brand-landing/"
  },
  {
    id: "integrity",
    name: "Integrity Fitness",
    surface: "Member offers",
    displayUrl: "Integrity hub",
    description: "A local fitness partner augmenting memberships with exclusive recovery offers and physio access.",
    image: integrityHub,
    url: "https://www.scalehealth.ca/integrity"
  },
  {
    id: "bird-and-be",
    name: "Bird&Be",
    surface: "Postpartum care landing",
    displayUrl: "bird-and-be / scale health",
    description: "Targeted postpartum recovery environments featuring guided pelvic floor care.",
    image: birdAndBeHub,
    url: "https://bb-review-6bfc59.vercel.app/"
  },
  {
    id: "bird-and-be-portal",
    name: "Bird&Be Member Portal",
    surface: "Marketplace & services",
    displayUrl: "member portal / bird-and-be",
    description: "A guided member account connecting care booking, marketplace discovery, services, and recovery progress.",
    image: birdAndBePortal,
    url: "https://bb-review-6bfc59.vercel.app/portal-preview?partner=bird-and-be"
  },
  {
    id: "nutriprocan",
    name: "NutriProCan",
    surface: "Nutrition & recovery landing",
    displayUrl: "nutriprocan / scale health",
    description: "Nutrition plans expanded with whole-body movement and physical recovery layers.",
    image: nutriprocanHub,
    url: "https://nutriprocan-review-89aed9.vercel.app/"
  },
  {
    id: "nutriprocan-portal",
    name: "NutriProCan Member Portal",
    surface: "Products & virtual care",
    displayUrl: "member portal / nutriprocan",
    description: "A commerce-enabled member view bringing product pricing, virtual care, and service guidance into one account.",
    image: nutriprocanPortal,
    url: "https://nutriprocan-review-89aed9.vercel.app/portal-preview?partner=nutriprocan"
  }
];

export function ShowcaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const reducedMotion = useReducedMotion();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopAutoplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    if (reducedMotion) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HUBS.length);
    }, 6000);
  }, [reducedMotion, stopAutoplay]);

  useEffect(() => {
    if (isPlaying) {
      startAutoplay();
    } else {
      stopAutoplay();
    }
    return stopAutoplay;
  }, [isPlaying, startAutoplay, stopAutoplay]);

  const activeHub = HUBS[activeIndex];
  const activeImageScale =
    activeHub.id === "jill-health"
      ? 1.3
      : activeHub.id === "nutriprocan"
        ? 1.4
        : 1;
  const activeImagePosition =
    activeHub.id === "nutriprocan" ? "center center" : "center top";
  const selectHub = (index: number) => {
    setActiveIndex(index);
    setIsPlaying(false);
  };

  const resumeAfterFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      isPlaying && startAutoplay();
    }
  };

  return (
    <div
      className="w-full mx-auto flex flex-col gap-10"
      data-testid="hub-showcase"
      onMouseEnter={stopAutoplay}
      onMouseLeave={() => isPlaying && startAutoplay()}
      onFocus={stopAutoplay}
      onBlur={resumeAfterFocusLeaves}
    >
      <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
        <div className="flex-1">
          <h3 className="text-4xl md:text-5xl font-display mb-4 italic tracking-tight">Selected Hub Environments</h3>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A curated look at how wellness brands and clinics are building dedicated recovery experiences for their communities. These are live deployment examples, not performance guarantees.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            aria-label={isPlaying ? "Pause rotation" : "Play rotation"}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                selectHub((activeIndex - 1 + HUBS.length) % HUBS.length);
              }}
              className="size-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              aria-label="Previous hub"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="text-sm font-medium w-12 text-center text-muted-foreground font-sans">
              {activeIndex + 1} / {HUBS.length}
            </div>
            <button
              onClick={() => {
                selectHub((activeIndex + 1) % HUBS.length);
              }}
              className="size-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              aria-label="Next hub"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-12 lg:gap-16 items-start">
        {/* Browser Frame */}
        <div className="border border-border bg-background flex flex-col relative shadow-sm">
          <div className="h-10 bg-secondary/30 border-b border-border flex items-center px-4 gap-4">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-border" />
              <div className="size-2.5 rounded-full bg-border" />
              <div className="size-2.5 rounded-full bg-border" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="max-w-full truncate bg-background/80 border border-border/50 rounded-sm text-[10px] text-muted-foreground px-4 py-1 font-medium tracking-wide">
                {activeHub.displayUrl}
              </div>
            </div>
            <div className="w-12" />
          </div>

          <div className="relative aspect-video lg:aspect-[16/10] bg-secondary/10 overflow-hidden">
            <motion.img
              key={activeHub.id}
              src={activeHub.image}
              alt={`Screenshot of ${activeHub.name} hub`}
              data-testid="hub-showcase-image"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: activeImageScale }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              style={{
                objectPosition: activeImagePosition,
                transformOrigin:
                  activeHub.id === "jill-health" ? "top center" : "center",
              }}
            />
          </div>

          {/* Tour Controls (moved outside clipped area) */}
          <div className="border-t border-border pt-5 pb-6 px-4 md:px-6">
             <div className="mb-4 flex items-center justify-between gap-4">
               <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                 Browse the inventory tour
               </span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
                 {HUBS.length} views
               </span>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {HUBS.map((hub, index) => {
                 const isActive = index === activeIndex;

                 return (
                   <button
                     key={hub.id}
                     type="button"
                     onClick={() => selectHub(index)}
                     aria-pressed={isActive}
                     className={`group flex min-h-14 flex-col justify-center border px-3 py-2 text-left transition-colors last:col-span-2 ${
                       isActive
                         ? "border-foreground bg-foreground text-accent"
                         : "border-border bg-background text-foreground hover:border-foreground/60 hover:bg-secondary/40"
                     }`}
                   >
                     <span className={`mb-1 text-[9px] font-bold uppercase tracking-[0.16em] ${
                       isActive ? "text-background" : "text-muted-foreground"
                     }`}>
                       {String(index + 1).padStart(2, "0")} · {hub.surface}
                     </span>
                     <span className={`truncate text-xs font-semibold ${isActive ? "text-accent" : "text-foreground"}`}>{hub.name}</span>
                   </button>
                 );
               })}
             </div>
           </div>
        </div>

        {/* Info Box */}
        <div className="flex flex-col gap-6 lg:pt-6">
          <motion.div
                key={activeHub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
                className="flex flex-col gap-5"
          >
                <div className="inline-block border border-border bg-secondary/30 text-[10px] uppercase tracking-widest px-3 py-1.5 text-foreground w-max font-medium">
                  {activeHub.surface}
               </div>
               <h4 className="text-3xl md:text-4xl font-display text-foreground tracking-wide">{activeHub.name}</h4>
               <p className="text-base text-muted-foreground leading-relaxed">
                 {activeHub.description}
               </p>
               <div className="pt-6 border-t border-border mt-2">
                 <a href={activeHub.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground hover:text-accent transition-colors group">
                   View live environment <ExternalLink className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                 </a>
               </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
