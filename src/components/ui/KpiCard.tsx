"use client";

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;
  detail?: string;
}

export function KpiCard({ label, value, change, detail }: KpiCardProps) {
  return (
    <div className="bg-surface border border-rule-light p-4">
      <p className="text-xs uppercase tracking-wider text-ink-faint mb-1">
        {label}
      </p>
      <p className="data-number text-2xl font-semibold text-ink">{value}</p>
      {change !== undefined && (
        <p
          className={`text-sm font-medium mt-1 ${
            change >= 0 ? "text-positive" : "text-negative"
          }`}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </p>
      )}
      {detail && <p className="text-xs text-ink-faint mt-1">{detail}</p>}
    </div>
  );
}
