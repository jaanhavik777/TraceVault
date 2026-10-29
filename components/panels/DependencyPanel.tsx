// OWNER: Kushi. Data source: GET /api/incidents/[id]/context -> dependencies
// CONTRACT: renders itself given only incidentId (fetches its own data).
export default function DependencyPanel({ incidentId }: { incidentId: number }) {
  return (
    <section className="card">
      <h2>Dependencies</h2>
      <p className="muted">TODO(Kushi): implement for incident #{incidentId}.</p>
    </section>
  );
}
