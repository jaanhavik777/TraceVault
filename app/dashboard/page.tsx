
"use client";

import { useEffect, useState } from "react";
import SeverityChart from "@/components/charts/SeverityChart";
import WeeklyTrendChart from "@/components/charts/WeeklyTrendChart";

type DashboardData = {
  kpis: {
    open: number;
    critical: number;
    resolved: number;
    avg_resolution_min: number;
  };
  byService: {
    service_name: string;
    incident_count: number;
    critical_count: number;
  }[];
  bySeverity: {
    severity: string;
    count: number;
  }[];
  trend: {
    week_start: string;
    incidents: number;
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load dashboard");
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main>
        <p className="muted">Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main>
        <p className="muted">No dashboard data available.</p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 24 }}>
      {/* Dashboard Header */}
      <header>
        <p className="muted">TraceVault Analytics</p>
        <h1>Incident Dashboard</h1>
        <p className="muted">
          Monitor incident performance, severity and weekly trends.
        </p>
      </header>

      {/* KPI Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 16,
        }}
      >
        {[
          {
            label: "Open Incidents",
            value: data.kpis.open,
            color: "#2563eb",
          },
          {
            label: "Critical Incidents",
            value: data.kpis.critical,
            color: "#dc2626",
          },
          {
            label: "Resolved Incidents",
            value: data.kpis.resolved,
            color: "#16a34a",
          },
          {
            label: "Avg. Resolution Time",
            value: `${data.kpis.avg_resolution_min} min`,
            color: "#7c3aed",
          },
        ].map((kpi) => (
          <section
            key={kpi.label}
            className="card"
            style={{ borderTop: `4px solid ${kpi.color}` }}
          >
            <p className="muted">{kpi.label}</p>
            <h2
              style={{
                fontSize: 30,
                margin: "8px 0",
                color: kpi.color,
              }}
            >
              {kpi.value}
            </h2>
          </section>
        ))}
      </section>

      {/* Incidents by Service */}
      <section className="card" style={{ overflowX: "auto" }}>
        <h2>Incidents by Service</h2>
        <p className="muted">
          Incident distribution across registered services.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Total Incidents</th>
              <th>Critical Incidents</th>
            </tr>
          </thead>

          <tbody>
            {data.byService.map((service) => (
              <tr key={service.service_name}>
                <td>{service.service_name}</td>
                <td>{service.incident_count}</td>
                <td>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>
                    {service.critical_count}
                  </span>
                </td>
              </tr>
            ))}

            {data.byService.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No service statistics available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Reusable Severity Chart */}
      <SeverityChart data={data.bySeverity} />

      {/* Reusable Weekly Trend Chart */}
      <WeeklyTrendChart data={data.trend} />
    </main>
  );
}
