// Authentication helpers for route handlers. OWNER: Jaanhavi
//
// Usage in any protected route handler:
//
//   export async function POST(req: NextRequest) {
//     try {
//       const user = await requireRole(req, ["ADMIN"]);
//       ...
//       return NextResponse.json(result);
//     } catch (e) {
//       return handleError(e);      // turns AuthError / ZodError into 401 / 403 / 400
//     }
//   }
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type Role,
  type SessionUser,
} from "./session";

export type { Role, SessionUser };
export { signSession };

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Hash a plain password with bcrypt (cost 10). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Compare a plain password to a stored bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Read and verify the session cookie; null if missing or invalid. */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

/** Throws AuthError(401) if not logged in, AuthError(403) if the role is not allowed. */
export async function requireRole(req: NextRequest, roles: Role[]): Promise<SessionUser> {
  const user = await getSession(req);
  if (!user) throw new AuthError(401, "Not authenticated");
  if (!roles.includes(user.role)) throw new AuthError(403, "Forbidden for your role");
  return user;
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Standard error-to-response mapping for route handlers. */
export function handleError(e: unknown): NextResponse {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Invalid input", details: e.flatten().fieldErrors }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
