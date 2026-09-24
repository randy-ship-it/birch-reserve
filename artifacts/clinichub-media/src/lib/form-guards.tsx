/**
 * Honeypot + attribution for every public form (Randy 6:50pm).
 * The server (api-server lib/publicGuards.ts) silently accepts-and-drops any
 * submission whose `fax` field is filled, and strips `attribution` into the lead row.
 */
import type { RefObject } from "react";
import { getAttribution, type AttributionPayload } from "@/lib/attribution";

export const HONEYPOT_FIELD = "fax";

/** Visually hidden, off the tab order and hidden from assistive tech; bots fill it. */
export function HoneypotField({ inputRef, idSuffix }: { inputRef: RefObject<HTMLInputElement | null>; idSuffix: string }) {
  const id = `hp-${HONEYPOT_FIELD}-${idSuffix}`;
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label htmlFor={id}>Fax</label>
      <input ref={inputRef} id={id} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** Adds `fax` (honeypot value) + `attribution` to a JSON body; typed as the original body. */
export function withFormGuards<T extends object>(body: T, honeypot: RefObject<HTMLInputElement | null>): T {
  const extra: { fax: string; attribution?: AttributionPayload } = { fax: honeypot.current?.value ?? "" };
  const attribution = getAttribution();
  if (Object.keys(attribution).length) extra.attribution = attribution;
  return { ...body, ...extra } as T;
}
