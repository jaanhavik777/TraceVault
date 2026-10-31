// Shapes returned by the incident API (see API.md). OWNER: Jaanhavi
export interface Me { userId: number; role: "ADMIN" | "ENGINEER"; fullName: string; email: string }

export interface Lookups {
  statuses: { status_id: number; status_name: string }[];
  severities: { severity_id: number; severity_name: string }[];
  services: { service_id: number; service_name: string; criticality: string; service_status: string }[];
  engineers: { user_id: number; full_name: string }[];
  rootCauseCategories: string[];
  eventTypes: string[];
}

export interface IncidentListRow {
  incident_id: number; title: string; status: string; severity: string;
  created_at: string; updated_at: string; reporter_name: string;
  assigned_engineer_id: number | null; assigned_name: string | null; primary_service: string | null;
}

export interface IncidentDetailData {
  incident: {
    incident_id: number; title: string; description: string; priority_score: number | null;
    status: string; severity: string; created_at: string; updated_at: string;
    reporter_id: number; reporter_name: string; assigned_engineer_id: number | null; assigned_name: string | null;
  };
  services: { service_id: number; service_name: string; criticality: string; is_primary: boolean }[];
  events: { event_id: number; event_type: string; event_description: string; event_timestamp: string; user_id: number | null; user_name: string | null }[];
  resolution: {
    resolution_id: number; root_cause_category: string; root_cause_description: string;
    resolution_summary: string; resolved_at: string; resolved_by: number | null; resolved_by_name: string | null;
  } | null;
}

// Mirrors TRANSITIONS in lib/incidents.ts (server). RESOLVED is only reachable through the resolve form.
export const NEXT_STATUSES: Record<string, string[]> = {
  OPEN: ["INVESTIGATING"],
  INVESTIGATING: ["MITIGATED", "OPEN"],
  MITIGATED: ["INVESTIGATING"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export const fmt = (iso: string) => new Date(iso).toLocaleString();
export const sevClass = (s: string) => `badge sev-${s.toLowerCase()}`;
