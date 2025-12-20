import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
  showLabel?: boolean;
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  showLabel = false,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full">
      <div
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
      >
        <div
          className={cn(
            "h-full bg-primary transition-all duration-500 ease-out",
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
}
