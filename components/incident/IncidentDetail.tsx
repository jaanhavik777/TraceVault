"use client";
// Incident investigation view: header, status, assignment, timeline, resolution. OWNER: Jaanhavi
// Kushi's panels are injected through the two slot props so the page order matches the design:
//   header -> services -> {afterServices: deployments, dependencies} -> timeline -> {afterTimeline: similar} -> resolution
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { fmt, NEXT_STATUSES, sevClass, type IncidentDetailData, type Lookups, type Me } from "./types";

export default function IncidentDetail({
  incidentId, afterServices, afterTimeline,
}: { incidentId: number; afterServices?: ReactNode; afterTimeline?: ReactNode }) {
  const [data, setData] = useState<IncidentDetailData | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // forms
  const [engineerId, setEngineerId] = useState("");
  const [eventType, setEventType] = useState("NOTE");
  const [noteText, setNoteText] = useState("");
  const [category, setCategory] = useState("DATABASE");
  const [cause, setCause] = useState("");
  const [summary, setSummary] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, m, l] = await Promise.all([
        api<IncidentDetailData>(`/api/incidents/${incidentId}`),
        api<Me>("/api/auth/me"),
        api<Lookups>("/api/lookups"),
      ]);
      setData(d); setMe(m); setLookups(l);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  // run an action, then reload so the timeline and status reflect what the database did
  async function act(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setError(null);
    try { await fn(); after?.(); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!data || !me || !lookups) {
    return error ? <p role="alert" className="error">{error}</p> : <p className="muted">Loading...</p>;
  }

  const { incident, services, events, resolution } = data;
  const isEngineer = me.role === "ENGINEER";
  const isAssignee = isEngineer && incident.assigned_engineer_id === me.userId;
  const open = incident.status !== "RESOLVED" && incident.status !== "CLOSED";
  const nextStatuses = isAssignee ? NEXT_STATUSES[incident.status] ?? [] : [];
  // same rule as the API: admins always; engineers only when unassigned or already theirs
  const canAssign = open && (me.role === "ADMIN" || (isEngineer && (incident.assigned_engineer_id === null || isAssignee)));
  const timelineOpen = open; // resolved/closed timelines are frozen

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}

      {/* header */}
      <section className="card">
        <p className="muted" style={{ margin: 0 }}>INCIDENT #{incident.incident_id}</p>
        <h1>{incident.title}</h1>
        <div className="row">
          <span className={sevClass(incident.severity)}>{incident.severity}</span>
          <span className="badge status">{incident.status}</span>
          <span className="muted">Reported by {incident.reporter_name} on {fmt(incident.created_at)}</span>
        </div>
        <p style={{ whiteSpace: "pre-wrap" }}>{incident.description}</p>
        <p>Assigned to: <strong>{incident.assigned_name ?? "nobody yet"}</strong></p>

        {nextStatuses.length > 0 && (
          <div className="row">
            <span className="muted">Move to:</span>
            {nextStatuses.map((s) => (
              <button key={s} className="btn btn-blue btn-sm" disabled={busy}
                onClick={() => act(() => api(`/api/incidents/${incidentId}`, { method: "PATCH", body: { status: s } }))}>
                {s}
              </button>
            ))}
          </div>
        )}

        {canAssign && (
          <div className="row" style={{ marginTop: 10 }}>
            <select style={{ width: "auto" }} value={engineerId} onChange={(e) => setEngineerId(e.target.value)} aria-label="Engineer">
              <option value="">Assign to...</option>
              {lookups.engineers.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
            <button className="btn btn-sm" disabled={busy || !engineerId}
              onClick={() => act(() => api(`/api/incidents/${incidentId}/assign`, { method: "POST", body: { engineerId: Number(engineerId) } }), () => setEngineerId(""))}>
              Assign
            </button>
          </div>
        )}
      </section>

      {/* affected services */}
      <section className="card">
        <h2>Affected services</h2>
        <div className="row">
          {services.map((s) => (
            <span key={s.service_id} className="badge" style={{ background: s.is_primary ? "var(--pink)" : "var(--seashell)" }}>
              {s.service_name}{s.is_primary ? " (primary)" : ""}
            </span>
          ))}
        </div>
      </section>

      {afterServices}

      {/* timeline */}
      <section className="card">
        <h2>Investigation timeline</h2>
        <ol className="timeline">
          {events.map((ev) => (
            <li key={ev.event_id}>
              <span className="muted">{fmt(ev.event_timestamp)}</span>{" "}
              <span className="badge status">{ev.event_type}</span>{" "}
              {ev.event_description}
              {ev.user_name && <span className="muted"> ({ev.user_name})</span>}
            </li>
          ))}
        </ol>

        {isEngineer && timelineOpen && (
          <form className="row" style={{ alignItems: "flex-end" }}
            onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => api(`/api/incidents/${incidentId}/events`, { method: "POST", body: { eventType, description: noteText } }), () => setNoteText("")); }}>
            <label style={{ width: 160 }}>Type
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {lookups.eventTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 220 }}>Add to timeline
              <input required value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What did you find or do?" />
            </label>
            <button className="btn btn-sm" disabled={busy}>Add</button>
          </form>
        )}
      </section>

      {afterTimeline}

      {/* resolution */}
      {resolution ? (
        <section className="card">
          <h2>Resolution</h2>
          <p><strong>Root cause:</strong> <span className="badge sev-high">{resolution.root_cause_category}</span> {resolution.root_cause_description}</p>
          <p><strong>Resolution:</strong> {resolution.resolution_summary}</p>
          <p className="muted">Resolved by {resolution.resolved_by_name ?? "unknown"} on {fmt(resolution.resolved_at)}</p>
        </section>
      ) : isAssignee && open ? (
        <form className="card" style={{ display: "grid", gap: 10 }}
          onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => api(`/api/incidents/${incidentId}/resolve`, { method: "POST", body: { rootCauseCategory: category, rootCauseDescription: cause, resolutionSummary: summary } })); }}>
          <h2 style={{ margin: 0 }}>Resolve this incident</h2>
          <label>Root cause category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {lookups.rootCauseCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Root cause<textarea required minLength={5} rows={3} value={cause} onChange={(e) => setCause(e.target.value)} /></label>
          <label>How it was resolved<textarea required minLength={5} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
          <div><button className="btn" disabled={busy}>Record resolution</button></div>
        </form>
      ) : null}
    </>
  );
}
