
"use client";

// OWNER: Kushi
// Data source: GET /api/incidents/[id]/similar
// Fetches and displays similar historical incidents.

import { useEffect, useState } from "react";

interface SimilarIncident {
  incident_id: number;
  title: string;
  similarity_pct: number;
  root_cause: string | null;
  resolution: string | null;
}

export default function SimilarIncidents({
  incidentId,
}: {
  incidentId: number;
}) {
  const [incidents, setIncidents] = useState<SimilarIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSimilarIncidents() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/incidents/${incidentId}/similar`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch similar incidents");
        }

        const data = await response.json();

        const results: SimilarIncident[] = Array.isArray(data)
          ? data
          : data.similarIncidents ?? [];

        if (!cancelled) {
          setIncidents(
            results.filter(
              (incident) => incident.incident_id !== incidentId
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSimilarIncidents();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <section className="card">
      <h2>Similar historical incidents</h2>

      {loading && (
        <p className="muted">Finding similar incidents...</p>
      )}

      {error && (
        <p className="muted">{error}</p>
      )}

      {!loading && !error && incidents.length === 0 && (
        <p className="muted">
          No similar historical incidents found.
        </p>
      )}

      {!loading &&
        !error &&
        incidents.map((incident) => (
          <article
            key={incident.incident_id}
            className="border-b py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">
                {incident.title}
              </h3>

              <span className="text-sm font-semibold">
                {incident.similarity_pct}% match
              </span>
            </div>

            <p className="muted text-sm">
              Incident #{incident.incident_id}
            </p>

            <div className="mt-2">
              <p className="text-sm font-semibold">Root cause</p>
              <p className="muted text-sm">
                {incident.root_cause || "Not available"}
              </p>
            </div>

            <div className="mt-2">
              <p className="text-sm font-semibold">Resolution</p>
              <p className="muted text-sm">
                {incident.resolution || "Not available"}
              </p>
            </div>
          </article>
        ))}
    </section>
  );
}
