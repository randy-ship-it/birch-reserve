/**
 * Internal: share + referral events (Randy via Emma, Nov 19 2026 8:31 AM ET). Unlisted; signed-in team only (route
 * wrapped in Clerk <Show when="signed-in">) and the API enforces the active sales-staff allowlist
 * (requireSalesStaff, same as /sales/advertiser-requests). noindex. Counts by channel, page and placement + latest.
 */
import { useEffect, useState } from "react";
import { usePageMeta } from "@/components/br/ui";

type Summary = {
  store: "postgres" | "memory";
  since_days: number;
  totals: { share: number; click: number; arrival: number };
  by_channel: Array<{ channel: string; share: number; click: number; arrival: number }>;
  by_path: Array<{ path: string; share: number; click: number; arrival: number }>;
  by_ref: Array<{ ref: string; arrival: number; click: number }>;
  recent: Array<{ at: string; kind: string; channel: string; path: string; ref: string | null; utm: string | null; referrer_host: string | null; share_id: string | null }>;
};
const fmt = (iso: string) => new Date(iso).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) + " ET";

export default function ShareEventsPage() {
  usePageMeta("Share events · internal | Birch Reserve", "Internal.");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
  useEffect(() => {
    setErr(null);
    fetch(`/api/sales/share-events?days=${days}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) throw new Error("Sign in with a team account that has sales access.");
        if (!r.ok) throw new Error("Share events are unavailable right now.");
        setData((await r.json()) as Summary);
      })
      .catch((e: Error) => setErr(e.message));
  }, [days]);
  const th = "py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-foreground/55";
  const td = "py-2 pr-3 tabular-nums";
  return (
    <div className="container mx-auto max-w-6xl px-4 py-10" data-testid="share-events-page">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Internal · team only</p>
      <h1 className="font-display text-4xl">Shares &amp; referrals</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {[1, 7, 30, 90].map((d) => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1.5 font-semibold ${days === d ? "bg-foreground text-background" : "bg-foreground/[0.06]"}`}>{d === 1 ? "24 h" : `${d} days`}</button>)}
        {data ? <span className="text-xs text-muted-foreground" data-testid="share-store">Store: {data.store === "postgres" ? "production database" : "preview memory (resets; never production)"}</span> : null}
      </div>
      {err ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" data-testid="share-events-error">{err}</p> : null}
      {data ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="share-totals">
            {(["share", "click", "arrival"] as const).map((k) => (
              <div key={k} className="rounded-2xl border border-foreground/10 bg-white p-4 shadow-sm"><p className="font-display text-4xl">{data.totals[k]}</p><p className="text-sm text-muted-foreground">{k === "share" ? "share taps" : k === "click" ? "CTA clicks to the intake" : "arrivals from tracked links"}</p></div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-foreground/10 bg-white p-4" data-testid="share-by-channel">
              <h2 className="font-display text-2xl">By channel</h2>
              <table className="mt-2 w-full text-sm"><thead><tr><th className={th}>Channel</th><th className={th}>Shares</th><th className={th}>Clicks</th><th className={th}>Arrivals</th></tr></thead>
                <tbody>{data.by_channel.map((r) => <tr key={r.channel} className="border-t border-foreground/10"><td className="py-2 pr-3 font-semibold">{r.channel}</td><td className={td}>{r.share}</td><td className={td}>{r.click}</td><td className={td}>{r.arrival}</td></tr>)}</tbody></table>
            </section>
            <section className="rounded-2xl border border-foreground/10 bg-white p-4" data-testid="share-by-ref">
              <h2 className="font-display text-2xl">By placement / ref</h2>
              <table className="mt-2 w-full text-sm"><thead><tr><th className={th}>ref</th><th className={th}>Clicks</th><th className={th}>Arrivals</th></tr></thead>
                <tbody>{data.by_ref.map((r) => <tr key={r.ref} className="border-t border-foreground/10"><td className="py-2 pr-3 font-mono text-xs">{r.ref}</td><td className={td}>{r.click}</td><td className={td}>{r.arrival}</td></tr>)}</tbody></table>
            </section>
            <section className="rounded-2xl border border-foreground/10 bg-white p-4 lg:col-span-2" data-testid="share-by-path">
              <h2 className="font-display text-2xl">By page</h2>
              <table className="mt-2 w-full text-sm"><thead><tr><th className={th}>Page</th><th className={th}>Shares</th><th className={th}>Clicks</th><th className={th}>Arrivals</th></tr></thead>
                <tbody>{data.by_path.map((r) => <tr key={r.path} className="border-t border-foreground/10"><td className="py-2 pr-3 font-mono text-xs">{r.path}</td><td className={td}>{r.share}</td><td className={td}>{r.click}</td><td className={td}>{r.arrival}</td></tr>)}</tbody></table>
            </section>
          </div>
          <section className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10 bg-white p-4" data-testid="share-recent">
            <h2 className="font-display text-2xl">Latest events</h2>
            <table className="mt-2 w-full min-w-[720px] text-sm"><thead><tr><th className={th}>When</th><th className={th}>Kind</th><th className={th}>Channel</th><th className={th}>Page</th><th className={th}>ref</th><th className={th}>utm</th><th className={th}>Referrer</th><th className={th}>Share id</th></tr></thead>
              <tbody>{data.recent.map((r, i) => <tr key={i} className="border-t border-foreground/10"><td className="py-2 pr-3 whitespace-nowrap">{fmt(r.at)}</td><td className="py-2 pr-3">{r.kind}</td><td className="py-2 pr-3">{r.channel}</td><td className="py-2 pr-3 font-mono text-xs">{r.path}</td><td className="py-2 pr-3 font-mono text-xs">{r.ref ?? "—"}</td><td className="py-2 pr-3 text-xs">{r.utm ?? "—"}</td><td className="py-2 pr-3 text-xs">{r.referrer_host ?? "—"}</td><td className="py-2 pr-3 font-mono text-xs">{r.share_id ?? "—"}</td></tr>)}</tbody></table>
          </section>
        </>
      ) : null}
    </div>
  );
}
