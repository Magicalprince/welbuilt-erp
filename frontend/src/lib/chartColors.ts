// Brand colors for charts
export const ChartColors = {
  gold: "#F5A623",
  slate: "#2D4A5E",
  beige: "#D4C5A9",
  success: "#22C55E",
  danger: "#EF4444",
  info: "#3B82F6",
} as const;

export const CHART_PALETTE = [
  ChartColors.gold,
  ChartColors.slate,
  ChartColors.beige,
  ChartColors.success,
  ChartColors.info,
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
] as const;

export type ChartColor = keyof typeof ChartColors;
