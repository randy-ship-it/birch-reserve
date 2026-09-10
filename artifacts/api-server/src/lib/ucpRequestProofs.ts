import { db, ucpAgentRequestProofsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { performance } from "node:perf_hooks";
import { logger } from "./logger";

export const UCP_PROOF_CLEANUP_BATCH_SIZE = 100;
const UCP_PROOF_CLEANUP_INTERVAL_MS = 60_000;

export const UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS = 750;
export const UCP_PROOF_BACKLOG_SAMPLE_INTERVAL_MS = 5 * 60_000;
export const UCP_PROOF_EXPIRED_BACKLOG_WARNING_THRESHOLD =
  UCP_PROOF_CLEANUP_BATCH_SIZE;

export type UcpAgentRequestProofBacklog = {
  liveProofs: number;
  expiredProofs: number;
};

export type UcpAgentRequestProofMaintenance = {
  deletedRows: number;
  backlog?: UcpAgentRequestProofBacklog;
  backlogMeasurementError?: unknown;
};

export function hasUcpAgentRequestProofBacklogWarning(
  backlog: UcpAgentRequestProofBacklog,
): boolean {
  return (
    backlog.expiredProofs >= UCP_PROOF_EXPIRED_BACKLOG_WARNING_THRESHOLD
  );
}

let nextCleanupAt = 0;
let nextBacklogSampleAt = 0;
let cleanupInFlight: Promise<UcpAgentRequestProofMaintenance> | undefined;

function percentile95(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}
export async function claimUcpAgentRequestProof(input: {
  agentIdentityHash: string;
  nonceHash: string;
  expiresAt: Date;
}): Promise<boolean> {
  const startedAt = performance.now();
  try {
    const [claimed] = await db
      .insert(ucpAgentRequestProofsTable)
      .values(input)
      .onConflictDoNothing()
      .returning({ nonceHash: ucpAgentRequestProofsTable.nonceHash });
    const didClaim = claimed !== undefined;
    observeUcpProofClaim(
      didClaim ? "claimed" : "replay",
      performance.now() - startedAt,
    );
    return didClaim;
  } catch (error) {
    observeUcpProofClaim("failure", performance.now() - startedAt);
    throw error;
  }
}

export async function cleanupExpiredUcpAgentRequestProofs(
  now = new Date(),
  limit = UCP_PROOF_CLEANUP_BATCH_SIZE,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("UCP proof cleanup limit must be a positive integer.");
  }
  const result = await db.execute(sql`
    with expired as (
      select agent_identity_hash, nonce_hash
      from ${ucpAgentRequestProofsTable}
      where expires_at < ${now}
      order by expires_at
      limit ${limit}
      for update skip locked
    )
    delete from ${ucpAgentRequestProofsTable} as proofs
    using expired
    where proofs.agent_identity_hash = expired.agent_identity_hash
      and proofs.nonce_hash = expired.nonce_hash
    returning proofs.nonce_hash
  `);
  return result.rowCount ?? 0;
}

export async function measureUcpAgentRequestProofBacklog(
  now = new Date(),
): Promise<UcpAgentRequestProofBacklog> {
  const result = await db.execute(sql`
    select
      count(*) filter (where expires_at >= ${now})::integer as live_proofs,
      count(*) filter (where expires_at < ${now})::integer as expired_proofs
    from ${ucpAgentRequestProofsTable}
  `);
  const row = result.rows[0] as
    | { live_proofs?: number | string; expired_proofs?: number | string }
    | undefined;
  return {
    liveProofs: Number(row?.live_proofs ?? 0),
    expiredProofs: Number(row?.expired_proofs ?? 0),
  };
}

export function scheduleExpiredUcpAgentRequestProofCleanup(
  now = new Date(),
): Promise<UcpAgentRequestProofMaintenance> | undefined {
  if (cleanupInFlight || now.getTime() < nextCleanupAt) return undefined;
  nextCleanupAt = now.getTime() + UCP_PROOF_CLEANUP_INTERVAL_MS;
  const shouldMeasureBacklog = now.getTime() >= nextBacklogSampleAt;
  if (shouldMeasureBacklog) {
    nextBacklogSampleAt =
      now.getTime() + UCP_PROOF_BACKLOG_SAMPLE_INTERVAL_MS;
  }
  cleanupInFlight = (async () => {
    const deletedRows = await cleanupExpiredUcpAgentRequestProofs(now);
    if (!shouldMeasureBacklog) return { deletedRows };
    try {
      return {
        deletedRows,
        backlog: await measureUcpAgentRequestProofBacklog(now),
      };
    } catch (backlogMeasurementError) {
      return { deletedRows, backlogMeasurementError };
    }
  })().finally(() => {
    cleanupInFlight = undefined;
  });
  return cleanupInFlight;
}

const UCP_PROOF_CLAIM_WINDOW_SIZE = 50;

export type UcpProofClaimOutcome = "claimed" | "replay" | "failure";

const UCP_PROOF_CLAIM_WARNING_COOLDOWN_MS = 5 * 60_000;

const claimLatencies: Record<Exclude<UcpProofClaimOutcome, "failure">, number[]> = {
  claimed: [],
  replay: [],
};

export const UCP_PROOF_CLAIM_WARNING_MIN_SAMPLES = 10;

type ProofClaimLog = Pick<typeof logger, "info" | "warn">;

export function observeUcpProofClaim(
  outcome: UcpProofClaimOutcome,
  latencyMs: number,
  options: { now?: number; log?: ProofClaimLog } = {},
): void {
  const log = options.log ?? logger;
  const roundedLatencyMs = Math.max(0, Math.round(latencyMs));
  log.info(
    {
      event: "ucp_proof_claim",
      outcome,
      latencyMs: roundedLatencyMs,
      thresholdMs: UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS,
    },
    "UCP proof claim completed",
  );
  if (outcome === "failure") return;

  const samples = claimLatencies[outcome];
  samples.push(roundedLatencyMs);
  if (samples.length > UCP_PROOF_CLAIM_WINDOW_SIZE) samples.shift();
  if (samples.length < UCP_PROOF_CLAIM_WARNING_MIN_SAMPLES) return;

  const p95LatencyMs = percentile95(samples);
  const now = options.now ?? Date.now();
  if (
    p95LatencyMs < UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS ||
    now < nextLatencyWarningAt
  ) {
    return;
  }
  nextLatencyWarningAt = now + UCP_PROOF_CLAIM_WARNING_COOLDOWN_MS;
  log.warn(
    {
      event: "ucp_proof_claim_latency_warning",
      outcome,
      sampleCount: samples.length,
      p95LatencyMs,
      thresholdMs: UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS,
      windowSize: UCP_PROOF_CLAIM_WINDOW_SIZE,
    },
    "Signed checkout authentication is approaching its latency budget; inspect proof-table growth, database locks, and query latency.",
  );
}

export function resetUcpProofClaimTelemetryForTests(): void {
  claimLatencies.claimed.length = 0;
  claimLatencies.replay.length = 0;
  nextLatencyWarningAt = 0;
}

let nextLatencyWarningAt = 0;
