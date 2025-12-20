import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, Loader2 } from "lucide-react";
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
} from "@/hooks/useFirestore";
import toast from "react-hot-toast";

export default function WithdrawalsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedFounder, setSelectedFounder] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: founders } = useFounders();
  const { data: founderFinances, isLoading: loadingFinances } = useFounderFinances();
  const { data: withdrawals, isLoading: loadingWithdrawals } = useWithdrawals();
  const createWithdrawalMutation = useCreateWithdrawal();

  const founderOptions = useMemo(() => {
    if (!founders) return [];
    return founders.map((f) => ({ value: f.id, label: f.name }));
  }, [founders]);

  const selectedFounderBalance = useMemo(() => {
    if (!selectedFounder || !founderFinances) return 0;
    const finance = founderFinances.find((f) => f.id === selectedFounder);
    return finance?.availableBalance || 0;
  }, [selectedFounder, founderFinances]);

  const handleOpenModal = () => {
    setSelectedFounder("");
    setAmount("");
    setNotes("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedFounder || !amount || Number(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    const withdrawalAmount = Number(amount);
    if (withdrawalAmount > selectedFounderBalance) {
      toast.error("Withdrawal amount exceeds available balance");
      return;
    }

    try {
      await createWithdrawalMutation.mutateAsync({
        founderId: selectedFounder,
        amount: withdrawalAmount,
        date: new Date(),
        notes: notes.trim() || undefined,
      });
      toast.success("Withdrawal recorded successfully");
      setShowModal(false);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      toast.error("Failed to record withdrawal");
    }
  };

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
            <p className="text-muted-foreground">Record and track founder equity withdrawals</p>
          </div>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="h-4 w-4 mr-2" />
          Record Withdrawal
        </Button>
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
                    <span className="text-muted-foreground">Withdrawn</span>
                    <span className="text-destructive">-{formatCurrency(founder.totalWithdrawals)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Available</span>
                    <span className="text-green-600">{formatCurrency(founder.availableBalance)}</span>
                  </div>
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

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWithdrawals ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : withdrawals && withdrawals.length > 0 ? (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => {
                const founder = founders?.find((f) => f.id === withdrawal.founderId);
                return (
                  <div
                    key={withdrawal.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{founder?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(withdrawal.createdAt)}
                        </p>
                        {withdrawal.notes && (
                          <p className="text-sm text-muted-foreground">{withdrawal.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{formatCurrency(withdrawal.amount)}</p>
                      <Badge variant={withdrawal.status === "APPROVED" ? "success" : withdrawal.status === "REJECTED" ? "destructive" : "secondary"}>
                        {withdrawal.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No withdrawals recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Withdrawal">
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
                Available balance: <span className="text-green-600 font-medium">{formatCurrency(selectedFounderBalance)}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              min="0"
              max={selectedFounderBalance}
              placeholder="Enter withdrawal amount"
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
              disabled={!selectedFounder || !amount || Number(amount) <= 0 || createWithdrawalMutation.isPending}
            >
              {createWithdrawalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Withdrawal"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
