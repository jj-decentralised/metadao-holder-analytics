export const CHART_COLORS = {
  series: [
    "#0080C6", // WSJ blue
    "#E6553A", // warm red
    "#26A65B", // positive green
    "#F5A623", // amber
    "#7B68EE", // medium purple
    "#E91E90", // hot pink
    "#00BCD4", // cyan
    "#8D6E63", // brown
  ],
  positive: "#26A65B",
  negative: "#CC0000",
  neutral: "#666666",
  grid: "#E8E4DC",
  axis: "#999999",
  equality: "#D4D0C8", // For Lorenz curve equality line
  background: "#FFFFFF",
  cream: "#FBF7F0",
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
