
type TrendItem = {
  week_start: string;
  incidents: number;
};

export default function WeeklyTrendChart({
  data,
}: {
  data: TrendItem[];
}) {
  const width = 700;
  const height = 220;
  const padding = 35;

  const maxCount = Math.max(1, ...data.map((item) => item.incidents));

  const points = data.map((item, index) => ({
    x: padding +
      (index * (width - padding * 2)) / Math.max(data.length - 1, 1),
    y: height - padding -
      (item.incidents / maxCount) * (height - padding * 2),
    item,
  }));

  const path = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  return (
    <section className="card">
      <h2>Weekly Incident Trend</h2>
      <p className="muted">
        Number of incidents reported each week.
      </p>

      {data.length === 0 ? (
        <p className="muted">No weekly trend data available.</p>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", minWidth: 450, marginTop: 16 }}
            role="img"
            aria-label="Weekly incident trend line chart"
          >
            {[0, 1, 2, 3].map((step) => {
              const y = padding +
                (step * (height - padding * 2)) / 3;

              return (
                <line
                  key={step}
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#d1d5db"
                  strokeDasharray="4 4"
                />
              );
            })}

            <path
              d={path}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {points.map((point) => (
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
                  y={height - 8}
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
  );
}
