"use client";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  source?: string;
  updatedAt?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({
  title,
  subtitle,
  source,
  updatedAt,
  children,
  className = "",
}: ChartContainerProps) {
  return (
    <div className={`bg-surface border border-rule-light p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="font-serif text-xl font-semibold text-ink leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>

      <div className="w-full">{children}</div>

      {(source || updatedAt) && (
        <div className="mt-3 flex items-center justify-between border-t border-rule-light pt-2">
          {source && (
            <span className="text-xs text-ink-faint">Source: {source}</span>
          )}
          {updatedAt && (
            <span className="text-xs text-ink-faint">
              Updated {updatedAt}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
