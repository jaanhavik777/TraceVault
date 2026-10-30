import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { handleError, setSessionCookie, signSession, verifyPassword, type Role } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2a$10$B6o8h4KdYhLAr.Ji/2tgBO.Li0rIpuA5j0Vw6pfe0UXJe2dgFOR1i";

interface UserRow {
  user_id: number;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  role_name: Role;
}

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json().catch(() => ({})));

    const rows = await query<UserRow>(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE lower(u.email) = lower($1)`,
      [body.email]
    );
    const user = rows[0];
    const passwordOk = await verifyPassword(body.password, user ? user.password_hash : DUMMY_HASH);

    // Same message for unknown email, wrong password and deactivated account.
    if (!user || !passwordOk || !user.is_active) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const session = { userId: user.user_id, role: user.role_name, fullName: user.full_name, email: user.email };
    const res = NextResponse.json(session);
    setSessionCookie(res, await signSession(session));
    return res;
  } catch (e) {
    return handleError(e);
  }
}
