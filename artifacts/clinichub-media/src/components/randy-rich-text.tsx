/**
 * Safe link rendering for Randy replies: plain text in, React nodes out.
 * Only http(s) URLs become links (target=_blank rel=noopener noreferrer).
 * No HTML is ever parsed or injected (no dangerouslySetInnerHTML).
 * Calendar links stay non-clickable until the visitor has qualified and taken
 * the AI call / callback step. Since 5:28pm the widget always passes allowCal
 * (the model only gives the calendar when a visitor insists on a set time; no UI surfaces it).
 */
import React from "react";

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING = /[.,;:!?)\]}'"]+$/;

export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isCalendarUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "cal.com" || host.endsWith(".cal.com");
  } catch {
    return false;
  }
}

export function RichText({ text, allowCal }: { text: string; allowCal: boolean }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    let raw = match[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    if (start > last) nodes.push(text.slice(last, start));
    const safe = safeHttpUrl(raw);
    if (!safe) {
      nodes.push(raw);
    } else if (isCalendarUrl(safe) && !allowCal) {
      nodes.push(<span key={`cal-${key++}`}>Randy&apos;s calendar (it opens here after a quick call)</span>);
    } else {
      nodes.push(
        <a
          key={`url-${key++}`}
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-accent underline-offset-2 hover:text-accent break-all"
          data-testid="randy-reply-link"
        >
          {raw}
        </a>,
      );
    }
    if (trail) nodes.push(trail);
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
