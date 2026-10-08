import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Same sentence on birchreserve.net, /inventory and scalehealth.ca. Do not paraphrase.
export const ORDERS_DEFINITION =
  "Orders: completed customer purchases over 12 months, on a partner brand's own store or through a clinic's member hub, across the Reserve List audience. Figures marked est. are modeled.";

const VISUALS = [
  {
    src: "/orders-brand-hub.webp",
    alt: "Jack Health brand hub on Scale Health, a brand's own page where a customer purchase counts as one order",
    caption: "Brand hub: a customer buys on the brand's own store = 1 order",
  },
  {
    src: "/orders-clinic-hub.webp",
    alt: "Example clinic member hub from scalehealth.ca/clinichubs, where a patient purchase counts as one order",
    caption: "Clinic hub: a patient buys through their clinic's member hub = 1 order",
  },
];

const finePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// (i) beside "orders". Hover on desktop, tap on mobile. The card is position:fixed, so it never shifts layout.
export function OrdersInfo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leave = useRef<number | undefined>(undefined);
  const uid = useId().replace(/:/g, "");
  const cardId = `orders-card-${uid}`;
  const defId = `orders-def-${uid}`;

  useEffect(() => setReady(true), []);

  const place = () => {
    const btn = btnRef.current;
    const card = cardRef.current;
    if (!btn || !card) return;
    const r = btn.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const on = () => place();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || cardRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const cancelLeave = () => {
    if (leave.current) window.clearTimeout(leave.current);
  };
  const scheduleLeave = () => {
    cancelLeave();
    leave.current = window.setTimeout(() => setOpen(false), 160);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current bg-transparent p-0 align-[-2px] text-[10px] font-semibold leading-none ${
          tone === "dark" ? "ml-1 text-current" : "ml-1 text-current"
        }`}
        aria-label="What orders means"
        aria-expanded={open}
        aria-controls={cardId}
        aria-describedby={defId}
        data-testid="orders-info"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (finePointer()) setOpen(true);
          else setOpen((v) => !v);
        }}
        onMouseEnter={() => {
          if (!finePointer()) return;
          cancelLeave();
          setOpen(true);
        }}
        onMouseLeave={() => {
          if (!finePointer()) return;
          scheduleLeave();
        }}
        onFocus={() => setOpen(true)}
      >
        i
      </button>
      {ready &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={defId}
            hidden={!open}
            data-testid="orders-info-card"
            onMouseEnter={() => {
              if (finePointer()) cancelLeave();
            }}
            onMouseLeave={() => {
              if (finePointer()) scheduleLeave();
            }}
            className="w-[min(520px,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3.5 text-left text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,.12)]"
            style={{ position: "fixed", zIndex: 90, boxSizing: "border-box" }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              onClick={() => {
                setOpen(false);
                btnRef.current?.focus();
              }}
            >
              ×
            </button>
            <p id={defId} className="m-0 pr-8 text-[13px] leading-snug text-neutral-800">
              {ORDERS_DEFINITION}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
              {VISUALS.map((v) => (
                <figure key={v.src} className="m-0 min-w-0">
                  <img src={v.src} alt={v.alt} width={640} height={420} className="block h-[132px] w-full rounded-md border border-neutral-200 object-cover object-top bg-neutral-100" />
                  <figcaption className="mt-1.5 text-xs leading-snug text-neutral-600">{v.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
