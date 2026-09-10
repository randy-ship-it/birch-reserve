import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Activity, Calendar, User, Play, Pause } from "lucide-react";

import imgElectrolyte from "@assets/generated_images/ad-electrolyte.jpg";
import imgMassage from "@assets/generated_images/ad-massage.jpg";
import imgSleep from "@assets/generated_images/ad-sleep.jpg";
import imgPlunge from "@assets/generated_images/ad-plunge.jpg";

export function PostCheckoutMockup() {
  return (
    <div className="w-full h-full min-h-[380px] bg-background border border-border flex flex-col font-sans text-foreground text-left text-xs overflow-hidden relative shadow-sm group">
       <div className="p-4 border-b border-border flex flex-col gap-2 bg-secondary/30">
         <div className="flex items-center gap-2">
           <div className="size-5 rounded-full bg-accent/20 flex items-center justify-center">
             <Check className="size-3 text-accent"/>
           </div>
           <span className="font-medium text-sm tracking-tight text-foreground/90">Order Confirmed</span>
         </div>
         <div className="text-muted-foreground text-[11px]">Your receipt has been emailed.</div>
       </div>
       <div className="p-6 flex-1 flex flex-col gap-6 bg-secondary/5">
         <div className="space-y-3 opacity-30">
           <div className="h-2 w-1/3 bg-foreground rounded-full" />
           <div className="h-2 w-1/2 bg-foreground rounded-full" />
           <div className="h-2 w-2/5 bg-foreground rounded-full" />
         </div>

         <div className="mt-auto border border-border bg-background flex flex-col relative overflow-hidden shadow-sm transition-all duration-300 hover:border-foreground/30 hover:shadow-md">
           <div className="absolute top-2 right-2 bg-background/95 backdrop-blur-md text-[8px] px-2 py-1 border border-border text-muted-foreground uppercase tracking-widest z-10 font-bold">
             Sponsored
           </div>
           <div className="w-full h-36 bg-secondary relative overflow-hidden">
             <img src={imgElectrolyte} alt="Aura Hydration" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
             <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
             <div className="absolute bottom-3 left-4 right-4">
               <span className="font-display text-2xl text-foreground leading-none tracking-wide">Aura Hydration</span>
             </div>
           </div>
           <div className="p-4 flex flex-col gap-4">
             <p className="text-muted-foreground text-[11px] leading-relaxed">
               Clinical-grade electrolyte powder designed for daily systemic recovery. 15% preferred pricing for network members.
             </p>
              <div className="w-full bg-foreground text-background text-[11px] font-bold uppercase tracking-wider py-3.5 text-center flex items-center justify-center gap-2" aria-hidden="true">
               Claim Member Offer <span className="opacity-70">→</span>
              </div>
           </div>
         </div>
       </div>
    </div>
  );
}

