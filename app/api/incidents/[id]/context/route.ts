
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireRole, HttpError } from "@/lib/auth";
import { parseId } from "@/lib/incidents";

// GET /api/incidents/[id]/context
// Returns recent deployments and upstream/downstream dependencies.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const id = parseId((await params).id);

    // Verify that the incident exists.
    const incidents = await query(
      `SELECT incident_id, created_at
       FROM incidents
       WHERE incident_id = $1`,
      [id]
    );

    if (incidents.length === 0) {
      throw new HttpError(404, "Incident not found");
    }

    // Find deployments of the incident's associated services
    // during the seven days before the incident was created.
    const deployments = await query(
      `SELECT
         d.deployment_id,
         d.version,
         d.deployed_at,
         ROUND(
           EXTRACT(EPOCH FROM (i.created_at - d.deployed_at)) / 3600.0,
           2
         )::FLOAT AS hours_before_incident,
         d.deployment_status AS status
       FROM incidents i
       JOIN incident_services ins
         ON ins.incident_id = i.incident_id
       JOIN deployments d
         ON d.service_id = ins.service_id
       WHERE i.incident_id = $1
         AND d.deployed_at >= i.created_at - INTERVAL '7 days'
         AND d.deployed_at <= i.created_at
       ORDER BY d.deployed_at DESC`,
      [id]
    );

    // Upstream: services that incident services depend on.
    const upstream = await query(
      `SELECT DISTINCT
         upstream_service.service_id,
         upstream_service.service_name
       FROM incident_services ins
       JOIN service_dependencies sd
         ON sd.service_id = ins.service_id
       JOIN services upstream_service
         ON upstream_service.service_id = sd.depends_on_service_id
       WHERE ins.incident_id = $1
       ORDER BY upstream_service.service_name`,
      [id]
    );

    // Downstream: services that depend on incident services.
    const downstream = await query(
      `SELECT DISTINCT
         downstream_service.service_id,
         downstream_service.service_name
       FROM incident_services ins
       JOIN service_dependencies sd
         ON sd.depends_on_service_id = ins.service_id
       JOIN services downstream_service
         ON downstream_service.service_id = sd.service_id
       WHERE ins.incident_id = $1
       ORDER BY downstream_service.service_name`,
      [id]
    );

    return NextResponse.json({
      deployments,
      dependencies: {
        upstream,
        downstream,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
