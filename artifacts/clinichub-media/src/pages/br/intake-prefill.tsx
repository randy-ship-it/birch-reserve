/**
 * /intake/b/:slug — a brand's prefilled, editable intake (PREVIEW ONLY; Randy via Emma, Nov 19 2026 12:54 PM ET).
 * One copy-paste link per brand: /intake/b/<slug>#edit=<private key>. Form beside the report (stacked on phones),
 * a plain "we drafted this" banner, each drafted field marked. Saves send only what the brand changed (full blocks,
 * so nothing prefilled is wiped). "Confirm" submits the same record and the report recalibrates.
 * Contract + gaps: /workspace/hub-intake-prefill/BIRCH-CONTRACT.md. ?mock=1 keeps everything in this browser.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import { Check, Loader2, Pencil, ShieldCheck, Sparkles } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { NoFitWords, ReportV2 } from "@/components/br/report-v2";
import { Details } from "@/components/br/details";
import { HUB_SURFACES } from "@/components/br/intake-details";
import { RT, RT_SANS } from "@/lib/reportTokens";
import { FRIDAY_CATEGORIES } from "../../../../api-server/src/lib/kitCalc/fridayV12";
import { mockExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import type { Country } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import type { FridayReport } from "@/lib/fridayBrandIntake";
import { buildPatch, afterSave, clone, fieldMark, getPath, parsePrefillHash, prefillLink, rebase, setPath, slugify, type FieldMark, type PrefillFields, type PrefillRef } from "@/lib/prefillDraft";
import { PREVIEW_LABEL, PrefillFail, asPreview, draftReport, forgetPrefillRef, loadPrefillRef, prefillApi, prefillMode, savePrefillRef, seedMockDraft, takeEarlyHash, EARLY_HASH_KEY, type DraftMeta, type MockState, type PrefillError, type StaleData } from "@/lib/prefillApi";

// Capture the private key before anything else on the page can read the address bar.
const EARLY_HASH = takeEarlyHash();

const NAVY = "#0b1f3a";
const input = "h-11 w-full min-w-0 rounded-xl border border-foreground/15 bg-white px-3 text-base outline-none transition focus:border-[#0b1f3a] focus:ring-2 focus:ring-lime-300";
const lab = "text-[11px] font-bold uppercase tracking-wide text-foreground/55";
const ERR_COPY: Record<PrefillError, string> = {
  // r3 G1: 410 link_replaced / link_expired / link_revoked each get their own words; 404 = a key that never worked.
  not_found: "Check you opened the whole link we sent, or ask us for a fresh one.",
  link_replaced: "This link has been replaced with a newer one, so it doesn't open anything any more. Use the newest link we sent you, or ask us for a fresh one.",
  link_revoked: "We switched it off. Ask us for a fresh one if you still need it.",
  link_expired: "Draft links stop working after a while to keep them private. Ask us for a fresh one.",
  unavailable: "We can't load your draft right now. Please try again in a minute.",
  rate_limited: "Too many tries right now. We'll try again shortly.",
  stale: "Updated elsewhere. Review changes.",
  individual_data: "Please keep it to business-level details (no customer names or contacts).",
  email: "Use a valid work email.",
  website: "Add your website.",
  too_fast: "One sec: give it a moment and try again.",
  invalid: "Something in the form doesn't look right. Check the fields and try again.",
  confirm_needs_email: "Add your work email to confirm.",
  brand_token_required: "Only the brand's own link can confirm.",
  staff_edit_closed: "The brand has confirmed, so this link can't change the answers any more.",
  brand_contact_only: "Use the brand's own email here, not a staff address.",
  needs_website: "Add the brand's website to see the draft preview.",
};
const HEAD: Partial<Record<PrefillError, string>> = {
  not_found: "This link doesn't work.",
  link_replaced: "This link has been replaced.",
  link_expired: "This link has expired.",
  link_revoked: "This link was turned off.",
  rate_limited: "One moment.",
};
const LINK_DEAD = new Set<PrefillError>(["not_found", "link_replaced", "link_expired", "link_revoked"]);
const codeOf = (e: unknown): PrefillError => ((e as Error)?.message as PrefillError) in ERR_COPY ? ((e as Error).message as PrefillError) : "unavailable";
const retryOf = (e: unknown) => (e instanceof PrefillFail && e.retryAfter ? e.retryAfter : 30);
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
/** The link this tab adopted (kept across a rate-limit retry). */
let ADOPTED: { slug: string; ref: PrefillRef } | null = null;
const MARKETS: Array<{ key: string; label: string; c: Country[] }> = [
  { key: "CA", label: "Canada", c: ["CA"] },
  { key: "US", label: "USA", c: ["US"] },
  { key: "both", label: "Both", c: ["CA", "US"] },
];
const marketKey = (c: unknown) => (Array.isArray(c) ? (c.length >= 2 ? "both" : (c[0] as string) ?? null) : null);
const geoText = (c: Country[]) => (c.length === 2 ? "Canada + USA" : c[0] === "CA" ? "Canada" : c[0] === "US" ? "USA" : "");
const numOrUndef = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? undefined : Math.round(n);
};

