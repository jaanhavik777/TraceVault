
"use client";

import { useEffect, useState } from "react";

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

const severityColors: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
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
    return <main><p className="muted">Loading dashboard...</p></main>;
  }

  if (error) {
    return <main><p className="error">{error}</p></main>;
  }

  if (!data) {
    return <main><p className="muted">No dashboard data available.</p></main>;
  }

  const maxSeverity = Math.max(
    1,
    ...data.bySeverity.map((item) => item.count)
  );

  const maxTrend = Math.max(
    1,
    ...data.trend.map((item) => item.incidents)
  );

  const chartWidth = 700;
  const chartHeight = 220;
  const chartPadding = 35;

  const chartPoints = data.trend.map((item, index) => {
    const x =
      chartPadding +
      (index * (chartWidth - chartPadding * 2)) /
        Math.max(data.trend.length - 1, 1);

    const y =
      chartHeight -
      chartPadding -
      (item.incidents / maxTrend) *
        (chartHeight - chartPadding * 2);

    return { x, y, item };
  });

  const trendPath = chartPoints
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  return (
    <main style={{ display: "grid", gap: 24 }}>
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
            <h2 style={{ fontSize: 30, margin: "8px 0", color: kpi.color }}>
              {kpi.value}
            </h2>
          </section>
        ))}
      </section>

      {/* Service Table */}
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

      {/* Severity Distribution */}
      <section className="card">
        <h2>Incidents by Severity</h2>
        <p className="muted">
          Distribution of incidents across severity levels.
        </p>

        <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
          {data.bySeverity.map((item) => (
            <div key={item.severity}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <strong>{item.severity}</strong>
                <span>{item.count} incidents</span>
              </div>

              <div
                style={{
                  height: 13,
                  background: "#e5e7eb",
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(item.count / maxSeverity) * 100}%`,
                    height: "100%",
                    background: severityColors[item.severity] || "#64748b",
                    borderRadius: 20,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Trend */}
      <section className="card">
        <h2>Weekly Incident Trend</h2>
        <p className="muted">
          Number of incidents reported each week.
        </p>

        {data.trend.length === 0 ? (
          <p className="muted">No weekly trend data available.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: "100%", minWidth: 450, marginTop: 16 }}
              role="img"
              aria-label="Weekly incident trend line chart"
            >
              {[0, 1, 2, 3].map((step) => {
                const y =
                  chartPadding +
                  (step * (chartHeight - chartPadding * 2)) / 3;

                return (
                  <line
                    key={step}
                    x1={chartPadding}
                    y1={y}
                    x2={chartWidth - chartPadding}
                    y2={y}
                    stroke="#d1d5db"
                    strokeDasharray="4 4"
                  />
                );
              })}

              <path
                d={trendPath}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {chartPoints.map((point) => (
                <g key={point.item.week_start}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill="#4f46e5"
                  />
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fill="currentColor"
                  >
                    {point.item.incidents}
                  </text>
                  <text
                    x={point.x}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                  >
                    {point.item.week_start.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </section>
    </main>
  );
}
