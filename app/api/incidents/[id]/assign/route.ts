import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { AuthError, HttpError, handleError, requireRole } from "@/lib/auth";
import { lockIncident, parseId } from "@/lib/incidents";

const Body = z.object({ engineerId: z.number().int().positive() });

// POST /api/incidents/[id]/assign  body { engineerId }
// Admins can assign any open incident. Engineers can assign only unassigned incidents (claiming or
// delegating them) or incidents already assigned to themselves (handing over).
// The work (validation, update, timeline event, audit entry) is done atomically by assign_incident().
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["ADMIN", "ENGINEER"]);
    const id = parseId((await params).id);
    const { engineerId } = Body.parse(await req.json().catch(() => ({})));

    await withTransaction(async (client) => {
      const inc = await lockIncident(client, id);
      if (inc.status === "RESOLVED" || inc.status === "CLOSED") {
        throw new HttpError(409, "Cannot assign a resolved or closed incident");
      }
      if (user.role === "ENGINEER" && inc.assigned_engineer_id !== null && inc.assigned_engineer_id !== user.userId) {
        throw new AuthError(403, "Only an admin or the currently assigned engineer can reassign this incident");
      }
      await client.query("SELECT assign_incident($1, $2, $3)", [id, engineerId, user.userId]);
    });

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
