// OWNER: Kushi. Data source: GET /api/incidents/[id]/context -> deployments
// CONTRACT: renders itself given only incidentId (fetches its own data).
export default function RecentDeployments({ incidentId }: { incidentId: number }) {
  return (
    <section className="card">
      <h2>Recent deployments</h2>
      <p className="muted">TODO(Kushi): implement for incident #{incidentId}.</p>
    </section>
  );
}
