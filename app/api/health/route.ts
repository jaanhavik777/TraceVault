import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Quick connectivity check: GET /api/health
export async function GET() {
  try {
    const rows = await query<{ now: string; pgvector: boolean }>(
      "SELECT NOW()::text AS now, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS pgvector"
    );
    return NextResponse.json({ status: "ok", ...rows[0] });
  } catch (e) {
    return NextResponse.json({ status: "db_error", message: String(e) }, { status: 500 });
  }
}
