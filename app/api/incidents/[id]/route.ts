import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { lockIncident, parseId, requireAssignee, TRANSITIONS } from "@/lib/incidents";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/incidents/[id]  -> { incident, services, events, resolution }
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);
    const id = parseId((await params).id);

    const [incident, services, events, resolution] = await Promise.all([
      query(
        `SELECT i.incident_id, i.title, i.description, i.priority_score,
                st.status_name AS status, sv.severity_name AS severity,
                i.created_at, i.updated_at,
                i.reporter_id, rep.full_name AS reporter_name,
                i.assigned_engineer_id, eng.full_name AS assigned_name
         FROM incidents i
         JOIN incident_statuses st   ON st.status_id = i.status_id
         JOIN incident_severities sv ON sv.severity_id = i.severity_id
         JOIN users rep              ON rep.user_id = i.reporter_id
         LEFT JOIN users eng         ON eng.user_id = i.assigned_engineer_id
         WHERE i.incident_id = $1`,
        [id]
      ),
      query(
        `SELECT s.service_id, s.service_name, s.criticality, isv.is_primary
         FROM incident_services isv JOIN services s ON s.service_id = isv.service_id
         WHERE isv.incident_id = $1
         ORDER BY isv.is_primary DESC, s.service_name`,
        [id]
      ),
      query(
        `SELECT e.event_id, e.event_type, e.event_description, e.event_timestamp,
                e.user_id, u.full_name AS user_name
         FROM incident_events e LEFT JOIN users u ON u.user_id = e.user_id
         WHERE e.incident_id = $1
         ORDER BY e.event_timestamp, e.event_id`,
        [id]
      ),
      query(
        `SELECT r.resolution_id, r.root_cause_category, r.root_cause_description,
                r.resolution_summary, r.resolved_at, r.resolved_by, u.full_name AS resolved_by_name
         FROM resolutions r LEFT JOIN users u ON u.user_id = r.resolved_by
         WHERE r.incident_id = $1`,
        [id]
      ),
    ]);

    if (!incident[0]) throw new HttpError(404, "Incident not found");
    return NextResponse.json({ incident: incident[0], services, events, resolution: resolution[0] ?? null });
  } catch (e) {
    return handleError(e);
  }
}

const PatchBody = z.object({ status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "CLOSED"]) });

// PATCH /api/incidents/[id]  body { status }  (ENGINEER, assigned only)
// The DB trigger records the status-change event and audit entry.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);
    const id = parseId((await params).id);
    const { status } = PatchBody.parse(await req.json().catch(() => ({})));

    const result = await withTransaction(async (client) => {
      const inc = await lockIncident(client, id);
      requireAssignee(user, inc);
      if (!TRANSITIONS[inc.status]?.includes(status)) {
        throw new HttpError(400, `Cannot change status from ${inc.status} to ${status}`);
      }
      // lets the status trigger attribute the change to this user (transaction-local)
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(user.userId)]);
      await client.query(
        "UPDATE incidents SET status_id = (SELECT status_id FROM incident_statuses WHERE status_name = $1) WHERE incident_id = $2",
        [status, id]
      );
      return { incident_id: id, status };
    });
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);
  }
}
