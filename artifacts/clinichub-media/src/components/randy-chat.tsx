/**
 * Chat Randy widget (Emma UX + Randy HARD). Grok text via /api/launch/randy-chat.
 *
 * Chips: Chat | Hear Randy | Call
 * HARD 2026-09-24 3:31–3:33pm ET: birchreserve.net = Birch Reserve only (opener + chips).
 * Full-body Randy (/avatars/randy-fullbody.png, transparent cutout) stands bottom-right
 * on a floating WHITE card (never navy behind him), object-fit: contain, bottom center —
 * head through shoes always visible. Small circles use /avatars/randy-head.png only
 * (pre-cropped head + shoulders); never cover-crop the full-body art into a circle.
 * Brain SoT: /workspace/birch-live-ops/voice-closer/knowledge/ (no chat-only fork)
 * Book a call: Cal ONLY after in-thread qualification — never cold-dump.
 * Checkout OFF until Gordon. Public SKUs hold-190 / reserve-490 only.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X, Calendar, Mic, MessageSquareText } from "lucide-react";
import { trackCta } from "@/lib/track-cta";
import {
  BOOK_CALL_CAL_URL,
  BOOK_CALL_MAILTO_HREF,
  OPEN_RANDY_CHAT_EVENT,
  type OpenRandyChatDetail,
} from "@/lib/book-call";
import {
  RANDY_TEL_DISPLAY,
  RANDY_TEL_HREF,
  SMART_OPENER,
  SUGGESTION_CHIPS,
  TEASER_TEXT,
  VOICE_CLOSER_KNOWLEDGE_SOT,
  shouldOfferLiveHandoff,
  type DiscoveryChipId,
  type RandyChatMode,
} from "@/lib/randy-chat-knowledge";
import {
  requestRandyReply,
  startRandyVoiceSession,
  type RandyModelMessage,
} from "@/lib/randy-model-client";

/** Head + shoulders (on white) for small circles only. */
const HEAD_SRC = "/avatars/randy-head.png";
const FULLBODY_SRC = "/avatars/randy-fullbody.png";
const FULLBODY_360_SRC = "/avatars/randy-fullbody-360.png";
/** Natural size of randy-fullbody.png (816x1626). */
const FULLBODY_W = 816;
const FULLBODY_H = 1626;
const FULLBODY_SRCSET = `${FULLBODY_360_SRC} 271w, ${FULLBODY_SRC} 816w`;
const FULLBODY_ALT =
  "Randy, full-body cartoon in a BirchReserve.net tee, standing and ready to chat";
const DISMISS_KEY = "birch:randy-figure-dismissed";
const TEASER_DELAY_MS = 4000;

const FIGURE_STYLES = `
@keyframes randy-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.randy-bob { animation: randy-bob 3.6s ease-in-out infinite; }
.randy-lift { transition: transform 200ms ease, box-shadow 200ms ease; }
.randy-lift:hover, .randy-lift:focus-visible { transform: translateY(-6px); box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.35); }
@keyframes randy-teaser-in { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: none; } }
.randy-teaser { animation: randy-teaser-in 260ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .randy-bob, .randy-teaser { animation: none; }
  .randy-lift, .randy-lift:hover, .randy-lift:focus-visible { transition: none; transform: none; }
}
`;

/**
 * Full-body Randy on a floating white card. The card (not the image) bobs/lifts.
 * object-contain + object-bottom, explicit heights, no overflow clipping → full body visible.
 */
function FullBodyCard({
  heightClass,
  sizes,
  eager,
}: {
  heightClass: string;
  sizes: string;
  eager?: boolean;
}) {
  return (
    <span
      className="flex items-end justify-center rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-3 pb-2 pt-3 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
      style={{ backgroundColor: "#fff" }}
    >
      <img
        src={FULLBODY_SRC}
        srcSet={FULLBODY_SRCSET}
        sizes={sizes}
        alt={FULLBODY_ALT}
        width={FULLBODY_W}
        height={FULLBODY_H}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className={`${heightClass} w-auto max-w-none select-none object-contain object-bottom`}
        data-testid="randy-fullbody-image"
      />
    </span>
  );
}

