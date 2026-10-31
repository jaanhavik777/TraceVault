// Incident investigation page: the demo centerpiece.
// OWNER: Jaanhavi (IncidentDetail). Kushi owns the three panels, injected in the order of the design.
import IncidentDetail from "@/components/incident/IncidentDetail";
import RecentDeployments from "@/components/panels/RecentDeployments";
import DependencyPanel from "@/components/panels/DependencyPanel";
import SimilarIncidents from "@/components/panels/SimilarIncidents";

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incidentId = Number(id);

  if (!Number.isInteger(incidentId) || incidentId < 1) {
    return <main><h1>Incident not found</h1></main>;
  }

  return (
    <main>
      <IncidentDetail
        incidentId={incidentId}
        afterServices={
          <>
            <RecentDeployments incidentId={incidentId} />
            <DependencyPanel incidentId={incidentId} />
          </>
        }
        afterTimeline={<SimilarIncidents incidentId={incidentId} />}
      />
    </main>
  );
}
