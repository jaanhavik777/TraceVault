
"use client";

import { useEffect, useState } from "react";

type Deployment = {
  deployment_id: number;
  version: string;
  deployed_at: string;
  hours_before_incident: number;
  status: string;
};

export default function RecentDeployments({
  incidentId,
}: {
  incidentId: number;
}) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchDeployments() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/incidents/${incidentId}/context`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load deployments");
        }

        if (!cancelled) {
          setDeployments(data.deployments || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load deployments"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDeployments();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <section className="card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">Recent Deployments</h2>

      {loading && <p className="text-sm text-slate-500">Loading deployments...</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && deployments.length === 0 && (
        <p className="text-sm text-slate-500">
          No deployments found in the 7 days before this incident.
        </p>
      )}

      {!loading && !error && deployments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Version</th>
                <th className="p-3">Deployed At</th>
                <th className="p-3">Hours Before Incident</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {deployments.map((deployment) => (
                <tr key={deployment.deployment_id} className="border-t">
                  <td className="p-3 font-medium">{deployment.version}</td>
                  <td className="p-3">
                    {new Date(deployment.deployed_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {deployment.hours_before_incident} hours
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                      {deployment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
