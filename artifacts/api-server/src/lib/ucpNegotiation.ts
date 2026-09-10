import {
  createHash,
  createPublicKey,
  verify,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { pool } from "@workspace/db";
import {
  UCP_AGENT_PROFILE_PATH,
  UCP_CHECKOUT_CAPABILITY,
  UCP_CHECKOUT_SCHEMA_URL,
  UCP_CHECKOUT_SPEC_URL,
  UCP_VERSION,
} from "./ucpProtocol";

const PROFILE_MAX_BYTES = 64 * 1024;
const PROFILE_CACHE_MS = 5 * 60 * 1000;

const PROFILE_NEGATIVE_CACHE_MS = 15 * 1000;
type UcpEntity = {
  version?: unknown;
  spec?: unknown;
  schema?: unknown;
};

type UcpPublicKeyJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
};

type UcpKeySuccession = {
  predecessor_key_id: string;
  predecessor_public_key_jwk: UcpPublicKeyJwk;
  successor_key_id: string;
  successor_public_key_jwk: UcpPublicKeyJwk;
  not_before: string;
  expires_at: string;
  signature: string;
};
type UcpPlatformProfile = {
  ucp: {
    version: string;
    capabilities: Record<string, UcpEntity[]>;
    authentication: {
      type: "ed25519";
      key_id: string;
      public_key_jwk: UcpPublicKeyJwk;
      key_succession: UcpKeySuccession[];
    };
    identityPublicKey: Record<string, unknown> | null;
  };
};

export type UcpNegotiationResult =
  | {
      ok: true;
      profileUrl: string;
      agentIdentityHash: string;
      keyId: string;
      publicKeyJwk: UcpPublicKeyJwk;
      authorizedAgentIdentityHashes: string[];
      identityPublicKey: Record<string, unknown> | null;
    }
  | {
      ok: false;
      status: number;
      code:
        | "invalid_profile_url"
        | "profile_unreachable"
        | "profile_malformed"
        | "version_unsupported"
        | "capabilities_incompatible";
      content: string;
    };

type ProfileResolver = (profileUrl: string) => Promise<UcpPlatformProfile>;
type ProfileLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const profileCache = new Map<
  string,
  { expiresAt: number; profile: UcpPlatformProfile }
>();

const profileNegativeCache = new Map<
  string,
  { expiresAt: number; error: UcpProfileResolutionError }
>();
let profileLookup: ProfileLookup = (hostname) =>
  lookup(hostname, { all: true });

class UcpProfileResolutionError extends Error {
  constructor(
    readonly status: 400 | 422 | 424,
    readonly code:
      | "invalid_profile_url"
      | "profile_unreachable"
      | "profile_malformed",
    message: string,
  ) {
    super(message);
  }
}

