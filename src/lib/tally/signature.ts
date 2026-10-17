import crypto from "node:crypto";

// Requests from the Tally agent are signed with TALLY_SYNC_SECRET:
// hex HMAC-SHA256(secret, `${timestamp}.` + raw body bytes). Must stay in sync
// with tally-agent/lib/mng.mjs.

const MAX_SKEW_MS = 5 * 60 * 1000;

/** Returns null when the signature is valid, otherwise the reason it isn't. */
export function verifySignature(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: Buffer,
  now = Date.now()
): string | null {
  if (!timestamp || !signature) return "Missing signature headers";
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) {
    return "Request timestamp is too old or too far in the future (check the server clock)";
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest();
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return "Bad signature (check that TALLY_SYNC_SECRET matches the agent's syncSecret)";
  }
  return null;
}
