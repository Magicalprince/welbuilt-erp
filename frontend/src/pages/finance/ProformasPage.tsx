import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, FileText, Eye, Download, ExternalLink, ArrowRightLeft, Trash2 } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Skeleton, Modal, Pagination } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useProformas, useClients, useConvertProformaToInvoice, useDeleteProforma } from "@/hooks/useFirestore";
import { usePagination } from "@/hooks/usePagination";
import { generateProformaPdfUrl, generateAndDownloadProformaPdf } from "@/services/proformaInvoicePdfService";
import toast from "react-hot-toast";
import type { ProformaInvoice, ProformaStatus } from "@/types";

// "Active" (Draft/Sent) is the default filter per explicit user
// decision — converted/expired/cancelled proformas aren't deleted or
// hidden from the data, just excluded from the default view so the
// list stays focused on proformas that still need action.
const statusFilters: { label: string; value: ProformaStatus | "ACTIVE" | "ALL" }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Converted", value: "CONVERTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "All", value: "ALL" },
];

export default function ProformasPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProformaStatus | "ACTIVE" | "ALL">("ACTIVE");
  const [previewProforma, setPreviewProforma] = useState<ProformaInvoice | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProformaInvoice | null>(null);

  const { data: proformas, isLoading, error } = useProformas();
  const { data: clients } = useClients();
  const convertMutation = useConvertProformaToInvoice();
  const deleteMutation = useDeleteProforma();

  const clientMap = useMemo(() => {
    if (!clients) return {};
    return clients.reduce((acc, client) => {
      acc[client.id] = client.companyName;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  const proformasWithClientName = useMemo(() => {
    if (!proformas) return [];
    return proformas.map((p) => ({
      ...p,
      clientName: clientMap[p.clientId] || "Unknown Client",
    }));
  }, [proformas, clientMap]);

  const filteredProformas = useMemo(() => {
    return proformasWithClientName.filter((p) => {
      const matchesSearch =
        p.proformaNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? p.status === "DRAFT" || p.status === "SENT" : p.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [proformasWithClientName, searchQuery, statusFilter]);

  const { paginatedItems: paginatedProformas, currentPage, setCurrentPage, totalItems } = usePagination(filteredProformas);

  const handleQuickView = async (e: React.MouseEvent, proforma: ProformaInvoice) => {
    e.preventDefault();
    e.stopPropagation();
    const client = clients?.find((c) => c.id === proforma.clientId);
    if (!client) {
      toast.error("Client data not found");
      return;
    }
    setPreviewingId(proforma.id);
    setPreviewProforma(proforma);
    try {
      const url = await generateProformaPdfUrl(proforma, client);
      setPdfPreviewUrl(url);
    } catch {
      toast.error("Failed to generate PDF preview");
      setPreviewProforma(null);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewProforma(null);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const handleDownloadFromPreview = async () => {
    if (!previewProforma) return;
    const client = clients?.find((c) => c.id === previewProforma.clientId);
    if (!client) return;
    try {
      await generateAndDownloadProformaPdf(previewProforma, client);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  const handleConvert = async (e: React.MouseEvent, proforma: ProformaInvoice) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Convert ${proforma.proformaNumber} to a real Tax Invoice? This creates a new, separately numbered invoice — the proforma itself cannot be edited after this.`
      )
    ) {
      return;
    }
    try {
      const invoiceId = await convertMutation.mutateAsync(proforma.id);
      toast.success("Converted to Tax Invoice");
      navigate(`/finance/invoices/${invoiceId}`);
    } catch (error) {
      console.error("Failed to convert proforma:", error);
      toast.error("Failed to convert proforma");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Proforma deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete proforma");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Proforma Invoices</h1>
          <p className="text-muted-foreground">
            Preliminary estimates sent before work is confirmed — not GST tax invoices
          </p>
        </div>
        <Link to="/finance/proformas/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Proforma
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proformas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading proformas. Please try again.</p>
        </div>
      ) : filteredProformas.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No proformas found</h3>
          <p className="text-muted-foreground">
            {proformas && proformas.length > 0
              ? "Try adjusting your search or filter"
              : "Get started by creating your first proforma"}
          </p>
          {(!proformas || proformas.length === 0) && (
            <Link to="/finance/proformas/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Proforma
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedProformas.map((proforma, index) => (
            <motion.div
              key={proforma.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/finance/proformas/${proforma.id}`}>
                <Card className="card-hover">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{proforma.proformaNumber}</h3>
                          <StatusBadge status={proforma.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {proforma.clientName}
                          {proforma.validUntil && ` • Valid until: ${formatDate(proforma.validUntil)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-bold mr-2">{formatCurrency(proforma.total)}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleQuickView(e, proforma)}
                          disabled={previewingId === proforma.id}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {previewingId === proforma.id ? "Loading..." : "View"}
                        </Button>
                        {proforma.status !== "CONVERTED" && proforma.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            onClick={(e) => handleConvert(e, proforma)}
                            disabled={convertMutation.isPending}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Convert
                          </Button>
                        )}
                        {proforma.status !== "CONVERTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirm(proforma);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && !error && filteredProformas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={20}
          onPageChange={setCurrentPage}
        />
      )}

      {/* PDF View / Preview Modal */}
      <Modal
        isOpen={!!previewProforma}
        onClose={handleClosePreview}
        title={`Proforma Preview — ${previewProforma?.proformaNumber}`}
        size="full"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 p-3 rounded-lg border">
            <span className="text-sm font-medium">
              {previewProforma?.proformaNumber} • {clientMap[previewProforma?.clientId || ""] || "Client"}
            </span>
            <div className="flex items-center gap-2">
              {pdfPreviewUrl && (
                <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in New Tab
                  </Button>
                </a>
              )}
              <Button size="sm" onClick={handleDownloadFromPreview}>
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </div>
          {pdfPreviewUrl ? (
            <div className="w-full h-[78vh] rounded-lg overflow-hidden border bg-zinc-900 flex items-center justify-center">
              <iframe
                src={pdfPreviewUrl}
                title={`Proforma ${previewProforma?.proformaNumber}`}
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            <div className="h-[60vh] flex items-center justify-center">
              <p className="text-muted-foreground">Generating preview...</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Proforma">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete <strong>{deleteConfirm?.proformaNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: ProformaStatus }) {
  const config: Record<
    ProformaStatus,
    { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
  > = {
    DRAFT: { label: "Draft", variant: "secondary" },
    SENT: { label: "Sent", variant: "warning" },
    CONVERTED: { label: "Converted", variant: "success" },
    EXPIRED: { label: "Expired", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "secondary" },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}
