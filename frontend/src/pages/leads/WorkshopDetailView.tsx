import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, IndianRupee, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Badge, Label, Input, Select, Textarea } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useWorkshop, useUpdateWorkshop, useDeleteWorkshop } from "@/hooks/useLeads";
import { getWorkshopFinancials } from "@/services/workshopService";
import type { Workshop, WorkshopExpense, WorkshopExpenseCategory, WorkshopStatus } from "@/types";
import { WORKSHOP_STATUS_LABELS, WORKSHOP_EXPENSE_CATEGORY_LABELS } from "@/types";
import toast from "react-hot-toast";

const EXPENSE_CATEGORIES = Object.keys(WORKSHOP_EXPENSE_CATEGORY_LABELS) as WorkshopExpenseCategory[];

const statusOptions: { value: WorkshopStatus; label: string }[] = (
  Object.keys(WORKSHOP_STATUS_LABELS) as WorkshopStatus[]
).map((s) => ({ value: s, label: WORKSHOP_STATUS_LABELS[s] }));

interface WorkshopDetailViewProps {
  workshopId: string;
  onBack: () => void;
}

type ExpenseFormState = Record<
  WorkshopExpenseCategory,
  { totalAmount: string; dayAmounts: string[]; showDayAmounts: boolean }
>;

function buildExpenseForm(workshop: Workshop): ExpenseFormState {
  const state = {} as ExpenseFormState;
  EXPENSE_CATEGORIES.forEach((cat) => {
    const existing = workshop.expenses.find((e) => e.category === cat);
    state[cat] = {
      totalAmount: existing ? String(existing.totalAmount) : "",
      dayAmounts: Array.from({ length: workshop.durationDays }, (_, i) =>
        existing?.dayAmounts?.[i] !== undefined ? String(existing.dayAmounts[i]) : ""
      ),
      showDayAmounts: !!existing?.dayAmounts?.some((a) => a !== undefined),
    };
  });
  return state;
}

interface DetailFormState {
  studentCount: string;
  costPerStudent: string;
  status: WorkshopStatus;
  notes: string;
  expenseForm: ExpenseFormState;
}

function buildDetailForm(workshop: Workshop): DetailFormState {
  return {
    studentCount: workshop.studentCount !== undefined ? String(workshop.studentCount) : "",
    costPerStudent: workshop.costPerStudent !== undefined ? String(workshop.costPerStudent) : "",
    status: workshop.status,
    notes: workshop.notes || "",
    expenseForm: buildExpenseForm(workshop),
  };
}

