import { useEffect } from "react";
import {
  ELEVENLABS_RANDY_AVATAR_URL,
  resolveElevenLabsRandyAgentId,
} from "@/lib/elevenlabs-randy-agent";

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

  const agentId = resolveElevenLabsRandyAgentId();

  return (
    <>
      <style>{`
        elevenlabs-convai {
          position: fixed;
          bottom: 20px;
          left: 20px;
          right: auto;
          z-index: 40;
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
