import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { handleError, requireRole } from "@/lib/auth";
import { refreshEmbedding } from "@/lib/incidents";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const ListFilters = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  from: date.optional(),
  to: date.optional(),
  assignedTo: z.literal("me").optional(),
});

// GET /api/incidents?status=OPEN&severity=HIGH&serviceId=3&from=2026-10-01&to=2026-10-31&assignedTo=me
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(req, ["ADMIN", "ENGINEER"]);
    const f = ListFilters.parse(Object.fromEntries(req.nextUrl.searchParams));

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };
    if (f.status) add("st.status_name = ?", f.status.toUpperCase());
    if (f.severity) add("sv.severity_name = ?", f.severity.toUpperCase());
    if (f.serviceId)
      add("EXISTS (SELECT 1 FROM incident_services x WHERE x.incident_id = i.incident_id AND x.service_id = ?)", f.serviceId);
    if (f.from) add("i.created_at >= ?::date", f.from);
    if (f.to) add("i.created_at < (?::date + 1)", f.to);
    if (f.assignedTo === "me") add("i.assigned_engineer_id = ?", user.userId);

    const rows = await query(
      `SELECT i.incident_id, i.title, st.status_name AS status, sv.severity_name AS severity,
              i.created_at, i.updated_at,
              rep.full_name AS reporter_name,
              i.assigned_engineer_id, eng.full_name AS assigned_name,
              (SELECT s.service_name FROM incident_services isv
                 JOIN services s ON s.service_id = isv.service_id
                WHERE isv.incident_id = i.incident_id AND isv.is_primary LIMIT 1) AS primary_service
       FROM incidents i
       JOIN incident_statuses st   ON st.status_id = i.status_id
       JOIN incident_severities sv ON sv.severity_id = i.severity_id
       JOIN users rep              ON rep.user_id = i.reporter_id
       LEFT JOIN users eng         ON eng.user_id = i.assigned_engineer_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY i.created_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) {
    return handleError(e);
  }
}

const CreateBody = z
  .object({
    title: z.string().trim().min(3).max(255),
    description: z.string().trim().min(1).max(10000),
    severityId: z.number().int().positive(),
    serviceIds: z.array(z.number().int().positive()).min(1).max(20),
    primaryServiceId: z.number().int().positive(),
  })
  .refine((b) => b.serviceIds.includes(b.primaryServiceId), {
    message: "primaryServiceId must be one of serviceIds",
    path: ["primaryServiceId"],
  });

// POST /api/incidents  (ENGINEER). The DB trigger writes the CREATED timeline event.
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);
    const body = CreateBody.parse(await req.json().catch(() => ({})));
    const serviceIds = [...new Set(body.serviceIds)];

    const incidentId = await withTransaction(async (client) => {
      const { rows } = await client.query<{ incident_id: number }>(
        `INSERT INTO incidents (title, description, status_id, severity_id, reporter_id)
         VALUES ($1, $2, (SELECT status_id FROM incident_statuses WHERE status_name = 'OPEN'), $3, $4)
         RETURNING incident_id`,
        [body.title, body.description, body.severityId, user.userId]
      );
      const id = rows[0].incident_id;
      for (const sid of serviceIds) {
        await client.query(
          "INSERT INTO incident_services (incident_id, service_id, is_primary) VALUES ($1, $2, $3)",
          [id, sid, sid === body.primaryServiceId]
        );
      }
      return id;
    });

    await refreshEmbedding(incidentId); // after commit, never throws
    return NextResponse.json({ incident_id: incidentId }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
