
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole, handleError } from "@/lib/auth";

const serviceSchema = z.object({
  service_name: z.string().trim().min(1).max(150),
  description: z.string().optional().nullable(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  service_status: z
    .enum(["ACTIVE", "INACTIVE", "MAINTENANCE"])
    .optional(),
  owner_id: z.number().int().positive().optional().nullable(),
});

const updateSchema = z.object({
  service_id: z.number().int().positive(),
  service_name: z.string().trim().min(1).max(150).optional(),
  description: z.string().optional().nullable(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  service_status: z
    .enum(["ACTIVE", "INACTIVE", "MAINTENANCE"])
    .optional(),
  owner_id: z.number().int().positive().optional().nullable(),
});

// GET: List all services
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const services = await query(
      `SELECT * FROM services ORDER BY service_id`
    );

    return NextResponse.json({ services });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a service
export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const body = await req.json();
    const parsed = serviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid service data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      service_name,
      description,
      criticality,
      service_status = "ACTIVE",
      owner_id,
    } = parsed.data;

    const rows = await query(
      `INSERT INTO services
        (service_name, description, criticality, service_status, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        service_name,
        description ?? null,
        criticality,
        service_status,
        owner_id ?? null,
      ]
    );

    return NextResponse.json({ service: rows[0] }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PATCH: Update a service
export async function PATCH(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { service_id, ...fields } = parsed.data;

    const allowedFields = [
      "service_name",
      "description",
      "criticality",
      "service_status",
      "owner_id",
    ] as const;

    const updates = allowedFields.filter(
      (field) => fields[field] !== undefined
    );

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400 }
      );
    }

    const values = updates.map((field) => fields[field]);
    const setClause = updates
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");

    values.push(service_id);

    const rows = await query(
      `UPDATE services
       SET ${setClause}
       WHERE service_id = $${values.length}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ service: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete a service
export async function DELETE(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN"]);

    const serviceId = Number(req.nextUrl.searchParams.get("service_id"));

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return NextResponse.json(
        { error: "A valid service_id is required" },
        { status: 400 }
      );
    }

    const rows = await query(
      `DELETE FROM services
       WHERE service_id = $1
       RETURNING *`,
      [serviceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Service deleted successfully",
      service: rows[0],
    });
  } catch (error) {
    return handleError(error);
  }
}
