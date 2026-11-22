/**
 * Street team program, coming 2027. Short and visual; detail is collapsed. Same palette as the home page and /intake
 * (navy, lime, forest). Copy lives in api-server/src/lib/overhaul/streetTeam.ts. Audience figure comes from the shared
 * STREET_REACH_FIG (brandIntake), no new numbers.
 */
import { ArrowRight, Footprints, MapPin, PackageOpen, QrCode, Route, Users } from "lucide-react";
import { Details } from "@/components/br/details";
import { STREET_REACH_FIG } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { STREET_TEAM, STREET_TEAM_INTAKE_HREF, STREET_TEAM_TIERS, STREET_TEAM_TODAY } from "../../../../api-server/src/lib/overhaul/streetTeam";
import { DOOR_ROUTE } from "../../../../api-server/src/lib/doorRoute";
import { logCtaClick } from "@/lib/shareTrack";

const TIER_ICON = { join: Users, own: Route, "door-drop": Footprints } as const;
const FEATURE_ICON = { qr: QrCode, bags: PackageOpen, gps: MapPin } as const;

export function streetTeamHref(tier?: string): string {
  return tier ? `${STREET_TEAM_INTAKE_HREF}?tier=${encodeURIComponent(tier)}` : STREET_TEAM_INTAKE_HREF;
}

export function StreetTeamProgram({ where }: { where: "home" | "page" }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#0b1f3a]/10 bg-white shadow-sm" data-testid={`street-team-${where}`} id="street-team">
      <div className="p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a]" data-testid={`street-team-badge-${where}`}>{STREET_TEAM.badge}</span>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{STREET_TEAM.eyebrow}</span>
        </div>
        {where === "page" ? <h1 className="mt-2 font-display text-4xl leading-[1.05] text-[#0b1f3a] md:text-5xl">{STREET_TEAM.title}</h1> : <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{STREET_TEAM.title}</h2>}
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{STREET_TEAM.sub}</p>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{STREET_TEAM.tiersTitle}</p>
        <ol className="mt-2 grid gap-3 md:grid-cols-3" data-testid={`street-team-tiers-${where}`}>
          {STREET_TEAM_TIERS.map((t) => {
            const Icon = TIER_ICON[t.key];
            return (
              <li key={t.key} className="flex flex-col rounded-2xl bg-[#ecfccb]/60 p-4" data-testid={`street-team-tier-${t.key}`}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{t.n}</span>
                  <Icon className="size-5 text-[#0E3B2A]" aria-hidden />
                </span>
                <p className="mt-2 font-display text-xl text-[#0b1f3a]">{t.name}</p>
                <p className="mt-1 text-sm text-foreground/70">{t.short}</p>
                <details className="mt-auto pt-2 text-[12px] text-foreground/70">
                  <summary className="cursor-pointer font-semibold text-[#0b1f3a]">Details</summary>
                  <p className="mt-1.5 leading-snug">{t.detail}</p>
                </details>
                <a href={streetTeamHref(t.key)} onClick={() => logCtaClick(`street_team_tier_${t.key}_${where}`)} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0b1f3a] underline-offset-4 hover:underline" data-testid={`street-team-tier-cta-${t.key}`}>
                  Ask about this <ArrowRight className="size-3.5" aria-hidden />
                </a>
              </li>
            );
          })}
        </ol>

        <div className="relative mt-5 overflow-hidden rounded-2xl text-white" style={{ background: "#0E3B2A" }} data-testid={`street-team-today-${where}`}>
          <img src={DOOR_ROUTE.mapWebp} alt="" aria-hidden width={DOOR_ROUTE.mapWidth} height={DOOR_ROUTE.mapHeight} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0E3B2A] via-[#0E3B2A]/85 to-[#0E3B2A]/40" />
          <div className="relative grid gap-5 p-5 md:grid-cols-[1.3fr_1fr] md:p-7">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#BFF3D6]">{STREET_TEAM_TODAY.eyebrow}</span>
              <p className="mt-2 font-display text-2xl leading-tight md:text-3xl">{STREET_TEAM_TODAY.title}</p>
              <p className="mt-1.5 text-sm text-white/80">{STREET_TEAM_TODAY.sub}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {STREET_TEAM_TODAY.features.map((f) => {
                  const Icon = FEATURE_ICON[f.key];
                  return (
                    <li key={f.key} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15" data-testid={`street-team-feature-${f.key}`}>
                      <Icon className="size-5 text-lime-300" aria-hidden />
                      <p className="mt-1.5 text-sm font-bold">{f.t}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/75">{f.d}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="self-end">
              <p className="whitespace-nowrap font-display text-[2.6rem] leading-none md:text-5xl" data-testid={`street-team-figure-${where}`}>{STREET_REACH_FIG.v}</p>
              <p className="mt-1.5 text-sm text-white/80">{STREET_REACH_FIG.l}</p>
              <p className="mt-1 text-[11px] text-white/60">Calm Joints and our Street Team Ambassadors. Based on signed partnership contracts.</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold text-[#0b1f3a]" data-testid={`street-team-outside-${where}`}>{STREET_TEAM.outside}</p>
        <p className="mt-1 text-[13px] text-foreground/70" data-testid={`street-team-minimum-${where}`}>{STREET_TEAM.minimum}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href={streetTeamHref()} onClick={() => logCtaClick(`street_team_${where}`)} data-testid={`street-team-cta-${where}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
            {STREET_TEAM.cta} <ArrowRight className="size-4" aria-hidden />
          </a>
          {where === "home" ? <a href="/street-team" className="text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline" data-testid="street-team-more">See the program</a> : null}
        </div>
        <Details label={STREET_TEAM.detailsLabel} testId={`street-team-details-${where}`}>
          <ul className="list-disc space-y-1 pl-5">{STREET_TEAM.details.map((d) => <li key={d}>{d}</li>)}</ul>
        </Details>
        <p className="mt-3 text-[11px] text-foreground/55">{STREET_TEAM.fine}</p>
      </div>
    </div>
  );
}
