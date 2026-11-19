/**
 * Network-figure copy override (Randy via Emma, Nov 19 2026 1:56 PM ET). Supplier mode (/intake/supplier) provides
 * SUPPLIER_NETWORK_COPY; with no provider (every other page, incl. the default /intake) components render exactly
 * as before. Retail line = a retail-network estimate; Street Team = no homes figure, plain reach line.
 */
import { createContext, useContext, type ReactNode } from "react";
import { RETAIL_COPY } from "../../../api-server/src/lib/overhaul/brandIntake";

export type NetworkCopy = { retail: string; tag: string; street: string };
export const SUPPLIER_NETWORK_COPY: NetworkCopy = {
  retail: "120+ retail hubs · 1MM+ recovery customers (est., growing to 300–500+ hubs) · Canada + USA",
  tag: "retail-network estimate",
  street: "reaches a few million doors targeted around the retail network",
};
const Ctx = createContext<NetworkCopy | null>(null);
export const NetworkCopyProvider = ({ value, children }: { value: NetworkCopy | null; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useNetworkCopy = () => useContext(Ctx);

/** "<retail line> · <tag>". Without a provider: the original RETAIL_COPY + the caller's original tag, unchanged. */
export function RetailNetworkLine({ fallbackTag }: { fallbackTag: string }) {
  const nc = useNetworkCopy();
  return <>{nc ? `${nc.retail} · ${nc.tag}` : `${RETAIL_COPY} · ${fallbackTag}`}</>;
}

type Tile = { key: string; fig: Array<{ v: string; l: string }>; line: string };
/** Report tiles: retail + street-team figures for the supplier preset; identity without a provider. */
export function applyNetworkCopy<T extends Tile>(tiles: T[], nc: NetworkCopy | null): T[] {
  if (!nc) return tiles;
  return tiles.map((t) =>
    t.key === "retail-network"
      ? { ...t, fig: [{ v: "120+", l: "retail hubs" }, { v: "1MM+", l: "recovery customers (est.)" }, { v: "300–500+", l: "hubs, growing to" }], line: `${nc.retail} · ${nc.tag}.` }
      : t.key === "street-team"
        ? { ...t, fig: [{ v: "A few million", l: "doors targeted around the retail network" }], line: `Street Team ${nc.street}.` }
        : t,
  );
}
