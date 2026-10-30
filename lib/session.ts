// Edge-safe session token helpers (jose only, no bcrypt). OWNER: Jaanhavi
// Used by both lib/auth.ts (route handlers) and middleware.ts (Edge runtime).
import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "ENGINEER";

export interface SessionUser {
  userId: number;
  role: Role;
  fullName: string;
  email: string;
}

export const SESSION_COOKIE = "tv_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours, in seconds

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "change-me") {
    throw new Error("AUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Returns the user if the token is valid and unexpired, otherwise null. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const { userId, role, fullName, email } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || (role !== "ADMIN" && role !== "ENGINEER")) return null;
    return { userId, role, fullName: String(fullName), email: String(email) };
  } catch {
    return null;
  }
}
