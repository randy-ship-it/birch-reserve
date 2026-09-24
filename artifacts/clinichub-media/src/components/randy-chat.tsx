/**
 * Chat Randy widget. Grok text via /api/launch/randy-chat.
 *
 * Header: Randy · Birch Reserve, online dot, Call pill (tel). Voice tab hidden until voice ships.
 * HARD 2026-09-24 3:31–3:33pm ET: birchreserve.net = Birch Reserve only (opener + chips).
 * Full-body Randy (/avatars/randy-fullbody.png, transparent cutout) stands bottom-right
 * on a floating WHITE card (never navy behind him), object-fit: contain, bottom center:
 * head through shoes always visible. Small circles use /avatars/randy-head.png only.
 * HARD 3:42pm ET: never silent on failure (error + Retry + tel). Book a call asks
 * 2–3 qualifying questions; next step is an AI call (tel) or a callback request;
 * No calendar CTA anywhere (HARD 5:28pm): partnerships get a callback intake. Every session is logged
 * server-side and emailed to Randy.
 * HARD 3:52pm ET: visitor-facing identity is "Randy from Birch Reserve"; no internal labels.
 * Checkout OFF. Public SKUs hold-190 / reserve-490 only.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X, PhoneIncoming, RotateCw, ArrowUp } from "lucide-react";
import { trackCta } from "@/lib/track-cta";
import { track } from "@/lib/analytics";
import { ensureHuman } from "@/lib/human-gate";
import { HoneypotField } from "@/lib/form-guards";
import { isLingerOpen, LINGER_STATE_EVENT, setChatOpen } from "@/lib/overlay-bus";
import {
  BOOK_CALL_MAILTO_HREF,
  OPEN_RANDY_CHAT_EVENT,
  type OpenRandyChatDetail,
} from "@/lib/book-call";
import { reserveIntakeNeed } from "@/lib/checkout-status";
import {
  AI_CALL_LABEL,
  QUALIFY_QUESTIONS,
  RANDY_TEL_DISPLAY,
  RANDY_TEL_HREF,
  SMART_OPENER,
  SUGGESTION_CHIPS,
  TALK_HUMAN_REPLY,
  TEASER_TEXT,
  qualifyDoneMessage,
  shouldOfferLiveHandoff,
  type DiscoveryChipId,
  type QualifyKey,
} from "@/lib/randy-chat-knowledge";
import {
  beaconRandyEvent,
  requestRandyReply,
  sendRandyEvent,
  type RandyChatEventType,
  type RandyModelMessage,
  type RandyReplyFailure,
} from "@/lib/randy-model-client";
import { RichText } from "@/components/randy-rich-text";

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
  /** error = friendly failure bubble (not sent to the model). */
  kind?: "error";
  showHandoff?: boolean;
  failure?: RandyReplyFailure["kind"];
};

type Mode = "chat" | "call";

const SESSION_KEY = "birch:randy-session";
const PHONE_DIGITS_MIN = 10;
const INTAKE_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function failureCopy(kind: RandyReplyFailure["kind"]): string {
  switch (kind) {
    case "timeout":
      return "Sorry, that took too long on my side. Tap Retry, or call the live line and you'll get an answer right away.";
    case "rate_limited":
      return "You're quicker than me. Give it a few seconds, then tap Retry. The live line is always open too.";
    case "network":
      return "Looks like the connection dropped. Check your signal and tap Retry, or call the live line.";
    default:
      return "Sorry, I couldn't get a reply just now. Tap Retry, or call the live line and you'll get an answer right away.";
  }
}

function toHistory(messages: ChatMessage[]): RandyModelMessage[] {
  return messages
    .filter((m) => !m.kind)
    .map((m) => ({ role: m.role === "randy" ? "assistant" : "user", content: m.text }));
}

