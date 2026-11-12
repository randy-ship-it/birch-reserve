/**
 * Birch Q&A Squirrel visuals. Same art and motion as the Friday pipeline
 * squirrel (friday-crm pipeline-widget.ts: fsq-shake, fsq-pop acorn, fsq-nod),
 * copied here so birchreserve.net stays self-contained.
 * See lib/birch-squirrel-config.ts for the future Friday data hook.
 */
import { BIRCH_SQUIRREL } from "@/lib/birch-squirrel-config";

export const SQUIRREL_STYLES = `
@keyframes bsq-shake{0%,100%{transform:rotate(0)}15%{transform:rotate(-16deg)}35%{transform:rotate(14deg)}55%{transform:rotate(-10deg)}75%{transform:rotate(6deg)}}
@keyframes bsq-pop{0%{opacity:0;transform:translateY(8px) scale(.4)}60%{opacity:1;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-16px) scale(.9)}}
@keyframes bsq-nod{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(6deg)}55%{transform:rotate(-8deg)}70%{transform:rotate(0)}}
.bsq-nod{transform-origin:50% 85%;animation:bsq-nod 2.4s ease-in-out 1.2s 2}
.bsq-btn:hover .bsq-nod,.bsq-btn:focus-visible .bsq-nod{animation:bsq-nod .9s ease-in-out}
.bsq-shake img{animation:bsq-shake .7s ease-in-out}
.bsq-shake::after{content:"";position:absolute;right:-2px;top:-4px;width:12px;height:14px;border-radius:50% 50% 46% 46%;background:#8B5A2B;box-shadow:inset 0 4px 0 #5C3A1A;animation:bsq-pop .7s ease-out forwards}
@media (prefers-reduced-motion:reduce){.bsq-nod,.bsq-shake img,.bsq-shake::after{animation:none!important}}
`;

/** Round squirrel badge (Friday's 38px-in-48px button look), scalable. */
export function SquirrelBadge({ size = 48, className = "", nod = false, testId }: { size?: number; className?: string; nod?: boolean; testId?: string }) {
  const inner = Math.round(size * 0.8);
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full border border-[#D3D9D6] bg-white ${className}`}
      style={{ width: size, height: size }}
      data-testid={testId}
    >
      <img
        src={BIRCH_SQUIRREL.iconSrc}
        alt=""
        width={inner}
        height={inner}
        draggable={false}
        className={`pointer-events-none block select-none ${nod ? "bsq-nod" : ""}`}
        style={{ width: inner, height: inner }}
      />
    </span>
  );
}

/** Full-body squirrel (transparent), for the open-chat stage on desktop. */
export function SquirrelFull({ className = "", testId }: { className?: string; testId?: string }) {
  return (
    <img
      src={BIRCH_SQUIRREL.fullSrc}
      alt=""
      width={720}
      height={720}
      draggable={false}
      className={`select-none object-contain ${className}`}
      data-testid={testId}
    />
  );
}
