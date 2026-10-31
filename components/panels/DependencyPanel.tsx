
"use client";

import { useEffect, useState } from "react";

type ServiceDependency = {
  service_id: number;
  service_name: string;
};

type DependencyData = {
  upstream: ServiceDependency[];
  downstream: ServiceDependency[];
};

export default function DependencyPanel({
  incidentId,
}: {
  incidentId: number;
}) {
  const [dependencies, setDependencies] = useState<DependencyData>({
    upstream: [],
    downstream: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchDependencies() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/incidents/${incidentId}/context`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load dependencies");
        }

        if (!cancelled) {
          setDependencies({
            upstream: data.dependencies?.upstream || [],
            downstream: data.dependencies?.downstream || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load dependencies"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDependencies();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <section className="card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-lg font-bold">Service Dependencies</h2>

      {loading && (
        <p className="text-sm text-slate-500">Loading dependencies...</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && (
        <div className="grid gap-6 md:grid-cols-2">

          {/* Upstream Services */}
          <div>
            <h3 className="mb-3 font-semibold text-indigo-700">
              Upstream Services
            </h3>

            <p className="mb-3 text-xs text-slate-500">
              Services that this incident's services depend on.
            </p>

            {dependencies.upstream.length === 0 ? (
              <p className="text-sm text-slate-500">
                No upstream dependencies found.
              </p>
            ) : (
              <ul className="space-y-2">
                {dependencies.upstream.map((service) => (
                  <li
                    key={service.service_id}
                    className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm"
                  >
                    <span className="font-medium">
                      {service.service_name}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      ID: {service.service_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Downstream Services */}
          <div>
            <h3 className="mb-3 font-semibold text-emerald-700">
              Downstream Services
            </h3>

            <p className="mb-3 text-xs text-slate-500">
              Services that depend on this incident's services.
            </p>

            {dependencies.downstream.length === 0 ? (
              <p className="text-sm text-slate-500">
                No downstream dependencies found.
              </p>
            ) : (
              <ul className="space-y-2">
                {dependencies.downstream.map((service) => (
                  <li
                    key={service.service_id}
                    className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm"
                  >
                    <span className="font-medium">
                      {service.service_name}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      ID: {service.service_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
