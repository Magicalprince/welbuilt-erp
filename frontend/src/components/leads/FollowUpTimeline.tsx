import { MessageSquare, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface FollowUpLike {
  id: string;
  date: Date;
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
  loggedBy: string;
  createdAt: Date;
}

interface FollowUpTimelineProps {
  followUps: FollowUpLike[];
  isLoading?: boolean;
  countLabel?: string;
  amountLabel?: string;
  initialCount?: number;
  initialAmount?: number;
}

export default function FollowUpTimeline({
  followUps,
  isLoading,
  countLabel = "Count",
  amountLabel = "Amount",
  initialCount,
  initialAmount,
}: FollowUpTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 w-full rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!followUps || followUps.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No follow-ups logged yet</p>
      </div>
    );
  }

  const sorted = [...followUps].sort((a, b) => b.date.getTime() - a.date.getTime());
  const chronological = [...sorted].reverse();

  return (
    <div className="relative pl-6 space-y-5 border-l border-border/60">
      {sorted.map((entry) => {
        const chronoIndex = chronological.findIndex((e) => e.id === entry.id);
        const previous = chronoIndex > 0 ? chronological[chronoIndex - 1] : undefined;
        const prevCount = previous?.updatedCount ?? initialCount;
        const prevAmount = previous?.updatedAmount ?? initialAmount;

        const countChanged =
          entry.updatedCount !== undefined && entry.updatedCount !== prevCount;
        const amountChanged =
          entry.updatedAmount !== undefined && entry.updatedAmount !== prevAmount;

        return (
          <div key={entry.id} className="relative">
            <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
            <div className="p-3 border rounded-lg bg-card/50 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm">{formatDate(entry.date)}</p>
                <p className="text-xs text-muted-foreground">{entry.loggedBy || "—"}</p>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {entry.meetingNotes}
              </p>

              {(countChanged || amountChanged) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {countChanged && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {countLabel}: {prevCount ?? "—"}
                      <ArrowRight className="h-3 w-3" />
                      {entry.updatedCount}
                    </span>
                  )}
                  {amountChanged && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                      {amountLabel}: {prevAmount !== undefined ? formatCurrency(prevAmount) : "—"}
                      <ArrowRight className="h-3 w-3" />
                      {formatCurrency(entry.updatedAmount!)}
                    </span>
                  )}
                </div>
              )}

              {entry.nextFollowUpDate && (
                <p className="text-xs text-muted-foreground pt-1">
                  Next follow-up: <span className="font-medium">{formatDate(entry.nextFollowUpDate)}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
