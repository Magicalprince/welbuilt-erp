import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import { ChartColors } from "@/lib/chartColors";
import type { MonthlyFinancialPoint } from "@/hooks/useFinancialHistory";

const MONTH_WIDTH = 90;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function ExpandedTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 shadow-lg border border-border/50">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
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

  const chartWidth = Math.max(data.length * MONTH_WIDTH, 400);

  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const viewportWidth = viewportRef.current.offsetWidth;
    const viewportHeight = viewportRef.current.offsetHeight;
    setViewportSize({ width: viewportWidth, height: viewportHeight });
    const overflow = Math.max(chartWidth - viewportWidth, 0);
    setDragLimits({ left: -overflow, right: 0 });
    // Start scrolled to the right edge (most recent months) each time it opens
    x.set(-overflow);
  }, [isOpen, chartWidth, x]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full h-full max-w-6xl rounded-xl bg-background shadow-2xl border flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b p-4 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">Income vs Expenses — Full History</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Drag or swipe left/right to browse past months
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden relative cursor-grab active:cursor-grabbing">
                <motion.div
                  drag="x"
                  dragConstraints={{ left: dragLimits.left, right: dragLimits.right }}
                  dragElastic={0.05}
                  dragMomentum={true}
                  style={{ x, width: chartWidth }}
                  className={cn("h-full py-4")}
                >
                  <AreaChart
                    width={chartWidth}
                    height={Math.max(viewportSize.height - 32, 200)}
                    data={data}
                    margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="expandedColorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ChartColors.success} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ChartColors.success} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expandedColorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ChartColors.danger} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ChartColors.danger} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<ExpandedTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke={ChartColors.success}
                      strokeWidth={2}
                      fill="url(#expandedColorIncome)"
                      name="Income"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke={ChartColors.danger}
                      strokeWidth={2}
                      fill="url(#expandedColorExpenses)"
                      name="Expenses"
                    />
                  </AreaChart>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