function trimCache<T>(cache: Map<string, T>): void {
  while (cache.size > PROFILE_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}
function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

type ValidatedProfileTarget = {
  url: URL;
  address: string;
  family: number;
};

async function lookupWithDeadline(
  hostname: string,
): Promise<Array<{ address: string; family: number }>> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      profileLookup(hostname),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Profile DNS lookup timed out.")),
          4_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function validatePublicProfileUrl(
  profileUrl: string,
): Promise<ValidatedProfileTarget> {
  let url: URL;
  try {
    url = new URL(profileUrl);
  } catch {
    throw new UcpProfileResolutionError(
      400,
      "invalid_profile_url",
      "The platform profile URL is malformed.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    [".local", ".localhost", ".internal"].some((suffix) =>
      url.hostname.toLowerCase().endsWith(suffix),
    )
  ) {
    throw new UcpProfileResolutionError(
      400,
      "invalid_profile_url",
      "The platform profile must use a public HTTPS URL.",
    );
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookupWithDeadline(url.hostname);
  } catch {
    throw new UcpProfileResolutionError(
      400,
      "invalid_profile_url",
      "The platform profile host could not be resolved.",
    );
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new UcpProfileResolutionError(
      400,
      "invalid_profile_url",
      "The platform profile must resolve only to public addresses.",
    );
  }
  const target = addresses[0];
  if (!target) {
    throw new UcpProfileResolutionError(
      400,
      "invalid_profile_url",
      "The platform profile host has no public address.",
    );
  }
  return { url, address: target.address, family: target.family };
}

function validatePlatformProfile(payload: unknown): UcpPlatformProfile {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The platform profile is not a JSON object.");
  }
  const ucp = (payload as { ucp?: unknown }).ucp;
  if (!ucp || typeof ucp !== "object" || Array.isArray(ucp)) {
    throw new Error("The platform profile has no UCP metadata.");
  }
  const record = ucp as Record<string, unknown>;
  if (
    typeof record.version !== "string" ||
    !record.services ||
    typeof record.services !== "object" ||
    Array.isArray(record.services) ||
    !record.payment_handlers ||
    typeof record.payment_handlers !== "object" ||
    Array.isArray(record.payment_handlers) ||
    (record.capabilities !== undefined &&
      (typeof record.capabilities !== "object" ||
        Array.isArray(record.capabilities)))
  ) {
    throw new Error("The platform profile is incomplete.");
  }
  const capabilities = (record.capabilities ?? {}) as Record<string, unknown>;
  const authentication = record.authentication;
  if (
    !authentication ||
    typeof authentication !== "object" ||
    Array.isArray(authentication)
  ) {
    throw new Error("The platform profile has no request authentication.");
  }
  const auth = authentication as Record<string, unknown>;
  const jwk = auth.public_key_jwk;
  const succession = auth.key_succession ?? [];
  if (
    auth.type !== "ed25519" ||
    typeof auth.key_id !== "string" ||
    auth.key_id.length < 1 ||
    auth.key_id.length > 200 ||
    !jwk ||
    typeof jwk !== "object" ||
    Array.isArray(jwk) ||
    (jwk as UcpPublicKeyJwk).kty !== "OKP" ||
    (jwk as UcpPublicKeyJwk).crv !== "Ed25519" ||
    typeof (jwk as UcpPublicKeyJwk).x !== "string" ||
    !Array.isArray(succession) ||
    succession.length > 10
  ) {
    throw new Error("The platform request authentication is invalid.");
  }
  const keySuccession = succession.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("The platform key succession is invalid.");
    }
    const record = entry as Record<string, unknown>;
    const predecessorJwk = record.predecessor_public_key_jwk;
    const successorJwk = record.successor_public_key_jwk;
    if (
      typeof record.predecessor_key_id !== "string" ||
      record.predecessor_key_id.length < 1 ||
      record.predecessor_key_id.length > 200 ||
      !predecessorJwk ||
      typeof predecessorJwk !== "object" ||
      Array.isArray(predecessorJwk) ||
      (predecessorJwk as UcpPublicKeyJwk).kty !== "OKP" ||
      (predecessorJwk as UcpPublicKeyJwk).crv !== "Ed25519" ||
      typeof (predecessorJwk as UcpPublicKeyJwk).x !== "string" ||
      typeof record.successor_key_id !== "string" ||
      record.successor_key_id.length < 1 ||
      record.successor_key_id.length > 200 ||
      !successorJwk ||
      typeof successorJwk !== "object" ||
      Array.isArray(successorJwk) ||
      (successorJwk as UcpPublicKeyJwk).kty !== "OKP" ||
      (successorJwk as UcpPublicKeyJwk).crv !== "Ed25519" ||
      typeof (successorJwk as UcpPublicKeyJwk).x !== "string" ||
      typeof record.not_before !== "string" ||
      typeof record.expires_at !== "string" ||
      typeof record.signature !== "string"
    ) {
      throw new Error("The platform key succession is invalid.");
    }
    try {
      createPublicKey({ key: predecessorJwk as never, format: "jwk" });
      createPublicKey({ key: successorJwk as never, format: "jwk" });
    } catch {
      throw new Error("A key succession authentication key is invalid.");
    }
    return {
      predecessor_key_id: record.predecessor_key_id,
      predecessor_public_key_jwk: predecessorJwk as UcpPublicKeyJwk,
      successor_key_id: record.successor_key_id,
      successor_public_key_jwk: successorJwk as UcpPublicKeyJwk,
      not_before: record.not_before,
      expires_at: record.expires_at,
      signature: record.signature,
    };
  });
  try {
    createPublicKey({ key: jwk as never, format: "jwk" });
  } catch {
    throw new Error("The platform request authentication key is invalid.");
  }
  const identity = record.identity;
  let identityPublicKey: Record<string, unknown> | null = null;
  if (identity !== undefined) {
    if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
      throw new Error("The platform identity metadata is invalid.");
    }
    const publicKey = (identity as Record<string, unknown>).public_key;
    if (
      !publicKey ||
      typeof publicKey !== "object" ||
      Array.isArray(publicKey) ||
      (publicKey as Record<string, unknown>).kty !== "OKP" ||
      (publicKey as Record<string, unknown>).crv !== "Ed25519" ||
      typeof (publicKey as Record<string, unknown>).x !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(
        (publicKey as Record<string, unknown>).x as string,
      ) ||
      ((publicKey as Record<string, unknown>).kid !== undefined &&
        typeof (publicKey as Record<string, unknown>).kid !== "string")
    ) {
      throw new Error("The platform continuity public key is invalid.");
    }
    identityPublicKey = {
      kty: "OKP",
      crv: "Ed25519",
      x: (publicKey as Record<string, unknown>).x,
      ...((publicKey as Record<string, unknown>).kid
        ? { kid: (publicKey as Record<string, unknown>).kid }
        : {}),
    };
  }
  const checkoutEntries = capabilities[UCP_CHECKOUT_CAPABILITY];
  if (
    checkoutEntries !== undefined &&
    (!Array.isArray(checkoutEntries) ||
      checkoutEntries.some(
        (entry) =>
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof (entry as UcpEntity).version !== "string" ||
          typeof (entry as UcpEntity).spec !== "string" ||
          typeof (entry as UcpEntity).schema !== "string",
      ))
  ) {
    throw new Error("The platform checkout capability is invalid.");
  }
  for (const entry of (checkoutEntries as UcpEntity[] | undefined) ?? []) {
    const schema = new URL(entry.schema as string);
    if (schema.protocol !== "https:" || schema.hostname !== "ucp.dev") {
      throw new Error("The platform checkout schema violates UCP namespace authority.");
    }
  }
  return {
    ucp: {
      version: record.version,
      capabilities: capabilities as Record<string, UcpEntity[]>,
      authentication: {
        type: "ed25519",
        key_id: auth.key_id,
        public_key_jwk: jwk as UcpPublicKeyJwk,
        key_succession: keySuccession,
      },
      identityPublicKey,
    },
  };
}

