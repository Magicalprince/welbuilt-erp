import { useEffect, useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import toast from "react-hot-toast";

export interface AddFollowUpFormData {
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
}

interface AddFollowUpFormProps {
  entityId: string;
  showCount?: boolean;
  countLabel?: string;
  amountLabel?: string;
  currentCount?: number;
  currentAmount?: number;
  onSubmit: (data: AddFollowUpFormData) => Promise<void>;
}

export default function AddFollowUpForm({
  entityId,
  showCount = false,
  countLabel = "Count",
  amountLabel = "Amount",
  currentCount,
  currentAmount,
  onSubmit,
}: AddFollowUpFormProps) {
  const [meetingNotes, setMeetingNotes] = useState("");
  const [count, setCount] = useState(currentCount !== undefined ? String(currentCount) : "");
  const [amount, setAmount] = useState(currentAmount !== undefined ? String(currentAmount) : "");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCount(currentCount !== undefined ? String(currentCount) : "");
    setAmount(currentAmount !== undefined ? String(currentAmount) : "");
  }, [entityId, currentCount, currentAmount]);

  const handleSubmit = async () => {
    if (!meetingNotes.trim()) {
      toast.error("Please enter meeting notes");
      return;
    }

    const updatedCount = showCount && count !== "" ? Number(count) : undefined;
    const updatedAmount = amount !== "" ? Number(amount) : undefined;

    setIsSubmitting(true);
    try {
      await onSubmit({
        meetingNotes: meetingNotes.trim(),
        updatedCount,
        updatedAmount,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      });
      setMeetingNotes("");
      setNextFollowUpDate("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
      <div>
        <Label>Meeting Notes *</Label>
        <Textarea
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          placeholder="What was discussed in this follow-up?"
          className="min-h-[80px]"
        />
      </div>

      <div className={showCount ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        {showCount && (
          <div>
            <Label>{countLabel}</Label>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Optional"
            />
          </div>
        )}
        <div>
          <Label>{amountLabel}</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label>Next Follow-up</Label>
          <Input
            type="date"
            value={nextFollowUpDate}
            onChange={(e) => setNextFollowUpDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Logging..." : "Log Follow-up"}
        </Button>
      </div>
    </div>
  );
}
