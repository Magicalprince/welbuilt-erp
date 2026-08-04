import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { X, TrendingUp, TrendingDown, Move } from "lucide-react";
import { Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { ChartColors } from "@/lib/chartColors";
import type { MonthlyFinancialPoint } from "@/hooks/useFinancialHistory";

const MONTH_WIDTH = 110;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function ExpandedTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.name === "Income")?.value ?? 0;
  const expenses = payload.find((p) => p.name === "Expenses")?.value ?? 0;
  const net = income - expenses;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-2xl min-w-[180px]">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ChartColors.success }} />
            Income
          </span>
          <span className="text-sm font-semibold text-white">{formatCurrency(income)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ChartColors.danger }} />
            Expenses
          </span>
          <span className="text-sm font-semibold text-white">{formatCurrency(expenses)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/10">
          <span className="text-sm text-white/70">Net</span>
          <span className={`text-sm font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {net >= 0 ? "+" : ""}
            {formatCurrency(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ExpandedChartOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlyFinancialPoint[];
}

export default function ExpandedChartOverlay({ isOpen, onClose, data }: ExpandedChartOverlayProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [dragLimits, setDragLimits] = useState({ left: 0, right: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 400 });
  const [hasDragHint, setHasDragHint] = useState(true);

  const chartWidth = Math.max(data.length * MONTH_WIDTH, 400);
  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
  })();

  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const viewportWidth = viewportRef.current.offsetWidth;
    const viewportHeight = viewportRef.current.offsetHeight;
    setViewportSize({ width: viewportWidth, height: viewportHeight });
    const overflow = Math.max(chartWidth - viewportWidth, 0);
    setDragLimits({ left: -overflow, right: 0 });
    // Start scrolled to the right edge (most recent months) each time it opens
    x.set(-overflow);
    setHasDragHint(overflow > 0);
  }, [isOpen, chartWidth, x]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const totals = data.reduce(
    (acc, p) => ({ income: acc.income + p.income, expenses: acc.expenses + p.expenses }),
    { income: 0, expenses: 0 }
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="relative w-full h-full max-w-6xl rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10 flex flex-col overflow-hidden outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 shrink-0 bg-gradient-to-b from-white/[0.03] to-transparent">
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">Income vs Expenses</h2>
                  <p className="text-sm text-white/50 mt-0.5 flex items-center gap-1.5">
                    <Move className="h-3.5 w-3.5" />
                    Drag to explore your full financial history
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Total Income</p>
                      <p className="text-sm font-bold text-emerald-400 flex items-center gap-1 justify-end">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {formatCurrency(totals.income)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Total Expenses</p>
                      <p className="text-sm font-bold text-red-400 flex items-center gap-1 justify-end">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {formatCurrency(totals.expenses)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 rounded-full text-white/60 hover:text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Chart viewport */}
              <div
                ref={viewportRef}
                className="flex-1 min-h-0 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
              >
                {/* Fade edges so the pan feels like an infinite canvas */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10 bg-gradient-to-r from-slate-900 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10 bg-gradient-to-l from-slate-900 to-transparent" />

                <motion.div
                  drag="x"
                  dragConstraints={{ left: dragLimits.left, right: dragLimits.right }}
                  dragElastic={0.06}
                  dragMomentum={true}
                  dragTransition={{ power: 0.25, timeConstant: 200 }}
                  onDragStart={() => setHasDragHint(false)}
                  style={{ x, width: chartWidth }}
                  className="h-full py-6 outline-none"
                  tabIndex={-1}
                >
                  <AreaChart
                    width={chartWidth}
                    height={Math.max(viewportSize.height - 48, 200)}
                    data={data}
                    margin={{ top: 10, right: 32, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="expandedColorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ChartColors.success} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ChartColors.success} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expandedColorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ChartColors.danger} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={ChartColors.danger} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="0"
                      stroke="rgba(255,255,255,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 500 }}
                      interval={0}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip
                      content={<ExpandedTooltip />}
                      cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                    />
                    {data.some((p) => p.key === currentMonthKey) && (
                      <ReferenceLine
                        x={data.find((p) => p.key === currentMonthKey)?.name}
                        stroke={ChartColors.gold}
                        strokeOpacity={0.4}
                        strokeDasharray="4 4"
                      />
                    )}
                    <Area
                      type="natural"
                      dataKey="income"
                      stroke={ChartColors.success}
                      strokeWidth={2.5}
                      fill="url(#expandedColorIncome)"
                      name="Income"
                      dot={{ r: 3, fill: ChartColors.success, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#0f172a" }}
                    />
                    <Area
                      type="natural"
                      dataKey="expenses"
                      stroke={ChartColors.danger}
                      strokeWidth={2.5}
                      fill="url(#expandedColorExpenses)"
                      name="Expenses"
                      dot={{ r: 3, fill: ChartColors.danger, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#0f172a" }}
                    />
                  </AreaChart>
                </motion.div>

                <AnimatePresence>
                  {hasDragHint && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-xs font-medium text-white/70"
                    >
                      <motion.div
                        animate={{ x: [-4, 4, -4] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Move className="h-3.5 w-3.5" />
                      </motion.div>
                      Drag to view older months
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 border-t border-white/10 px-6 py-3 shrink-0 bg-gradient-to-t from-white/[0.03] to-transparent">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ChartColors.success }} />
                  <span className="text-xs font-medium text-white/60">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ChartColors.danger }} />
                  <span className="text-xs font-medium text-white/60">Expenses</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
