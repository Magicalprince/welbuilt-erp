import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Avatar,
  Badge,
  Skeleton,
  Select,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useFounders,
  useFounderFinances,
  useWithdrawals,
  useCreateWithdrawal,
  useRepayments,
  useCreateRepayment,
} from "@/hooks/useFirestore";
import toast from "react-hot-toast";

type LedgerEntry = {
  id: string;
  kind: "WITHDRAWAL" | "REPAYMENT";
  founderId: string;
  amount: number;
  date: Date;
  notes?: string;
};

export default function WithdrawalsPage() {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"WITHDRAW" | "REPAY">("WITHDRAW");
  const [selectedFounder, setSelectedFounder] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: founders } = useFounders();
  const { data: founderFinances, isLoading: loadingFinances } = useFounderFinances();
  const { data: withdrawals, isLoading: loadingWithdrawals } = useWithdrawals();
  const { data: repayments, isLoading: loadingRepayments } = useRepayments();
  const createWithdrawalMutation = useCreateWithdrawal();
  const createRepaymentMutation = useCreateRepayment();

  const founderOptions = useMemo(() => {
    if (!founders) return [];
    return founders.map((f) => ({ value: f.id, label: f.name }));
  }, [founders]);

  const selectedFounderBalance = useMemo(() => {
    if (!selectedFounder || !founderFinances) return 0;
    const finance = founderFinances.find((f) => f.id === selectedFounder);
    return finance?.availableBalance || 0;
  }, [selectedFounder, founderFinances]);

  // Net amount currently owed by the selected founder — the repayment cap
  const selectedFounderOwed = useMemo(() => {
    if (!selectedFounder || !founderFinances) return 0;
    const finance = founderFinances.find((f) => f.id === selectedFounder);
    return finance?.totalWithdrawals || 0;
  }, [selectedFounder, founderFinances]);

  const modalCap = modalMode === "WITHDRAW" ? selectedFounderBalance : selectedFounderOwed;

  // Merge withdrawals + repayments into one chronological ledger
  const ledger = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];
    withdrawals?.forEach((w) =>
      entries.push({
        id: w.id,
        kind: "WITHDRAWAL",
        founderId: w.founderId,
        amount: w.amount,
        date: w.createdAt,
        notes: w.notes,
      })
    );
    repayments?.forEach((r) =>
      entries.push({
        id: r.id,
        kind: "REPAYMENT",
        founderId: r.founderId,
        amount: r.amount,
        date: r.createdAt,
        notes: r.notes,
      })
    );
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [withdrawals, repayments]);

  const handleOpenModal = (mode: "WITHDRAW" | "REPAY", founderId?: string) => {
    setModalMode(mode);
    setSelectedFounder(founderId || "");
    setAmount("");
    setNotes("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedFounder || !amount || Number(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    const enteredAmount = Number(amount);
    if (enteredAmount > modalCap) {
      toast.error(
        modalMode === "WITHDRAW"
          ? "Withdrawal amount exceeds available balance"
          : "Repayment amount exceeds the outstanding withdrawn balance"
      );
      return;
    }

    try {
      if (modalMode === "WITHDRAW") {
        await createWithdrawalMutation.mutateAsync({
          founderId: selectedFounder,
          amount: enteredAmount,
          date: new Date(),
          notes: notes.trim() || undefined,
        });
        toast.success("Withdrawal recorded successfully");
      } else {
        await createRepaymentMutation.mutateAsync({
          founderId: selectedFounder,
          amount: enteredAmount,
          date: new Date(),
          notes: notes.trim() || undefined,
        });
        toast.success("Repayment recorded successfully");
      }
      setShowModal(false);
    } catch (error) {
      console.error(`Error creating ${modalMode.toLowerCase()}:`, error);
      const message = error instanceof Error ? error.message : `Failed to record ${modalMode === "WITHDRAW" ? "withdrawal" : "repayment"}`;
      toast.error(message);
    }
  };

  const isSubmitting = createWithdrawalMutation.isPending || createRepaymentMutation.isPending;

  // Loading states are checked individually in the JSX

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/finance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Founder Withdrawals</h1>
            <p className="text-muted-foreground">Record and track founder equity withdrawals and repayments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleOpenModal("REPAY")}>
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Record Repayment
          </Button>
          <Button onClick={() => handleOpenModal("WITHDRAW")}>
            <Plus className="h-4 w-4 mr-2" />
            Record Withdrawal
          </Button>
        </div>
      </div>

      {/* Founder Balances */}
      {loadingFinances ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : founderFinances && founderFinances.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {founderFinances.map((founder) => (
            <Card key={founder.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={founder.name} size="md" />
                  <div>
                    <p className="font-semibold">{founder.name}</p>
                    <Badge variant="secondary">{founder.equityPercent}%</Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Earned</span>
                    <span>{formatCurrency(founder.earnedShare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Withdrawn</span>
                    <span className="text-destructive">-{formatCurrency(founder.totalWithdrawals)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Available</span>
                    <span className="text-green-600">{formatCurrency(founder.availableBalance)}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenModal("REPAY", founder.id)}
                    disabled={founder.totalWithdrawals <= 0}
                  >
                    Repay
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenModal("WITHDRAW", founder.id)}
                  >
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No founder data available
          </CardContent>
        </Card>
      )}

      {/* Withdrawal & Repayment Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal & Repayment History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWithdrawals || loadingRepayments ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : ledger.length > 0 ? (
            <div className="space-y-3">
              {ledger.map((entry) => {
                const founder = founders?.find((f) => f.id === entry.founderId);
                const isRepayment = entry.kind === "REPAYMENT";
                return (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {isRepayment ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{founder?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(entry.date)}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${isRepayment ? "text-green-600" : ""}`}>
                        {isRepayment ? "+" : "-"}{formatCurrency(entry.amount)}
                      </p>
                      <Badge variant={isRepayment ? "success" : "secondary"}>
                        {isRepayment ? "Repayment" : "Withdrawal"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No withdrawals or repayments recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal / Repayment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === "WITHDRAW" ? "Record Withdrawal" : "Record Repayment"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Founder *</Label>
            <Select
              value={selectedFounder}
              onChange={(e) => setSelectedFounder(e.target.value)}
              options={founderOptions}
              placeholder="Select founder"
            />
            {selectedFounder && (
              <p className="text-sm text-muted-foreground">
                {modalMode === "WITHDRAW" ? (
                  <>Available balance: <span className="text-green-600 font-medium">{formatCurrency(selectedFounderBalance)}</span></>
                ) : (
                  <>Outstanding withdrawn: <span className="text-destructive font-medium">{formatCurrency(selectedFounderOwed)}</span></>
                )}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              min="0"
              max={modalCap}
              placeholder={modalMode === "WITHDRAW" ? "Enter withdrawal amount" : "Enter repayment amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFounder || !amount || Number(amount) <= 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                modalMode === "WITHDRAW" ? "Record Withdrawal" : "Record Repayment"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
