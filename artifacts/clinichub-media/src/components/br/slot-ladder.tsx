import { useState } from "react";
import { SLOT_LADDER, type Currency } from "../../../../api-server/src/lib/overhaul/model";
import { Field, inputClass, postJson, useOverhaulStatus } from "./ui";

/** Non-exclusive deposits that buy down the rate (bonus credit). Uses POST /v1/sponsor/deposit (gated). */
export function SlotLadder({ currency, audience }: { currency: Currency; audience: "brand" | "local" }) {
  const status = useOverhaulStatus();
  const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const tier = SLOT_LADDER.find((t) => t.key === pick)!;
    setBusy(true);
    setMsg(null);
    const body = { brand: fd.get("brand"), email: fd.get("email"), agree: fd.get("agree") === "on", currency, ...(tier.key === "slot-490" ? { amount: currency === "cad" ? tier.cad : tier.usd } : { tier: tier.key }) };
    try {
      const r = await postJson<{ url?: string; error?: string; held?: boolean; message?: string }>("/v1/sponsor/deposit", body);
      if (r.ok && r.data.url) {
        window.location.href = r.data.url;
        return;
      }
      // Not open yet: the server records held requests in Friday; otherwise record it here so nobody is lost.
      if (!r.data.held) await postJson("/v1/leads", { kind: "deposit_interest", email: fd.get("email"), company: fd.get("brand"), fields: { tier: tier.key, currency, audience } });
      setMsg("Reserved by inquiry. We'll confirm your slot within 1 business day. No charge today.");
    } catch {
      setMsg("Couldn't open checkout. Email sales@silverbirchgrowth.com.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="slot-ladder">
      <div className="grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-4">
        {SLOT_LADDER.map((t) => {
          const price = currency === "cad" ? t.cad : t.usd;
          const credit = Math.round(price * (1 + t.bonusPct / 100));
          const on = pick === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setPick(t.key)} className={`flex flex-col items-start p-6 text-left transition-colors ${on ? "bg-foreground text-background" : "bg-background hover:bg-secondary/60"}`} data-testid={`slot-${t.key}`}>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">{t.label}</span>
              <span className="mt-2 font-display text-4xl">${price.toLocaleString()}</span>
              <span className="text-xs opacity-70">{currency.toUpperCase()} deposit</span>
              <span className={`mt-4 text-sm font-semibold ${on ? "text-accent" : ""}`}>${credit.toLocaleString()} in ad credit</span>
              <span className="mt-1 text-xs opacity-70">{t.note}</span>
            </button>
          );
        })}
      </div>
      {pick ? (
        <form
          className="mt-6 grid gap-4 border border-foreground/15 bg-white p-6 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget);
          }}
        >
          <Field label={audience === "brand" ? "Brand" : "Business"}>
            <input name="brand" required className={inputClass} />
          </Field>
          <Field label="Work email">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <button type="submit" disabled={busy} className="h-12 bg-accent px-6 text-sm font-semibold text-accent-foreground hover:bg-foreground hover:text-background disabled:opacity-60">
            {busy ? "Opening…" : status?.depositCheckout ? "Pay deposit" : "Reserve by inquiry"}
          </button>
          <label className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-3">
            <input type="checkbox" name="agree" required className="mt-0.5" /> I agree to the deposit terms: credit spends down on live hubs over 6 months from when my deposit lands, under an insertion order that names the hubs; unused credit can be refunded or extended month by month at the same rate.
          </label>
          {msg ? <p className="text-sm md:col-span-3" data-testid="slot-msg">{msg}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
