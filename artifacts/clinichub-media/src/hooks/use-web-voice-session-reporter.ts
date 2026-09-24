/**
 * React hook around WebVoiceSessionReporter for the in-browser live voice client.
 *
 *   const voiceLog = useWebVoiceSessionReporter();
 *   voiceLog.start({ surface: "call_chip", chatSessionId });  // when the session connects
 *   voiceLog.addTurn("user", finalCallerTranscript);           // on each final transcript
 *   voiceLog.addTurn("assistant", finalAgentTranscript);
 *   voiceLog.setFields({ name, company, phone, email, need }); // when captured
 *   voiceLog.end("caller_hangup");                              // on normal end
 *
 * Unexpected closes are covered automatically: pagehide and tab-hidden flush
 * with sendBeacon, and unmount ends the session. Kept separate from the voice
 * client itself so it can be wired in with a few lines after PR #19.
 */
import { useEffect, useMemo } from "react";
import { WebVoiceSessionReporter } from "@/lib/web-voice-session";

export function useWebVoiceSessionReporter(): WebVoiceSessionReporter {
  const reporter = useMemo(() => new WebVoiceSessionReporter(), []);
  useEffect(() => {
    const onPageHide = () => {
      if (reporter.active) reporter.flush("pagehide");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && reporter.active) reporter.flush("tab_hidden");
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (reporter.active) reporter.end("unmount");
    };
  }, [reporter]);
  return reporter;
}