export default function WorkshopDetailView({ workshopId, onBack }: WorkshopDetailViewProps) {
  const { data: workshop, isLoading } = useWorkshop(workshopId);
  const updateMutation = useUpdateWorkshop();
  const deleteMutation = useDeleteWorkshop();

  const [form, setForm] = useState<DetailFormState | null>(null);

  useEffect(() => {
    if (workshop) setForm(buildDetailForm(workshop));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshop?.id]);

  if (isLoading || !workshop || !form) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="h-64 w-full bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  const financials = getWorkshopFinancials(workshop);
  const { expenseForm } = form;

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${workshop.workshopTitle}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(workshop.id);
      toast.success("Workshop deleted successfully");
      onBack();
    } catch (error) {
      console.error("Failed to delete workshop:", error);
      toast.error("Failed to delete workshop");
    }
  };

  const handleSave = async () => {
    const expenses: WorkshopExpense[] = EXPENSE_CATEGORIES.filter(
      (cat) => expenseForm[cat].totalAmount !== ""
    ).map((cat) => {
      const dayAmounts = expenseForm[cat].dayAmounts
        .map((v) => (v === "" ? undefined : Number(v)))
        .filter((v): v is number => v !== undefined);
      const expense: WorkshopExpense = {
        category: cat,
        totalAmount: Number(expenseForm[cat].totalAmount),
      };
      if (dayAmounts.length > 0) expense.dayAmounts = dayAmounts;
      return expense;
    });

    try {
      await updateMutation.mutateAsync({
        id: workshop.id,
        data: {
          studentCount: form.studentCount !== "" ? Number(form.studentCount) : undefined,
          costPerStudent: form.costPerStudent !== "" ? Number(form.costPerStudent) : undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
          expenses,
        },
      });
      toast.success("Workshop updated");
    } catch (error) {
      console.error("Failed to update workshop:", error);
      toast.error("Failed to update workshop");
    }
  };

  const updateExpenseField = (
    category: WorkshopExpenseCategory,
    field: "totalAmount",
    value: string
  ) => {
    setForm((prev) =>
      prev
        ? { ...prev, expenseForm: { ...prev.expenseForm, [category]: { ...prev.expenseForm[category], [field]: value } } }
        : prev
    );
  };

  const updateDayAmount = (category: WorkshopExpenseCategory, dayIndex: number, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const dayAmounts = [...prev.expenseForm[category].dayAmounts];
      dayAmounts[dayIndex] = value;
      return {
        ...prev,
        expenseForm: { ...prev.expenseForm, [category]: { ...prev.expenseForm[category], dayAmounts } },
      };
    });
  };

  const toggleDayAmounts = (category: WorkshopExpenseCategory) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            expenseForm: {
              ...prev.expenseForm,
              [category]: { ...prev.expenseForm[category], showDayAmounts: !prev.expenseForm[category].showDayAmounts },
            },
          }
        : prev
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{workshop.workshopTitle}</h1>
              <Badge variant={workshop.status === "COMPLETED" ? "success" : "warning"}>
                {WORKSHOP_STATUS_LABELS[workshop.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {workshop.targetYear} · {formatDate(workshop.startDate)} – {formatDate(workshop.endDate)} ·{" "}
              {workshop.durationDays} day{workshop.durationDays !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="font-semibold text-green-500">{formatCurrency(financials.totalEarnings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="font-semibold text-red-500">{formatCurrency(financials.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  financials.netMargin >= 0 ? "bg-blue-500/10" : "bg-red-500/10"
                }`}
              >
                <IndianRupee className={`h-5 w-5 ${financials.netMargin >= 0 ? "text-blue-500" : "text-red-500"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Margin</p>
                <p className={`font-semibold ${financials.netMargin >= 0 ? "text-blue-500" : "text-red-500"}`}>
                  {formatCurrency(financials.netMargin)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-medium">Workshop Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Student Count</Label>
              <Input
                type="number"
                value={form.studentCount}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, studentCount: e.target.value } : prev))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Cost per Student (₹)</Label>
              <Input
                type="number"
                value={form.costPerStudent}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, costPerStudent: e.target.value } : prev))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, status: e.target.value as WorkshopStatus } : prev))
                }
                options={statusOptions}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
              placeholder="Optional"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-medium">Expense Breakdown</h3>
          <div className="space-y-3">
            {EXPENSE_CATEGORIES.map((cat) => (
              <div key={cat} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-medium text-sm w-40">{WORKSHOP_EXPENSE_CATEGORY_LABELS[cat]}</p>
                  <div className="flex-1 min-w-[140px]">
                    <Input
                      type="number"
                      value={expenseForm[cat].totalAmount}
                      onChange={(e) => updateExpenseField(cat, "totalAmount", e.target.value)}
                      placeholder="Total amount (₹)"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleDayAmounts(cat)}>
                    {expenseForm[cat].showDayAmounts ? "Hide day amounts" : "Day-wise amounts"}
                  </Button>
                </div>

                {expenseForm[cat].showDayAmounts && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                    {expenseForm[cat].dayAmounts.map((val, i) => (
                      <div key={i}>
                        <Label className="text-xs mb-1 block">Day {i + 1}</Label>
                        <Input
                          type="number"
                          value={val}
                          onChange={(e) => updateDayAmount(cat, i, e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