export function RandyChat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [slow, setSlow] = useState(false);
  const [handoffReady, setHandoffReady] = useState(false);
  const [callStepDone, setCallStepDone] = useState(false);
  const [qualifyStep, setQualifyStep] = useState<number | null>(null);
  const [qualify, setQualify] = useState<Partial<Record<QualifyKey, string>>>({});
  const [qualified, setQualified] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackName, setCallbackName] = useState("");
  const [intake, setIntake] = useState<{ company: string; role: string; email: string; need: string; size: string; timing: string }>({
    company: "",
    role: "",
    email: "",
    need: "",
    size: "",
    timing: "",
  });
  const [callbackState, setCallbackState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [teaserDone, setTeaserDone] = useState(false);
  // Linger email card showing → hide the launcher (never both on screen).
  const [lingerOpen, setLingerOpenState] = useState<boolean>(() => isLingerOpen());
  const honeypotRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionRef = useRef<string>("");
  const qualifyRef = useRef<Partial<Record<QualifyKey, string>>>({});

  messagesRef.current = messages;
  qualifyRef.current = qualify;

  const sessionId = useCallback(() => {
    if (!sessionRef.current) sessionRef.current = getSessionId();
    return sessionRef.current;
  }, []);

  const setThread = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const pushMessages = useCallback(
    (...items: ChatMessage[]) => {
      setThread([...messagesRef.current, ...items]);
    },
    [setThread],
  );

  const logEvent = useCallback(
    (
      type: RandyChatEventType,
      extra?: {
        contact?: { phone?: string; name?: string; email?: string; role?: string };
        qualify?: { company?: string; need?: string; size?: string; timing?: string };
        fax?: string;
      },
    ) =>
      sendRandyEvent({
        sessionId: sessionId(),
        type,
        messages: toHistory(messagesRef.current),
        qualify: { ...qualifyRef.current, ...(extra?.qualify ?? {}) },
        ...(extra?.contact ? { contact: extra.contact } : {}),
        ...(extra?.fax ? { fax: extra.fax } : {}),
      }),
    [sessionId],
  );

  const startQualify = useCallback(() => {
    setQualifyStep(0);
    pushMessages({ id: newId(), role: "randy", text: QUALIFY_QUESTIONS[0]!.prompt });
  }, [pushMessages]);

  const ensureThread = useCallback(() => {
    if (messagesRef.current.length === 0) {
      setThread([{ id: "opener", role: "randy", text: SMART_OPENER }]);
    }
  }, [setThread]);

  const openWidget = useCallback(
    (detail?: OpenRandyChatDetail) => {
      setOpen(true);
      track("chat_open", { reason: detail?.reason ?? "launcher" });
      // Humans only: verify in the background while the opener shows (no-op when off).
      void ensureHuman();
      setTeaserVisible(false);
      setTeaserDone(true);
      setMode("chat");
      if (detail?.reason === "reserve-intake") {
        // Checkout paused: straight into the callback intake, seat + category preselected.
        const sku = detail.sku === "hold-190" ? "hold-190" : "reserve-490";
        const need = reserveIntakeNeed(sku, detail.category);
        ensureThread();
        const nextQualify = { ...qualifyRef.current, ...(detail.category ? { category: detail.category } : {}) };
        qualifyRef.current = nextQualify;
        setQualify(nextQualify);
        setIntake((cur) => ({ ...cur, need }));
        pushMessages({
          id: newId(),
          role: "randy",
          text: `Online checkout is paused, so I'll lock this with you directly. Leave your details and the team will send the insertion order and invoice for the ${sku === "hold-190" ? "$190 hold" : "$490 seat"}.`,
        });
        setHandoffReady(true);
        setCallbackOpen(true);
        return;
      }
      const isBookCall =
        detail?.reason === "book-a-call" || detail?.reason === "voice-demo" || detail?.reason === "concierge";
      if (isBookCall && !qualified && qualifyStep === null) {
        // Book a call: qualifying questions first, never a cold calendar link.
        if (messagesRef.current.length === 0) setThread([]);
        startQualify();
      } else {
        ensureThread();
      }
    },
    [ensureThread, pushMessages, qualified, qualifyStep, setThread, startQualify],
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<OpenRandyChatDetail>;
      openWidget(custom.detail ?? { reason: "launcher" });
    };
    window.addEventListener(OPEN_RANDY_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RANDY_CHAT_EVENT, onOpen);
  }, [openWidget]);

  // Deep link (?chat=book) used by server-rendered pages instead of a bare calendar link.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("chat") === "book") openWidget({ reason: "book-a-call", mode: "chat" });
      else if (params.get("chat") === "open") openWidget({ reason: "launcher", mode: "chat" });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setChatOpen(open);
  }, [open]);

  useEffect(() => {
    const onLinger = (event: Event) => setLingerOpenState(Boolean((event as CustomEvent<{ open: boolean }>).detail?.open));
    window.addEventListener(LINGER_STATE_EVENT, onLinger);
    return () => window.removeEventListener(LINGER_STATE_EVENT, onLinger);
  }, []);

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
  }, [messages, typing, open, mode, callbackOpen, callbackState]);

  useEffect(() => {
    if (open && mode === "chat") {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, mode]);

  // "Still thinking…" after 8s of typing.
  useEffect(() => {
    if (!typing) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [typing]);


  // Transcript: close beacon when the tab is hidden/closed mid-conversation.
  useEffect(() => {
    const onHide = () => {
      if (messagesRef.current.some((m) => m.role === "user")) {
        beaconRandyEvent({
          sessionId: sessionId(),
          type: "close",
          messages: toHistory(messagesRef.current),
          qualify: qualifyRef.current,
        });
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [sessionId]);

  const closeWidget = () => {
    setOpen(false);
    if (messagesRef.current.some((m) => m.role === "user")) {
      beaconRandyEvent({
        sessionId: sessionId(),
        type: "close",
        messages: toHistory(messagesRef.current),
        qualify: qualifyRef.current,
      });
    }
  };

  /** Ask Grok for the next reply using the current thread (already ends with the user turn). */
  const fetchReply = useCallback(
    async (chipId?: DiscoveryChipId) => {
      const history = toHistory(messagesRef.current);
      const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      const turns = history.filter((m) => m.role === "user").length;
      setTyping(true);
      try {
        const reply = await requestRandyReply({
          messages: history,
          mode: "chat",
          ...(chipId ? { chipId } : {}),
          sessionId: sessionId(),
        });
        if (!reply.ok) {
          pushMessages({
            id: newId(),
            role: "randy",
            kind: "error",
            text: failureCopy(reply.kind),
            failure: reply.kind,
          });
          setHandoffReady(true);
          return;
        }
        const showHandoff = Boolean(
          reply.offerHandoff || shouldOfferLiveHandoff({ discoveryTurns: turns, lastUserText: lastUser, chipId }),
        );
        if (showHandoff) setHandoffReady(true);
        if (turns >= 3) setQualified(true);
        pushMessages({ id: newId(), role: "randy", text: reply.text, showHandoff });
      } finally {
        setTyping(false);
      }
    },
    [pushMessages, sessionId],
  );

  const retry = async (errorId: string) => {
    if (typing) return;
    setThread(messagesRef.current.filter((m) => m.id !== errorId));
    await fetchReply();
  };

  /** Local (non-model) Randy turn; synced to the transcript. */
  const localReply = useCallback(
    (text: string, opts?: { showHandoff?: boolean }) => {
      pushMessages({ id: newId(), role: "randy", text, showHandoff: opts?.showHandoff });
      if (opts?.showHandoff) setHandoffReady(true);
      void logEvent("activity");
    },
    [logEvent, pushMessages],
  );

  const answerQualify = (text: string) => {
    const step = qualifyStep ?? 0;
    const key = QUALIFY_QUESTIONS[step]!.key;
    const nextQualify = { ...qualifyRef.current, [key]: text };
    qualifyRef.current = nextQualify;
    setQualify(nextQualify);
    pushMessages({ id: newId(), role: "user", text });
    const next = step + 1;
    if (next < QUALIFY_QUESTIONS.length) {
      setQualifyStep(next);
      localReply(QUALIFY_QUESTIONS[next]!.prompt);
      return;
    }
    setQualifyStep(null);
    setQualified(true);
    if (callStepDone) {
      localReply("Thanks, that's everything I need.");
    } else {
      pushMessages({ id: newId(), role: "randy", text: qualifyDoneMessage(nextQualify.company), showHandoff: true });
      setHandoffReady(true);
    }
    void logEvent("qualified");
  };

  const handleChip = async (chipId: DiscoveryChipId, label: string, message: string) => {
    if (typing) return;
    if (chipId === "talk_human") {
      trackCta("cta_book_call");
      pushMessages({ id: newId(), role: "user", text: label });
      localReply(TALK_HUMAN_REPLY, { showHandoff: true });
      return;
    }
    // Bubble shows the chip label; the model gets the fuller message.
    pushMessages({ id: newId(), role: "user", text: message });
    track("chat_message", { chip: chipId });
    await fetchReply(chipId);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    if (qualifyStep !== null) {
      answerQualify(text);
      return;
    }
    pushMessages({ id: newId(), role: "user", text });
    track("chat_message");
    await fetchReply();
  };

  const markCallStep = (
    type: "tel_click" | "callback_request",
    extra?: {
      contact?: { phone?: string; name?: string; email?: string; role?: string };
      qualify?: { company?: string; need?: string; size?: string; timing?: string };
      fax?: string;
    },
  ) => {
    setCallStepDone(true);
    setHandoffReady(true);
    return logEvent(type, extra);
  };

  const openCallbackIntake = () => {
    // Prefill from the qualifying answers so the visitor doesn't retype them.
    const q = qualifyRef.current;
    setIntake((cur) => ({
      ...cur,
      company: cur.company || q.company || "",
      need: cur.need || q.category || "",
      timing: cur.timing || q.timing || "",
    }));
    setCallbackOpen(true);
  };

  const onTelClick = () => {
    trackCta("cta_book_call");
    void markCallStep("tel_click");
    if (!qualified && qualifyStep === null) {
      window.setTimeout(() => {
        pushMessages({
          id: newId(),
          role: "randy",
          text: "Calling now. If you'd rather, leave your details here and the team will call you back.",
        });
      }, 400);
    }
  };

  const submitCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = callbackPhone.replace(/\D/g, "");
    const email = intake.email.trim();
    if (digits.length < PHONE_DIGITS_MIN || digits.length > 15 || (email && !INTAKE_EMAIL.test(email))) {
      setCallbackState("error");
      return;
    }
    setCallbackState("sending");
    const name = callbackName.trim();
    pushMessages({
      id: newId(),
      role: "user",
      text: `Please call me back at ${callbackPhone.trim()}${name ? ` (${name})` : ""}.`,
    });
    const clip = (v: string, n: number) => v.trim().slice(0, n);
    const contact = {
      phone: callbackPhone.trim(),
      ...(name ? { name: clip(name, 80) } : {}),
      ...(email ? { email } : {}),
      ...(intake.role.trim() ? { role: clip(intake.role, 80) } : {}),
    };
    const qualifyExtra = {
      ...(intake.company.trim() ? { company: clip(intake.company, 300) } : {}),
      ...(intake.need.trim() ? { need: clip(intake.need, 300) } : {}),
      ...(intake.size.trim() ? { size: clip(intake.size, 300) } : {}),
      ...(intake.timing.trim() ? { timing: clip(intake.timing, 300) } : {}),
    };
    const fax = honeypotRef.current?.value ?? "";
    const ok = await markCallStep("callback_request", { contact, qualify: qualifyExtra, ...(fax ? { fax } : {}) });
    if (!ok) {
      setCallbackState("error");
      pushMessages({
        id: newId(),
        role: "randy",
        kind: "error",
        text: "Sorry, I couldn't save your details just now. Try again, or call the live line.",
      });
      return;
    }
    setCallbackState("done");
    setCallbackOpen(false);
    trackCta("cta_book_call");
    track("intake_submit", { source: "chat_callback" });
    setQualifyStep(null);
    pushMessages({
      id: newId(),
      role: "randy",
      text: "Got it, thanks. Randy's team will call you back shortly. Anything else I can answer in the meantime?",
    });
  };

  const lastHandoffIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i]!.showHandoff) return i;
    return -1;
  })();

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

  const pillBase =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

  const handoffCard = (
    <div className="mt-2 flex w-full flex-col gap-2" data-testid="randy-handoff">
      <a
        href={RANDY_TEL_HREF}
        onClick={onTelClick}
        className={`${pillBase} h-10 justify-center bg-accent text-accent-foreground shadow-sm`}
        data-testid="randy-handoff-ai-call"
      >
        <Phone className="size-4" aria-hidden />
        {AI_CALL_LABEL}
      </a>
      {callbackState === "done" ? (
        <p className="text-[12px] text-slate-500">Callback requested. Randy&apos;s team will call you shortly.</p>
      ) : callbackOpen ? (
        <form
          onSubmit={submitCallback}
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3"
          data-testid="randy-callback-form"
        >
          <p className="text-[12px] font-medium text-slate-600">Leave your details and the team will call you back.</p>
          <HoneypotField inputRef={honeypotRef} idSuffix="randy-callback" />
          <input
            id="randy-callback-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={callbackPhone}
            onChange={(e) => {
              setCallbackPhone(e.target.value);
              if (callbackState === "error") setCallbackState("idle");
            }}
            placeholder="Phone (required)"
            aria-label="Phone number (required)"
            maxLength={32}
            required
            className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            data-testid="randy-callback-phone"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              autoComplete="name"
              value={callbackName}
              onChange={(e) => setCallbackName(e.target.value)}
              placeholder="Name"
              aria-label="Your name"
              maxLength={80}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-name"
            />
            <input
              type="email"
              autoComplete="email"
              value={intake.email}
              onChange={(e) => {
                setIntake((c) => ({ ...c, email: e.target.value }));
                if (callbackState === "error") setCallbackState("idle");
              }}
              placeholder="Email"
              aria-label="Email"
              maxLength={254}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-email"
            />
            <input
              type="text"
              autoComplete="organization"
              value={intake.company}
              onChange={(e) => setIntake((c) => ({ ...c, company: e.target.value }))}
              placeholder="Company"
              aria-label="Company"
              maxLength={300}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-company"
            />
            <input
              type="text"
              autoComplete="organization-title"
              value={intake.role}
              onChange={(e) => setIntake((c) => ({ ...c, role: e.target.value }))}
              placeholder="Role"
              aria-label="Role"
              maxLength={80}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-role"
            />
          </div>
          <input
            type="text"
            value={intake.need}
            onChange={(e) => setIntake((c) => ({ ...c, need: e.target.value }))}
            placeholder="What do you need?"
            aria-label="What do you need?"
            maxLength={300}
            className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            data-testid="randy-callback-need"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={intake.size}
              onChange={(e) => setIntake((c) => ({ ...c, size: e.target.value }))}
              placeholder="Size (locations, budget)"
              aria-label="Size (locations, budget)"
              maxLength={300}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-size"
            />
            <input
              type="text"
              value={intake.timing}
              onChange={(e) => setIntake((c) => ({ ...c, timing: e.target.value }))}
              placeholder="Timing"
              aria-label="Timing"
              maxLength={300}
              className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              data-testid="randy-callback-timing"
            />
          </div>
          {callbackState === "error" && (
            <p className="text-[12px] text-red-600" role="alert">
              Please enter a full phone number with area code{intake.email.trim() ? ", and a valid email" : ""}.
            </p>
          )}
          <button
            type="submit"
            disabled={callbackState === "sending"}
            className={`${pillBase} h-10 justify-center bg-foreground text-background disabled:opacity-60`}
            data-testid="randy-callback-submit"
          >
            {callbackState === "sending" ? "Sending…" : "Call me back"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={openCallbackIntake}
          className={`${pillBase} h-10 justify-center border border-slate-300 bg-white text-slate-800`}
          data-testid="randy-handoff-callback"
        >
          <PhoneIncoming className="size-4" aria-hidden />
          Request a callback
        </button>
      )}
    </div>
  );

  return (
    <>
      <style>{FIGURE_STYLES}</style>

      {/* Closed state: full-body Randy on a floating white card, bottom-right */}
      {!open && !dismissed && !lingerOpen && (
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
                    onClick={closeWidget}
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
                            {msg.kind === "error" ? (
                              <div
                                className="w-full rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-4 py-3 text-[14px] leading-relaxed text-slate-800"
                                role="alert"
                                data-testid="randy-error"
                              >
                                <p>{msg.text}</p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  {msg.failure && (
                                    <button
                                      type="button"
                                      onClick={() => void retry(msg.id)}
                                      className={`${pillBase} border border-slate-300 bg-white text-slate-800`}
                                      data-testid="randy-retry"
                                    >
                                      <RotateCw className="size-3.5" aria-hidden />
                                      Retry
                                    </button>
                                  )}
                                  {callPill("Call", "randy-error-call")}
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-line break-words rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-[14px] leading-relaxed text-slate-800">
                                <RichText text={msg.text} allowCal />
                              </p>
                            )}
                            {msg.showHandoff && index === lastHandoffIndex && handoffCard}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] break-words rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[14px] leading-relaxed text-background">
                            {msg.text}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Suggestion chips on fresh opener (staggered) */}
                  {messages.length === 1 && messages[0]?.id === "opener" && !typing && (
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
                        {slow && <span className="ml-2 text-[12px] text-slate-500">Still thinking…</span>}
                      </div>
                    </div>
                  )}
                  <div ref={endRef} className="h-1" />
                </div>
              </div>

              {/* Persistent next steps once handoff intent shows */}
              {handoffReady && (
                <div className="flex gap-2 px-4 pt-2 shrink-0" data-testid="randy-persistent-cta">
                  <a href={RANDY_TEL_HREF} onClick={onTelClick} className={`${pillBase} flex-1 justify-center bg-accent text-accent-foreground`}>
                    <Phone className="size-3.5" aria-hidden />
                    AI call now
                  </a>
                  {callbackState === "done" ? (
                    <span className="inline-flex flex-1 items-center justify-center text-[12px] text-slate-500">Callback requested</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        openCallbackIntake();
                        if (lastHandoffIndex < 0) {
                          pushMessages({ id: newId(), role: "randy", text: "Leave your details and Randy's team will call you back.", showHandoff: true });
                        }
                      }}
                      className={`${pillBase} flex-1 justify-center border border-slate-300 bg-white text-slate-800`}
                    >
                      <PhoneIncoming className="size-3.5" aria-hidden />
                      Callback
                    </button>
                  )}
                </div>
              )}

              {/* Composer */}
              <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shrink-0">
                <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-5 pr-1.5 focus-within:border-slate-400 focus-within:bg-white">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    maxLength={1000}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={qualifyStep !== null ? "Type your answer…" : "Message Randy…"}
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
                  Chats are saved so Randy&apos;s team can follow up. Prefer email?{" "}
                  <a href={BOOK_CALL_MAILTO_HREF} className="underline hover:text-slate-600">
                    Email sales
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