export function ProtocolMockup() {
  return (
    <div className="w-full h-full min-h-[380px] bg-background border border-border flex flex-col font-sans text-foreground overflow-hidden relative shadow-sm group">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground"/>
          <span className="font-medium text-sm tracking-tight text-foreground/90">Day 3: Mobility</span>
        </div>
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          Active Plan
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-6 bg-secondary/5">
        <div className="flex gap-4 opacity-40">
          <div className="size-10 rounded-full border border-border bg-background shrink-0" />
          <div className="space-y-2.5 flex-1 py-1">
             <div className="h-2 w-full bg-foreground rounded-full" />
             <div className="h-2 w-4/5 bg-foreground rounded-full" />
             <div className="h-2 w-2/3 bg-foreground rounded-full" />
          </div>
        </div>

        <div className="mt-auto border border-border bg-foreground flex flex-col relative overflow-hidden shadow-sm transition-all duration-300 hover:border-foreground/50 hover:shadow-md">
           <div className="absolute top-2 left-2 bg-foreground/95 backdrop-blur-md text-[8px] px-2 py-1 border border-background/20 text-background/80 uppercase tracking-widest z-10 font-bold">
             Sponsored Module
           </div>
           <div className="w-full h-40 bg-secondary relative overflow-hidden">
             <img src={imgMassage} alt="Pulse Kinetic" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
             <div className="absolute inset-0 bg-gradient-to-t from-foreground/100 via-foreground/20 to-transparent" />
           </div>
           <div className="p-5 flex flex-col gap-2 relative z-10 bg-foreground">
             <h4 className="font-display text-2xl leading-none text-background tracking-wide">Pulse Kinetic Series</h4>
             <p className="text-background/70 text-[11px] leading-relaxed">
               Integrate percussive therapy into your mobility routine. Members receive early access to the new quiet series.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}

export function BookingMockup() {
  return (
    <div className="w-full h-full min-h-[380px] bg-background border border-border flex flex-col font-sans text-foreground overflow-hidden relative shadow-sm group">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground"/>
          <span className="font-medium text-sm tracking-tight text-foreground/90">Scheduled Session</span>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-6 bg-secondary/5">
        <div className="border border-border p-5 space-y-3 bg-background shadow-sm relative overflow-hidden">
           <div className="absolute right-0 top-0 w-16 h-16 bg-secondary/50 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
           <div className="font-bold text-[9px] text-muted-foreground uppercase tracking-widest">Confirmation Details</div>
           <div className="font-display text-2xl leading-none text-foreground tracking-wide">Thursday, 2:00 PM</div>
           <div className="h-1.5 w-1/2 bg-foreground/10 rounded-full mt-4" />
        </div>

        <div className="mt-auto border border-border bg-background flex items-stretch relative overflow-hidden shadow-sm transition-all duration-300 hover:border-foreground/30 hover:shadow-md min-h-[120px]">
           <div className="absolute top-0 right-0 bg-secondary/95 backdrop-blur-md text-[8px] px-2 py-1 border-b border-l border-border text-muted-foreground uppercase tracking-widest z-10 font-bold">
             Sponsored
           </div>
           <div className="flex flex-col justify-center p-5 flex-1 z-10">
             <h4 className="font-display text-xl leading-none mb-2 text-foreground tracking-wide">Somnus Sleep</h4>
             <p className="text-muted-foreground text-[10px] leading-relaxed pr-2">
               Prepare for your session with evening supplement complexes formulated for deep recovery.
             </p>
           </div>
           <div className="w-[45%] bg-secondary relative overflow-hidden shrink-0 border-l border-border">
             <img src={imgSleep} alt="Somnus Sleep" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
             <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/50" />
           </div>
        </div>
      </div>
    </div>
  );
}

export function HubMockup() {
  return (
    <div className="w-full h-full min-h-[380px] bg-background border border-border flex flex-col font-sans text-foreground overflow-hidden relative shadow-sm group">
      <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-full bg-foreground flex items-center justify-center">
            <User className="size-3 text-background"/>
          </div>
          <span className="font-medium text-sm tracking-tight text-foreground/90">Member Portal</span>
        </div>
        <div className="flex gap-1">
          <div className="size-1 rounded-full bg-foreground/20" />
          <div className="size-1 rounded-full bg-foreground/20" />
          <div className="size-1 rounded-full bg-foreground/20" />
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-6 bg-secondary/5">

        <div className="border border-border bg-background flex flex-col relative overflow-hidden shadow-sm transition-all duration-300 hover:border-foreground/30 hover:shadow-md p-2 pb-0">
           <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-md text-[8px] px-2 py-1 border border-border text-muted-foreground uppercase tracking-widest z-10 font-bold shadow-sm">
             Sponsored Partner
           </div>
           <div className="w-full h-40 bg-secondary relative overflow-hidden border border-border">
             <img src={imgPlunge} alt="Nordic Tub" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
           </div>
           <div className="p-4 flex justify-between items-center gap-4">
             <div className="flex flex-col gap-1.5">
               <span className="font-display text-2xl leading-none text-foreground tracking-wide">Nordic Tub</span>
               <span className="text-muted-foreground text-[10px] leading-relaxed max-w-[200px]">Modern temperature management for home recovery spaces.</span>
             </div>
              <div className="size-10 rounded-full border border-border flex items-center justify-center bg-secondary/50 group-hover:bg-foreground group-hover:border-foreground group-hover:text-background transition-colors shrink-0 shadow-sm text-foreground" aria-hidden="true">
               <span className="text-sm font-bold opacity-70 group-hover:opacity-100 transition-opacity">→</span>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4 opacity-30 mt-auto">
          <div className="h-10 border border-foreground/30 bg-background rounded-sm" />
          <div className="h-10 border border-foreground/30 bg-background rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function VideoAdMockup({
  onRequestFormat,
}: {
  onRequestFormat: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(true);
  const reducedMotion = useReducedMotion();
  const [sceneIndex, setSceneIndex] = useState(0);

  const sceneDuration = 5000;
  const scenes = [
    { text: "Precision Recovery", img: imgPlunge },
    { text: "Daily Baseline", img: imgMassage },
    { text: "Network Access", img: imgSleep },
  ];

  useEffect(() => {
    if (!isPlaying || reducedMotion) return;
    const interval = setInterval(() => {
      setSceneIndex(prev => (prev + 1) % scenes.length);
    }, sceneDuration);
    return () => clearInterval(interval);
  }, [isPlaying, reducedMotion, scenes.length]);

  const togglePlay = () => setIsPlaying((current) => !current);
  const currentScene = scenes[sceneIndex];

  return (
    <div className="w-full h-full min-h-[440px] bg-background border border-border flex flex-col font-sans text-foreground overflow-hidden relative shadow-sm group transition-all duration-300 hover:border-foreground/30">

      {/* Video Container */}
      <div className="flex-1 relative overflow-hidden bg-foreground">

        {/* Story Progress */}
        <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-20">
          {scenes.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-background/20 overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-background origin-left"
                initial={{ scaleX: i < sceneIndex ? 1 : 0 }}
                animate={{
                  scaleX: i === sceneIndex ? (isPlaying && !reducedMotion ? 1 : 0) : i < sceneIndex ? 1 : 0
                }}
                transition={i === sceneIndex && isPlaying && !reducedMotion ? { duration: sceneDuration / 1000, ease: "linear" } : { duration: 0 }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-8 left-4 right-4 flex justify-between items-start z-20">
          <div className="bg-foreground/50 backdrop-blur-md text-[8px] px-2 py-1 border border-background/20 text-background/90 uppercase tracking-widest font-bold">
             15s Creative Concept
          </div>
          <div className="bg-foreground/50 backdrop-blur-md text-[8px] px-2 py-1 border border-background/20 text-background/60 uppercase tracking-widest font-bold">
             Illustrative — not your receipt
          </div>
        </div>

        <AnimatePresence>
           <motion.div
             key={sceneIndex}
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.8 }}
             className="absolute inset-0"
           >
             <motion.img
               src={currentScene.img}
               initial={{ scale: 1.05 }}
               animate={{ scale: 1 }}
               transition={{ duration: 6, ease: "easeOut" }}
               className="w-full h-full object-cover opacity-90"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-foreground/100 via-foreground/30 to-transparent" />
             <div className="absolute bottom-6 left-6 right-6">
                <motion.h3
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="font-display text-4xl text-background mb-2 leading-none tracking-wide"
                >
                  {currentScene.text}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-background/80 text-[11px] max-w-[85%] leading-relaxed font-sans"
                >
                  Discover targeted tools designed to accelerate your baseline performance.
                </motion.p>
             </div>
           </motion.div>
        </AnimatePresence>

        <button
          onClick={togglePlay}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-foreground/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-30"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <div className="size-14 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center border border-background/30 text-background shadow-lg transition-transform hover:scale-105">
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-1" />}
          </div>
        </button>
      </div>

      {/* Fake UI Context */}
      <div className="p-5 bg-background border-t border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center shadow-sm">
             <Activity className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-foreground mb-1 tracking-tight">Scale Network Partner</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Motion Preview</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequestFormat}
          data-testid="button-motion-format-reserve"
          className="text-[10px] uppercase tracking-wider font-bold border border-border px-4 py-2 hover:bg-secondary transition-colors text-foreground"
        >
          Reserve this format
        </button>
      </div>
    </div>
  );
}
