import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { db, ucpAgentRequestProofsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  claimUcpAgentRequestProof,
  cleanupExpiredUcpAgentRequestProofs,
  observeUcpProofClaim,
  resetUcpProofClaimTelemetryForTests,
  UCP_PROOF_CLEANUP_BATCH_SIZE,
  UCP_PROOF_CLAIM_WARNING_MIN_SAMPLES,
  UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS,
} from "../src/lib/ucpRequestProofs";

const SEEDED_LIVE_PROOFS = 5_000;
const SEEDED_EXPIRED_PROOFS = 5_000;
const CONCURRENT_UNIQUE_CLAIMS = 40;
const CONCURRENT_REPLAY_CLAIMS = 40;
const INSERT_BATCH_SIZE = 1_000;

// Local PostgreSQL baselines are normally below 100 ms p95. These limits are
// intentionally much wider so shared CI runners do not create flaky failures,
// while an accidental sequential scan, lock wait, or unbounded cleanup still
// produces a repeatable regression signal.
const CLAIM_P95_THRESHOLD_MS = 2_000;
const BENCHMARK_WALL_THRESHOLD_MS = 8_000;

type TimedClaim = {
  claimed: boolean;
  latencyMs: number;
};

test("proof claim telemetry stays identifier-free and warns on sustained latency", () => {
  resetUcpProofClaimTelemetryForTests();
  const entries: Array<{
    level: "info" | "warn";
    fields: Record<string, unknown>;
    message: string;
  }> = [];
  const log = {
    info(fields: Record<string, unknown>, message: string) {
      entries.push({ level: "info", fields, message });
    },
    warn(fields: Record<string, unknown>, message: string) {
      entries.push({ level: "warn", fields, message });
    },
  };

  for (let index = 0; index < UCP_PROOF_CLAIM_WARNING_MIN_SAMPLES; index += 1) {
    observeUcpProofClaim(
      "claimed",
      UCP_PROOF_CLAIM_WARNING_THRESHOLD_MS + index,
      { log, now: 1_000 },
    );
  }
  observeUcpProofClaim("replay", 12, { log, now: 1_000 });
  observeUcpProofClaim("failure", 18, { log, now: 1_000 });

  assert.equal(entries.filter((entry) => entry.level === "warn").length, 1);
  assert.deepEqual(
    entries.slice(-2).map((entry) => entry.fields.outcome),
    ["replay", "failure"],
  );
  for (const entry of entries) {
    assert.deepEqual(
      Object.keys(entry.fields).sort(),
      entry.level === "warn"
        ? [
            "event",
            "outcome",
            "p95LatencyMs",
            "sampleCount",
            "thresholdMs",
            "windowSize",
          ]
        : ["event", "latencyMs", "outcome", "thresholdMs"],
    );
    assert.doesNotMatch(
      JSON.stringify(entry),
      /agentIdentity|nonce|signature|profileUrl/i,
    );
  }
  resetUcpProofClaimTelemetryForTests();
});

