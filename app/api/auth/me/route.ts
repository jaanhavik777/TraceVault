import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/auth/me: who am I? Used by the UI to show the user and decide which links to display.
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(user);
}
