
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole, handleError } from "@/lib/auth";

const deploymentSchema = z.object({
  serviceId: z.number().int().positive(),
  version: z.string().trim().min(1).max(100),
  environment: z.string().trim().min(1).max(50),
  deploymentStatus: z.enum(["SUCCESS", "FAILED", "ROLLED_BACK"]),
});

// GET: List deployments, optionally filtered by serviceId
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const serviceIdParam = req.nextUrl.searchParams.get("serviceId");

    if (serviceIdParam !== null) {
      const serviceId = Number(serviceIdParam);

      if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return NextResponse.json(
          { error: "A valid serviceId is required" },
          { status: 400 }
        );
      }

      const deployments = await query(
        `SELECT d.*, s.service_name
         FROM deployments d
         JOIN services s ON s.service_id = d.service_id
         WHERE d.service_id = $1
         ORDER BY d.deployed_at DESC`,
        [serviceId]
      );

      return NextResponse.json({ deployments });
    }

    const deployments = await query(
      `SELECT d.*, s.service_name
       FROM deployments d
       JOIN services s ON s.service_id = d.service_id
       ORDER BY d.deployed_at DESC`
    );

    return NextResponse.json({ deployments });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a deployment (ENGINEER only)
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ["ENGINEER"]);

    const body = await req.json();
    const parsed = deploymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid deployment data",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      serviceId,
      version,
      environment,
      deploymentStatus,
    } = parsed.data;

    const rows = await query(
      `INSERT INTO deployments
        (service_id, version, environment, deployed_by, deployment_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        serviceId,
        version,
        environment,
        user.userId,
        deploymentStatus,
      ]
    );

    return NextResponse.json(
      { deployment: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
