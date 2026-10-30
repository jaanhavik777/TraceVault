import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { EVENT_TYPES, parseId } from "@/lib/incidents";

const Body = z.object({
  eventType: z.enum(EVENT_TYPES),
  description: z.string().trim().min(1).max(2000),
});

// POST /api/incidents/[id]/events  body { eventType, description }  (ENGINEER)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);
    const id = parseId((await params).id);
    const body = Body.parse(await req.json().catch(() => ({})));

    const rows = await query(
      `INSERT INTO incident_events (incident_id, user_id, event_type, event_description)
       SELECT $1::int, $2::int, $3::text, $4::text
       WHERE EXISTS (SELECT 1 FROM incidents WHERE incident_id = $1::int)
       RETURNING event_id, event_type, event_description, event_timestamp, user_id`,
      [id, user.userId, body.eventType, body.description]
    );
    if (!rows[0]) throw new HttpError(404, "Incident not found");
    return NextResponse.json({ ...rows[0], user_name: user.fullName }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
