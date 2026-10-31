"use client";
// Incident list with filters + create form. OWNER: Jaanhavi
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import NewIncidentForm from "@/components/incident/NewIncidentForm";
import { fmt, sevClass, type IncidentListRow, type Lookups, type Me } from "@/components/incident/types";

export default function IncidentsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [rows, setRows] = useState<IncidentListRow[]>([]);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mine, setMine] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0); // ignore slow responses that arrive after a newer filter change

  useEffect(() => {
    Promise.all([api<Me>("/api/auth/me"), api<Lookups>("/api/lookups")])
      .then(([m, l]) => { setMe(m); setLookups(l); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (severity) p.set("severity", severity);
    if (serviceId) p.set("serviceId", serviceId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (mine) p.set("assignedTo", "me");
    const mine_ = ++requestId.current;
    try {
      const data = await api<IncidentListRow[]>(`/api/incidents?${p.toString()}`);
      if (mine_ === requestId.current) setRows(data);
    } catch (e) {
      if (mine_ === requestId.current) setError((e as Error).message);
    } finally {
      if (mine_ === requestId.current) setLoading(false);
    }
  }, [status, severity, serviceId, from, to, mine]);

  useEffect(() => { load(); }, [load]);

  const clear = () => { setStatus(""); setSeverity(""); setServiceId(""); setFrom(""); setTo(""); setMine(false); };

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Incidents</h1>
        {me?.role === "ENGINEER" && lookups && (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? "Close form" : "New incident"}</button>
        )}
      </div>

      {showForm && lookups && <NewIncidentForm lookups={lookups} />}

      <section className="card">
        <div className="grid2">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {lookups?.statuses.map((s) => <option key={s.status_id} value={s.status_name}>{s.status_name}</option>)}
            </select>
          </label>
          <label>Severity
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">All</option>
              {lookups?.severities.map((s) => <option key={s.severity_id} value={s.severity_name}>{s.severity_name}</option>)}
            </select>
          </label>
          <label>Service
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">All</option>
              {lookups?.services.map((s) => <option key={s.service_id} value={s.service_id}>{s.service_name}</option>)}
            </select>
          </label>
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {me?.role === "ENGINEER" && (
            <label className="row" style={{ fontWeight: 400 }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me
            </label>
          )}
          <button className="btn btn-blue btn-sm" onClick={clear}>Clear filters</button>
        </div>
      </section>

      {error && <p role="alert" className="error">{error}</p>}

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Title</th><th>Severity</th><th>Status</th><th>Primary service</th><th>Assigned to</th><th>Created</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.incident_id}>
                <td>{r.incident_id}</td>
                <td><Link href={`/incidents/${r.incident_id}`}>{r.title}</Link></td>
                <td><span className={sevClass(r.severity)}>{r.severity}</span></td>
                <td><span className="badge status">{r.status}</span></td>
                <td>{r.primary_service ?? "n/a"}</td>
                <td>{r.assigned_name ?? <span className="muted">unassigned</span>}</td>
                <td>{fmt(r.created_at)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="muted">No incidents match these filters.</td></tr>}
          </tbody>
        </table>
        {loading && <p className="muted">Loading...</p>}
      </section>
    </main>
  );
}
