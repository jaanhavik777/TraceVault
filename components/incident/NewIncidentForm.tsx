"use client";
// Create-incident form (engineers only). OWNER: Jaanhavi
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Lookups } from "./types";

export default function NewIncidentForm({ lookups }: { lookups: Lookups }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severityId, setSeverityId] = useState<number>(lookups.severities[1]?.severity_id ?? 1);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [primary, setPrimary] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleService(id: number) {
    const next = serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id];
    setServiceIds(next);
    if (primary === null || !next.includes(primary)) setPrimary(next[0] ?? null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (serviceIds.length === 0 || primary === null) {
      setError("Select at least one affected service and choose the primary one.");
      return;
    }
    setBusy(true);
    try {
      const { incident_id } = await api<{ incident_id: number }>("/api/incidents", {
        method: "POST",
        body: { title, description, severityId, serviceIds, primaryServiceId: primary },
      });
      router.push(`/incidents/${incident_id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>New incident</h2>
      <label>Title<input required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Description<textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Severity
        <select value={severityId} onChange={(e) => setSeverityId(Number(e.target.value))}>
          {lookups.severities.map((s) => <option key={s.severity_id} value={s.severity_id}>{s.severity_name}</option>)}
        </select>
      </label>
      <fieldset style={{ border: "1.5px solid var(--blue)", borderRadius: 8 }}>
        <legend>Affected services (pick the primary one with the radio button)</legend>
        <div className="grid2">
          {lookups.services.map((s) => (
            <div key={s.service_id} className="row">
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={serviceIds.includes(s.service_id)} onChange={() => toggleService(s.service_id)} aria-label={s.service_name} />
              <span>{s.service_name}</span>
              <input type="radio" name="primary" style={{ width: "auto", margin: 0 }} disabled={!serviceIds.includes(s.service_id)} checked={primary === s.service_id} onChange={() => setPrimary(s.service_id)} aria-label={`primary: ${s.service_name}`} />
            </div>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row"><button className="btn" disabled={busy}>{busy ? "Creating..." : "Create incident"}</button></div>
    </form>
  );
}
