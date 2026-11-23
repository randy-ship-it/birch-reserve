/** "insertion order (IO)" on first use per page (single source: api-server/src/lib/ioExplain.ts). */
import { IO_EXPLAIN_JS } from "../../../api-server/src/lib/ioExplain";

export function ensureIoExplain(): void {
  if (typeof window === "undefined" || (window as unknown as { __brIo?: number }).__brIo) return;
  try {
    const s = document.createElement("script");
    s.textContent = IO_EXPLAIN_JS;
    document.head.appendChild(s);
  } catch {
    /* best effort */
  }
}
