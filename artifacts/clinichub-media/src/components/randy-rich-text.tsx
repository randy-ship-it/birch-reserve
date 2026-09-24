/**
 * Safe link rendering for Randy replies: plain text in, React nodes out.
 * Links render as short labels, never as spelled-out URLs (Randy via Emma
 * 2026-09-24 6:48pm ET): markdown [label](url) shows the label; a bare URL
 * shows a short label (known destination name or the bare host).
 * Only http(s)/tel/mailto become links; web links open in a new tab with
 * rel="noopener noreferrer". No HTML is ever parsed or injected (no
 * dangerouslySetInnerHTML) — every token is a React text node or <a>.
 * Calendar links stay non-clickable unless allowCal (the widget always passes
 * allowCal since 5:28pm; the model only gives the calendar when a visitor
 * insists on a set time).
 */
import React from "react";
import { isCalendarHost, tokenizeRandyLinks } from "@/lib/randy-links";

export function isCalendarUrl(url: string): boolean {
  try {
    return isCalendarHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function RichText({ text, allowCal }: { text: string; allowCal: boolean }) {
  const tokens = tokenizeRandyLinks(text);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === "text") return <React.Fragment key={`t-${i}`}>{t.text}</React.Fragment>;
        if (t.calendar && !allowCal) {
          return <span key={`cal-${i}`}>Randy&apos;s calendar (it opens here after a quick call)</span>;
        }
        return (
          <a
            key={`url-${i}`}
            href={t.href}
            {...(t.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="underline decoration-accent underline-offset-2 hover:text-accent"
            data-testid="randy-reply-link"
          >
            {t.label}
          </a>
        );
      })}
    </>
  );
}
