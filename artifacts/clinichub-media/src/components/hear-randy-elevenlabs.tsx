import { useEffect } from "react";
import {
  ELEVENLABS_RANDY_AVATAR_URL,
  resolveElevenLabsRandyAgentId,
} from "@/lib/elevenlabs-randy-agent";

/**
 * iOS Safari only starts the microphone if getUserMedia runs in the same
 * turn as the tap. The convai widget awaits its terms modal before opening
 * the socket, which spends that gesture. Unlock audio and the mic here, in
 * the capture phase, so the later widget start still has permission.
 */
let voiceUnlockPending = false;

function unlockIosVoiceGesture(event: Event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const inWidget = path.some(
    (node) => node instanceof Element && node.localName === "elevenlabs-convai",
  );
  if (!inWidget) return;

  const button = path.find((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
  const label = `${button?.innerText ?? ""} ${button?.getAttribute("aria-label") ?? ""}`.toLowerCase();
  if (button && /dismiss|cancel|end|mute|close/.test(label)) return;
  if (button && !/start|accept|talk|call|hear|agree/.test(label)) return;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextCtor) {
    try {
      const ctx = new AudioContextCtor();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      void ctx.resume();
    } catch {
      /* A second tap can finish the unlock if this context is blocked. */
    }
  }

  const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (!getUserMedia || voiceUnlockPending) return;
  voiceUnlockPending = true;
  if (import.meta.env.VITE_BROWSER_TEST_AUTH === "true") {
    const micCalls = ((window as Window & { __gum?: number[] }).__gum ??= []);
    micCalls.push(performance.now());
  }
  // Invoke synchronously inside the user gesture. Do not await first.
  const pending = getUserMedia({ audio: true });
  void pending.then(
    (stream) => {
      window.setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop());
        voiceUnlockPending = false;
      }, 4000);
    },
    () => {
      voiceUnlockPending = false;
    },
  );
}

const SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";
const SCRIPT_ATTR = "data-elevenlabs-convai-embed";

declare global {
  // React 19 JSX namespace
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "elevenlabs-convai": React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLElement>,
          HTMLElement
        > & {
          "agent-id"?: string;
          "action-text"?: string;
          "start-call-text"?: string;
          "end-call-text"?: string;
          "avatar-image-url"?: string;
          dismissible?: string | boolean;
        };
      }
    }
  }
}

/**
 * Site-wide Hear Randy CTA via ElevenLabs ConvAI widget (bottom-left).
 * Chat Randy stays bottom-right. Mode in randy-chat is chat|call only —
 * this floating widget is the Hear path (no second brain / no prompt override).
 */
export function HearRandyElevenLabs() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`script[${SCRIPT_ATTR}]`)) return;

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.setAttribute(SCRIPT_ATTR, "1");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // touchend is the iOS gesture that may call getUserMedia. click covers WebKit taps.
    document.addEventListener("touchend", unlockIosVoiceGesture, true);
    document.addEventListener("click", unlockIosVoiceGesture, true);
    return () => {
      document.removeEventListener("touchend", unlockIosVoiceGesture, true);
      document.removeEventListener("click", unlockIosVoiceGesture, true);
    };
  }, []);

  const agentId = resolveElevenLabsRandyAgentId();

  return (
    <>
      <style>{`
        /*
         * The widget paints its controls inside a full-viewport host
         * (pointer-events: none, children opt back in). Pinning only
         * left/bottom and leaving top at 0 collapses that host to 0px
         * wide — iOS then drops taps on Start / Accept. Keep the host
         * full-bleed and above the mobile reserve bar (z-40).
         */
        elevenlabs-convai {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          max-width: 100vw;
          z-index: 60;
          pointer-events: none;
        }
        @media (max-width: 767px) {
          /*
           * Absolute controls inside the shadow tree ignore host padding.
           * Shorten the host so Start / Accept sit above the sticky
           * call + reserve bar and that bar stays tappable.
           */
          elevenlabs-convai {
            top: 0;
            bottom: 11.5rem;
            height: auto;
          }
        }
      `}</style>
      <elevenlabs-convai
        agent-id={agentId}
        action-text="Hear Randy"
        start-call-text="Start talking"
        end-call-text="End"
        avatar-image-url={ELEVENLABS_RANDY_AVATAR_URL}
        dismissible="true"
      />
    </>
  );
}
