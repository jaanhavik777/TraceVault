
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  requireRole,
  hashPassword,
  handleError,
} from "@/lib/auth";

const createUserSchema = z.object({
  role_id: z.number().int().positive(),
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(100),
});

const updateUserSchema = z.object({
  user_id: z.number().int().positive(),
  is_active: z.boolean(),
});

// GET: List all users (ADMIN only)
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const users = await query(
      `SELECT
         user_id,
         role_id,
         full_name,
         email,
         is_active,
         created_at
       FROM users
       ORDER BY user_id`
    );

    return NextResponse.json({ users });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a user (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid user data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { role_id, full_name, email, password } = parsed.data;

    const password_hash = await hashPassword(password);

    const rows = await query(
      `INSERT INTO users
         (role_id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING
         user_id,
         role_id,
         full_name,
         email,
         is_active,
         created_at`,
      [role_id, full_name, email, password_hash]
    );

    return NextResponse.json(
      { user: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    if (dbError.code === "23503") {
      return NextResponse.json(
        { error: "The specified role does not exist" },
        { status: 400 }
      );
    }

    return handleError(error);
  }
}

// PATCH: Activate or deactivate a user (ADMIN only)
export async function PATCH(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { user_id, is_active } = parsed.data;

    const rows = await query(
      `UPDATE users
       SET is_active = $1
       WHERE user_id = $2
       RETURNING
         user_id,
         role_id,
         full_name,
         email,
         is_active,
         created_at`,
      [is_active, user_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
