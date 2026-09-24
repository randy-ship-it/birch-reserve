/**
 * Chat Randy widget (Emma UX + Randy HARD). Grok text via /api/launch/randy-chat.
 *
 * Header: Randy · Birch Reserve, online dot, Call pill (tel). Voice tab hidden until voice ships.
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
import { Phone, X, Calendar, ArrowUp } from "lucide-react";
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
  shouldOfferLiveHandoff,
  type DiscoveryChipId,
  type RandyChatMode,
} from "@/lib/randy-chat-knowledge";
import {
  requestRandyReply,
  type RandyModelMessage,
} from "@/lib/randy-model-client";

/** Head + shoulders (on white) for small circles only. */
const HEAD_SRC = "/avatars/randy-head.png";
const PANEL_SHADOW =
  "shadow-[0_32px_80px_-24px_rgba(7,26,57,0.45),0_10px_28px_-10px_rgba(7,26,57,0.22)]";
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
.randy-lift { transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 260ms ease; }
.randy-lift:hover, .randy-lift:focus-visible { transform: translateY(-6px); box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.35); }
@keyframes randy-teaser-in { from { opacity: 0; transform: translateY(6px) scale(0.94); } to { opacity: 1; transform: none; } }
.randy-teaser { animation: randy-teaser-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes randy-wave { 0% { transform: rotate(0); } 20% { transform: rotate(-5deg); } 40% { transform: rotate(4deg); } 60% { transform: rotate(-3deg); } 80% { transform: rotate(2deg); } 100% { transform: rotate(0); } }
@keyframes randy-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.015); } }
.randy-wave { transform-origin: 50% 100%; animation: randy-wave 1.3s ease-in-out 0.25s 1 both, randy-breathe 4.2s ease-in-out 1.6s infinite; }
@keyframes randy-chip-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.randy-chip { animation: randy-chip-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes randy-msg-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
.randy-msg { animation: randy-msg-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes randy-dot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-4px); opacity: 1; } }
.randy-dot { animation: randy-dot 1.1s ease-in-out infinite; }
@keyframes randy-ping { 0% { transform: scale(1); opacity: 0.6; } 80%, 100% { transform: scale(2.2); opacity: 0; } }
.randy-ping { animation: randy-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .randy-bob, .randy-teaser, .randy-wave, .randy-chip, .randy-msg, .randy-dot, .randy-ping { animation: none !important; }
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
  void mode;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [discoveryTurns, setDiscoveryTurns] = useState(0);
  const [handoffReady, setHandoffReady] = useState(false);
  const [calUnlocked, setCalUnlocked] = useState(false);
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
      setMode("chat");
      if (detail?.reason === "book-a-call") {
        // Book a call: keep Cal locked until discovery qualifies.
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
          mode: "chat",
          chipId,
        });

        const offer = shouldOfferLiveHandoff({
          discoveryTurns: nextTurns,
          lastUserText: userText,
          chipId,
        });
        const showHandoff = Boolean(reply.offerHandoff || offer);
        // Cal only after qualification (2–3 turns or clear fit / handoff from model).
        // HARD: Cal only after ≥2 visitor turns, never on the first tap.
        const showCal = showHandoff && nextTurns >= 2;

        if (showHandoff) unlockHandoff(showCal);

        appendRandy(reply.text, { showHandoff, showCal });
      } catch {
        appendRandy(
          "Sorry, I couldn't get a reply just now. Tap Call for the live line, or send your message again.",
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

  const onTelClick = () => {
    trackCta("cta_book_call");
    unlockHandoff(false);
  };

  const onCalClick = () => {
    if (!calUnlocked) return;
    trackCta("cta_book_call");
  };

  const headAvatar = (size: "lg" | "sm") => (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/10 ${
        size === "lg" ? "size-11 p-[3px]" : "size-6 p-[2px]"
      }`}
    >
      <img
        src={HEAD_SRC}
        alt={size === "lg" ? "Randy, cartoon head and shoulders" : ""}
        className="size-full rounded-full object-contain"
        width={size === "lg" ? 44 : 24}
        height={size === "lg" ? 44 : 24}
        {...(size === "lg" ? { "data-testid": "randy-avatar-image" } : {})}
      />
      {size === "lg" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5" aria-label="Online" role="img">
          <span className="randy-ping absolute inline-flex size-full rounded-full bg-emerald-400" aria-hidden />
          <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
      )}
    </span>
  );

  const callPill = (label: string, testId: string) => (
    <a
      href={RANDY_TEL_HREF}
      onClick={onTelClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      aria-label={`Call Randy at ${RANDY_TEL_DISPLAY}`}
      data-testid={testId}
    >
      <Phone className="size-3.5" aria-hidden />
      {label}
    </a>
  );

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
              className="randy-teaser relative mb-16 max-w-[150px] rounded-2xl border border-black/5 bg-white px-3 py-2 text-left text-[13px] font-medium leading-snug text-slate-900 shadow-[0_12px_32px_-10px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:mb-24 md:max-w-[190px] md:px-4 md:py-3 md:text-sm"
              style={{ backgroundColor: "#fff" }}
              aria-label={`${TEASER_TEXT} Open chat with Randy`}
              data-testid="randy-teaser"
            >
              {TEASER_TEXT}
              <span
                aria-hidden
                className="absolute -right-[7px] bottom-4 size-3 rotate-45 border-r border-t border-black/5 bg-white"
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
              <FullBodyCard heightClass="h-[130px] md:h-[200px]" sizes="(min-width: 768px) 100px, 66px" eager />
            </button>
            <button
              type="button"
              onClick={dismissFigure}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 shadow-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Hide Randy for this visit"
              data-testid="button-dismiss-randy"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Desktop stage: full-body Randy on a white panel directly left of the chat, bottom-aligned, head to shoes */}
            <motion.div
              key="randy-stage"
              initial={{ opacity: 0, x: 28, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.04 }}
              className={`pointer-events-none fixed bottom-6 right-[calc(1.5rem+400px+14px)] z-50 hidden flex-col items-center justify-end rounded-3xl border border-black/5 bg-white px-6 pb-5 pt-7 md:flex ${PANEL_SHADOW}`}
              style={{ backgroundColor: "#fff" }}
              data-testid="randy-figure-open"
              aria-hidden
            >
              <img
                src={FULLBODY_SRC}
                srcSet={FULLBODY_SRCSET}
                sizes="230px"
                alt=""
                width={FULLBODY_W}
                height={FULLBODY_H}
                draggable={false}
                className="randy-wave h-[min(440px,calc(100dvh-9rem))] w-auto max-w-none select-none object-contain object-bottom"
                data-testid="randy-fullbody-stage"
              />
            </motion.div>

            {/* Chat panel: desktop floating glass card; mobile native bottom sheet */}
            <motion.div
              key="randy-panel"
              initial={{ opacity: 0, y: 48, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-150px)] flex-col rounded-t-3xl border border-black/5 bg-white/95 text-slate-900 backdrop-blur-xl md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100dvh-3rem))] md:w-[400px] md:rounded-3xl ${PANEL_SHADOW}`}
              role="dialog"
              aria-modal="false"
              aria-label="Chat with Randy from Birch Reserve"
              data-testid="dialog-randy-chat"
            >
              {/* Mobile: full-body figure peeking over the sheet's top edge, head fully visible */}
              <div
                className="pointer-events-none absolute -top-[124px] right-5 md:hidden"
                data-testid="randy-figure-peek"
                aria-hidden
              >
                <span
                  className="flex items-end justify-center rounded-2xl border border-black/5 bg-white px-2.5 pb-1.5 pt-2 shadow-[0_12px_28px_-12px_rgba(7,26,57,0.45)]"
                  style={{ backgroundColor: "#fff" }}
                >
                  <img
                    src={FULLBODY_360_SRC}
                    alt=""
                    width={271}
                    height={540}
                    draggable={false}
                    className="randy-wave h-[118px] w-auto max-w-none select-none object-contain object-bottom"
                  />
                </span>
              </div>

              {/* Grab handle (mobile) */}
              <div className="flex justify-center pt-2 md:hidden" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-slate-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 md:pt-4 shrink-0">
                <div className="flex min-w-0 items-center gap-3">
                  {headAvatar("lg")}
                  <div className="min-w-0 leading-tight">
                    <h3 className="truncate font-display text-[17px] font-semibold tracking-tight text-slate-900">Randy</h3>
                    <p className="truncate text-[12px] text-slate-500">Birch Reserve</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {callPill("Call", "randy-chip-call")}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Close chat"
                    data-testid="button-close-randy-chat"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mx-5 h-px bg-slate-200/80 shrink-0" />

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite" data-testid="randy-mode-chips">
                <div className="flex flex-col gap-3">
                  {messages.map((msg, index) => (
                    <div key={msg.id} className="randy-msg w-full">
                      {msg.role === "randy" ? (
                        <div className="flex items-end gap-2">
                          <span className="w-6 shrink-0">
                            {(index === messages.length - 1 || messages[index + 1]?.role !== "randy") && headAvatar("sm")}
                          </span>
                          <div className="flex min-w-0 max-w-[85%] flex-col items-start">
                            <p className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-[14px] leading-relaxed text-slate-800 break-words">
                              {msg.text}
                            </p>
                            {msg.showHandoff && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {callPill(`Call ${RANDY_TEL_DISPLAY}`, "randy-handoff-call")}
                                {msg.showCal || calUnlocked ? (
                                  <a
                                    href={BOOK_CALL_CAL_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={onCalClick}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:border-slate-400"
                                    data-testid="randy-handoff-cal"
                                  >
                                    <Calendar className="size-3.5" aria-hidden />
                                    Book a time
                                  </a>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[14px] leading-relaxed text-background break-words">
                            {msg.text}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Suggestion chips on fresh opener (staggered) */}
                  {messages.length === 1 && !typing && (
                    <div className="flex flex-wrap gap-2 pl-8" data-testid="randy-suggestion-chips">
                      {SUGGESTION_CHIPS.map((chip, i) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => void handleChip(chip.id, chip.label, chip.message)}
                          data-testid={`randy-suggestion-${chip.id}`}
                          className="randy-chip rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          style={{ animationDelay: `${120 + i * 70}ms` }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {typing && (
                    <div className="flex items-end gap-2" data-testid="randy-typing" aria-label="Randy is typing">
                      <span className="w-6 shrink-0">{headAvatar("sm")}</span>
                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="randy-dot size-1.5 rounded-full bg-slate-500"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={endRef} className="h-1" />
                </div>
              </div>

              {/* Composer */}
              <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shrink-0">
                <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-5 pr-1.5 focus-within:border-slate-400 focus-within:bg-white">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    maxLength={1000}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message Randy…"
                    aria-label="Message Randy"
                    className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    data-testid="randy-chat-input"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || typing}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform enabled:hover:scale-105 disabled:opacity-40"
                    aria-label="Send"
                    data-testid="randy-send"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </form>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Prefer email?{" "}
                  <a href={BOOK_CALL_MAILTO_HREF} className="underline hover:text-slate-600">
                    Email Randy
                  </a>
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
