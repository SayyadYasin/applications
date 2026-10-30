'use client';
import { money } from '@/lib/format';

/** Simple accessible inline-SVG bar chart. */
export function BarChart({ data, height = 140 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = Math.max(data.length * 28, 280);
  const bw = Math.min(22, (w / Math.max(data.length, 1)) * 0.7);
  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-label="Bar chart" width={w} height={height + 24} viewBox={`0 0 ${w} ${height + 24}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * height;
          const x = i * (w / data.length) + (w / data.length - bw) / 2;
          return (
            <g key={d.label + i}>
              <rect x={x} y={height - h} width={bw} height={Math.max(h, 1)} rx={3} fill="#ea580c">
                <title>{`${d.label}: ${money(d.value)}`}</title>
              </rect>
              {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && (
                <text x={x + bw / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1="0" x2={w} y1={height} y2={height} stroke="#e5e7eb" />
      </svg>
    </div>
  );
}

/** Inline-SVG line/area chart. */
export function LineChart({ data, height = 140 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length < 2) return <p className="py-6 text-center text-sm text-gray-500">Not enough data yet</p>;
  const w = 320;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [(i / (data.length - 1)) * (w - 20) + 10, height - (d.value / max) * (height - 10) + 5] as const);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg role="img" aria-label="Line chart" viewBox={`0 0 ${w} ${height + 20}`} className="w-full">
      <polygon points={`10,${height + 5} ${line} ${w - 10},${height + 5}`} fill="#fed7aa" opacity="0.5" />
      <polyline points={line} fill="none" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#ea580c">
          <title>{`${data[i].label}: ${money(data[i].value)}`}</title>
        </circle>
      ))}
      <text x="10" y={height + 18} fontSize="9" fill="#6b7280">{data[0].label}</text>
      <text x={w - 10} y={height + 18} fontSize="9" textAnchor="end" fill="#6b7280">{data[data.length - 1].label}</text>
    </svg>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>{v.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-2 rounded-full bg-brand" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
