import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Search,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  X,
  Filter,
  Download,
  Paperclip,
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
import { uploadFileToR2, deleteFileFromR2, getSignedDownloadUrl, validateFile, formatFileSize } from "@/services/serverStorageService";
import { useClients, useProjects, useCreateClient, useCreateProject } from "@/hooks/useFirestore";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Quotation, QuotationStatus } from "@/types";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
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
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: quotations, isLoading } = useQuery({
    queryKey: quotationQueryKey,
    queryFn: getAllQuotations,
  });
  const { data: clients } = useClients();
  const { data: projects } = useProjects();

  const deleteMutation = useMutation({
    mutationFn: async (quotation: Quotation) => {
      try {
        await deleteFileFromR2(quotation.fileKey);
      } catch (err) {
        console.error("Failed to delete stored file:", err);
      }
      await deleteQuotation(quotation.id);
    },
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

  const handleDownload = async (q: Quotation) => {
    setDownloadingId(q.id);
    try {
      const signedUrl = await getSignedDownloadUrl(q.fileKey);
      const link = document.createElement("a");
      link.href = signedUrl;
      link.target = "_blank";
      link.download = q.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients?.forEach((c) => { map[c.id] = c.companyName; });
    return map;
  }, [clients]);

  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects?.forEach((p) => { map[p.id] = p.title; });
    return map;
  }, [projects]);

  const filtered = useMemo(() => {
    if (!quotations) return [];
    return quotations.filter((q) => {
      const clientName = clientMap[q.clientId] || "";
      const matchesSearch =
        q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      totalValue: quotations.filter((q) => q.status === "ACCEPTED").reduce((s, q) => s + q.amount, 0),
    };
  }, [quotations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quotations</h1>
          <p className="text-muted-foreground">Track quotations sent to clients and map them to projects</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Add Quotation
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
            placeholder="Search by number, file name, or client..."
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
              : "Upload a quotation you've already sent to a client to start tracking it here"}
          </p>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Add Quotation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const cfg = statusConfig(q.status);
            const clientName = clientMap[q.clientId] || "Unknown Client";
            const projectName = q.projectId ? projectMap[q.projectId] : null;
            const isExpired = q.status === "SENT" && q.validUntil && new Date() > q.validUntil;
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
                          <Paperclip className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{q.quotationNumber}</span>
                            <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                            {isExpired && (
                              <Badge variant="destructive" className="text-xs">Expired</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {clientName}{projectName ? ` • ${projectName}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{q.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(q.amount)}</p>
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
                              Mark Sent
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(q)}
                            disabled={downloadingId === q.id}
                          >
                            {downloadingId === q.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                          </Button>
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

      {/* Upload / Add Quotation Modal */}
      {showUploadModal && (
        <UploadQuotationModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          clients={clients || []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: quotationQueryKey })}
        />
      )}

      {/* View / Detail Modal */}
      {viewQuotation && (
        <QuotationDetailModal
          quotation={viewQuotation}
          clientName={clientMap[viewQuotation.clientId] || "Unknown"}
          projectName={viewQuotation.projectId ? projectMap[viewQuotation.projectId] : null}
          onClose={() => setViewQuotation(null)}
          onDownload={() => handleDownload(viewQuotation)}
          downloading={downloadingId === viewQuotation.id}
          onStatusChange={(status) => {
            updateStatusMutation.mutate({ id: viewQuotation.id, status });
            setViewQuotation((q) => q ? { ...q, status } : null);
          }}
        />
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Quotation">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete quotation <strong>{deleteConfirm?.quotationNumber}</strong> and its attached file? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
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
// Upload Quotation Modal
// ─────────────────────────────────────────────
function UploadQuotationModal({
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
  const createClientMutation = useCreateClient();
  const createProjectMutation = useCreateProject();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newClient, setNewClient] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    gstNumber: "",
  });
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectValue, setNewProjectValue] = useState(0);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientProjects = useMemo(
    () => (allProjects || []).filter((p) => p.clientId === clientId),
    [allProjects, clientId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid file");
      return;
    }
    setSelectedFile(file);
  };

  const handleCreateClient = async () => {
    if (!newClient.companyName || !newClient.contactPerson || !newClient.email) {
      toast.error("Company name, contact person, and email are required");
      return;
    }
    try {
      const created = await createClientMutation.mutateAsync({
        companyName: newClient.companyName,
        contactPerson: newClient.contactPerson,
        email: newClient.email,
        phone: newClient.phone || undefined,
        address: newClient.address || undefined,
        gstNumber: newClient.gstNumber || undefined,
        status: "PROSPECTIVE",
      });
      setClientId(created);
      setShowNewClientForm(false);
      setNewClient({ companyName: "", contactPerson: "", email: "", phone: "", address: "", gstNumber: "" });
      toast.success("Client added");
    } catch {
      toast.error("Failed to add client");
    }
  };

  const handleCreateProject = async () => {
    if (!clientId) {
      toast.error("Select a client first");
      return;
    }
    if (!newProjectTitle) {
      toast.error("Project title is required");
      return;
    }
    try {
      const created = await createProjectMutation.mutateAsync({
        data: {
          title: newProjectTitle,
          status: "PLANNING",
          value: newProjectValue,
          startDate: new Date(),
          clientId,
        },
      });
      setProjectId(created);
      setShowNewProjectForm(false);
      setNewProjectTitle("");
      setNewProjectValue(0);
      toast.success("Project added");
    } catch {
      toast.error("Failed to add project");
    }
  };

  const handleSubmit = async () => {
    if (!clientId) {
      toast.error("Select or add a client");
      return;
    }
    if (!selectedFile) {
      toast.error("Attach the quotation file (PDF or DOC)");
      return;
    }
    if (amount <= 0) {
      toast.error("Enter the quotation amount");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadFileToR2(selectedFile, "quotations");
      await createQuotation({
        clientId,
        projectId: projectId || undefined,
        issueDate: new Date(issueDate),
        validUntil: validUntil ? new Date(validUntil) : undefined,
        amount,
        status: "DRAFT",
        notes: notes || undefined,
        fileUrl: uploaded.fileUrl,
        fileKey: uploaded.fileKey,
        fileName: selectedFile.name,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      });
      toast.success("Quotation added!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add quotation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Quotation" className="max-w-2xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <p className="text-sm text-muted-foreground">
          Attach a quotation you've already created (PDF or Word doc) and map it to a client and project.
        </p>

        {/* File attach */}
        <div>
          <Label>Quotation File *</Label>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
          />
          {selectedFile ? (
            <div className="mt-1 flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(selectedFile.size)}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-1 w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          )}
        </div>

        {/* Client & Project */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Client *</Label>
            {!showNewClientForm ? (
              <Select
                value={clientId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowNewClientForm(true);
                    return;
                  }
                  setClientId(e.target.value);
                  setProjectId("");
                }}
                options={[
                  ...clients.map((c) => ({ value: c.id, label: c.companyName })),
                  { value: "__new__", label: "+ Add new client..." },
                ]}
                placeholder="Select client"
              />
            ) : (
              <div className="mt-1 p-3 border rounded-lg space-y-2 bg-muted/30">
                <Input
                  placeholder="Company name *"
                  value={newClient.companyName}
                  onChange={(e) => setNewClient((c) => ({ ...c, companyName: e.target.value }))}
                />
                <Input
                  placeholder="Contact person *"
                  value={newClient.contactPerson}
                  onChange={(e) => setNewClient((c) => ({ ...c, contactPerson: e.target.value }))}
                />
                <Input
                  placeholder="Email *"
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                />
                <Input
                  placeholder="Phone"
                  value={newClient.phone}
                  onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                />
                <Input
                  placeholder="GSTIN (optional)"
                  value={newClient.gstNumber}
                  onChange={(e) => setNewClient((c) => ({ ...c, gstNumber: e.target.value }))}
                />
                <Textarea
                  placeholder="Address (optional)"
                  value={newClient.address}
                  onChange={(e) => setNewClient((c) => ({ ...c, address: e.target.value }))}
                  rows={2}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClientForm(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateClient} disabled={createClientMutation.isPending}>
                    {createClientMutation.isPending ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Project (Optional)</Label>
            {!showNewProjectForm ? (
              <Select
                value={projectId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowNewProjectForm(true);
                    return;
                  }
                  setProjectId(e.target.value);
                }}
                options={[
                  ...clientProjects.map((p) => ({ value: p.id, label: p.title })),
                  ...(clientId ? [{ value: "__new__", label: "+ Add new project..." }] : []),
                ]}
                placeholder="Select project"
                disabled={!clientId}
              />
            ) : (
              <div className="mt-1 p-3 border rounded-lg space-y-2 bg-muted/30">
                <Input
                  placeholder="Project title *"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                />
                <Input
                  placeholder="Estimated value (₹)"
                  type="number"
                  min="0"
                  value={newProjectValue}
                  onChange={(e) => setNewProjectValue(Number(e.target.value))}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewProjectForm(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateProject} disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? "Adding..." : "Add Project"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dates & Amount */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Issue Date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Valid Until (Optional)</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Add Quotation"}
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
  projectName,
  onClose,
  onDownload,
  downloading,
  onStatusChange,
}: {
  quotation: Quotation;
  clientName: string;
  projectName?: string | null;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
  onStatusChange: (s: QuotationStatus) => void;
}) {
  const cfg = statusConfig(quotation.status);

  return (
    <Modal isOpen onClose={onClose} title={`Quotation — ${quotation.quotationNumber}`} className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={cfg.variant} className="flex items-center gap-1">
            {cfg.icon}
            {cfg.label}
          </Badge>
          {quotation.validUntil && (
            <span className="text-sm text-muted-foreground">Valid until: {formatDate(quotation.validUntil)}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">{clientName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Project</p>
            <p className="font-medium">{projectName || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Issue Date</p>
            <p className="font-medium">{formatDate(quotation.issueDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">{formatCurrency(quotation.amount)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{quotation.fileName}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatFileSize(quotation.fileSize)}</span>
        </div>

        {quotation.notes && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium mb-1">Notes</p>
            <p className="text-muted-foreground">{quotation.notes}</p>
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
              <Button variant="outline" size="sm" onClick={() => onStatusChange("ACCEPTED")}>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Accepted
              </Button>
              <Button variant="outline" size="sm" onClick={() => onStatusChange("REJECTED")}>
                <XCircle className="h-3 w-3 mr-1" />
                Rejected
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onDownload} disabled={downloading}>
            {downloading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downloading...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Download</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
