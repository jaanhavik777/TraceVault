import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError, requireRole } from "@/lib/auth";
import { EmbeddingError, searchSimilar } from "@/lib/embeddings";

const Params = z.object({
  q: z.string().trim().min(3, "Describe the problem in at least 3 characters").max(2000),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  resolvedOnly: z.enum(["1", "0"]).optional(),
});

// GET /api/search?q=...&limit=5&resolvedOnly=1   (semantic search over historical incidents)
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);
    const p = Params.parse(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(await searchSimilar(p.q, p.limit, p.resolvedOnly === "1"));
  } catch (e) {
    if (e instanceof EmbeddingError) return NextResponse.json({ error: e.message }, { status: 503 });
    return handleError(e);
  }
}
