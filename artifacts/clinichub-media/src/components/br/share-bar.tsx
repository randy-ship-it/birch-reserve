/**
 * One-tap sharing (Randy via Emma, Nov 19 2026 8:31 AM ET): copy link, email, text, LinkedIn, X, and the phone's
 * own share sheet when the browser has one. Every outbound link carries ?ref=share_<channel>&sid=<id>; the tap and
 * the later arrival are both logged server-side (lib/shareTrack.ts).
 */
import { useMemo, useState } from "react";
import { Check, Link2, Mail, MessageSquare, Share2 } from "lucide-react";
import { logShare, newShareId, shareUrl, type ShareChannel } from "@/lib/shareTrack";

const LinkedInIcon = () => <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.2 1.5-2.2 2.9V21h-4V9Z" /></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor"><path d="M17.8 3H21l-7 8 8.2 10h-6.4l-5-6.2L5 21H1.8l7.5-8.6L1.4 3h6.6l4.5 5.7L17.8 3Zm-1.1 16.2h1.8L7.4 4.7H5.5l11.2 14.5Z" /></svg>;

export function ShareBar({ title = "Get your free Monetization Kit", text = "See what your brand or hub could earn and reach across health and wellness hubs. Estimates, reviewed by a person.", tone = "light", testId = "share-bar", href }: { title?: string; text?: string; tone?: "light" | "dark"; testId?: string; /** "intake": share the public /intake page instead of the current URL (private report pages). */ href?: "intake" }) {
  const sid = useMemo(() => newShareId(), []);
  const [copied, setCopied] = useState(false);
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const url = (c: ShareChannel) => shareUrl(c, sid, href === "intake" ? `${window.location.origin}/intake` : undefined);
  const btn = tone === "dark" ? "bg-white/10 text-white hover:bg-white hover:text-[#0b1f3a]" : "bg-foreground/[0.06] text-foreground hover:bg-foreground hover:text-background";
  const cls = `inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${btn}`;
  const open = (c: ShareChannel, href: string) => () => {
    logShare(c, sid);
    if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer,width=640,height=640");
    else window.location.href = href;
  };
  const copy = async () => {
    logShare("copy", sid);
    try {
      await navigator.clipboard.writeText(url("copy"));
    } catch {
      window.prompt("Copy this link", url("copy"));
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const native = async () => {
    logShare("native", sid);
    try {
      await navigator.share({ title, text, url: url("native") });
    } catch {
      /* dismissed */
    }
  };
  const enc = encodeURIComponent;
  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-2">
      <span className={`mr-1 text-[11px] font-bold uppercase tracking-wider ${tone === "dark" ? "text-white/60" : "text-foreground/55"}`}>Share</span>
      {canNative ? (
        <button type="button" onClick={native} data-testid={`${testId}-native`} className={`${cls} md:hidden`}><Share2 className="size-4" />Share…</button>
      ) : null}
      <button type="button" onClick={copy} data-testid={`${testId}-copy`} className={cls} aria-live="polite">{copied ? <Check className="size-4" /> : <Link2 className="size-4" />}{copied ? "Copied" : "Copy link"}</button>
      <button type="button" onClick={open("email", `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url("email")}`)}`)} data-testid={`${testId}-email`} className={cls} aria-label="Share by email"><Mail className="size-4" /><span className="hidden sm:inline">Email</span></button>
      <button type="button" onClick={open("sms", `sms:?&body=${enc(`${title}: ${url("sms")}`)}`)} data-testid={`${testId}-sms`} className={cls} aria-label="Share by text message"><MessageSquare className="size-4" /><span className="hidden sm:inline">Text</span></button>
      <button type="button" onClick={open("linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url("linkedin"))}`)} data-testid={`${testId}-linkedin`} className={cls} aria-label="Share on LinkedIn"><LinkedInIcon /><span className="hidden sm:inline">LinkedIn</span></button>
      <button type="button" onClick={open("x", `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url("x"))}`)} data-testid={`${testId}-x`} className={cls} aria-label="Share on X"><XIcon /><span className="hidden sm:inline">Post</span></button>
    </div>
  );
}
