import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import { trackCta } from "@/lib/track-cta";
import {
  DISPLAY_FORMATS,
  SCALE_HEALTH_URLS,
  classifyGuideQuestion,
  type AdInterest,
  type ConciergeQuestionSignals,
  type GuideQuestionIntent,
} from "./birch-guide-knowledge";

export type { ConciergeQuestionSignals } from "./birch-guide-knowledge";

export interface SalesConciergeResponse {
  message: string;
  recommendedInterest?: AdInterest;
  handoffAllowed: boolean;
}

export interface SalesConciergeProps {
  isOpen: boolean;
  onClose: () => void;
  onAskQuestion: (
    signals: ConciergeQuestionSignals,
  ) => Promise<SalesConciergeResponse>;
  onHandoff: (recommendation?: AdInterest) => void;
  onRequestReview: () => void;
}

type Option = {
  label: string;
  action?: () => void;
  href?: string;
  primary?: boolean;
};

type MessageNode = {
  id: string;
  role: "advisor" | "user";
  text?: string;
  options?: Option[];
  isPrivacyNote?: boolean;
};

export function SalesConcierge({
  isOpen,
  onClose,
  onAskQuestion,
  onHandoff,
  onRequestReview,
}: SalesConciergeProps) {
  const [messages, setMessages] = useState<MessageNode[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMode, setInputMode] = useState<"none" | "question">("none");
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => closeButtonRef.current?.focus(), 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (!isOpen) return;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "init-1",
          role: "advisor",
          text: "Birch Reserve places brands inside signed Scale Health customer hubs, beside products people already buy—not on the open web. I can help you inquire or reserve the right path.",
          isPrivacyNote: true
        },
        {
          id: "init-2",
          role: "advisor",
          text: "Which describes you best?",
          options: [
            { label: "A product sold online", action: () => handleVisitorType("online_product") },
            { label: "A health & wellness service sold online", action: () => handleVisitorType("online_service") },
            { label: "A health & wellness audience", action: () => handleVisitorType("wellness_audience") },
            { label: "Other", action: () => handleVisitorType("other") }
          ]
        }
      ]);
    } else if (!isOpen) {
      const timer = setTimeout(() => {
        setMessages([]);
        setInputMode("none");
        setInputValue("");
        setIsTyping(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [messages, isTyping, inputMode]);

  useEffect(() => {
    if (inputMode === "question") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputMode]);

  const appendUserMessage = (text: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      let newPrev = prev;
      if (last && last.options) {
        newPrev = [...prev.slice(0, -1), { ...last, options: undefined }];
      }
      return [...newPrev, { id: Date.now().toString(), role: "user", text }];
    });
  };

  const appendAdvisorMessage = (text: string, options?: Option[]) => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-advisor`,
        role: "advisor",
        text,
        ...(options ? { options } : {}),
      },
    ]);
  };

  const handleVisitorType = (type: string) => {
    const labels: Record<string, string> = {
      online_product: "A product sold online",
      online_service: "A health & wellness service sold online",
      wellness_audience: "A health & wellness audience",
      other: "Other"
    };
    appendUserMessage(labels[type]);
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      appendAdvisorMessage("Got it. How can I help you today?", [
        { label: "Reserve an advertising seat", action: () => handleIntent("interested"), primary: true },
        { label: "Just learn", action: () => handleIntent("learning") },
        { label: "Ask a typed question", action: handleAskQuestion }
      ]);
    }, 420);
  };

  const handleIntent = (selectedIntent: string) => {
      if (selectedIntent === 'interested') {
      appendUserMessage("Reserve an advertising seat");
      setIsTyping(true);
      window.setTimeout(() => {
        setIsTyping(false);
        appendAdvisorMessage("Prices: $190 = 7-day look, does not eat a seat. $490 = category seat + 100% media credit. $899 is a legacy SKU still in checkout — do not hero it. Nothing runs until an insertion order names the surface.", [
          { label: "Open Reservation Form", action: () => onHandoff(), primary: true },
          { label: "Compare advertising paths", action: () => handleChoosePath(true) }
        ]);
      }, 420);
    } else if (selectedIntent === 'learning') {
      appendUserMessage("Just learn");
      setIsTyping(true);
      window.setTimeout(() => {
        setIsTyping(false);
        appendAdvisorMessage("We offer Performance advertising for clinics receiving bookings, and Display for brands wanting broader attention.", [
          { label: "Compare advertising paths", action: () => handleChoosePath(true), primary: true },
          { label: "See placement moments", action: showFormatPicker }
        ]);
      }, 420);
    }
  };

  const handleChoosePath = (withMessage = true) => {
    if (withMessage) {
      appendUserMessage("Compare advertising paths");
    }
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      appendAdvisorMessage("Are you primarily looking to drive direct clinic bookings, or build broader brand awareness?", [
        { label: "Drive direct bookings", action: () => handlePathSelection("performance") },
        { label: "Build brand awareness", action: () => handlePathSelection("display") },
        { label: "Test both side-by-side", action: () => handlePathSelection("both") }
      ]);
    }, 420);
  };

  const handlePathSelection = (path: AdInterest) => {
    const userText = path === "performance"
      ? "Drive direct bookings"
      : path === "display"
        ? "Build brand awareness"
        : path === "both"
          ? "Test both side-by-side"
          : "Request guidance";

    appendUserMessage(userText);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let responseText = "";
      if (path === "performance") {
        responseText = "Performance is a strong fit when the focus is direct bookings and the clinic is set up to receive them.";
      } else if (path === "display") {
        responseText = "Display reaches high-intent customers inside signed Scale Health brand hubs—after purchase, booking, or plan start—and beside products they already trust.";
      } else if (path === "both") {
        responseText = "A side-by-side approach compares Performance and Display contexts to see what works best.";
      } else {
        responseText = "A team member can help identify the best advertising path for you.";
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "advisor",
          text: responseText,
        }
      ]);

      appendAdvisorMessage("Would you like to reserve a founding seat now?", [
        { label: "Reserve first access", action: () => onHandoff(path), primary: true },
        { label: "See placement moments", action: showFormatPicker }
      ]);
    }, 800);
  };

  const showFormatPicker = () => {
    appendUserMessage("See placement moments");
    appendAdvisorMessage("Pick one context. I’ll keep it short.", [
      { label: DISPLAY_FORMATS.confirmation.label, action: () => handleFormatSelection("confirmation") },
      { label: DISPLAY_FORMATS.plan.label, action: () => handleFormatSelection("plan") },
      { label: DISPLAY_FORMATS.booking.label, action: () => handleFormatSelection("booking") },
      { label: DISPLAY_FORMATS.hub.label, action: () => handleFormatSelection("hub") },
    ]);
  };

  const handleFormatSelection = (format: keyof typeof DISPLAY_FORMATS) => {
    const selected = DISPLAY_FORMATS[format];
    appendUserMessage(selected.label);
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      appendAdvisorMessage(selected.message, [
        { label: "Reserve first access", action: () => onHandoff("display"), primary: true },
        { label: "Show another context", action: showFormatPicker },
      ]);
    }, 380);
  };

  const handleAskQuestion = () => {
    appendUserMessage("I have a specific question");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "advisor",
            text: "Ask about fit, formats, or where to start."
        }
      ]);
      setInputMode("question");
    }, 600);
  };

  const getTrainedQuestionResponse = (
    intentType: GuideQuestionIntent,
  ): { text: string; options: Option[] } | null => {
    switch (intentType) {
      case "sensitive":
        return {
          text: "Please leave out sensitive details. I can still help with general advertising fit.",
          options: [{ label: "Help me choose a path", action: () => handleChoosePath(true), primary: true }],
        };
      case "not_a_fit":
        return {
          text: "That is not a fit for this advertising channel. Birch Reserve does not handle patient-level data or clinical tracking pixels.",
          options: [{ label: "Compare advertising paths", action: () => handleChoosePath(true) }],
        };
      case "build_a_hub":
        return {
          text: "That is a Scale Health Clinic Hubs conversation, rather than an ad purchase.",
          options: [
            {
              label: "Open https://scalehealth.ca/clinichubs",
              href: SCALE_HEALTH_URLS.clinicHubs,
              primary: true,
            },
            { label: "Compare advertising paths", action: () => handleChoosePath(true) },
          ],
        };
      case "join_provider_network":
        return {
          text: "Providers listing a surface can opt in free. That is not a charge, and it is not the Scale Health $49 ICA.",
          options: [
            {
              label: "Open https://scalehealth.ca/providers",
              href: SCALE_HEALTH_URLS.providers,
              primary: true,
            },
            { label: "Explore Performance", action: () => handlePathSelection("performance") },
          ],
        };
      case "performance_fit":
        return {
          text: "If you are already in Clinic Hubs and can receive bookings, Performance is the advertising path here.",
          options: [
            { label: "Explore Performance", action: () => handlePathSelection("performance"), primary: true },
            { label: "Open https://scalehealth.ca/providers", href: SCALE_HEALTH_URLS.providers },
          ],
        };
      case "pricing_or_availability":
      case "self_serve_purchase":
        return {
          text: "Prices: $190 = 7-day look, does not eat a seat. $490 = category seat + 100% media credit. $899 is a legacy SKU still in checkout — do not hero it. Nothing runs until an insertion order names the surface.",
          options: [
            { label: "Reserve first access", action: onHandoff, primary: true },
            { label: "Compare advertising paths", action: () => handleChoosePath(true) },
          ],
        };
      case "align_on_request":
        return {
          text: "On-prem clinic and studio surfaces are a separate insertion-order line, available on request. The public product is digital hubs.",
          options: [
            { label: "Book a call", href: "mailto:randy@silverbirchgrowth.com?subject=Book%20a%20call%20%E2%80%94%20Birch%20Reserve", primary: true },
            { label: "Lock the seat — $490 USD", action: onHandoff },
          ],
        };
      case "book_a_call":
        return {
          text: "Multi-hub, exclusive, and on-prem Align are a call, not a public checkout SKU.",
          options: [
            { label: "Book a call", href: "mailto:randy@silverbirchgrowth.com?subject=Book%20a%20call%20%E2%80%94%20Birch%20Reserve", primary: true },
          ],
        };
      case "audience_or_metrics":
        return {
          text: "We do not sell a guaranteed impression count. You buy first-right on a category inside signed hubs. We name the surface on the insertion order.",
          options: [
            { label: "Reserve first access", action: onHandoff, primary: true },
            { label: "See placement moments", action: showFormatPicker },
          ],
        };
      case "media_kit":
        return {
          text: "Eight category seats inside signed Scale Health hubs. Not an open auction. Not a guaranteed impression buy. $490 is the category seat. Credit, not a flight.",
          options: [
            { label: "Reserve first access", action: onHandoff, primary: true },
            { label: "See placement moments", action: showFormatPicker },
          ],
        };
      case "auction_comparison":
        return {
          text: "This is a curated network, not an open auction. Digital units sit inside signed Scale Health customer hubs beside recognized recovery and wellness products. Physical activations are planned for participating locations, with details TBA for Fall 2026.",
          options: [
            { label: "Explore Display", action: () => handlePathSelection("display"), primary: true },
            { label: "Compare advertising paths", action: () => handleChoosePath(true) },
          ],
        };
      case "format":
        return {
          text: "The public page shows four approved Display contexts. Pick one and I will walk you through it.",
          options: [{ label: "See placement moments", action: showFormatPicker, primary: true }],
        };
      case "display_fit":
        return {
          text: "That sounds like a Display conversation. We place complementary categories within relevant host environments.",
          options: [
            { label: "Explore Display", action: () => handlePathSelection("display"), primary: true },
            { label: "See placement moments", action: showFormatPicker },
          ],
        };
      case "general":
        return null;
    }
  };

  const submitQuestion = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    setInputValue("");
    setInputMode("none");
    const analysis = classifyGuideQuestion(text);
    appendUserMessage(
      analysis.signals.sensitiveContentDetected
        ? "Private details withheld from the advisor"
        : "Advertising question analyzed"
    );
    setIsTyping(true);

    const trainedResponse = getTrainedQuestionResponse(analysis.intent);
    if (trainedResponse) {
      window.setTimeout(() => {
        setIsTyping(false);
        appendAdvisorMessage(trainedResponse.text, trainedResponse.options);
      }, 360);
      return;
    }

    try {
      const response = await onAskQuestion(analysis.signals);
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "advisor",
          text: response.message,
          options:
            response.handoffAllowed && response.recommendedInterest
              ? [
                  {
                    label: `Reserve ${response.recommendedInterest} seat`,
                    action: () => onHandoff(response.recommendedInterest!),
                    primary: true,
                  },
                  {
                    label: "Compare all advertising paths",
                    action: () => handleChoosePath(true),
                  },
                ]
              : [
                  {
                    label: "Reserve first access",
                    action: onHandoff,
                    primary: true,
                  },
                  {
                    label: "Compare advertising paths",
                    action: () => handleChoosePath(true),
                  },
                ],
        }
      ]);
    } catch {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "advisor",
          text: "The live advisor is taking a pause, but you can still explore the paths or reserve your seat directly.",
          options: [
            { label: "Reserve first access", action: onHandoff, primary: true },
            { label: "Return to advertising paths", action: () => handleChoosePath(true) }
          ]
        }
      ]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed z-50 flex flex-col bg-foreground text-background shadow-2xl sm:bottom-6 sm:right-6 sm:h-[650px] sm:w-[400px] sm:max-h-[calc(100dvh-3rem)] sm:border sm:border-background/20 bottom-0 right-0 h-[100dvh] w-full"
          role="dialog"
          aria-modal="false"
          aria-label="Birch Reserve Sales Concierge"
          data-testid="dialog-sales-concierge"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-background/20 shrink-0 bg-foreground">
            <div className="flex items-center gap-3">
              <div className="size-8 bg-accent flex items-center justify-center">
                <ShieldCheck className="size-4 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-display tracking-wide text-background">Birch Guide</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="size-1.5 bg-accent rounded-full animate-pulse" />
                  <span className="text-[9px] uppercase tracking-widest text-background/60">Guidance ready</span>
                </div>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="size-8 flex items-center justify-center text-background/60 hover:text-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              aria-label="Close concierge"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-foreground">
            <div className="flex flex-col gap-6">
              {messages.map((msg, index) => (
                <div key={msg.id} className="w-full">
                  {msg.role === "advisor" ? (
                    <div className="flex flex-col gap-1 items-start">
                      {/* Only show the avatar on the first advisor message in a cluster */}
                      {(index === 0 || messages[index - 1]?.role !== "advisor") && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className="size-5 bg-background flex items-center justify-center">
                            <ShieldCheck className="size-3 text-foreground" />
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-background/60 font-bold">Birch Reserve</span>
                        </div>
                      )}
                      <div className="text-sm leading-relaxed text-background/90 pr-8">
                        {msg.text}
                      </div>

                      {msg.isPrivacyNote && (
                        <div className="mt-2 text-xs text-background/50 border-l border-background/20 pl-3">
                           Guidance is completely private.
                        </div>
                      )}

                      {msg.options && (
                        <div className="flex flex-col gap-2 mt-4 w-full">
                          {msg.options.map((opt, i) => (
                            opt.href ? (
                              <a
                                key={i}
                                href={opt.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  if (opt.label === "Book a call") trackCta("cta_book_call");
                                }}
                                className={`flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors w-full border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                                  opt.primary
                                    ? 'bg-accent border-accent text-accent-foreground hover:bg-accent/90'
                                    : 'bg-transparent border-background/20 text-background hover:bg-background/10'
                                }`}
                              >
                                {opt.label}
                              </a>
                            ) : (
                              <button
                                key={i}
                                type="button"
                                onClick={opt.action}
                                className={`px-4 py-3 text-left text-sm font-medium transition-colors w-full border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                                  opt.primary
                                    ? 'bg-accent border-accent text-accent-foreground hover:bg-accent/90'
                                    : 'bg-transparent border-background/20 text-background hover:bg-background/10'
                                }`}
                              >
                                {opt.label}
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="bg-background/10 text-background text-sm px-4 py-3 max-w-[85%]">
                        {msg.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 mb-2 w-max bg-background/5 px-4 py-3 border border-background/10">
                  <div className="flex gap-1">
                    <div className="size-1.5 rounded-full bg-background/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="size-1.5 rounded-full bg-background/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="size-1.5 rounded-full bg-background/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-foreground border-t border-background/20">
            {inputMode === "question" ? (
              <form onSubmit={submitQuestion} className="flex items-center gap-2 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-background/5 border border-background/20 text-background placeholder:text-background/40 px-4 h-12 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all rounded-none"
                />
                {inputValue.trim() && (
                  <button
                    type="submit"
                    className="absolute right-2 top-2 h-8 px-4 bg-accent text-accent-foreground text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-colors"
                  >
                    Ask
                  </button>
                )}
              </form>
            ) : (
              <div className="text-center text-[10px] uppercase tracking-widest text-background/40">
                Birch Reserve
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
