"use client";
// Similar historical incidents for the incident page. OWNER: Kushi
// Data source: GET /api/incidents/[id]/similar  (pgvector cosine similarity over incident + resolution text)
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { sevClass } from "@/components/incident/types";

interface Similar {
  incident_id: number; title: string; status: string; severity: string; similarity_pct: number;
  root_cause: string | null; root_cause_category: string | null; resolution: string | null;
}

export default function SimilarIncidents({ incidentId }: { incidentId: number }) {
  const [items, setItems] = useState<Similar[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null); setError(null);
    api<Similar[]>(`/api/incidents/${incidentId}/similar?limit=5`)
      .then(setItems)
      .catch((e) => setError((e as Error).message));
  }, [incidentId]);

  return (
    <section className="card">
      <h2>Similar historical incidents</h2>
      {error && <p className="muted">Semantic search is unavailable right now: {error}</p>}
      {!error && items === null && <p className="muted">Searching...</p>}
      {items && items.length === 0 && <p className="muted">No other indexed incidents yet.</p>}
      {items?.map((s) => (
        <div key={s.incident_id} style={{ padding: "8px 0", borderTop: "1px solid var(--blue)" }}>
          <div className="row">
            <strong>{s.similarity_pct}%</strong>
            <Link href={`/incidents/${s.incident_id}`}>#{s.incident_id} {s.title}</Link>
            <span className={sevClass(s.severity)}>{s.severity}</span>
            <span className="badge status">{s.status}</span>
          </div>
          {s.root_cause && <p style={{ margin: "4px 0 0" }}><strong>Root cause:</strong> {s.root_cause}</p>}
          {s.resolution && <p style={{ margin: "2px 0 0" }}><strong>Resolved by:</strong> {s.resolution}</p>}
        </div>
      ))}
    </section>
  );
}
