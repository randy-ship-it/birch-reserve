export const CTA_EVENTS = [
  "cta_hold_190",
  "cta_reserve_490",
  "cta_book_call",
  "cta_open_reserve",
  "cta_custom_onprem",
  "cta_confirmation_placement",
  "cta_auto_buy",
  "cta_private_distribution",
  "cta_insights_article",
  "cta_insights_related",
] as const;

export type CtaEvent = (typeof CTA_EVENTS)[number];
export type CtaOffer = "hold-190" | "reserve-490";

const CTA_EVENT_SET = new Set<string>(CTA_EVENTS);

function currentPath(): string {
  const path = window.location.pathname || "/";
  return path.slice(0, 200);
}

export function trackCta(event: CtaEvent, options?: { offer?: CtaOffer | null }): void {
  if (!CTA_EVENT_SET.has(event)) return;
  try {
    const payload: { event: CtaEvent; path: string; offer?: CtaOffer } = {
      event,
      path: currentPath(),
    };
    if (options?.offer === "hold-190" || options?.offer === "reserve-490") {
      payload.offer = options.offer;
    }
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon("/v1/ui-events", new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
    void fetch("/v1/ui-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // CTA navigation must not wait on or surface analytics failures.
  }
}

export function trackReserveDialogOpen(
  format: string | undefined,
  offer: CtaOffer,
): void {
  if (offer === "hold-190") {
    trackCta("cta_hold_190", { offer: "hold-190" });
    return;
  }
  if (format === "Confirmation Placement") {
    trackCta("cta_confirmation_placement", { offer: "reserve-490" });
    return;
  }
  if (format === "Auto-buy") {
    trackCta("cta_auto_buy", { offer: "reserve-490" });
    return;
  }
  if (format === "Private distribution") {
    trackCta("cta_private_distribution", { offer: "reserve-490" });
    return;
  }
  if (format) {
    trackCta("cta_open_reserve", { offer: "reserve-490" });
    return;
  }
  trackCta("cta_reserve_490", { offer: "reserve-490" });
}
