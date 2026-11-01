
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireRole, HttpError } from "@/lib/auth";
import { parseId } from "@/lib/incidents";
import { searchSimilar } from "@/lib/embeddings";

// GET /api/incidents/[id]/similar
// Returns similar historical incidents using embedding similarity.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const id = parseId((await params).id);

    // Verify that the incident exists and retrieve its details.
    const incidents = await query(
      `SELECT
         i.incident_id,
         i.title,
         i.description,
         r.root_cause_description,
         r.resolution_summary
       FROM incidents i
       LEFT JOIN resolutions r
         ON r.incident_id = i.incident_id
       WHERE i.incident_id = $1`,
      [id]
    );

    if (incidents.length === 0) {
      throw new HttpError(404, "Incident not found");
    }

    const incident = incidents[0];

    // Build search text using the incident's available information.
    const searchText = [
      `Title: ${incident.title}`,
      `Description: ${incident.description}`,
      incident.root_cause_description
        ? `Root cause: ${incident.root_cause_description}`
        : "",
      incident.resolution_summary
        ? `Resolution: ${incident.resolution_summary}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Find similar incidents and exclude the current incident.
    const results = await searchSimilar(searchText, 6);

    const similarIncidents = results
      .filter((item) => item.incident_id !== id)
      .slice(0, 5);

    return NextResponse.json({
      similarIncidents,
    });
  } catch (error) {
    return handleError(error);
  }
}
