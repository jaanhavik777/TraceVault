import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { EmbeddingError, similarToIncident } from "@/lib/embeddings";
import { parseId } from "@/lib/incidents";

const Params = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  resolvedOnly: z.enum(["1", "0"]).optional(),
});

// GET /api/incidents/[id]/similar?limit=5   (historical incidents most similar to this one)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);
    const id = parseId((await params).id);
    const p = Params.parse(Object.fromEntries(req.nextUrl.searchParams));

    const exists = await query("SELECT 1 FROM incidents WHERE incident_id = $1", [id]);
    if (exists.length === 0) throw new HttpError(404, "Incident not found");

    return NextResponse.json(await similarToIncident(id, p.limit, p.resolvedOnly === "1"));
  } catch (e) {
    if (e instanceof EmbeddingError) return NextResponse.json({ error: e.message }, { status: 503 });
    return handleError(e);
  }
}
