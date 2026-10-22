import { X } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { EMPTY_DATE_RANGE, type DateRange } from "@/lib/utils";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const hasValue = value.from || value.to;

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <Input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        max={value.to || undefined}
        aria-label="From date"
        className="w-auto"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        min={value.from || undefined}
        aria-label="To date"
        className="w-auto"
      />
      {hasValue && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => onChange(EMPTY_DATE_RANGE)}
          aria-label="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
