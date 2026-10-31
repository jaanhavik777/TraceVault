
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, handleError } from "@/lib/auth";

// GET /api/dashboard
// ADMIN only: returns incident KPIs and analytics.
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    // 1. KPI summary
    const kpiRows = await query(
      `SELECT
         COUNT(*) FILTER (
           WHERE st.status_name NOT IN ('RESOLVED', 'CLOSED')
         )::INT AS open,

         COUNT(*) FILTER (
           WHERE sv.severity_name = 'CRITICAL'
             AND st.status_name NOT IN ('RESOLVED', 'CLOSED')
         )::INT AS critical,

         (
           SELECT COUNT(*)::INT
           FROM resolutions
         ) AS resolved,

         COALESCE(
           (
             SELECT ROUND(
               AVG(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC,
               1
             )::FLOAT
             FROM resolutions r
             JOIN incidents i ON i.incident_id = r.incident_id
           ),
           0
         ) AS avg_resolution_min

       FROM incidents i
       JOIN incident_statuses st ON st.status_id = i.status_id
       JOIN incident_severities sv ON sv.severity_id = i.severity_id`
    );

    // 2. Incident statistics by service
    const byService = await query(
      `SELECT
         service_name,
         incident_count::INT AS incident_count,
         critical_count::INT AS critical_count
       FROM service_incident_summary
       ORDER BY incident_count DESC, service_name`
    );

    // 3. Incident count grouped by severity
    const bySeverity = await query(
      `SELECT
         sv.severity_name AS severity,
         COUNT(i.incident_id)::INT AS count
       FROM incident_severities sv
       LEFT JOIN incidents i
         ON i.severity_id = sv.severity_id
       GROUP BY sv.severity_id, sv.severity_name
       ORDER BY sv.severity_id`
    );

    // 4. Weekly incident trend for the last 8 weeks
    const trend = await query(
      `WITH weeks AS (
         SELECT generate_series(
           DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 weeks',
           DATE_TRUNC('week', CURRENT_DATE),
           INTERVAL '1 week'
         )::DATE AS week_start
       )
       SELECT
         TO_CHAR(w.week_start, 'YYYY-MM-DD') AS week_start,
         COUNT(i.incident_id)::INT AS incidents
       FROM weeks w
       LEFT JOIN incidents i
         ON i.created_at >= w.week_start
        AND i.created_at < w.week_start + INTERVAL '1 week'
       GROUP BY w.week_start
       ORDER BY w.week_start`
    );

    return NextResponse.json({
      kpis: kpiRows[0],
      byService,
      bySeverity,
      trend,
    });
  } catch (error) {
    return handleError(error);
  }
}
