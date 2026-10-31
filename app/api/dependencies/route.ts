
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole, handleError } from "@/lib/auth";

const dependencySchema = z.object({
  serviceId: z.number().int().positive(),
  dependsOnServiceId: z.number().int().positive(),
});

// GET: List all dependencies
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const dependencies = await query(
      `SELECT
         sd.dependency_id,
         sd.service_id,
         s.service_name AS service_name,
         sd.depends_on_service_id,
         ds.service_name AS depends_on_service_name
       FROM service_dependencies sd
       JOIN services s ON sd.service_id = s.service_id
       JOIN services ds ON sd.depends_on_service_id = ds.service_id
       ORDER BY sd.dependency_id`
    );

    return NextResponse.json({ dependencies });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a dependency
export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const body = await req.json();
    const parsed = dependencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid dependency data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { serviceId, dependsOnServiceId } = parsed.data;

    // Prevent self-dependency
    if (serviceId === dependsOnServiceId) {
      return NextResponse.json(
        { error: "A service cannot depend on itself" },
        { status: 400 }
      );
    }

    // Check whether adding this dependency creates a cycle
    const cycleCheck = await query(
      `WITH RECURSIVE reachable(id) AS (
         SELECT $2::int
         UNION
         SELECT sd.depends_on_service_id
         FROM service_dependencies sd
         JOIN reachable r ON sd.service_id = r.id
       )
       SELECT EXISTS (
         SELECT 1 FROM reachable WHERE id = $1
       ) AS creates_cycle`,
      [serviceId, dependsOnServiceId]
    );

    if (cycleCheck[0].creates_cycle) {
      return NextResponse.json(
        { error: "This dependency would create a cycle" },
        { status: 400 }
      );
    }

    const rows = await query(
      `INSERT INTO service_dependencies
         (service_id, depends_on_service_id)
       VALUES ($1, $2)
       RETURNING *`,
      [serviceId, dependsOnServiceId]
    );

    return NextResponse.json(
      { dependency: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      return NextResponse.json(
        { error: "This dependency already exists" },
        { status: 400 }
      );
    }

    if (dbError.code === "23503") {
      return NextResponse.json(
        { error: "One or both services do not exist" },
        { status: 400 }
      );
    }

    return handleError(error);
  }
}

// DELETE: Remove a dependency
export async function DELETE(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const dependencyId = Number(
      req.nextUrl.searchParams.get("dependency_id")
    );

    if (!Number.isInteger(dependencyId) || dependencyId <= 0) {
      return NextResponse.json(
        { error: "A valid dependency_id is required" },
        { status: 400 }
      );
    }

    const rows = await query(
      `DELETE FROM service_dependencies
       WHERE dependency_id = $1
       RETURNING *`,
      [dependencyId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Dependency not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Dependency deleted successfully",
      dependency: rows[0],
    });
  } catch (error) {
    return handleError(error);
  }
}
