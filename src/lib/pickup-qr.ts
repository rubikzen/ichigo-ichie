import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PICKUP_QR_PREFIX = "ichigo-pickup:";
const PICKUP_QR_VERSION = "v1";

function pickupQrSecret() {
  return (
    process.env.PICKUP_QR_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function signatureFor(signingInput: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`ichigo-ichie:pickup:${signingInput}`)
    .digest("base64url");
}

export function createPickupQrPayload(orderId: string) {
  if (!UUID_RE.test(orderId)) {
    throw new Error("PICKUP_QR_ORDER_INVALID");
  }

  const secret = pickupQrSecret();
  if (!secret) {
    throw new Error("PICKUP_QR_SECRET_MISSING");
  }

  const payload = Buffer.from(orderId, "utf8").toString("base64url");
  const signingInput = `${PICKUP_QR_VERSION}.${payload}`;
  const signature = signatureFor(signingInput, secret);

  return `${PICKUP_QR_PREFIX}${signingInput}.${signature}`;
}

export function verifyPickupQrPayload(rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  const encoded = raw.startsWith(PICKUP_QR_PREFIX)
    ? raw.slice(PICKUP_QR_PREFIX.length)
    : raw;

  const [version, payload, providedSignature, extra] = encoded.split(".");
  if (
    extra ||
    version !== PICKUP_QR_VERSION ||
    !payload ||
    !providedSignature
  ) {
    return null;
  }

  const secret = pickupQrSecret();
  if (!secret) return null;

  const signingInput = `${version}.${payload}`;
  const expectedSignature = signatureFor(signingInput, secret);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const orderId = Buffer.from(payload, "base64url").toString("utf8");
    return UUID_RE.test(orderId) ? orderId : null;
  } catch {
    return null;
  }
}

export const pickupQrPrefix = PICKUP_QR_PREFIX;