async function requestPinnedProfile(
  target: ValidatedProfileTarget,
): Promise<{ status: number; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const { url, address } = target;
    const request = httpsRequest(
      {
        protocol: "https:",
        hostname: address,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: isIP(url.hostname) ? undefined : url.hostname,
        headers: {
          accept: "application/json",
          "accept-encoding": "identity",
          host: url.host,
        },
        timeout: 4_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size > PROFILE_MAX_BYTES) {
            response.destroy(new Error("The platform profile is too large."));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode ?? 0,
              payload: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          } catch (error) {
            reject(error);
          }
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error("The platform profile request timed out.")),
    );
    request.on("error", reject);
    request.end();
  });
}
let profileRequester = requestPinnedProfile;

async function fetchPlatformProfile(profileUrl: string): Promise<UcpPlatformProfile> {
  const now = profileClock();
  const cached = profileCache.get(profileUrl);
  if (cached && cached.expiresAt > now) return cached.profile;
  const failed = profileNegativeCache.get(profileUrl);
  if (failed && failed.expiresAt > now) throw failed.error;
  const pending = profileRequests.get(profileUrl);
  if (pending) return pending;
  const resolution = (async () => {
    try {
      const target = await validatePublicProfileUrl(profileUrl);
      let response: Awaited<ReturnType<typeof requestPinnedProfile>>;
      try {
        response = await profileRequester(target);
      } catch {
        throw new UcpProfileResolutionError(
          424,
          "profile_unreachable",
          "The platform profile could not be fetched.",
        );
      }
      if (response.status < 200 || response.status >= 300) {
        throw new UcpProfileResolutionError(
          424,
          "profile_unreachable",
          `The platform profile returned HTTP ${response.status}.`,
        );
      }
      let profile: UcpPlatformProfile;
      try {
        profile = validatePlatformProfile(response.payload);
      } catch {
        throw new UcpProfileResolutionError(
          422,
          "profile_malformed",
          "The platform profile is malformed.",
        );
      }
      profileCache.set(profileUrl, {
        expiresAt: profileClock() + PROFILE_CACHE_MS,
        profile,
      });
      trimCache(profileCache);
      profileNegativeCache.delete(profileUrl);
      return profile;
    } catch (error) {
      if (error instanceof UcpProfileResolutionError) {
        profileNegativeCache.set(profileUrl, {
          expiresAt: profileClock() + PROFILE_NEGATIVE_CACHE_MS,
          error,
        });
        trimCache(profileNegativeCache);
      }
      throw error;
    } finally {
      profileRequests.delete(profileUrl);
    }
  })();
  profileRequests.set(profileUrl, resolution);
  return resolution;
}

