import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, Loader2, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Modal,
  Textarea,
  Badge,
  Skeleton,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useIncomes, useCreateIncome, useDeleteIncome, useClients, useProjects } from "@/hooks/useFirestore";
import { useAuthStore } from "@/store/authStore";
import type { IncomeCategory } from "@/types";
import toast from "react-hot-toast";

const categoryOptions: { value: IncomeCategory; label: string }[] = [
  { value: "PROJECT_PAYMENT", label: "Project Payment" },
  { value: "INTERN_PAYMENT", label: "Intern Payment" },
  { value: "TESTING_FEE", label: "Testing Fee" },
  { value: "CERTIFICATE_FEE", label: "Certificate Fee" },
  { value: "ADVANCE", label: "Advance Payment" },
  { value: "OTHER", label: "Other" },
];

const categoryColors: Record<IncomeCategory, string> = {
  PROJECT_PAYMENT: "bg-blue-500/10 text-blue-600",
  INTERN_PAYMENT: "bg-purple-500/10 text-purple-600",
  TESTING_FEE: "bg-cyan-500/10 text-cyan-600",
  CERTIFICATE_FEE: "bg-amber-500/10 text-amber-600",
  ADVANCE: "bg-teal-500/10 text-teal-600",
  OTHER: "bg-gray-500/10 text-gray-600",
};

export default function IncomePage() {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<IncomeCategory>("OTHER");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { data: incomes, isLoading } = useIncomes();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const createIncomeMutation = useCreateIncome();
  const deleteIncomeMutation = useDeleteIncome();

  const totalIncome = useMemo(() => {
    if (!incomes) return 0;
    return incomes.reduce((sum, i) => sum + i.amount, 0);
  }, [incomes]);

  const incomeByCategory = useMemo(() => {
    if (!incomes) return {};
    return incomes.reduce((acc, income) => {
      acc[income.category] = (acc[income.category] || 0) + income.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [incomes]);

  const handleOpenModal = () => {
    setDescription("");
    setAmount("");
    setCategory("OTHER");
    setNotes("");
    setClientId("");
    setProjectId("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !amount || Number(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createIncomeMutation.mutateAsync({
        description: description.trim(),
        amount: Number(amount),
        category,
        notes: notes.trim() || undefined,
        date: new Date(),
        receivedBy: user?.id || "",
        clientId: clientId || undefined,
        projectId: projectId || undefined,
      });
      toast.success("Income recorded successfully");
      setShowModal(false);
    } catch (error) {
      console.error("Error creating income:", error);
      toast.error("Failed to record income");
    }
  };

  const handleDelete = async (incomeId: string) => {
    try {
      await deleteIncomeMutation.mutateAsync(incomeId);
      toast.success("Income deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete income");
    }
  };

  const getClientName = (id?: string) => {
    if (!id || !clients) return null;
    const client = clients.find((c) => c.id === id);
    return client?.companyName;
  };

  const getProjectTitle = (id?: string) => {
    if (!id || !projects) return null;
    const project = projects.find((p) => p.id === id);
    return project?.title;
  };

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
            <h1 className="text-3xl font-bold">Income</h1>
            <p className="text-muted-foreground">Track non-invoice income (intern payments, advances, etc.)</p>
          </div>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Income
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        {Object.entries(incomeByCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat, total]) => (
            <Card key={cat}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {categoryOptions.find((c) => c.value === cat)?.label || cat}
                </p>
                <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Income List */}
      <Card>
        <CardHeader>
          <CardTitle>All Income</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : incomes && incomes.length > 0 ? (
            <div className="space-y-3">
              {incomes.map((income) => (
                <div
                  key={income.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${categoryColors[income.category]}`}>
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{income.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <Badge variant="secondary">
                          {categoryOptions.find((c) => c.value === income.category)?.label}
                        </Badge>
                        <span>• {formatDate(income.date)}</span>
                        {income.clientId && (
                          <span>• {getClientName(income.clientId)}</span>
                        )}
                        {income.projectId && (
                          <span>• {getProjectTitle(income.projectId)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-lg text-green-600">{formatCurrency(income.amount)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(income.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No income recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Add Income Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Income">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              placeholder="What was this income for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as IncomeCategory)}
                options={categoryOptions}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Client (Optional)</Label>
              <Select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                options={[
                  { value: "", label: "No client" },
                  ...(clients?.map((c) => ({ value: c.id, label: c.companyName })) || []),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Project (Optional)</Label>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[
                  { value: "", label: "No project" },
                  ...(projects?.map((p) => ({ value: p.id, label: p.title })) || []),
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!description.trim() || !amount || Number(amount) <= 0 || createIncomeMutation.isPending}
            >
              {createIncomeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Income"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Income"
      >
        <p>Are you sure you want to delete this income record? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            disabled={deleteIncomeMutation.isPending}
          >
            {deleteIncomeMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
