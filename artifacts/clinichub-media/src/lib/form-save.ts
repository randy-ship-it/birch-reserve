/**
 * Save-as-you-type for public forms (Randy, voice, Nov 21 2026): a refresh or a back-button never loses what a
 * visitor typed. localStorage only, this browser only, never sent anywhere. Cleared on a successful submit and
 * after 7 days. Honeypot and file fields are never saved.
 */
import { useEffect, useRef, useState } from "react";

const PREFIX = "br-form:";
const TTL_MS = 7 * 24 * 3600_000;

export function loadSaved<T extends Record<string, unknown>>(key: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const o = JSON.parse(raw) as { at?: number; v?: Partial<T> };
    if (!o || typeof o !== "object" || !o.v || typeof o.at !== "number" || Date.now() - o.at > TTL_MS) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return o.v;
  } catch {
    return null;
  }
}

export function saveForm(key: string, v: Record<string, unknown>): void {
  try {
    const clean = Object.fromEntries(Object.entries(v).filter(([k, x]) => !/^(fax|company_url|company_website|hp)$/i.test(k) && x !== undefined));
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), v: clean }));
  } catch {
    /* storage blocked: the form still works */
  }
}

export function clearSaved(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** useState that persists to localStorage under `key`. `restored` is true when saved answers were brought back. */
export function useSavedState<T extends Record<string, unknown>>(key: string, initial: T): [T, (next: T | ((cur: T) => T)) => void, { restored: boolean; clear: () => void }] {
  const restoredRef = useRef(false);
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const s = loadSaved<T>(key);
    if (s && Object.values(s).some((x) => (typeof x === "string" ? x.trim() : x != null && x !== false))) {
      restoredRef.current = true;
      return { ...initial, ...s };
    }
    return initial;
  });
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) {
      // A new key (e.g. new prefilled picks): start from that key's saved answers or the new defaults.
      keyRef.current = key;
      const s = loadSaved<T>(key);
      setV(s ? { ...initial, ...s } : initial);
      return;
    }
    saveForm(key, v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
  return [v, setV, { restored: restoredRef.current, clear: () => clearSaved(key) }];
}

export const EMAIL_OK = /^[^\s@]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
export const SITE_OK = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;

/** Friendly inline message for a field, or "" when it's fine. */
export function fieldError(kind: "email" | "website" | "text", value: string, required = true): string {
  const v = value.trim();
  if (!v) return required ? (kind === "email" ? "Add your work email." : kind === "website" ? "Add your website, like yourbrand.com." : "This one's needed.") : "";
  if (kind === "email" && !EMAIL_OK.test(v)) return "That email looks off. Check for a typo, like name@company.com.";
  if (kind === "website" && !SITE_OK.test(v)) return "Use a web address like yourbrand.com.";
  return "";
}

/** Autofill hints by field name, so every form gets the right keyboard and browser autofill. */
export function autofillFor(name: string, type?: string): { autoComplete?: string; inputMode?: "email" | "url" | "tel" | "text" | "numeric"; type?: string } {
  const n = name.toLowerCase();
  if (type === "email" || n === "email") return { autoComplete: "email", inputMode: "email", type: "email" };
  if (type === "tel" || n === "phone") return { autoComplete: "tel", inputMode: "tel", type: "tel" };
  if (type === "url" || n === "website") return { autoComplete: "url", inputMode: "url", type: "text" };
  if (n === "name") return { autoComplete: "name" };
  if (n === "company" || n === "brand" || n === "agency") return { autoComplete: "organization" };
  return {};
}