function Mark({ m }: { m: FieldMark }) {
  if (!m) return null;
  const tone = m === "drafted" ? "bg-lime-100 text-[#0b1f3a]" : "bg-[#0b1f3a] text-white";
  return (
    <span data-testid={`mark-${m}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {m === "drafted" ? <Sparkles className="size-3" aria-hidden /> : <Pencil className="size-3" aria-hidden />}
      {m === "drafted" ? "Drafted" : m === "edited" ? "Edited" : "Added"}
    </span>
  );
}
function Field({ label, mark, children, testId }: { label: string; mark: FieldMark; children: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} data-mark={mark ?? "none"} className="block min-w-0">
      <div className="flex items-center justify-between gap-2"><span className={lab}>{label}</span><Mark m={mark} /></div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
const seg = (on: boolean) => `h-10 rounded-xl px-3 text-sm font-bold transition ${on ? "bg-[#0b1f3a] text-white shadow" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`;

type Load = { state: "loading" } | { state: "error"; error: PrefillError } | { state: "missing" } | { state: "ready" };
type Save = "idle" | "saving" | "saved" | "error" | "waiting";

export default function BrIntakePrefill() {
  const params = useParams<{ slug: string }>();
  const slug = slugify(params.slug ?? "brand");
  const mode = prefillMode();
  const [ref, setRef] = useState<PrefillRef | null>(null);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [initial, setInitial] = useState<PrefillFields>({}); // what we drafted (for Drafted/Edited marks)
  const [baseline, setBaseline] = useState<PrefillFields>({}); // what the backend holds now
  const [cur, setCur] = useState<PrefillFields>({});
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ version: number; report: FridayReport | null; held: boolean } | null>(null);
  const started = useRef(Date.now());
  const [copied, setCopied] = useState(false);
  // Draft preview (v1.4 r2 §2): from the SAVED answers; re-fetched after each autosave.
  const [preview, setPreview] = useState<FridayReport | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [loadTick, setLoadTick] = useState(0);
  const [saveTick, setSaveTick] = useState(0);
  const [retryIn, setRetryIn] = useState(0);
  const [elsewhere, setElsewhere] = useState(false); // r3 G3: someone saved from another link; we merged
  const curRef = useRef<PrefillFields>({});
  curRef.current = cur;

  usePageMeta("Your Monetization Kit draft | Birch Reserve", "A drafted Monetization Kit for your brand. Fix anything, then confirm. Estimates in USD, reviewed by a person.");

  // Adopt the link (fragment → this browser), then read the saved answers back.
  useEffect(() => {
    let r = (ADOPTED?.slug === slug ? ADOPTED.ref : null) ?? parsePrefillHash(EARLY_HASH);
    const qs = new URLSearchParams(window.location.search);
    const st = qs.get("mockstate") as MockState | null;
    if (r) savePrefillRef(slug, r);
    else if (!(mode === "mock" && st)) r = loadPrefillRef(slug); // a QA mockstate always seeds its own link
    if (!r && mode === "mock") {
      r = seedMockDraft(slug, st && ["staff", "expired", "revoked", "replaced", "invalid", "busy"].includes(st) ? st : "ok");
      if (st !== "staff" && st !== "replaced" && st !== "invalid") savePrefillRef(slug, r);
    }
    if (!r) return void setLoad({ state: "missing" });
    ADOPTED = { slug, ref: r };
    setRef(r);
    prefillApi()
      .get(r)
      .then((d) => {
        setInitial(clone(d.fields));
        setBaseline(clone(d.fields));
        setCur(clone(d.fields));
        setMeta(d.meta);
        if (d.meta.status !== "draft") setConfirmed({ version: d.meta.version, report: null, held: false });
        setLoad({ state: "ready" });
      })
      .catch((e: unknown) => {
        const code = codeOf(e);
        if (LINK_DEAD.has(code)) forgetPrefillRef(slug), (ADOPTED = null);
        setLoad({ state: "error", error: code });
        // r3 G9: 429 → wait Retry-After, then try again by itself.
        if (code === "rate_limited") {
          setRetryIn(retryOf(e));
          setTimeout(() => setLoadTick((n) => n + 1), retryOf(e) * 1000);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, loadTick]);

  // A link pasted into this same tab (hash-only navigation): move the key out of the bar and reload once.
  useEffect(() => {
    const on = () => {
      if (!/(?:^#|&)edit=/.test(window.location.hash)) return;
      try {
        sessionStorage.setItem(EARLY_HASH_KEY, window.location.hash);
      } catch {
        /* ignore */
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.location.reload();
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    if (!ref || load.state !== "ready") return;
    let live = true;
    const view = (cur.roles ?? []).includes("publisher") ? "publisher" : "brand";
    prefillApi()
      .preview(ref, view)
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview(null)); // falls back to the in-browser estimate, same label
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.id, ref?.editToken, load.state, previewTick]);

  // After a confirm (or on a link that was already confirmed), show the backend's recalibrated report.
  useEffect(() => {
    if (!ref || !confirmed || confirmed.report) return;
    const view = (cur.roles ?? []).includes("publisher") ? "publisher" : "brand";
    prefillApi().report(ref, view).then((rep) => rep && setConfirmed((c) => (c ? { ...c, report: rep } : c))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, confirmed?.version]);

  /**
   * r3 G3: a 409 stale carries the fresh answers. Re-apply this tab's unsaved edits on top (they win), take
   * everything else from the other link, and say so in plain words. The next autosave resends with the fresh rev.
   */
  const adoptStale = (st: StaleData, base: PrefillFields) => {
    const m = rebase(base, curRef.current, st.fields);
    setInitial((i) => m.elsewhere.reduce((acc, p) => setPath(acc, p, clone(getPath(st.fields, p))), i));
    setBaseline(clone(st.fields));
    setCur(m.fields);
    setMeta((x) => (x ? { ...x, rev: st.rev, saved_at: st.saved_at, ...(st.markers !== undefined ? { markers: st.markers } : {}), ...(st.expires_at !== undefined ? { expires_at: st.expires_at } : {}) } : x));
    if (m.elsewhere.length || m.conflicts.length) setElsewhere(true);
    setPreviewTick((n) => n + 1);
  };
  const fail = (e: unknown, base: PrefillFields) => {
    const code = codeOf(e);
    if (code === "stale" && e instanceof PrefillFail && e.stale) return void adoptStale(e.stale, base);
    if (LINK_DEAD.has(code)) {
      forgetPrefillRef(slug);
      ADOPTED = null;
      return void setLoad({ state: "error", error: code });
    }
    if (code === "rate_limited") {
      // r3 G9: wait Retry-After, then save again by itself. Nothing typed is lost meanwhile.
      const secs = retryOf(e);
      setSave("waiting");
      setRetryIn(secs);
      setTimeout(() => setSaveTick((n) => n + 1), secs * 1000);
      return;
    }
    setSave("error");
    setErr(ERR_COPY[code]);
  };

  // Autosave: only after a real edit, only the changed keys (full blocks). Untouched form → no request at all.
  const patch = useMemo(() => buildPatch(baseline, cur), [baseline, cur]);
  useEffect(() => {
    if (!ref || load.state !== "ready" || !patch || busy || meta?.can_edit === false || save === "waiting") return;
    const sentFrom = baseline;
    const sent = cur;
    const t = setTimeout(async () => {
      setSave("saving");
      try {
        const m = await prefillApi().save(ref, patch, meta?.rev);
        if (m.fields) {
          // r3 G5: the PATCH echo is the new baseline (no extra read). Edits typed while it was in flight are kept.
          const echo = m.fields;
          setBaseline(clone(echo));
          setCur((now) => rebase(sent, now, echo).fields);
        } else setBaseline((b) => afterSave(b, patch)); // older backend: no echo
        setMeta((x) => (x ? { ...x, saved_at: m.saved_at, rev: m.rev ?? x.rev, ...(m.markers !== undefined ? { markers: m.markers } : {}), ...(m.expires_at !== undefined ? { expires_at: m.expires_at } : {}) } : x));
        setSave("saved");
        setPreviewTick((n) => n + 1);
      } catch (e) {
        if (codeOf(e) !== "rate_limited") setSave("idle");
        fail(e, sentFrom);
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch, ref, load.state, busy, saveTick, save === "waiting"]);
  useEffect(() => {
    if (save === "waiting" && saveTick) setSave("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTick]);

  const [changedAfter, setChangedAfter] = useState(false); // edits after a confirm → show the draft estimate again
  const edit = (fn: (c: PrefillFields) => PrefillFields) => {
    setErr(null);
    if (confirmed) setChangedAfter(true);
    setCur(fn);
  };
  const set = (path: string, v: unknown) => edit((c) => setPath(c, path, v));
  const mark = (path: string) => fieldMark(initial, cur, path, meta?.markers ?? null);
  const roles = cur.roles ?? [];
  const toggleRole = (r: "supplier" | "publisher") => {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    if (next.filter((x) => x === "supplier" || x === "publisher").length) set("roles", next);
  };
  const setMarket = (c: Country[]) => {
    edit((x) => setPath(setPath(setPath(x, "geo.sells", c), "geo.ships", c), "profile.geography", geoText(c)));
  };
  const surfaces = (cur.publisher?.surfaces ?? []) as string[];
  const toggleSurface = (k: string) => set("publisher.surfaces", surfaces.includes(k) ? surfaces.filter((s) => s !== k) : [...surfaces, k]);

  const draft = useMemo(() => draftReport(cur), [cur]);
  const showConfirmed = !!confirmed?.report && !changedAfter;
  const report = showConfirmed ? confirmed!.report! : preview ?? asPreview(draft);
  const isStaff = meta?.access === "staff";
  const canConfirm = !!meta?.can_confirm;
  const readOnly = meta?.can_edit === false;
  const exposure = useMemo(() => {
    const c = (cur.geo?.sells ?? []) as Country[];
    return mockExposure(c.length ? { sells_in: c, ships_to: (cur.geo?.ships ?? c) as Country[] } : undefined);
  }, [cur.geo]);

  const onConfirm = async () => {
    if (!ref || !meta?.can_confirm) return; // the staff link never confirms (backend: 403 brand_token_required)
    setErr(null);
    // v1.4 §4: an email already on file is enough; otherwise the brand adds one here.
    if (email.trim() ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) : !meta?.email_on_file) return void setErr(email.trim() ? ERR_COPY.email : ERR_COPY.confirm_needs_email);
    setBusy(true);
    const base = baseline;
    try {
      const body = buildPatch(baseline, cur) ?? {};
      const res = await prefillApi().confirm(ref, body, { email: email.trim(), website: cur.website ?? "", elapsed_ms: Date.now() - started.current }, meta?.rev);
      if (res.fields) {
        const echo = res.fields;
        setBaseline(clone(echo));
        setCur((now) => rebase(cur, now, echo).fields);
      } else setBaseline((b) => afterSave(b, body));
      const next = { ...ref, version: res.version };
      setRef(next);
      savePrefillRef(slug, next);
      // r3 G6: version N + public_mirror from the confirm response; a confirmed brand link stops expiring.
      setMeta((m) => (m ? { ...m, status: res.status, version: res.version, rev: res.rev ?? m.rev, email_on_file: true, expires_at: null, ...(res.markers !== undefined ? { markers: res.markers } : {}) } : m));
      setConfirmed({ version: res.version, report: null, held: res.public_mirror === "held" });
      setChangedAfter(false);
      // Stacked on phones: bring the recalibrated report into view.
      if (window.innerWidth < 1024) setTimeout(() => document.getElementById("prefill-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      setSave("saved");
    } catch (e) {
      const code = codeOf(e);
      if (code === "stale") {
        fail(e, base);
        setErr("Updated elsewhere. Review the changes, then confirm again.");
      } else if (code === "rate_limited") setErr(`Too many tries right now. Please wait ${retryOf(e)} seconds and confirm again.`);
      else if (LINK_DEAD.has(code)) fail(e, base);
      else setErr(ERR_COPY[code]);
    } finally {
      setBusy(false);
    }
  };
  // Re-confirming after more edits is allowed (each confirm = a new report version on the same link).
  const dirtySinceConfirm = !!confirmed && changedAfter;

  const name = cur.company_name?.trim() || "your brand";
  if (load.state !== "ready") {
    return (
      <div data-testid="prefill-page" className="min-h-[60vh]">
        <MockBanner />
        <div className="container mx-auto max-w-xl px-4 py-16 text-center" data-testid={`prefill-${load.state}`}>
          {load.state === "loading" ? (
            <p className="inline-flex items-center gap-2 text-foreground/70"><Loader2 className="size-4 animate-spin" aria-hidden />Loading your draft…</p>
          ) : (
            <>
              <h1 className="font-display text-3xl" data-testid="prefill-error-head">{load.state === "missing" ? "This link is missing its private key." : HEAD[load.error] ?? "We couldn't open this draft."}</h1>
              <p className="mt-2 text-foreground/70" data-testid="prefill-error-copy" data-code={load.state === "error" ? load.error : "missing"}>{load.state === "missing" ? "Open the full link you were sent, or ask us for a fresh one." : load.error === "rate_limited" ? `Too many tries right now. We'll try again in ${retryIn} seconds.` : ERR_COPY[load.error]}</p>
              {load.state === "missing" || LINK_DEAD.has(load.error) ? <Link href="/intake" className="mt-6 inline-flex h-12 items-center rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a]">Start a new Monetization Kit</Link> : null}
            </>
          )}
        </div>
      </div>
    );
  }

  const saveText = save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Not saved" : save === "waiting" ? `Busy, saving again in ${retryIn}s` : patch ? "Unsaved changes" : "Nothing changed yet";
  const expires = meta?.status === "draft" && meta.expires_at ? fmtDate(meta.expires_at) : null;
  return (
    <div data-testid="prefill-page" style={{ fontFamily: RT_SANS }}>
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-7xl px-4 pb-4 pt-6 md:pt-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · Monetization Kit</p>
          <h1 className="font-display text-3xl leading-[1.05] md:text-5xl" data-testid="prefill-title">{confirmed ? `${name}, your kit is confirmed.` : `${name}, your kit is drafted.`}</h1>
          <div className="mt-4 flex items-start gap-3 rounded-2xl p-3 md:items-center md:p-4" style={{ background: NAVY, color: "#fff" }} data-testid="prefill-banner">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-lime-300 md:mt-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-snug">We drafted this from what we know. Fix anything.</p>
              {isStaff ? <p className="mt-1 text-[13px] font-semibold text-lime-300" data-testid="prefill-staff-note">{readOnly ? "Staff link · read-only now: the brand has confirmed." : "Staff link · edits the draft only. The brand confirms from their own link."}</p> : null}
              {isStaff && !readOnly && !meta?.email_on_file ? <p className="mt-1 text-[12px] text-white/75" data-testid="prefill-needs-email">No brand email on file yet. The brand will be asked for it when they confirm.</p> : null}
              <Details dark testId="prefill-banner-details" label="How we drafted it">
                <p>From your public website and what you've told us. Fields marked <b>Drafted</b> are our guesses; change any of them and the report updates.</p>
                <p>Nothing is published or shared until you confirm, and a person reviews it before anything runs. Every figure is an estimate in USD.</p>
                <p>This link is private to you. Please don't post it.</p>
              </Details>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto grid max-w-7xl gap-5 px-4 pb-14 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void onConfirm(); }} className="rounded-3xl border border-foreground/10 bg-white p-4 shadow-sm lg:sticky lg:top-20 md:p-5" data-testid="prefill-form" noValidate>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Your answers</h2>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground/60" data-testid="prefill-save" data-state={save}>
              {save === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : save === "saved" ? <Check className="size-3.5 text-lime-600" aria-hidden /> : null}{saveText}
            </span>
          </div>
          {elsewhere ? (
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-[#0b1f3a]" role="status" data-testid="pf-elsewhere">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">Updated elsewhere. Review changes.</p>
                <button type="button" className="text-[12px] font-semibold underline" onClick={() => setElsewhere(false)} data-testid="pf-elsewhere-ok">Got it</button>
              </div>
              <Details testId="pf-elsewhere-details"><p>Someone saved this draft from another link while you were editing. We pulled in their answers and kept everything you typed.</p></Details>
            </div>
          ) : null}
          <fieldset disabled={readOnly} className="mt-3 space-y-3 disabled:opacity-70" data-testid="pf-fields">
            <Field label="Brand" mark={mark("company_name")} testId="pf-brand">
              <input className={input} value={cur.company_name ?? ""} onChange={(e) => set("company_name", e.target.value.slice(0, 120))} aria-label="Brand name" data-testid="pf-brand-input" />
            </Field>
            <Field label="Website" mark={mark("website")} testId="pf-website">
              <input className={input} value={cur.website ?? ""} onChange={(e) => set("website", e.target.value.slice(0, 200))} aria-label="Website" inputMode="url" data-testid="pf-website-input" />
            </Field>
            <Field label="You are" mark={mark("roles")} testId="pf-roles">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={roles.includes("supplier")} onClick={() => toggleRole("supplier")} className={seg(roles.includes("supplier"))} data-testid="pf-role-supplier">Supplier</button>
                <button type="button" aria-pressed={roles.includes("publisher")} onClick={() => toggleRole("publisher")} className={seg(roles.includes("publisher"))} data-testid="pf-role-hub">Hub</button>
              </div>
            </Field>
            <Field label="Category" mark={mark("category")} testId="pf-category">
              <select className={input} value={cur.category ?? ""} onChange={(e) => set("category", e.target.value || undefined)} aria-label="Category" data-testid="pf-category-input">
                <option value="">Pick a category</option>
                {FRIDAY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Sells and ships to" mark={mark("geo.sells")} testId="pf-geo">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sells and ships to">
                {MARKETS.map((m) => <button key={m.key} type="button" role="radio" aria-checked={marketKey(cur.geo?.sells) === m.key} onClick={() => setMarket(m.c)} className={seg(marketKey(cur.geo?.sells) === m.key)} data-testid={`pf-geo-${m.key}`}>{m.label}</button>)}
              </div>
            </Field>
            <div className="grid gap-3">
              <Field label="Avg order, USD" mark={mark("calculator.avg_cart_usd")} testId="pf-aov">
                <input className={input} inputMode="numeric" value={cur.calculator?.avg_cart_usd ?? ""} onChange={(e) => set("calculator.avg_cart_usd", numOrUndef(e.target.value))} aria-label="Average order in USD" data-testid="pf-aov-input" />
              </Field>
              <Field label="Orders a month" mark={mark("calculator.orders_per_month")} testId="pf-orders">
                <input className={input} inputMode="numeric" value={cur.calculator?.orders_per_month ?? ""} onChange={(e) => set("calculator.orders_per_month", numOrUndef(e.target.value))} aria-label="Orders a month" data-testid="pf-orders-input" />
              </Field>
            </div>
            <details className="group rounded-2xl bg-foreground/[0.03] p-3" data-testid="pf-more">
              <summary className="cursor-pointer list-none text-sm font-bold text-[#0b1f3a] [&::-webkit-details-marker]:hidden">More detail <span className="font-normal text-foreground/55">(optional)</span></summary>
              <div className="mt-3 space-y-3">
                {roles.includes("publisher") ? (
                  <Field label="Hub surfaces" mark={mark("publisher.surfaces")} testId="pf-surfaces">
                    <div className="flex flex-wrap gap-1.5">
                      {HUB_SURFACES.map((s) => <button key={s.key} type="button" aria-pressed={surfaces.includes(s.key)} onClick={() => toggleSurface(s.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${surfaces.includes(s.key) ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/70 ring-1 ring-foreground/15"}`} data-testid={`pf-surface-${s.key}`}>{s.label}</button>)}
                    </div>
                  </Field>
                ) : null}
                <Field label="Website visitors a month (est.)" mark={mark("profile.reach.metrics.web_visitors.value")} testId="pf-visitors">
                  <input className={input} inputMode="numeric" value={(getPath(cur, "profile.reach.metrics.web_visitors.value") as number | undefined) ?? ""} onChange={(e) => { const v = numOrUndef(e.target.value); edit((c) => setPath(c, "profile.reach.metrics.web_visitors", v === undefined ? undefined : { value: v, period: "per month", source: "hub-reported" })); }} aria-label="Website visitors a month" data-testid="pf-visitors-input" />
                </Field>
                <Field label="Your customers, in a line" mark={mark("blurb")} testId="pf-blurb">
                  <textarea className={`${input} h-20 py-2`} value={cur.blurb ?? ""} onChange={(e) => set("blurb", e.target.value.slice(0, 600))} aria-label="Your customers, in a line" data-testid="pf-blurb-input" />
                  <p className="mt-1 text-[11px] text-foreground/55">Business-level only. No customer names or contacts.</p>
                </Field>
              </div>
            </details>
          </fieldset>

          {canConfirm ? (
          <div className="mt-4 rounded-2xl p-3" style={{ background: "#f3f7e8" }} data-testid="pf-confirm">
            <label className="block">
              <span className={lab}>{meta?.email_on_file ? "Work email (optional)" : "Your work email"}</span>
              <input className={`mt-1 ${input}`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 254))} placeholder={meta?.email_hint ? `On file: ${meta.email_hint}` : "you@yourbrand.com"} data-testid="pf-email" />
            </label>
            <button type="submit" disabled={busy || (!!confirmed && !dirtySinceConfirm)} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 transition disabled:opacity-60" data-testid="pf-confirm-btn">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              {confirmed ? (dirtySinceConfirm ? "Confirm my changes" : "Confirmed") : "Looks right. Confirm my kit"}
            </button>
            {err ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert" data-testid="pf-error">{err}</p> : null}
            <Details testId="pf-confirm-details"><p>Confirming updates your report on this same link. A person reviews it before anything runs. No charge, no commitment.</p></Details>
          </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-foreground/[0.04] p-3 text-[13px] text-foreground/70" data-testid="pf-no-confirm">
              Changes save to the draft. The brand reviews and confirms it from their own link.
              {err ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert" data-testid="pf-error">{err}</p> : null}
            </div>
          )}
          {expires ? <p className="mt-3 text-[11px] text-foreground/50" data-testid="pf-expires">This private link works until {expires}.</p> : null}
          {mode === "mock" && ref ? (
            <div className="mt-3 rounded-xl border border-dashed border-violet-400 p-2 text-[11px] text-violet-800" data-testid="pf-mock-link">
              Preview only: the {isStaff ? "staff" : "brand"} copy-paste link looks like{" "}
              <button type="button" className="font-bold underline" onClick={() => { void navigator.clipboard?.writeText(prefillLink(slug, ref, window.location.origin)).then(() => setCopied(true)); }}>{copied ? "copied" : "this (copy)"}</button>
            </div>
          ) : null}
        </form>

        <div className="min-w-0 scroll-mt-20" id="prefill-report" data-testid="prefill-report">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: showConfirmed ? RT.forest : RT.mint, color: showConfirmed ? "#fff" : RT.forest }} data-testid="prefill-report-label">
              {showConfirmed ? `Confirmed · version ${confirmed!.version}` : PREVIEW_LABEL}
            </span>
            {confirmed?.held ? <span className="text-[12px] text-foreground/60" data-testid="prefill-held">In review: we confirm brand ownership first, usually within one business day.</span> : null}
          </div>
          {!showConfirmed ? <Details testId="prefill-preview-details" label="About this preview"><p>Built from the answers saved so far; not confirmed by the brand. Numbers change after you confirm.</p></Details> : null}
          {showConfirmed ? <p className="mb-2 text-sm font-semibold" style={{ color: RT.forest }} data-testid="prefill-recalibrated">{isStaff ? "Confirmed by the brand." : "Report updated with your answers."}</p> : null}
          {/* Beside the form the report column is narrower than on /intake: stack its two side cards there. */}
          <style>{`.pf-report{container-type:inline-size}@container (max-width: 960px){.pf-report .grid.items-start{grid-template-columns:minmax(0,1fr)!important}}`}</style>
          <div className="pf-report">
          <NoFitWords.Provider value={!showConfirmed}>
            <ReportV2 report={report} compact exposure={exposure} exposureSource={showConfirmed && !confirmed!.report!.mock ? "report" : "mock"} />
          </NoFitWords.Provider>
          </div>
        </div>
      </div>
      <p className="sr-only" data-testid="prefill-version">{meta?.version ?? 0}</p>
    </div>
  );
}
