import { useState } from "react";
import { MessageSquare, ArrowRight, Pencil, Trash2, Check, X } from "lucide-react";
import { Button, Input, Label, Textarea, Modal } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface FollowUpLike {
  id: string;
  date: Date;
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
  loggedBy: string;
  createdAt: Date;
}

export interface FollowUpEditData {
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
}

interface OriginalEntry {
  date: Date;
  notes: string;
}

interface FollowUpTimelineProps {
  followUps: FollowUpLike[];
  isLoading?: boolean;
  countLabel?: string;
  amountLabel?: string;
  initialCount?: number;
  initialAmount?: number;
  originalEntry?: OriginalEntry;
  showCount?: boolean;
  onEdit?: (followUpId: string, data: FollowUpEditData) => Promise<void>;
  onDelete?: (followUpId: string) => Promise<void>;
}

export default function FollowUpTimeline({
  followUps,
  isLoading,
  countLabel = "Count",
  amountLabel = "Amount",
  initialCount,
  initialAmount,
  originalEntry,
  showCount = false,
  onEdit,
  onDelete,
}: FollowUpTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 w-full rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if ((!followUps || followUps.length === 0) && !originalEntry) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No follow-ups logged yet</p>
      </div>
    );
  }

  const sorted = [...followUps].sort((a, b) => b.date.getTime() - a.date.getTime());
  const chronological = [...sorted].reverse();
  const deleteTarget = deleteConfirmId ? followUps.find((f) => f.id === deleteConfirmId) : null;

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

        if (editingId === entry.id) {
          return (
            <EditFollowUpRow
              key={entry.id}
              entry={entry}
              showCount={showCount}
              countLabel={countLabel}
              amountLabel={amountLabel}
              onCancel={() => setEditingId(null)}
              onSave={async (data) => {
                await onEdit?.(entry.id, data);
                setEditingId(null);
              }}
            />
          );
        }

        return (
          <div key={entry.id} className="relative group">
            <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
            <div className="p-3 border rounded-lg bg-card/50 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm">{formatDate(entry.date)}</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">{entry.loggedBy || "—"}</p>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit"
                      onClick={() => setEditingId(entry.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteConfirmId(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {entry.meetingNotes || "—"}
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

      {originalEntry && (
        <div className="relative">
          <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
          <div className="p-3 border rounded-lg border-dashed bg-muted/20 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">{formatDate(originalEntry.date)}</p>
              <p className="text-xs text-muted-foreground">First contact</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{originalEntry.notes}</p>
          </div>
        </div>
      )}

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Follow-up">
        <p>Are you sure you want to delete this follow-up entry?</p>
        {deleteTarget && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{deleteTarget.meetingNotes}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={async () => {
              if (deleteConfirmId) await onDelete?.(deleteConfirmId);
              setDeleteConfirmId(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function EditFollowUpRow({
  entry,
  showCount,
  countLabel,
  amountLabel,
  onCancel,
  onSave,
}: {
  entry: FollowUpLike;
  showCount: boolean;
  countLabel: string;
  amountLabel: string;
  onCancel: () => void;
  onSave: (data: FollowUpEditData) => Promise<void>;
}) {
  const [meetingNotes, setMeetingNotes] = useState(entry.meetingNotes);
  const [count, setCount] = useState(entry.updatedCount !== undefined ? String(entry.updatedCount) : "");
  const [amount, setAmount] = useState(entry.updatedAmount !== undefined ? String(entry.updatedAmount) : "");
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    entry.nextFollowUpDate ? entry.nextFollowUpDate.toISOString().split("T")[0] : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!meetingNotes.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        meetingNotes: meetingNotes.trim(),
        updatedCount: showCount && count !== "" ? Number(count) : undefined,
        updatedAmount: amount !== "" ? Number(amount) : undefined,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
      <div className="p-3 border rounded-lg bg-card space-y-3">
        <Label className="text-xs">Meeting Notes</Label>
        <Textarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} className="min-h-[70px]" />
        <div className={showCount ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
          {showCount && (
            <div>
              <Label className="text-xs">{countLabel}</Label>
              <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs">{amountLabel}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Next Follow-up</Label>
            <Input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !meetingNotes.trim()}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
