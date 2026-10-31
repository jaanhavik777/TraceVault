
type SeverityItem = {
  severity: string;
  count: number;
};

const severityColors: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

export default function SeverityChart({
  data,
}: {
  data: SeverityItem[];
}) {
  const maxCount = Math.max(1, ...data.map((item) => item.count));

  return (
    <section className="card">
      <h2>Incidents by Severity</h2>
      <p className="muted">
        Distribution of incidents across severity levels.
      </p>

      <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
        {data.map((item) => (
          <div key={item.severity}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}>
              <strong>{item.severity}</strong>
              <span>
                {item.count} {item.count === 1 ? "incident" : "incidents"}
              </span>
            </div>

            <div style={{
              height: 13,
              background: "#e5e7eb",
              borderRadius: 20,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${(item.count / maxCount) * 100}%`,
                height: "100%",
                background: severityColors[item.severity] || "#64748b",
                borderRadius: 20,
              }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
