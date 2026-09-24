import { RANDY_TEL_DISPLAY, RANDY_TEL_HREF } from "@/lib/randy-chat-knowledge";
import { useEffect } from "react";
import { Phone } from "lucide-react";
import { trackCta } from "@/lib/track-cta";
import { openRandyChat } from "@/lib/book-call";

const PAGE_TITLE = "Birch Reserve · Randy voice closer (team demo)";
const TEL_HREF = RANDY_TEL_HREF;
const TEL_DISPLAY = RANDY_TEL_DISPLAY;
const KNOWLEDGE_SOT =
  "/workspace/birch-live-ops/voice-closer/knowledge/";

export default function VoiceDemo() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;

    let robots = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    const createdRobots = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    const previousRobots = robots.getAttribute("content");
    robots.setAttribute("content", "noindex,nofollow");

    return () => {
      document.title = previousTitle;
      if (createdRobots) {
        robots?.remove();
      } else if (previousRobots != null) {
        robots?.setAttribute("content", previousRobots);
      } else {
        robots?.removeAttribute("content");
      }
    };
  }, []);

  return (
    <article className="container mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Private team demo · unlisted
      </p>
      <h1 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
        Birch Reserve · Randy voice closer
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        For <strong className="text-foreground">Randy / Jon / Simar / Chris / Barb</strong> only.
        Not linked from the public site. Path stays under <code className="text-xs">/sales/</code>{" "}
        (robots Disallow).
      </p>

      <div className="mt-10 rounded-none border border-border bg-secondary/20 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Live number
        </p>
        <a
          href={TEL_HREF}
          className="mt-4 inline-flex w-full items-center justify-center gap-3 bg-accent px-6 py-4 text-base font-medium text-accent-foreground transition-colors hover:bg-accent/90 md:w-auto"
          data-testid="voice-demo-call"
        >
          <Phone className="size-5" aria-hidden />
          Call {TEL_DISPLAY}
        </a>
        <p className="mt-4 text-muted-foreground">
          Tap Call (or dial from any phone). The agent is being configured as Randy&apos;s
          voice portfolio closer. Operators: knowledge pack SoT at{" "}
          <code className="break-all text-xs text-foreground">{KNOWLEDGE_SOT}</code>
        </p>
      </div>

      <h2 className="mt-12 font-display text-2xl text-foreground">How to try it</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Call the number above from your phone.</li>
        <li>Talk as a brand buyer, provider, or partner — keep it realistic.</li>
        <li>
          If something sounds off (metrics, checkout, SKUs), note it and fall back to Book a
          call.
        </li>
      </ol>

      <h2 className="mt-12 font-display text-2xl text-foreground">Hard reminders</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          <strong className="text-foreground">Checkout OFF</strong> until Gordon. Do not claim a
          card was charged.
        </li>
        <li>
          Public ladder: <strong className="text-foreground">Hold $190</strong> /{" "}
          <strong className="text-foreground">Reserve $490</strong> /{" "}
          <strong className="text-foreground">Book a call</strong> only.
        </li>
        <li>
          Never invent reach, impressions, CTR, fill, or sourced quotes you do not have.
        </li>
        <li>
          <strong className="text-foreground">$899</strong> is never hero (legacy / unpublished
          only).
        </li>
        <li>
          If someone is a <strong className="text-foreground">provider</strong>: rails-not-leads —
          no lead fee, bounty, or “we send you patients.”
        </li>
      </ul>

      <div className="mt-12 border-t border-border pt-8">
        <p className="text-muted-foreground">
          Prefer to chat with Randy first instead of the voice line?
        </p>
        <button
          type="button"
          onClick={() => {
            trackCta("cta_book_call");
            // Qualify in Randy chat — Cal only after qualification in-thread.
            openRandyChat({ reason: "voice-demo", mode: "chat" });
          }}
          className="mt-3 inline-block border border-border px-4 py-2 text-xs font-medium uppercase tracking-widest text-foreground transition-colors hover:border-accent hover:text-accent"
          data-testid="voice-demo-book-call"
        >
          Book a call
        </button>
      </div>
    </article>
  );
}
