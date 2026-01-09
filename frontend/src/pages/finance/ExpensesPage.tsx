import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Receipt, Loader2, Trash2 } from "lucide-react";
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
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/useFirestore";
import { useAuthStore } from "@/store/authStore";
import type { ExpenseCategory } from "@/types";
import toast from "react-hot-toast";

const categoryOptions: { value: ExpenseCategory; label: string }[] = [
  { value: "TOOLS", label: "Software & Tools" },
  { value: "HOSTING", label: "Hosting & Infrastructure" },
  { value: "APIS", label: "APIs & Services" },
  { value: "MARKETING", label: "Marketing" },
  { value: "TRAVEL", label: "Travel" },
  { value: "OFFICE", label: "Office Supplies" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "SALARIES", label: "Salaries" },
  { value: "FOUNDER_WITHDRAWAL", label: "Founder Withdrawal" },
  { value: "OTHER", label: "Other" },
];

const categoryColors: Record<ExpenseCategory, string> = {
  TOOLS: "bg-blue-500/10 text-blue-600",
  HOSTING: "bg-purple-500/10 text-purple-600",
  APIS: "bg-cyan-500/10 text-cyan-600",
  MARKETING: "bg-pink-500/10 text-pink-600",
  TRAVEL: "bg-orange-500/10 text-orange-600",
  OFFICE: "bg-yellow-500/10 text-yellow-600",
  UTILITIES: "bg-emerald-500/10 text-emerald-600",
  SALARIES: "bg-indigo-500/10 text-indigo-600",
  FOUNDER_WITHDRAWAL: "bg-red-500/10 text-red-600",
  OTHER: "bg-gray-500/10 text-gray-600",
};

export default function ExpensesPage() {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [notes, setNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { data: expenses, isLoading } = useExpenses();
  const createExpenseMutation = useCreateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  const totalExpenses = useMemo(() => {
    if (!expenses) return 0;
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const expensesByCategory = useMemo(() => {
    if (!expenses) return {};
    return expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  const handleOpenModal = () => {
    setDescription("");
    setAmount("");
    setCategory("OTHER");
    setNotes("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !amount || Number(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createExpenseMutation.mutateAsync({
        description: description.trim(),
        amount: Number(amount),
        category,
        notes: notes.trim() || undefined,
        date: new Date(),
        paidBy: user?.id || "",
      });
      toast.success("Expense recorded successfully");
      setShowModal(false);
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Failed to record expense");
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpenseMutation.mutateAsync(expenseId);
      toast.success("Expense deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete expense");
    }
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
            <h1 className="text-3xl font-bold">Expenses</h1>
            <p className="text-muted-foreground">Track and manage company expenses</p>
          </div>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        {Object.entries(expensesByCategory)
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

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${categoryColors[expense.category]}`}>
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">
                          {categoryOptions.find((c) => c.value === expense.category)?.label}
                        </Badge>
                        <span>• {formatDate(expense.date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-lg">{formatCurrency(expense.amount)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(expense.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No expenses recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Expense">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              placeholder="What was this expense for?"
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
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                options={categoryOptions}
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
              disabled={!description.trim() || !amount || Number(amount) <= 0 || createExpenseMutation.isPending}
            >
              {createExpenseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Expense"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Expense"
      >
        <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            disabled={deleteExpenseMutation.isPending}
          >
            {deleteExpenseMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
