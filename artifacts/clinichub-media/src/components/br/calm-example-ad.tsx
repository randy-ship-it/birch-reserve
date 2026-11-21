import type { HubKey } from "@/lib/hub-mocks";

/**
 * Example ad inside the hub mockups (Randy, Nov 21 2026 5:54 PM): the real Calm Joints creative (e7fa6757, 1200x628),
 * shown ONLY as an illustration inside example-hub mockups, labelled "Example placement". It is not a live ad: nothing
 * here calls the ad server, fires beacons or links out. Live serving stays in the ad system (campaign 899bcb46 is paused).
 * On the Calm Joints hub mock itself we keep the neutral "Your brand" card (a brand advertising on its own hub reads oddly).
 */
export const CALM_EXAMPLE = {
  brand: "Calm Joints",
  src: "/ads-examples/calm-joints-example.webp",
  src600: "/ads-examples/calm-joints-example-600.webp",
  alt: "Example placement: Calm Joints ad",
  label: "Example placement",
  w: 1200,
  h: 628,
} as const;

export const showCalmExample = (hub?: HubKey) => hub !== "calmjoints";

export function CalmExampleCreative({ className = "", sizes = "(max-width: 768px) 60vw, 420px", fit = "cover" }: { className?: string; sizes?: string; fit?: "cover" | "contain" }) {
  return (
    <img
      src={CALM_EXAMPLE.src600}
      srcSet={`${CALM_EXAMPLE.src600} 600w, ${CALM_EXAMPLE.src} 1200w`}
      sizes={sizes}
      width={CALM_EXAMPLE.w}
      height={CALM_EXAMPLE.h}
      alt={CALM_EXAMPLE.alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`block w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
      data-testid="calm-example-creative"
    />
  );
}