type ChatMessage = {
  id: string;
  role: "randy" | "user";
  text: string;
  showHandoff?: boolean;
  showCal?: boolean;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RandyChat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RandyChatMode>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [discoveryTurns, setDiscoveryTurns] = useState(0);
  const [handoffReady, setHandoffReady] = useState(false);
  const [calUnlocked, setCalUnlocked] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [teaserDone, setTeaserDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<RandyModelMessage[]>([]);

  const resetThread = useCallback(() => {
    setMessages([
      {
        id: "opener",
        role: "randy",
        text: SMART_OPENER,
      },
    ]);
    setDiscoveryTurns(0);
    setHandoffReady(false);
    setCalUnlocked(false);
    setVoiceNote(null);
    setInput("");
    setTyping(false);
    setMode("chat");
    historyRef.current = [{ role: "assistant", content: SMART_OPENER }];
  }, []);

  const openWidget = useCallback(
    (detail?: OpenRandyChatDetail) => {
      setOpen(true);
      setTeaserVisible(false);
      setTeaserDone(true);
      if (messages.length === 0) resetThread();
      if (detail?.mode === "hear") {
        setMode("hear");
      } else if (detail?.mode === "call") {
        setMode("call");
      } else {
        setMode("chat");
      }
      if (detail?.reason === "book-a-call") {
        // Pre-screen path: keep Cal locked until discovery qualifies.
        setCalUnlocked(false);
      }
    },
    [messages.length, resetThread],
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<OpenRandyChatDetail>;
      openWidget(custom.detail ?? { reason: "launcher" });
    };
    window.addEventListener(OPEN_RANDY_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RANDY_CHAT_EVENT, onOpen);
  }, [openWidget]);

  // Teaser bubble after ~4s (closed state only; once per page view).
  useEffect(() => {
    if (open || dismissed || teaserDone) return;
    const t = window.setTimeout(() => setTeaserVisible(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [open, dismissed, teaserDone]);

  const dismissFigure = useCallback(() => {
    setDismissed(true);
    setTeaserVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessionStorage unavailable — hide for this render only */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages, typing, open, mode]);

  useEffect(() => {
    if (open && mode === "chat") {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, mode]);

  const unlockHandoff = useCallback((alsoCal: boolean) => {
    setHandoffReady(true);
    if (alsoCal) setCalUnlocked(true);
  }, []);

  const appendRandy = useCallback(
    (text: string, opts?: { showHandoff?: boolean; showCal?: boolean }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "randy",
          text,
          showHandoff: opts?.showHandoff,
          showCal: opts?.showCal,
        },
      ]);
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant", content: text },
      ];
    },
    [],
  );

  const runReply = useCallback(
    async (userText: string, chipId?: DiscoveryChipId) => {
      const nextTurns = discoveryTurns + 1;
      setDiscoveryTurns(nextTurns);
      setTyping(true);

      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: userText },
      ];

      try {
        const reply = await requestRandyReply({
          messages: historyRef.current,
          mode: mode === "hear" ? "hear" : "chat",
          chipId,
        });

        const offer = shouldOfferLiveHandoff({
          discoveryTurns: nextTurns,
          lastUserText: userText,
          chipId,
        });
        const showHandoff = Boolean(reply.offerHandoff || offer);
        // Cal only after qualification (2–3 turns or clear fit / handoff from model).
        // HARD: Cal only after the pre-screen (≥2 visitor turns), never on the first tap.
        const showCal = showHandoff && nextTurns >= 2;

        if (showHandoff) unlockHandoff(showCal);

        appendRandy(reply.text, { showHandoff, showCal });
      } catch {
        appendRandy(
          "I’m paused for a second. Tap Call for the live line, or keep chatting — Cal unlocks after a quick pre-screen.",
          { showHandoff: true, showCal: false },
        );
        unlockHandoff(false);
      } finally {
        setTyping(false);
      }
    },
    [appendRandy, discoveryTurns, mode, unlockHandoff],
  );

  const handleChip = async (chipId: DiscoveryChipId, label: string, message: string) => {
    if (chipId === "talk_human") trackCta("cta_book_call");
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: label }]);
    await runReply(message, chipId);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    setMessages((prev) => [...prev, { id: newId(), role: "user", text }]);
    await runReply(text);
  };

  const selectMode = async (next: RandyChatMode) => {
    setMode(next);
    if (next === "call") {
      // Call chip: available; persistent CTA when intent shown — allow dial.
      trackCta("cta_book_call");
      unlockHandoff(true);
      window.location.href = RANDY_TEL_HREF;
      return;
    }
    if (next === "hear") {
      const session = await startRandyVoiceSession();
      const note =
        !session.ok && "uiNote" in session
          ? session.uiNote
          : "Hear Randy — text via Grok when AI is on; Eve/Grok realtime voice next.";
      setVoiceNote(note);
      if (!session.ok) {
        appendRandy(
          "Hear Randy: ask in text (Grok when live). In-widget Eve/Grok voice is next — tap Call for the phone closer now. Cal stays locked until we qualify.",
          { showHandoff: true, showCal: false },
        );
        unlockHandoff(false);
      }
    }
  };

  const onCalClick = () => {
    if (!calUnlocked) return;
    trackCta("cta_book_call");
  };

  return (
    <>
      <style>{FIGURE_STYLES}</style>

      {/* Closed state: full-body Randy on a floating white card, bottom-right */}
      {!open && !dismissed && (
        <div
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-3 z-[45] flex items-end gap-2 md:bottom-6 md:right-6"
          data-testid="randy-figure-launcher"
        >
          {teaserVisible && (
            <button
              type="button"
              onClick={() => openWidget({ reason: "launcher", mode: "chat" })}
              className="randy-teaser relative mb-16 max-w-[150px] rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-left text-[13px] font-medium leading-snug text-slate-900 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:mb-24 md:max-w-[190px] md:px-4 md:py-3 md:text-sm"
              style={{ backgroundColor: "#fff" }}
              aria-label={`${TEASER_TEXT} Open chat with Randy`}
              data-testid="randy-teaser"
            >
              {TEASER_TEXT}
              <span
                aria-hidden
                className="absolute -right-[7px] bottom-4 size-3 rotate-45 border-r border-t border-[rgba(0,0,0,0.08)] bg-white"
              />
            </button>
          )}
          <div className="randy-bob relative">
            <button
              type="button"
              onClick={() => openWidget({ reason: "launcher", mode: "chat" })}
              className="randy-lift block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              aria-label="Chat with Randy about Birch Reserve category seats"
              data-testid="button-open-randy-chat"
            >
              <FullBodyCard
                heightClass="h-[130px] md:h-[200px]"
                sizes="(min-width: 768px) 100px, 66px"
                eager
              />
            </button>
            <button
              type="button"
              onClick={dismissFigure}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-[rgba(0,0,0,0.12)] bg-white text-slate-600 shadow-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Hide Randy for this visit"
              data-testid="button-dismiss-randy"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Open state: full-body figure stays visible on white — beside the panel (desktop), above it (mobile) */}
      {open && (
        <div
          className="pointer-events-none fixed right-3 top-3 z-50 sm:bottom-6 sm:right-[calc(1.5rem+400px+12px)] sm:top-auto"
          data-testid="randy-figure-open"
        >
          <div className="randy-bob">
            <FullBodyCard heightClass="h-[130px] sm:h-[200px]" sizes="(min-width: 640px) 100px, 66px" eager />
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 flex flex-col bg-foreground text-background shadow-2xl sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[400px] sm:border sm:border-background/20 bottom-0 right-0 h-[calc(100dvh-170px)] w-full"
            role="dialog"
            aria-modal="false"
            aria-label="Chat with Randy"
            data-testid="dialog-randy-chat"
          >
            {/* Header + avatar */}
            <div className="flex items-center justify-between gap-3 border-b border-background/20 p-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-background/20">
                  <img
                    src={HEAD_SRC}
                    alt="Randy, cartoon head and shoulders"
                    className="size-full object-contain"
                    width={44}
                    height={44}
                    data-testid="randy-avatar-image"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-display tracking-wide truncate">Randy</h3>
                  <p className="text-[11px] text-background/60 truncate">Birch Reserve</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="size-8 flex items-center justify-center text-background/60 hover:text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                aria-label="Close Randy chat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mode chips: Chat | Hear Randy | Call */}
            <div
              className="flex gap-2 border-b border-background/15 px-4 py-3 shrink-0"
              role="tablist"
              aria-label="Randy modes"
              data-testid="randy-mode-chips"
            >
              {(
                [
                  { id: "chat" as const, label: "Chat", icon: MessageSquareText },
                  { id: "hear" as const, label: "Hear Randy", icon: Mic },
                  { id: "call" as const, label: "Call", icon: Phone },
                ] as const
              ).map((chip) => {
                const Icon = chip.icon;
                const active = mode === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => void selectMode(chip.id)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                      active
                        ? "bg-accent border-accent text-accent-foreground"
                        : "border-background/25 text-background/80 hover:bg-background/10"
                    }`}
                    data-testid={`randy-chip-${chip.id}`}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Messages — keep in-thread */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                {messages.map((msg, index) => (
                  <div key={msg.id} className="w-full">
                    {msg.role === "randy" ? (
                      <div className="flex flex-col items-start gap-1">
                        {(index === 0 || messages[index - 1]?.role !== "randy") && (
                          <div className="mb-1 flex items-center gap-2">
                            <img
                              src={HEAD_SRC}
                              alt=""
                              className="size-5 rounded-full bg-white object-contain"
                              width={20}
                              height={20}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-background/55">
                              Randy
                            </span>
                          </div>
                        )}
                        <p className="pr-6 text-sm leading-relaxed text-background/90">{msg.text}</p>
                        {msg.showHandoff && (
                          <div className="mt-3 flex w-full flex-col gap-2">
                            <a
                              href={RANDY_TEL_HREF}
                              onClick={() => trackCta("cta_book_call")}
                              className="flex items-center justify-center gap-2 border border-accent bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                              data-testid="randy-handoff-call"
                            >
                              <Phone className="size-4" aria-hidden />
                              Call {RANDY_TEL_DISPLAY}
                            </a>
                            {msg.showCal || calUnlocked ? (
                              <a
                                href={BOOK_CALL_CAL_URL}
                                target="_blank"
                                rel="noreferrer"
                                onClick={onCalClick}
                                className="flex items-center justify-center gap-2 border border-background/25 px-4 py-3 text-sm font-medium text-background hover:bg-background/10"
                                data-testid="randy-handoff-cal"
                              >
                                <Calendar className="size-4" aria-hidden />
                                Book on calendar
                              </a>
                            ) : (
                              <p className="text-[11px] text-background/50">
                                Calendar unlocks after a short pre-screen in this chat.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] bg-background/10 px-4 py-3 text-sm text-background">
                          {msg.text}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Suggestion chips on fresh opener */}
                {messages.length === 1 && !typing && mode === "chat" && (
                  <div className="flex flex-wrap gap-2" data-testid="randy-suggestion-chips">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => void handleChip(chip.id, chip.label, chip.message)}
                        data-testid={`randy-suggestion-${chip.id}`}
                        className="border border-background/25 px-3 py-2 text-left text-xs text-background/90 hover:bg-background/10"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {mode === "hear" && voiceNote && (
                  <p className="border border-background/15 bg-background/5 px-3 py-2 text-[11px] text-background/70">
                    {voiceNote}
                  </p>
                )}

                {typing && (
                  <div className="flex w-max items-center gap-1 border border-background/10 bg-background/5 px-4 py-3">
                    <span className="size-1.5 animate-bounce rounded-full bg-background/40" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-background/40" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-background/40" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                <div ref={endRef} className="h-2" />
              </div>
            </div>

            {/* Persistent CTAs when handoff intent shown */}
            {handoffReady && (
              <div className="flex gap-2 border-t border-background/15 px-4 py-2 shrink-0" data-testid="randy-persistent-cta">
                <a
                  href={RANDY_TEL_HREF}
                  onClick={() => trackCta("cta_book_call")}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 bg-accent px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-accent-foreground"
                >
                  <Phone className="size-3.5" aria-hidden />
                  Call
                </a>
                {calUnlocked ? (
                  <a
                    href={BOOK_CALL_CAL_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onCalClick}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 border border-background/25 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-background"
                  >
                    <Calendar className="size-3.5" aria-hidden />
                    Calendar
                  </a>
                ) : (
                  <span className="inline-flex flex-1 items-center justify-center px-2 py-2 text-[10px] uppercase tracking-wider text-background/40">
                    Cal after pre-screen
                  </span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-background/20 p-4 shrink-0">
              {mode === "chat" || mode === "hear" ? (
                <form onSubmit={submit} className="relative flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mode === "hear" ? "Ask — text live; Eve voice next…" : "Ask Randy…"}
                    className="h-12 w-full border border-background/20 bg-background/5 px-4 pr-20 text-sm text-background placeholder:text-background/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    data-testid="randy-chat-input"
                  />
                  {input.trim() && (
                    <button
                      type="submit"
                      className="absolute right-2 top-2 h-8 px-3 bg-accent text-xs font-bold uppercase tracking-widest text-accent-foreground"
                    >
                      Send
                    </button>
                  )}
                </form>
              ) : (
                <p className="text-center text-[10px] uppercase tracking-widest text-background/45">
                  Dialing {RANDY_TEL_DISPLAY}…
                </p>
              )}
              <p className="mt-2 text-center text-[9px] text-background/35">
                SoT: voice-closer/knowledge · mailto backup{" "}
                <a href={BOOK_CALL_MAILTO_HREF} className="underline">
                  email
                </a>
                <span className="sr-only">{VOICE_CLOSER_KNOWLEDGE_SOT}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
