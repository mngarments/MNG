import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "mng_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

/** Create a signed, time-bound session token. */
export function signToken(email: string): string {
  const payload = `${email}|${Date.now()}`;
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

/** Verify a token's signature and freshness. Returns the email or null. */
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const expected = crypto
    .createHmac("sha256", secret())
    .update(b64)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const [email, tsStr] = payload.split("|");
  const ts = Number(tsStr);
  if (!email || !Number.isFinite(ts)) return null;
  if (Date.now() - ts > MAX_AGE_SECONDS * 1000) return null;
  return email;
}

/** Constant-time credential check against env-configured admin. */
export function checkCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@mngarments.com";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  return safeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase()) &&
    safeEqual(password, adminPass);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Set the session cookie (call from a route handler). */
export async function setSessionCookie(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Read + verify the current session. Returns the admin email or null. */
export async function getSession(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME };
