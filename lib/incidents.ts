// Helpers for the incident API. OWNER: Jaanhavi
import type { PoolClient } from "pg";
import { AuthError, HttpError, type SessionUser } from "@/lib/auth";
import { upsertIncidentEmbedding } from "@/lib/embeddings";

export const ROOT_CAUSE_CATEGORIES = [
  "DATABASE", "DEPLOYMENT", "CONFIGURATION", "INFRASTRUCTURE", "NETWORK",
  "CAPACITY", "QUEUE", "EXTERNAL_DEPENDENCY", "APPLICATION_BUG", "OTHER",
] as const;

export const EVENT_TYPES = ["NOTE", "HYPOTHESIS", "ACTION", "MITIGATION", "ROLLBACK"] as const;

/** Allowed manual status changes. RESOLVED is only reachable through /resolve so knowledge is always recorded. */
export const TRANSITIONS: Record<string, string[]> = {
  OPEN: ["INVESTIGATING"],
  INVESTIGATING: ["MITIGATED", "OPEN"],
  MITIGATED: ["INVESTIGATING"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Invalid incident id");
  return id;
}

export interface LockedIncident {
  incident_id: number;
  status: string;
  assigned_engineer_id: number | null;
}

/** Row-lock an incident for the rest of the transaction (prevents two engineers racing on it). */
export async function lockIncident(client: PoolClient, id: number): Promise<LockedIncident> {
  const { rows } = await client.query<LockedIncident>(
    `SELECT i.incident_id, st.status_name AS status, i.assigned_engineer_id
     FROM incidents i JOIN incident_statuses st ON st.status_id = i.status_id
     WHERE i.incident_id = $1
     FOR UPDATE OF i`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Incident not found");
  return rows[0];
}

/** Engineers may only change incidents assigned to them. */
export function requireAssignee(user: SessionUser, inc: LockedIncident): void {
  if (user.role === "ENGINEER" && inc.assigned_engineer_id !== user.userId) {
    throw new AuthError(403, "Only the assigned engineer can do this");
  }
}

/** Refresh the semantic-search embedding. Never throws: search problems must not fail incident work. */
export async function refreshEmbedding(incidentId: number): Promise<void> {
  try {
    await upsertIncidentEmbedding(incidentId);
  } catch (e) {
    console.error("embedding refresh failed for incident", incidentId, e);
  }
}
