import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { handleError, requireRole } from "@/lib/auth";
import { parseId } from "@/lib/incidents";

const Body = z.object({ engineerId: z.number().int().positive() });

// POST /api/incidents/[id]/assign  body { engineerId }  (ADMIN or ENGINEER)
// All the work (validation, update, timeline event, audit entry) happens atomically
// inside the assign_incident() stored function. Its errors come back as 400.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["ADMIN", "ENGINEER"]);
    const id = parseId((await params).id);
    const { engineerId } = Body.parse(await req.json().catch(() => ({})));

    await query("SELECT assign_incident($1, $2, $3)", [id, engineerId, user.userId]);

    const rows = await query(
      `SELECT i.incident_id, i.assigned_engineer_id, st.status_name AS status
       FROM incidents i JOIN incident_statuses st ON st.status_id = i.status_id
       WHERE i.incident_id = $1`,
      [id]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    return handleError(e);
  }
}
