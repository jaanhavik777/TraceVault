import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireRole } from "@/lib/auth";
import { EVENT_TYPES, ROOT_CAUSE_CATEGORIES } from "@/lib/incidents";

// GET /api/lookups: everything the incident forms need for dropdowns (any logged-in user)
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);
    const [statuses, severities, services, engineers] = await Promise.all([
      query("SELECT status_id, status_name FROM incident_statuses ORDER BY status_id"),
      query("SELECT severity_id, severity_name FROM incident_severities ORDER BY severity_id"),
      query("SELECT service_id, service_name, criticality, service_status FROM services ORDER BY service_name"),
      query(
        `SELECT u.user_id, u.full_name FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'ENGINEER' AND u.is_active ORDER BY u.full_name`
      ),
    ]);
    return NextResponse.json({
      statuses, severities, services, engineers,
      rootCauseCategories: ROOT_CAUSE_CATEGORIES,
      eventTypes: EVENT_TYPES,
    });
  } catch (e) {
    return handleError(e);
  }
}
