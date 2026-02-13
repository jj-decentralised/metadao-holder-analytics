export const CHART_COLORS = {
  series: [
    "#000000", // primary black
    "#6B7280", // gray
    "#16A34A", // green
    "#DC2626", // red
    "#2563EB", // blue
    "#9333EA", // purple
    "#0891B2", // cyan
    "#CA8A04", // amber
  ],
  positive: "#16A34A",
  negative: "#DC2626",
  neutral: "#555555",
  grid: "#E5E5E5",
  axis: "#888888",
  equality: "#D4D4D4",
  background: "#FFFFFF",
  cream: "#FFFFFF",
};

export const CHART_FONTS = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'Inter', -apple-system, sans-serif",
};

export const CHART_STYLE = {
  axisTickSize: 11,
  labelSize: 12,
  titleSize: 16,
  tooltipStyle: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E4DC",
    borderRadius: "2px",
    fontFamily: CHART_FONTS.sans,
    fontSize: "12px",
    padding: "8px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
};

export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