let profileResolver: ProfileResolver = fetchPlatformProfile;

function parseAgentProfileUrl(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^\s*profile="([^"\\]+)"\s*$/.exec(header);
  if (!match?.[1]) return null;
  try {
    const profile = new URL(match[1]);
    return profile.protocol === "https:" &&
      profile.pathname === UCP_AGENT_PROFILE_PATH &&
      !profile.search &&
      !profile.hash
      ? profile.href
      : null;
  } catch {
    return null;
  }
}

function agentIdentityHash(publicKeyJwk: UcpPublicKeyJwk): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        crv: publicKeyJwk.crv,
        kty: publicKeyJwk.kty,
        x: publicKeyJwk.x,
      }),
    )
    .digest("hex");
}
export async function negotiateUcpAgent(
  header: string | undefined,
): Promise<UcpNegotiationResult> {
  const profileUrl = parseAgentProfileUrl(header);
  if (!profileUrl) {
    return {
      ok: false,
      status: 400,
      code: "invalid_profile_url",
      content:
        `UCP-Agent must use RFC 8941 dictionary syntax: profile="https://platform.example${UCP_AGENT_PROFILE_PATH}".`,
    };
  }
  let profile: UcpPlatformProfile;
  try {
    profile = await profileResolver(profileUrl);
  } catch (error) {
    if (error instanceof UcpProfileResolutionError) {
      return {
        ok: false,
        status: error.status,
        code: error.code,
        content: error.message,
      };
    }
    return {
      ok: false,
      status: 422,
      code: "profile_malformed",
      content: "The advertised UCP platform profile could not be validated.",
    };
  }
  if (profile.ucp.version !== UCP_VERSION) {
    return {
      ok: false,
      status: 422,
      code: "version_unsupported",
      content: `Version ${profile.ucp.version} is not supported. Birch Reserve implements ${UCP_VERSION}.`,
    };
  }
  const checkout = profile.ucp.capabilities[UCP_CHECKOUT_CAPABILITY] ?? [];
  if (
    !checkout.some(
      (entry) =>
        entry.version === UCP_VERSION &&
        entry.spec === UCP_CHECKOUT_SPEC_URL &&
        entry.schema === UCP_CHECKOUT_SCHEMA_URL,
    )
  ) {
    return {
      ok: false,
      status: 200,
      code: "capabilities_incompatible",
      content: "The platform and Birch Reserve have no compatible checkout capability version.",
    };
  }
  const currentIdentityHash = agentIdentityHash(
    profile.ucp.authentication.public_key_jwk,
  );
  const predecessorIdentityHashes = verifiedPredecessorIdentityHashes({
    profileUrl,
    keyId: profile.ucp.authentication.key_id,
    publicKeyJwk: profile.ucp.authentication.public_key_jwk,
    succession: profile.ucp.authentication.key_succession ?? [],
  });
  return {
    ok: true,
    profileUrl,
    agentIdentityHash: currentIdentityHash,
    keyId: profile.ucp.authentication.key_id,
    publicKeyJwk: profile.ucp.authentication.public_key_jwk,
    authorizedAgentIdentityHashes: [
      currentIdentityHash,
      ...predecessorIdentityHashes,
    ],
    identityPublicKey: profile.ucp.identityPublicKey,
  };
}

