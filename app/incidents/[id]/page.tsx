// Incident investigation page: the demo centerpiece.
// OWNER: Jaanhavi (page shell, header, timeline, resolution form)
// Kushi provides the three panels below; they are already wired in as stubs.
import RecentDeployments from "@/components/panels/RecentDeployments";
import DependencyPanel from "@/components/panels/DependencyPanel";
import SimilarIncidents from "@/components/panels/SimilarIncidents";

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incidentId = Number(id);

  return (
    <main>
      <h1>Incident #{incidentId}</h1>
      <p className="muted">TODO(Jaanhavi): header (title, severity, status), assignment, timeline, resolution form.</p>

      <RecentDeployments incidentId={incidentId} />
      <DependencyPanel incidentId={incidentId} />
      <SimilarIncidents incidentId={incidentId} />
    </main>
  );
}
