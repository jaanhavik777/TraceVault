// OWNER: Kushi. Data source: GET /api/incidents/[id]/similar
// CONTRACT: renders itself given only incidentId (fetches its own data).
export default function SimilarIncidents({ incidentId }: { incidentId: number }) {
  return (
    <section className="card">
      <h2>Similar historical incidents</h2>
      <p className="muted">TODO(Kushi): implement for incident #{incidentId}.</p>
    </section>
  );
}
