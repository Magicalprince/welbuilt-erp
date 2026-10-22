import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, Loader2, Trash2, Search, Download, X } from "lucide-react";
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
  Pagination,
  DateRangeFilter,
} from "@/components/ui";
import { formatCurrency, formatDate, isWithinDateRange, EMPTY_DATE_RANGE, type DateRange } from "@/lib/utils";
import { useIncomes, useCreateIncome, useDeleteIncome, useClients, useProjects } from "@/hooks/useFirestore";
import { usePagination } from "@/hooks/usePagination";
import { useAuthStore } from "@/store/authStore";
import type { IncomeCategory } from "@/types";
import toast from "react-hot-toast";
import { generateAndDownloadFinanceStatementPdf, incomeToStatementRows } from "@/services/financeStatementPdfService";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [isExporting, setIsExporting] = useState(false);

  const { user } = useAuthStore();
  const { data: incomes, isLoading } = useIncomes();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const createIncomeMutation = useCreateIncome();
  const deleteIncomeMutation = useDeleteIncome();

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients?.forEach((c) => map.set(c.id, c.companyName));
    return map;
  }, [clients]);

  const projectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [projects]);

  const getClientName = (id?: string) => (id ? clientNameById.get(id) : undefined);
  const getProjectTitle = (id?: string) => (id ? projectTitleById.get(id) : undefined);

  const filteredIncomes = useMemo(() => {
    if (!incomes) return [];
    const query = searchQuery.trim().toLowerCase();
    return incomes.filter((income) => {
      const matchesSearch =
        !query ||
        income.description.toLowerCase().includes(query) ||
        (clientNameById.get(income.clientId || "") || "").toLowerCase().includes(query) ||
        (projectTitleById.get(income.projectId || "") || "").toLowerCase().includes(query);
      const matchesDate = isWithinDateRange(income.date, dateRange.from, dateRange.to);
      return matchesSearch && matchesDate;
    });
  }, [incomes, searchQuery, dateRange, clientNameById, projectTitleById]);

  const { paginatedItems: paginatedIncomes, currentPage, setCurrentPage, totalItems } = usePagination(filteredIncomes);

  const hasActiveFilters = !!searchQuery || !!dateRange.from || !!dateRange.to;

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateRange(EMPTY_DATE_RANGE);
  };

  const getCategoryLabel = (cat: IncomeCategory) =>
    categoryOptions.find((c) => c.value === cat)?.label || cat;

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const dateRangeLabel =
        dateRange.from || dateRange.to
          ? `${dateRange.from ? formatDate(dateRange.from) : "Start"} – ${dateRange.to ? formatDate(dateRange.to) : "Now"}`
          : undefined;
      await generateAndDownloadFinanceStatementPdf(
        {
          title: "Income Statement",
          dateRangeLabel,
          income: incomeToStatementRows(filteredIncomes, getCategoryLabel),
        },
        `Income_Statement_${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (error) {
      console.error("Error exporting income PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const totalIncome = useMemo(() => {
    return filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
  }, [filteredIncomes]);

  const incomeByCategory = useMemo(() => {
    return filteredIncomes.reduce((acc, income) => {
      acc[income.category] = (acc[income.category] || 0) + income.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredIncomes]);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={isExporting || filteredIncomes.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Generating..." : "Export PDF"}
          </Button>
          <Button onClick={handleOpenModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search income..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
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
          ) : filteredIncomes.length > 0 ? (
            <div className="space-y-3">
              {paginatedIncomes.map((income) => (
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
          ) : hasActiveFilters ? (
            <p className="text-center py-8 text-muted-foreground">No income matches your filters</p>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No income recorded yet</p>
          )}
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={20}
            onPageChange={setCurrentPage}
          />
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
