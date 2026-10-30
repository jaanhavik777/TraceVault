import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { lockIncident, parseId, refreshEmbedding, requireAssignee, ROOT_CAUSE_CATEGORIES } from "@/lib/incidents";

const Body = z.object({
  rootCauseCategory: z.enum(ROOT_CAUSE_CATEGORIES),
  rootCauseDescription: z.string().trim().min(5).max(5000),
  resolutionSummary: z.string().trim().min(5).max(5000),
});

// POST /api/incidents/[id]/resolve  (ENGINEER, assigned only)
// resolve_incident() inserts the resolution, sets status RESOLVED and writes the audit entry;
// the status trigger adds the timeline event. Afterwards the embedding is refreshed so the
// new knowledge becomes searchable.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);
    const id = parseId((await params).id);
    const body = Body.parse(await req.json().catch(() => ({})));

    await withTransaction(async (client) => {
      const inc = await lockIncident(client, id);
      requireAssignee(user, inc);
      if (inc.status === "RESOLVED" || inc.status === "CLOSED") {
        throw new HttpError(409, "Incident is already resolved");
      }
      await client.query("SELECT resolve_incident($1, $2, $3, $4, $5)", [
        id, user.userId, body.rootCauseCategory, body.rootCauseDescription, body.resolutionSummary,
      ]);
    });

    await refreshEmbedding(id); // after commit, never throws
    return NextResponse.json({ incident_id: id, status: "RESOLVED" }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