export function authenticateUcpAgentRequest(input: {
  method: string;
  target: string;
  profileUrl: string;
  keyId: string;
  publicKeyJwk: UcpPublicKeyJwk;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  nonceHeader: string | undefined;
  idempotencyKey: string | undefined;
  body: Buffer | undefined;
  now?: number;
}): { ok: true; nonceHash: string; validUntil: Date } | { ok: false } {
  const timestamp = input.timestampHeader?.trim() ?? "";
  const signatureValue = input.signatureHeader?.trim() ?? "";
  const nonce = input.nonceHeader?.trim() ?? "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[A-Za-z0-9_-]{86}$/.test(signatureValue) ||
    !/^[A-Za-z0-9._~-]{22,200}$/.test(nonce)
  ) {
    return { ok: false };
  }
  const timestampMs = Number(timestamp) * 1000;
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(timestampMs) || Math.abs(now - timestampMs) > 5 * 60_000) {
    return { ok: false };
  }
  const bodyDigest = createHash("sha256")
    .update(input.body ?? Buffer.alloc(0))
    .digest("base64url");
  const canonical = [
    input.method.toUpperCase(),
    input.target,
    input.profileUrl,
    input.keyId,
    timestamp,
    nonce,
    input.idempotencyKey?.trim() ?? "",
    bodyDigest,
  ].join("\n");
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureValue, "base64url");
    if (signature.length !== 64) return { ok: false };
    const publicKey = createPublicKey({
      key: input.publicKeyJwk as never,
      format: "jwk",
    });
    if (!verify(null, Buffer.from(canonical), publicKey, signature)) {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
  return {
    ok: true,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    validUntil: new Date(timestampMs + 5 * 60_000),
  };
}

type IdentityContinuityClaims = {
  authorizationId: string;
  authorizationProofHash: string;
  authorizedAt: Date;
  previousPublicKeyThumbprint: string;
};
export function setUcpProfileResolverForTests(
  resolver?: ProfileResolver,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("UCP profile resolver overrides are test-only.");
  }
  profileResolver = resolver ?? fetchPlatformProfile;
  profileCache.clear();
  profileNegativeCache.clear();
  profileRequests.clear();
}

export function setUcpNetworkFunctionsForTests(overrides?: {
  lookup?: ProfileLookup;
  request?: typeof requestPinnedProfile;
  now?: () => number;
}): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("UCP network overrides are test-only.");
  }
  profileLookup =
    overrides?.lookup ?? ((hostname) => lookup(hostname, { all: true }));
  profileRequester = overrides?.request ?? requestPinnedProfile;
  profileClock = overrides?.now ?? Date.now;
  profileCache.clear();
  profileNegativeCache.clear();
  profileRequests.clear();
}

