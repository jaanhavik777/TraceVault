// Authentication helpers. OWNER: Jaanhavi
// TODO(Jaanhavi): implement. Signatures below are the CONTRACT Kushi's admin routes rely on.
import { NextRequest } from "next/server";

export type Role = "ADMIN" | "ENGINEER";

export interface SessionUser {
  userId: number;
  role: Role;
  fullName: string;
  email: string;
}

/** Hash a plain password with bcrypt. */
export async function hashPassword(_plain: string): Promise<string> {
  throw new Error("Not implemented");
}

/** Compare plain password to stored bcrypt hash. */
export async function verifyPassword(_plain: string, _hash: string): Promise<boolean> {
  throw new Error("Not implemented");
}

/** Create a signed JWT (use jose + AUTH_SECRET). */
export async function signSession(_user: SessionUser): Promise<string> {
  throw new Error("Not implemented");
}

/** Read and verify the session cookie; return null if missing/invalid. */
export async function getSession(_req: NextRequest): Promise<SessionUser | null> {
  throw new Error("Not implemented");
}

/**
 * Use at the top of every protected route handler:
 *   const user = await requireRole(req, ["ADMIN"]);
 * Should throw/return a 401/403 response if not allowed.
 */
export async function requireRole(_req: NextRequest, _roles: Role[]): Promise<SessionUser> {
  throw new Error("Not implemented");
}