function percentile(values: number[], fraction: number): number {
  assert.ok(values.length > 0);
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

async function timedClaim(input: {
  agentIdentityHash: string;
  nonceHash: string;
  expiresAt: Date;
}): Promise<TimedClaim> {
  const startedAt = performance.now();
  const claimed = await claimUcpAgentRequestProof(input);
  return { claimed, latencyMs: performance.now() - startedAt };
}

test(
  "UCP proof claims stay responsive as the proof table grows and cleanup runs",
  { timeout: 30_000 },
  async () => {
    const benchmarkId = `proof-performance-${process.pid}-${Date.now()}`;
    const liveUntil = new Date(Date.now() + 10 * 60_000);
    const expiredAt = new Date(Date.now() - 10 * 60_000);
    const replayNonce = `${benchmarkId}-replay`;
    const seededRows = [
      ...Array.from({ length: SEEDED_LIVE_PROOFS }, (_, index) => ({
        agentIdentityHash: benchmarkId,
        nonceHash: `live-${index}`,
        expiresAt: liveUntil,
      })),
      ...Array.from({ length: SEEDED_EXPIRED_PROOFS }, (_, index) => ({
        agentIdentityHash: benchmarkId,
        nonceHash: `expired-${index}`,
        expiresAt: expiredAt,
      })),
      {
        agentIdentityHash: benchmarkId,
        nonceHash: replayNonce,
        expiresAt: liveUntil,
      },
    ];

    try {
      for (let offset = 0; offset < seededRows.length; offset += INSERT_BATCH_SIZE) {
        await db
          .insert(ucpAgentRequestProofsTable)
          .values(seededRows.slice(offset, offset + INSERT_BATCH_SIZE));
      }

      const startedAt = performance.now();
      const [cleanupCount, uniqueClaims, replayClaims] = await Promise.all([
        cleanupExpiredUcpAgentRequestProofs(
          new Date(),
          UCP_PROOF_CLEANUP_BATCH_SIZE,
        ),
        Promise.all(
          Array.from({ length: CONCURRENT_UNIQUE_CLAIMS }, (_, index) =>
            timedClaim({
              agentIdentityHash: benchmarkId,
              nonceHash: `unique-${index}`,
              expiresAt: liveUntil,
            }),
          ),
        ),
        Promise.all(
          Array.from({ length: CONCURRENT_REPLAY_CLAIMS }, () =>
            timedClaim({
              agentIdentityHash: benchmarkId,
              nonceHash: replayNonce,
              expiresAt: liveUntil,
            }),
          ),
        ),
      ]);
      const wallMs = performance.now() - startedAt;
      const uniqueP95Ms = percentile(
        uniqueClaims.map(({ latencyMs }) => latencyMs),
        0.95,
      );
      const replayP95Ms = percentile(
        replayClaims.map(({ latencyMs }) => latencyMs),
        0.95,
      );
      const maxClaimMs = Math.max(
        ...uniqueClaims.map(({ latencyMs }) => latencyMs),
        ...replayClaims.map(({ latencyMs }) => latencyMs),
      );

      console.info(
        JSON.stringify({
          benchmark: "ucp-request-proof-claims",
          seededLive: SEEDED_LIVE_PROOFS,
          seededExpired: SEEDED_EXPIRED_PROOFS,
          concurrentUnique: CONCURRENT_UNIQUE_CLAIMS,
          concurrentReplay: CONCURRENT_REPLAY_CLAIMS,
          cleanupCount,
          uniqueP95Ms: Number(uniqueP95Ms.toFixed(1)),
          replayP95Ms: Number(replayP95Ms.toFixed(1)),
          maxClaimMs: Number(maxClaimMs.toFixed(1)),
          wallMs: Number(wallMs.toFixed(1)),
          thresholds: {
            claimP95Ms: CLAIM_P95_THRESHOLD_MS,
            wallMs: BENCHMARK_WALL_THRESHOLD_MS,
          },
        }),
      );

      assert.equal(cleanupCount, UCP_PROOF_CLEANUP_BATCH_SIZE);
      assert.equal(uniqueClaims.filter(({ claimed }) => claimed).length, 40);
      assert.equal(replayClaims.filter(({ claimed }) => claimed).length, 0);
      assert.ok(
        uniqueP95Ms < CLAIM_P95_THRESHOLD_MS,
        `unique claim p95 ${uniqueP95Ms.toFixed(1)} ms exceeded ${CLAIM_P95_THRESHOLD_MS} ms`,
      );
      assert.ok(
        replayP95Ms < CLAIM_P95_THRESHOLD_MS,
        `replay claim p95 ${replayP95Ms.toFixed(1)} ms exceeded ${CLAIM_P95_THRESHOLD_MS} ms`,
      );
      assert.ok(
        wallMs < BENCHMARK_WALL_THRESHOLD_MS,
        `benchmark wall time ${wallMs.toFixed(1)} ms exceeded ${BENCHMARK_WALL_THRESHOLD_MS} ms`,
      );
    } finally {
      await db
        .delete(ucpAgentRequestProofsTable)
        .where(eq(ucpAgentRequestProofsTable.agentIdentityHash, benchmarkId));
    }
  },
);