function verifiedPredecessorIdentityHashes(input: {
  profileUrl: string;
  keyId: string;
  publicKeyJwk: UcpPublicKeyJwk;
  succession: UcpKeySuccession[];
  now?: number;
}): string[] {
  const now = input.now ?? Date.now();
  const currentIdentityHash = agentIdentityHash(input.publicKeyJwk);
  const verifiedHashes: string[] = [];
  let expectedSuccessorIdentityHash = currentIdentityHash;
  let expectedSuccessorKeyId = input.keyId;
  for (const succession of [...input.succession].reverse()) {
    const notBefore = Date.parse(succession.not_before);
    const expiresAt = Date.parse(succession.expires_at);
    if (
      !Number.isFinite(notBefore) ||
      !Number.isFinite(expiresAt) ||
      notBefore > now ||
      expiresAt <= now ||
      expiresAt <= notBefore
    ) {
      return [];
    }
    const predecessorIdentityHash = agentIdentityHash(
      succession.predecessor_public_key_jwk,
    );
    const successorIdentityHash = agentIdentityHash(
      succession.successor_public_key_jwk,
    );
    if (
      predecessorIdentityHash === successorIdentityHash ||
      successorIdentityHash !== expectedSuccessorIdentityHash ||
      succession.successor_key_id !== expectedSuccessorKeyId ||
      verifiedHashes.includes(predecessorIdentityHash)
    ) {
      return [];
    }
    const canonical = [
      "birch-reserve-ucp-key-succession-v1",
      input.profileUrl,
      succession.predecessor_key_id,
      predecessorIdentityHash,
      succession.successor_key_id,
      successorIdentityHash,
      succession.not_before,
      succession.expires_at,
    ].join("\n");
    try {
      const signature = Buffer.from(succession.signature, "base64url");
      const predecessorKey = createPublicKey({
        key: succession.predecessor_public_key_jwk as never,
        format: "jwk",
      });
      if (
        signature.length === 64 &&
        verify(null, Buffer.from(canonical), predecessorKey, signature)
      ) {
        verifiedHashes.push(predecessorIdentityHash);
        expectedSuccessorIdentityHash = predecessorIdentityHash;
        expectedSuccessorKeyId = succession.predecessor_key_id;
        continue;
      }
    } catch {
      // Invalid succession entries never extend checkout ownership.
    }
    return [];
  }
  return verifiedHashes;
}
export function setUcpPreAuthLimitForTests(enabled = false): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("UCP pre-auth limit overrides are test-only.");
  }
  preAuthLimitEnabled = enabled;
  preAuthBuckets.clear();
}

export function setUcpSharedAdmissionForTests(
  admission?: SharedProfileAdmission,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("UCP shared admission overrides are test-only.");
  }
  sharedProfileAdmission = admission ?? claimSharedProfileAdmission;
  nextSharedAdmissionCleanupAt = 0;
  preAuthBuckets.clear();
}
const PRE_AUTH_REFILL_PER_MS = 60 / 60_000;

const preAuthBuckets = new Map<
  string,
  { tokens: number; updatedAt: number }
>();

let preAuthLimitEnabled = process.env.NODE_ENV !== "test";

type SharedProfileAdmission = (
  clientKey: string,
  _now: number,
) => Promise<boolean>;
export async function admitUcpProfileResolution(
  header: string | undefined,
  clientKey: string,
  now = Date.now(),
): Promise<boolean> {
  if (!preAuthLimitEnabled) return true;
  const profileUrl = parseAgentProfileUrl(header);
  if (!profileUrl || hasCachedProfileResolution(profileUrl, now)) return true;
  try {
    return await claimSharedProfileAdmissionBeforeDeadline(clientKey, now);
  } catch {
    return admitWithLocalFallback(clientKey, now);
  }
}

const profileRequests = new Map<string, Promise<UcpPlatformProfile>>();

let profileClock = Date.now;

function hasCachedProfileResolution(profileUrl: string, now: number): boolean {
  const positive = profileCache.get(profileUrl);
  if (positive) {
    if (positive.expiresAt > now) return true;
    profileCache.delete(profileUrl);
  }
  const negative = profileNegativeCache.get(profileUrl);
  if (negative) {
    if (negative.expiresAt > now) return true;
    profileNegativeCache.delete(profileUrl);
  }
  return profileRequests.has(profileUrl);
}

const PRE_AUTH_BURST = 20;

const PROFILE_CACHE_MAX_ENTRIES = 1_000;

export function verifyUcpIdentityContinuity(input: {
  authorization: string | undefined;
  checkoutId: string;
  previousProfileUrl: string;
  replacementProfileUrl: string;
  previousPublicKey: Record<string, unknown> | null;
  now?: Date;
}): IdentityContinuityClaims | null {
  try {
    if (!input.authorization || !input.previousPublicKey) return null;
    if (input.authorization.length > 8_192) return null;
    const parts = input.authorization.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = JSON.parse(decodeJwsPart(encodedHeader).toString("utf8")) as {
      alg?: unknown;
      typ?: unknown;
      kid?: unknown;
    };
    if (
      header.alg !== "EdDSA" ||
      (header.typ !== undefined &&
        header.typ !== "ucp-identity-continuity+jwt") ||
      (header.kid !== undefined &&
        header.kid !== input.previousPublicKey.kid)
    ) {
      return null;
    }
    const claims = JSON.parse(
      decodeJwsPart(encodedPayload).toString("utf8"),
    ) as Record<string, unknown>;
    const expectedAudience = `urn:birch-reserve:ucp-checkout:${input.checkoutId}`;
    if (
      claims.iss !== input.previousProfileUrl ||
      claims.sub !== input.replacementProfileUrl ||
      claims.aud !== expectedAudience ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= claims.iat ||
      typeof claims.jti !== "string" ||
      claims.jti.length < 16 ||
      claims.jti.length > 200
    ) {
      return null;
    }
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
    if (
      claims.iat > nowSeconds + 60 ||
      claims.exp < nowSeconds - 60 ||
      claims.exp - claims.iat > 10 * 60
    ) {
      return null;
    }
    const publicKey = createPublicKey({
      key: input.previousPublicKey as never,
      format: "jwk",
    });
    const valid = verify(
      null,
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      decodeJwsPart(encodedSignature),
    );
    if (!valid) return null;
    return {
      authorizationId: claims.jti,
      authorizationProofHash: createHash("sha256")
        .update(input.authorization)
        .digest("hex"),
      authorizedAt: new Date(claims.iat * 1_000),
      previousPublicKeyThumbprint: createHash("sha256")
        .update(
          JSON.stringify({
            crv: input.previousPublicKey.crv,
            kty: input.previousPublicKey.kty,
            x: input.previousPublicKey.x,
          }),
        )
        .digest("base64url"),
    };
  } catch {
    return null;
  }
}

function scheduleStaleSharedAdmissionCleanup(now = Date.now()): void {
  if (now < nextSharedAdmissionCleanupAt) return;
  nextSharedAdmissionCleanupAt =
    now + SHARED_ADMISSION_CLEANUP_INTERVAL_MS;
  void cleanupStaleSharedAdmissionBudgets().catch(() => undefined);
}

let sharedProfileAdmission: SharedProfileAdmission = claimSharedProfileAdmission;

async function claimSharedProfileAdmissionBeforeDeadline(
  clientKey: string,
  now: number,
): Promise<boolean> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      sharedProfileAdmission(clientKey, now),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Shared UCP profile admission timed out.")),
          SHARED_ADMISSION_DEADLINE_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function acquireSharedAdmissionClient() {
  const pendingClient = pool.connect();
  return new Promise<Awaited<typeof pendingClient>>(
    (resolve, reject) => {
      let completed = false;
      const timeout = setTimeout(() => {
        completed = true;
        reject(new Error("Shared UCP profile admission connection timed out."));
      }, SHARED_ADMISSION_QUERY_TIMEOUT_MS);
      void pendingClient.then(
        (client) => {
          if (completed) {
            client.release();
            return;
          }
          completed = true;
          clearTimeout(timeout);
          resolve(client);
        },
        (error) => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          reject(error);
        },
      );
    },
  );
}

