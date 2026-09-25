type HubWalkthroughVideoProps = {
  className?: string;
  /** data-testid for the <video> element */
  testId?: string;
};

/**
 * Live DR-HO'S hub walkthrough (Randy upload). Native player — no third-party embed.
 * Caption stays illustrative of seat-placement context.
 */
export function HubWalkthroughVideo({
  className = "h-full w-full object-cover object-top",
  testId = "video-hub-walkthrough",
}: HubWalkthroughVideoProps) {
  return (
    <video
      className={className}
      data-testid={testId}
      src="/hub-video/dr-ho-runthrough.mp4"
      poster="/hub-video/dr-ho-runthrough-poster.jpg"
      controls
      playsInline
      muted
      loop
      autoPlay
      preload="metadata"
      aria-label="Live DR-HO'S hub walkthrough"
    />
  );
}
