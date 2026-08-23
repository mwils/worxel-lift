import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "lift_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionClaims {
  userId: string;
  shopId?: string;
  email: string;
  role: "owner" | "tech";
}

function secretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function signSessionCookie(claims: SessionClaims): Promise<string> {
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("lift")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  // Local Express dev runs over http://localhost; everything else is HTTPS.
  const isLocalDev = process.env.LIFT_LOCAL_DEV === "1";
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isLocalDev ? "" : "Secure",
    process.env.COOKIE_DOMAIN ? `Domain=${process.env.COOKIE_DOMAIN}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return cookie;
}

export function clearSessionCookie(): string {
  // MUST mirror the attributes set in signSessionCookie — browsers identify
  // cookies by (name, domain, path). If we omit Domain here the browser sees
  // this as a different cookie and the original session cookie stays alive.
  const isLocalDev = process.env.LIFT_LOCAL_DEV === "1";
  return [
    `${COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isLocalDev ? "" : "Secure",
    process.env.COOKIE_DOMAIN ? `Domain=${process.env.COOKIE_DOMAIN}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function verifySessionCookie(cookieHeader: string): Promise<SessionClaims | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = match.slice(COOKIE_NAME.length + 1);
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "lift" });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

/**
 * Company-level admin check (Lift-the-company, not a shop tenant). There is
 * no admin role in the user model — admins are a comma-separated email
 * allowlist in COMPANY_ADMIN_EMAILS. Used by withCompanyAuth and /auth/me.
 */
export function isCompanyAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = (process.env.COMPANY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

// ── magic link / sms code helpers ───────────────────────────────
export function generateMagicToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSmsCode(): { code: string; hash: string } {
  // 6-digit numeric
  const n = (parseInt(randomBytes(4).toString("hex"), 16) % 1_000_000)
    .toString()
    .padStart(6, "0");
  const hash = createHash("sha256").update(n).digest("hex");
  return { code: n, hash };
}

export function hashSmsCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