const SHARED_ADMISSION_CLEANUP_INTERVAL_MS = 60_000;

const SHARED_ADMISSION_DEADLINE_MS = 250;

const SHARED_ADMISSION_CLEANUP_BATCH_SIZE = 100;

const SHARED_ADMISSION_STALE_MS = 10 * 60_000;

async function claimSharedProfileAdmission(
  clientKey: string,
  _now: number,
): Promise<boolean> {
  const client = await acquireSharedAdmissionClient();
  let destroyConnection = false;
  try {
    const query = {
      text: `
        insert into ucp_profile_admission_budgets as budget (
          client_key,
          tokens,
          updated_at
        )
        values ($1, $2, statement_timestamp())
        on conflict (client_key) do update
        set
          tokens = least(
            $3,
            budget.tokens
              + greatest(
                  0,
                  extract(
                    epoch from (statement_timestamp() - budget.updated_at)
                  ) * 1000
                ) * $4
          ) - 1,
          updated_at = statement_timestamp()
        where least(
          $3,
          budget.tokens
            + greatest(
                0,
                extract(
                  epoch from (statement_timestamp() - budget.updated_at)
                ) * 1000
              ) * $4
        ) >= 1
        returning true as admitted
      `,
      values: [
        clientKey,
        PRE_AUTH_BURST - 1,
        PRE_AUTH_BURST,
        PRE_AUTH_REFILL_PER_MS,
      ],
      query_timeout: SHARED_ADMISSION_QUERY_TIMEOUT_MS,
    };
    const result = await client.query<{ admitted: boolean }>(query);
    scheduleStaleSharedAdmissionCleanup();
    return result.rows[0]?.admitted === true;
  } catch (error) {
    destroyConnection = true;
    throw error;
  } finally {
    client.release(destroyConnection);
  }
}

const SHARED_ADMISSION_QUERY_TIMEOUT_MS = 200;

async function cleanupStaleSharedAdmissionBudgets(): Promise<void> {
  const client = await acquireSharedAdmissionClient();
  let destroyConnection = false;
  try {
    const query = {
      text: `
        with stale as (
          select client_key
          from ucp_profile_admission_budgets
          where updated_at
            < statement_timestamp() - ($1 * interval '1 millisecond')
          order by updated_at
          limit $2
          for update skip locked
        )
        delete from ucp_profile_admission_budgets as budget
        using stale
        where budget.client_key = stale.client_key
      `,
      values: [
        SHARED_ADMISSION_STALE_MS,
        SHARED_ADMISSION_CLEANUP_BATCH_SIZE,
      ],
      query_timeout: SHARED_ADMISSION_QUERY_TIMEOUT_MS,
    };
    await client.query(query);
  } catch (error) {
    destroyConnection = true;
    throw error;
  } finally {
    client.release(destroyConnection);
  }
}

function admitWithLocalFallback(clientKey: string, now: number): boolean {
  const previous = preAuthBuckets.get(clientKey);
  const tokens = previous
    ? Math.min(
        PRE_AUTH_BURST,
        previous.tokens + Math.max(0, now - previous.updatedAt) * PRE_AUTH_REFILL_PER_MS,
      )
    : PRE_AUTH_BURST;
  if (tokens < 1) {
    preAuthBuckets.set(clientKey, { tokens, updatedAt: now });
    return false;
  }
  preAuthBuckets.set(clientKey, { tokens: tokens - 1, updatedAt: now });
  trimCache(preAuthBuckets);
  return true;
}

let nextSharedAdmissionCleanupAt = 0;

function decodeJwsPart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url value.");
  }
  return Buffer.from(value, "base64url");
}
