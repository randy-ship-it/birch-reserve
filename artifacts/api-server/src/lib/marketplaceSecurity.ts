import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type DeliveryTokenPayload = {
  campaignId: string;
  deliveryId: string;
  expiresAt: number;
  placementId: string;
};

function getMasterSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for marketplace security.");
  }
  return secret;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createPrivateKey(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPrivateKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function privateKeyMatches(value: string, expectedHash: string): boolean {
  return safeEqual(hashPrivateKey(value), expectedHash);
}

export function adminSecretMatches(value: string): boolean {
  return safeEqual(value, getMasterSecret());
}

export function encryptMarketplaceSecret(value: string): string {
  const key = createHash("sha256")
    .update(`marketplace:encryption:${getMasterSecret()}`)
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMarketplaceSecret(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Marketplace signing secret is malformed.");
  }

  const key = createHash("sha256")
    .update(`marketplace:encryption:${getMasterSecret()}`)
    .digest();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createDeliveryIdentity(
  payload: Omit<DeliveryTokenPayload, "deliveryId" | "expiresAt">,
): DeliveryTokenPayload {
  return {
    ...payload,
    deliveryId: randomBytes(18).toString("base64url"),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

export function createDeliveryToken(payload: DeliveryTokenPayload): string {
  const completePayload = payload;
  const encoded = Buffer.from(JSON.stringify(completePayload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", getMasterSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyDeliveryToken(token: string): DeliveryTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getMasterSecret())
    .update(encoded)
    .digest("base64url");
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as DeliveryTokenPayload;
    if (
      !payload.campaignId ||
      !payload.deliveryId ||
      !payload.placementId ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function marketplaceEventSignature(
  body: unknown,
  signingSecret: string,
): string {
  return createHmac("sha256", signingSecret)
    .update(JSON.stringify(body))
    .digest("hex");
}

export function marketplaceEventSignatureMatches(
  body: unknown,
  signature: string,
  signingSecret: string,
): boolean {
  return safeEqual(signature, marketplaceEventSignature(body, signingSecret));
}