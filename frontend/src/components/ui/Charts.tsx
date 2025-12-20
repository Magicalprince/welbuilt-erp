import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { ChartColors, CHART_PALETTE } from "@/lib/chartColors";

// Local alias for backward compatibility
const COLORS = ChartColors;
const CHART_COLORS = CHART_PALETTE;

// Custom tooltip props
interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

// Custom tooltip component
function CustomTooltip({ active, payload, label, valueFormatter }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-card rounded-lg p-3 shadow-lg border border-border/50">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: TooltipPayloadEntry, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

// ============================================
// AREA CHART - Revenue Trends
// ============================================
interface AreaChartData {
  name: string;
  value: number;
  value2?: number;
}

interface RevenueAreaChartProps {
  data: AreaChartData[];
  height?: number;
  showGrid?: boolean;
  className?: string;
  gradientId?: string;
}

export function RevenueAreaChart({
  data,
  height = 300,
  showGrid = true,
  className,
  gradientId = "colorRevenue",
}: RevenueAreaChartProps) {
  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.gold}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            name="Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ============================================
// COMPARISON AREA CHART - Income vs Expenses
// ============================================
interface ComparisonAreaChartProps {
  data: Array<{ name: string; income: number; expenses: number }>;
  height?: number;
  className?: string;
}

export function ComparisonAreaChart({ data, height = 300, className }: ComparisonAreaChartProps) {
  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="income"
            stroke={COLORS.success}
            strokeWidth={2}
            fill="url(#colorIncome)"
            name="Income"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke={COLORS.danger}
            strokeWidth={2}
            fill="url(#colorExpenses)"
            name="Expenses"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ============================================
// DONUT CHART - Category Breakdown
// ============================================
interface DonutChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

interface DonutChartProps {
  data: DonutChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

export function DonutChart({
  data,
  height = 250,
  innerRadius = 60,
  outerRadius = 90,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  return (
    <motion.div
      className={cn("w-full relative", className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="glass-card rounded-lg p-3 shadow-lg">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.value)} ({((item.value / total) * 100).toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-2xl font-bold text-foreground">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-sm text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// BAR CHART - Monthly Comparison
// ============================================
interface BarChartData {
  name: string;
  value: number;
  value2?: number;
}

interface MonthlyBarChartProps {
  data: BarChartData[];
  height?: number;
  className?: string;
  barColors?: [string, string?];
}

export function MonthlyBarChart({
  data,
  height = 300,
  className,
  barColors = [COLORS.gold, COLORS.slate],
}: MonthlyBarChartProps) {
  const hasSecondValue = data.some((d) => d.value2 !== undefined);

  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
          {hasSecondValue && <Legend />}
          <Bar
            dataKey="value"
            fill={barColors[0]}
            radius={[4, 4, 0, 0]}
            name="Income"
            animationDuration={1000}
          />
          {hasSecondValue && (
            <Bar
              dataKey="value2"
              fill={barColors[1]}
              radius={[4, 4, 0, 0]}
              name="Expenses"
              animationDuration={1000}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ============================================
// HORIZONTAL BAR CHART - Founder Equity
// ============================================
interface HorizontalBarData {
  name: string;
  value: number;
  value2?: number;
  total?: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarData[];
  height?: number;
  className?: string;
}

export function HorizontalBarChart({ data, height = 200, className }: HorizontalBarChartProps) {
  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
          <Legend />
          <Bar
            dataKey="value"
            fill={COLORS.success}
            radius={[0, 4, 4, 0]}
            name="Available"
            stackId="a"
            animationDuration={1000}
          />
          <Bar
            dataKey="value2"
            fill={COLORS.slate}
            radius={[0, 4, 4, 0]}
            name="Withdrawn"
            stackId="a"
            animationDuration={1000}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ============================================
// SPARKLINE - Mini trend for stat cards
// ============================================
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = COLORS.gold,
  height = 40,
  width = 100,
  className,
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <motion.div
      className={cn("", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData}>
          <defs>
            <linearGradient id={`sparkline-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={1500}
          />
          <Area
            type="monotone"
            dataKey="value"
            fill={`url(#sparkline-${color.replace("#", "")})`}
            stroke="transparent"
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ============================================
// LEGEND COMPONENT
// ============================================
interface ChartLegendProps {
  items: Array<{ name: string; color: string; value?: string }>;
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-muted-foreground">{item.name}</span>
          {item.value && (
            <span className="text-sm font-medium">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

