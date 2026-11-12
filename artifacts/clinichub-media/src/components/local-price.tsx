import { usePriceText } from "@/lib/currency";

/** Renders a string with its $190 / $490 USD copy shown in the visitor's currency. */
export function LocalPrice({ children }: { children: string }) {
  const t = usePriceText();
  return <>{t(children)}</>;
}
