import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  FileText,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  X,
  Filter,
  Download,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Textarea,
  Badge,
  Skeleton,
  Modal,
} from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} from "@/services/quotationService";
import { useClients, useProjects, useCreateInvoice } from "@/hooks/useFirestore";
import { generateAndDownloadQuotationPdf } from "@/services/quotationPdfService";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Quotation, QuotationStatus, GSTType, QuotationLineItem, Client, Project } from "@/types";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
];

const GST_TYPE_OPTIONS = [
  { value: "NONE", label: "No GST" },
  { value: "CGST_SGST", label: "CGST + SGST (Intra-state)" },
  { value: "IGST", label: "IGST (Inter-state)" },
];

const GST_RATE_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18% (Standard)" },
  { value: "28", label: "28%" },
];

function statusConfig(status: QuotationStatus): {
  label: string;
  variant: "default" | "success" | "warning" | "destructive" | "secondary";
  icon: React.ReactNode;
} {
  const map: Record<QuotationStatus, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary"; icon: React.ReactNode }> = {
    DRAFT: { label: "Draft", variant: "secondary", icon: <FileText className="h-3 w-3" /> },
    SENT: { label: "Sent", variant: "default", icon: <Send className="h-3 w-3" /> },
    ACCEPTED: { label: "Accepted", variant: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
    REJECTED: { label: "Rejected", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    EXPIRED: { label: "Expired", variant: "warning", icon: <Clock className="h-3 w-3" /> },
  };
  return map[status];
}

const quotationQueryKey = ["quotations"] as const;

export default function QuotationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null);

  const { data: quotations, isLoading } = useQuery({
    queryKey: quotationQueryKey,
    queryFn: getAllQuotations,
  });
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const createInvoiceMutation = useCreateInvoice();

  const deleteMutation = useMutation({
    mutationFn: deleteQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationQueryKey });
      toast.success("Quotation deleted");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Failed to delete quotation"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
      updateQuotation(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotationQueryKey }),
    onError: () => toast.error("Failed to update status"),
  });

  const convertMutation = useMutation({
    mutationFn: async (quotation: Quotation) => {
      const invoiceData = {
        clientId: quotation.clientId,
        projectId: quotation.projectId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        lineItems: quotation.lineItems,
        subtotal: quotation.subtotal,
        tax: quotation.tax,
        discount: quotation.discount,
        total: quotation.total,
        status: "PENDING" as const,
        notes: quotation.notes,
        gstType: quotation.gstType,
        cgstPercent: quotation.cgstPercent,
        sgstPercent: quotation.sgstPercent,
        igstPercent: quotation.igstPercent,
        cgstAmount: quotation.cgstAmount,
        sgstAmount: quotation.sgstAmount,
        igstAmount: quotation.igstAmount,
      };
      const invoiceId = await createInvoiceMutation.mutateAsync({ data: invoiceData, paymentSchedule: [] });
      await updateQuotation(quotation.id, { status: "ACCEPTED", convertedToInvoiceId: invoiceId });
      return invoiceId;
    },
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: quotationQueryKey });
      toast.success("Quotation converted to invoice!");
      setViewQuotation(null);
      navigate(`/finance/invoices/${invoiceId}`);
    },
    onError: () => toast.error("Failed to convert quotation to invoice"),
  });

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients?.forEach((c) => { map[c.id] = c.companyName; });
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    if (!quotations) return [];
    return quotations.filter((q) => {
      const clientName = clientMap[q.clientId] || "";
      const matchesSearch =
        q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchQuery, statusFilter, clientMap]);

  const stats = useMemo(() => {
    if (!quotations) return { total: 0, accepted: 0, pending: 0, totalValue: 0 };
    return {
      total: quotations.length,
      accepted: quotations.filter((q) => q.status === "ACCEPTED").length,
      pending: quotations.filter((q) => q.status === "SENT" || q.status === "DRAFT").length,
      totalValue: quotations.filter((q) => q.status === "ACCEPTED").reduce((s, q) => s + q.total, 0),
    };
  }, [quotations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quotations</h1>
          <p className="text-muted-foreground">Create and manage client quotations</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Quotation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Accepted", value: stats.accepted, color: "text-green-600" },
          { label: "Won Value", value: formatCurrency(stats.totalValue), color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && "bg-primary text-primary-foreground")}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg"
        >
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
          </div>
          <Button variant="ghost" size="sm" className="self-end" onClick={() => setStatusFilter("ALL")}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </motion.div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No quotations found</h3>
          <p className="text-muted-foreground mb-4">
            {quotations && quotations.length > 0
              ? "Try adjusting your search or filter"
              : "Create your first quotation to send to clients"}
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Quotation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const cfg = statusConfig(q.status);
            const clientName = clientMap[q.clientId] || "Unknown Client";
            const isExpired = q.status === "SENT" && new Date() > q.validUntil;
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{q.quotationNumber}</span>
                            <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                            {isExpired && q.status === "SENT" && (
                              <Badge variant="destructive" className="text-xs">Expired</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Valid until: {formatDate(q.validUntil)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(q.total)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</p>
                        </div>
                        <div className="flex gap-1">
                          {q.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: q.id, status: "SENT" })}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Send
                            </Button>
                          )}
                          {(q.status === "SENT" || q.status === "ACCEPTED") && !q.convertedToInvoiceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewQuotation(q)}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Convert
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewQuotation(q)}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(q)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <CreateQuotationModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          clients={clients || []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: quotationQueryKey })}
        />
      )}

      {/* View / Detail Modal */}
      {viewQuotation && (
        <QuotationDetailModal
          quotation={viewQuotation}
          clientName={clientMap[viewQuotation.clientId] || "Unknown"}
          client={clients?.find((c) => c.id === viewQuotation.clientId) ?? null}
          project={projects?.find((p) => p.id === viewQuotation.projectId) ?? null}
          onClose={() => setViewQuotation(null)}
          onConvert={() => convertMutation.mutate(viewQuotation)}
          converting={convertMutation.isPending}
          onStatusChange={(status) => {
            updateStatusMutation.mutate({ id: viewQuotation.id, status });
            setViewQuotation((q) => q ? { ...q, status } : null);
          }}
        />
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Quotation">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete quotation <strong>{deleteConfirm?.quotationNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create Quotation Modal
// ─────────────────────────────────────────────
function CreateQuotationModal({
  isOpen,
  onClose,
  clients,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: Array<{ id: string; companyName: string }>;
  onSuccess: () => void;
}) {
  const { data: allProjects } = useProjects();

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [gstType, setGstType] = useState<GSTType>("CGST_SGST");
  const [gstRate, setGstRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("This quotation is valid for 15 days from the date of issue.");
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const clientProjects = useMemo(
    () => (allProjects || []).filter((p) => p.clientId === clientId),
    [allProjects, clientId]
  );

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const cgstPercent = gstType === "CGST_SGST" ? gstRate / 2 : 0;
  const sgstPercent = gstType === "CGST_SGST" ? gstRate / 2 : 0;
  const igstPercent = gstType === "IGST" ? gstRate : 0;
  const cgstAmount = gstType === "CGST_SGST" ? (subtotal * cgstPercent) / 100 : 0;
  const sgstAmount = gstType === "CGST_SGST" ? (subtotal * sgstPercent) / 100 : 0;
  const igstAmount = gstType === "IGST" ? (subtotal * igstPercent) / 100 : 0;
  const taxAmount = cgstAmount + sgstAmount + igstAmount;
  const total = subtotal + taxAmount - discount;

  const updateItem = (id: string, field: keyof QuotationLineItem, value: string | number) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "rate") updated.amount = updated.quantity * updated.rate;
        return updated;
      })
    );
  };

  const handleSubmit = async () => {
    if (!clientId || !lineItems.every((i) => i.description && i.amount > 0)) {
      toast.error("Please fill in client and all line items");
      return;
    }
    setSubmitting(true);
    try {
      await createQuotation({
        clientId,
        projectId: projectId || undefined,
        issueDate: new Date(issueDate),
        validUntil: new Date(validUntil),
        lineItems,
        subtotal,
        tax: taxAmount,
        discount,
        total,
        status: "DRAFT",
        notes: notes || undefined,
        terms: terms || undefined,
        gstType,
        ...(gstType === "CGST_SGST" && { cgstPercent, sgstPercent, cgstAmount, sgstAmount }),
        ...(gstType === "IGST" && { igstPercent, igstAmount }),
      });
      toast.success("Quotation created!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Quotation" className="max-w-3xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Client & Project */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Client *</Label>
            <Select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
              options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
              placeholder="Select client"
            />
          </div>
          <div>
            <Label>Project (Optional)</Label>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={clientProjects.map((p) => ({ value: p.id, label: p.title }))}
              placeholder="Select project"
              disabled={!clientId}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Issue Date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Valid Until</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLineItems((items) => [
                  ...items,
                  { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
                ])
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, "rate", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2 text-right text-sm font-medium">{formatCurrency(item.amount)}</div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={lineItems.length === 1}
                    onClick={() => setLineItems((items) => items.filter((i) => i.id !== item.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GST & Totals */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground min-w-[70px]">GST Type</span>
            <Select
              value={gstType}
              onChange={(e) => setGstType(e.target.value as GSTType)}
              options={GST_TYPE_OPTIONS}
              className="flex-1"
            />
            {gstType !== "NONE" && (
              <Select
                value={gstRate.toString()}
                onChange={(e) => setGstRate(Number(e.target.value))}
                options={GST_RATE_OPTIONS}
                className="w-32"
              />
            )}
          </div>
          {gstType === "CGST_SGST" && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CGST ({cgstPercent}%)</span>
                <span>{formatCurrency(cgstAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SGST ({sgstPercent}%)</span>
                <span>{formatCurrency(sgstAmount)}</span>
              </div>
            </>
          )}
          {gstType === "IGST" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IGST ({igstPercent}%)</span>
              <span>{formatCurrency(igstAmount)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground min-w-[70px]">Discount (₹)</span>
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-32 h-8"
            />
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Notes & Terms */}
        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>
        <div>
          <Label>Terms & Conditions</Label>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Quotation terms..."
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Quotation"}
        </Button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Quotation Detail Modal
// ─────────────────────────────────────────────
function QuotationDetailModal({
  quotation,
  clientName,
  client,
  project,
  onClose,
  onConvert,
  converting,
  onStatusChange,
}: {
  quotation: Quotation;
  clientName: string;
  client: Client | null;
  project: Project | null;
  onClose: () => void;
  onConvert: () => void;
  converting: boolean;
  onStatusChange: (s: QuotationStatus) => void;
}) {
  const cfg = statusConfig(quotation.status);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!client) return;
    setIsDownloading(true);
    try {
      await generateAndDownloadQuotationPdf(quotation, client, project);
    } catch {
      toast.error("Failed to generate quotation PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Quotation — ${quotation.quotationNumber}`} className="max-w-2xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Header Info */}
        <div className="flex items-center justify-between">
          <Badge variant={cfg.variant} className="flex items-center gap-1">
            {cfg.icon}
            {cfg.label}
          </Badge>
          <span className="text-sm text-muted-foreground">Valid until: {formatDate(quotation.validUntil)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">{clientName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Issue Date</p>
            <p className="font-medium">{formatDate(quotation.issueDate)}</p>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-right py-2 font-medium">Qty</th>
              <th className="text-right py-2 font-medium">Rate</th>
              <th className="text-right py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lineItems.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="py-2 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 text-right text-muted-foreground">Subtotal</td>
              <td className="py-2 text-right">{formatCurrency(quotation.subtotal)}</td>
            </tr>
            {quotation.gstType === "CGST_SGST" && (
              <>
                <tr>
                  <td colSpan={3} className="py-1 text-right text-xs text-muted-foreground">CGST ({quotation.cgstPercent}%)</td>
                  <td className="py-1 text-right text-xs">{formatCurrency(quotation.cgstAmount || 0)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1 text-right text-xs text-muted-foreground">SGST ({quotation.sgstPercent}%)</td>
                  <td className="py-1 text-right text-xs">{formatCurrency(quotation.sgstAmount || 0)}</td>
                </tr>
              </>
            )}
            {quotation.gstType === "IGST" && (
              <tr>
                <td colSpan={3} className="py-1 text-right text-xs text-muted-foreground">IGST ({quotation.igstPercent}%)</td>
                <td className="py-1 text-right text-xs">{formatCurrency(quotation.igstAmount || 0)}</td>
              </tr>
            )}
            {quotation.discount > 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-right text-muted-foreground">Discount</td>
                <td className="py-2 text-right text-green-600">-{formatCurrency(quotation.discount)}</td>
              </tr>
            )}
            <tr className="border-t font-bold text-base">
              <td colSpan={3} className="py-2 text-right">Total</td>
              <td className="py-2 text-right">{formatCurrency(quotation.total)}</td>
            </tr>
          </tfoot>
        </table>

        {quotation.notes && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium mb-1">Notes</p>
            <p className="text-muted-foreground">{quotation.notes}</p>
          </div>
        )}
        {quotation.terms && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium mb-1">Terms & Conditions</p>
            <p className="text-muted-foreground">{quotation.terms}</p>
          </div>
        )}

        {quotation.convertedToInvoiceId && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
            This quotation has been converted to an invoice.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t mt-4">
        <div className="flex gap-2">
          {quotation.status === "DRAFT" && (
            <Button variant="outline" size="sm" onClick={() => onStatusChange("SENT")}>
              <Send className="h-3 w-3 mr-1" />
              Mark Sent
            </Button>
          )}
          {quotation.status === "SENT" && (
            <>
              <Button variant="outline" size="sm" onClick={() => onStatusChange("REJECTED")}>
                <XCircle className="h-3 w-3 mr-1" />
                Rejected
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading || !client}>
            {isDownloading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Download PDF</>
            )}
          </Button>
          {!quotation.convertedToInvoiceId && (quotation.status === "SENT" || quotation.status === "ACCEPTED") && (
            <Button onClick={onConvert} disabled={converting}>
              {converting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Converting...</>
              ) : (
                <><ArrowRight className="h-4 w-4 mr-2" />Convert to Invoice</>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
