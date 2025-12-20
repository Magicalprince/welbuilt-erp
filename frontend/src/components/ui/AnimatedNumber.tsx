import CountUp from "react-countup";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  formatOptions?: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  };
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 2,
  className,
  formatOptions,
}: AnimatedNumberProps) {
  const formattingFn = formatOptions
    ? (value: number) =>
        new Intl.NumberFormat(formatOptions.locale || "en-IN", {
          minimumFractionDigits: formatOptions.minimumFractionDigits ?? decimals,
          maximumFractionDigits: formatOptions.maximumFractionDigits ?? decimals,
        }).format(value)
    : undefined;

  return (
    <motion.span
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <CountUp
        start={0}
        end={value}
        duration={duration}
        decimals={decimals}
        prefix={prefix}
        suffix={suffix}
        separator=","
        formattingFn={formattingFn}
      />
    </motion.span>
  );
}

// Currency specific animated number
interface AnimatedCurrencyProps {
  value: number;
  currency?: string;
  duration?: number;
  className?: string;
}

export function AnimatedCurrency({
  value,
  currency = "₹",
  duration = 2,
  className,
}: AnimatedCurrencyProps) {
  return (
    <motion.span
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <CountUp
        start={0}
        end={value}
        duration={duration}
        decimals={value % 1 !== 0 ? 2 : 0}
        prefix={currency}
        separator=","
        formattingFn={(n) =>
          `${currency}${new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
            maximumFractionDigits: 2,
          }).format(n)}`
        }
      />
    </motion.span>
  );
}

// Percentage animated number
interface AnimatedPercentageProps {
  value: number;
  duration?: number;
  className?: string;
  showSign?: boolean;
}

export function AnimatedPercentage({
  value,
  duration = 1.5,
  className,
  showSign = false,
}: AnimatedPercentageProps) {
  const sign = showSign && value > 0 ? "+" : "";

  return (
    <motion.span
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <CountUp
        start={0}
        end={value}
        duration={duration}
        decimals={1}
        prefix={sign}
        suffix="%"
      />
    </motion.span>
  );
}

// Stat card with animated number
interface AnimatedStatProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function AnimatedStat({
  label,
  value,
  prefix = "",
  suffix = "",
  trend,
  icon,
  className,
}: AnimatedStatProps) {
  return (
    <motion.div
      className={cn("space-y-2", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>

      <div className="flex items-end gap-2">
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          className="text-2xl font-bold"
        />

        {trend && (
          <motion.span
            className={cn(
              "text-sm font-medium pb-0.5",
              trend.isPositive ? "text-green-500" : "text-red-500"
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

export default AnimatedNumber;
