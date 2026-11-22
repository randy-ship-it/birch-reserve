/**
 * Scale-voice for shared copy constants (Randy, Nov 21 2026: Scale pages talk about Scale). The strings live in
 * server-shared modules written in Birch voice. On the Scale mirror the boot script sets window.__BR_MIRROR.skin
 * before the bundle loads, so module-load evaluation in the browser can swap the brand name. Server and
 * birchreserve.net always get the original text. Silver Birch Growth Inc. (legal) is never touched.
 */
export function scaleVoice<T extends string>(s: T): string {
  const w = (globalThis as { window?: { __BR_MIRROR?: { skin?: string } } }).window;
  if (w?.__BR_MIRROR?.skin !== "scale") return s;
  return s
    .replace(/Birch Reserve/g, "Scale Health")
    .replace(/(?<!Silver )\bBirch\b/g, "Scale Health");
}

/** Deep version for copy objects and arrays (strings only; other values pass through). */
export function scaleVoiceDeep<T>(v: T): T {
  if (typeof v === "string") return scaleVoice(v) as unknown as T;
  if (Array.isArray(v)) return v.map(scaleVoiceDeep) as unknown as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scaleVoiceDeep(x)])) as T;
  return v;
}
