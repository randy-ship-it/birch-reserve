/**
 * Birch ads-only inventory signup (/sell-ads).
 * Copy from ads-only-signup/03-COPY.md (Randy approved). No invented metrics. No em dashes.
 * Posts to POST /api/launch/ads-inventory-signup → Friday birchreserve via fridayPush.
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const INVENTORY_OPTIONS = [
  { id: "site", label: "Site / web placement" },
  { id: "email", label: "Email / newsletter" },
  { id: "sms", label: "SMS" },
  { id: "waiting_room", label: "Waiting-room screen" },
] as const;

type InventoryId = (typeof INVENTORY_OPTIONS)[number]["id"];

type Status = "idle" | "submitting" | "ok" | "error";

const PAGE_TITLE = "List inventory | Birch Reserve";
const PAGE_DESCRIPTION =
  "Tell us what unused digital space you can sell. Birch matches brand buyers. Separate from category seat checkout.";

export default function SellAdsPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    document.title = PAGE_TITLE;
    description?.setAttribute("content", PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (description && previousDescription) {
        description.setAttribute("content", previousDescription);
      }
    };
  }, []);

  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [types, setTypes] = useState<Set<InventoryId>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ads-${Date.now()}`,
    [],
  );

  function toggle(id: InventoryId, on: boolean) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!company.trim() || !name.trim() || !email.trim() || !audience.trim() || types.size === 0) {
      setError("Company, name, email, audience estimate, and at least one inventory type are required.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/launch/ads-inventory-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          audienceEstimate: audience.trim(),
          inventoryTypes: Array.from(types),
          notes: notes.trim() || undefined,
          idempotencyKey,
          path: "/sell-ads",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(body.error || "We could not save that. Try again or email randy@scalehealth.ca.");
        setStatus("error");
        return;
      }
      setStatus("ok");
    } catch {
      setError("We could not save that. Try again or email randy@scalehealth.ca.");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Ads only · inventory hosts
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">
        List unused space. Sell ads.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        If you run a health or recovery site, email list, SMS list, or waiting-room screen with
        idle inventory, tell us what you have. Birch brings brand buyers. This is not the $190 /
        $490 category seat checkout.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Want ads plus product transactions in a free hub? That path is{" "}
        <a
          className="underline underline-offset-2"
          href="https://scalehealth.ca/clinichubs"
          rel="noreferrer"
          target="_blank"
        >
          scalehealth.ca/clinichubs
        </a>
        .
      </p>

      {status === "ok" ? (
        <div className="mt-10 rounded-md border border-border bg-card p-6" role="status">
          <p className="font-medium">Thanks. We logged your inventory for the Birch team.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Expect a reply at the email you gave. Category seat holds stay at{" "}
            <Link href="/buycalc" className="underline underline-offset-2">
              /buycalc
            </Link>{" "}
            if you are buying ads, not listing them.
          </p>
        </div>
      ) : (
        <form className="mt-10 space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              name="company"
              required
              maxLength={160}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Owned audience estimate</Label>
            <Input
              id="audience"
              name="audience"
              required
              maxLength={200}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. 8k email list; 25k monthly site visits"
            />
            <p className="text-xs text-muted-foreground">
              Rough monthly site visits, or email / SMS list size. A range is fine. No guarantee
              implied.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Inventory types</legend>
            {INVENTORY_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={types.has(opt.id)}
                  onCheckedChange={(v) => toggle(opt.id, v === true)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Formats, geo, brand categories you will or will not run, anything we should know.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={status === "submitting"} className="w-full sm:w-auto">
            {status === "submitting" ? "Submitting…" : "Submit inventory"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Submitting does not reserve a category seat and does not create a campaign order.
            Audience figures are your estimate only.
          </p>
        </form>
      )}
    </main>
  );
}
