import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { EVENT_TYPES, lockIncident, parseId } from "@/lib/incidents";

const Body = z.object({
  eventType: z.enum(EVENT_TYPES),
  description: z.string().trim().min(1).max(2000),
});

// POST /api/incidents/[id]/events  body { eventType, description }  (ENGINEER)
// Any engineer may add to the timeline of an open incident; resolved/closed timelines are frozen.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);
    const id = parseId((await params).id);
    const body = Body.parse(await req.json().catch(() => ({})));

    const event = await withTransaction(async (client) => {
      const inc = await lockIncident(client, id);
      if (inc.status === "RESOLVED" || inc.status === "CLOSED") {
        throw new HttpError(409, "This incident is closed; its timeline can no longer be changed");
      }
      const { rows } = await client.query(
        `INSERT INTO incident_events (incident_id, user_id, event_type, event_description)
         VALUES ($1, $2, $3, $4)
         RETURNING event_id, event_type, event_description, event_timestamp, user_id`,
        [id, user.userId, body.eventType, body.description]
      );
      return rows[0];
    });
    return NextResponse.json({ ...event, user_name: user.fullName }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
