import { NextRequest, NextResponse } from "next/server";
import { handleError, requireRole } from "@/lib/auth";
import { backfillEmbeddings, EmbeddingError } from "@/lib/embeddings";

// POST /api/embeddings/backfill[?all=1]   (ADMIN)
// Builds embeddings for incidents that have none (all=1 rebuilds every one). Run after seeding or db:reset.
export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);
    return NextResponse.json(await backfillEmbeddings(req.nextUrl.searchParams.get("all") === "1"));
  } catch (e) {
    if (e instanceof EmbeddingError) return NextResponse.json({ error: e.message }, { status: 503 });
    return handleError(e);
  }
}
