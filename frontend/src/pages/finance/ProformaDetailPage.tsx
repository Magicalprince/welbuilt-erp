import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Pencil, Trash2, Eye, ArrowRightLeft, FileText } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PdfPreviewModal, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useProforma, useClient, useProject, useDeleteProforma, useConvertProformaToInvoice } from "@/hooks/useFirestore";
import { generateAndDownloadProformaPdf, generateProformaPdfUrl } from "@/services/proformaInvoicePdfService";
import toast from "react-hot-toast";
import type { ProformaStatus } from "@/types";

export default function ProformaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: proforma, isLoading } = useProforma(id || "");
  const { data: client } = useClient(proforma?.clientId || "");
  const { data: project } = useProject(proforma?.projectId || "");

  const deleteMutation = useDeleteProforma();
  const convertMutation = useConvertProformaToInvoice();

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isConverted = proforma?.status === "CONVERTED";

  const handleDownloadPdf = async () => {
    if (!proforma || !client) return;
    setIsDownloading(true);
    try {
      await generateAndDownloadProformaPdf(proforma, client);
    } catch {
      toast.error("Failed to generate proforma PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewPdf = async () => {
    if (!proforma || !client) return;
    setIsPreviewLoading(true);
    try {
      const url = await generateProformaPdfUrl(proforma, client);
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);
    } catch {
      toast.error("Failed to generate proforma PDF preview");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClosePreviewModal = () => {
    setShowPreviewModal(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const handleConvert = async () => {
    if (!proforma) return;
    if (
      !window.confirm(
        `Convert ${proforma.proformaNumber} to a real Tax Invoice? This creates a new, separately numbered invoice — this proforma cannot be edited after this.`
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
    if (!proforma || !id) return;
    if (
      window.confirm(
        `Are you sure you want to delete proforma ${proforma.proformaNumber}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Proforma deleted successfully");
        navigate("/finance/proformas");
      } catch {
        toast.error("Failed to delete proforma");
      }
    }
  };

  if (isLoading) {
    return <ProformaDetailSkeleton />;
  }

  if (!proforma) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Proforma not found</h2>
        <p className="text-muted-foreground mt-2">The proforma you're looking for doesn't exist.</p>
        <Link to="/finance/proformas" className="mt-4 inline-block">
          <Button>Back to Proformas</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/finance/proformas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{proforma.proformaNumber}</h1>
              <StatusBadge status={proforma.status} />
            </div>
            <p className="text-muted-foreground">
              {client?.companyName || "Loading..."} • {project?.title || "No project"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isConverted && proforma.status !== "CANCELLED" && (
            <Button onClick={handleConvert} disabled={convertMutation.isPending}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Convert to Tax Invoice
            </Button>
          )}
          <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleViewPdf} disabled={isPreviewLoading || !client}>
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewLoading ? "Loading..." : "View"}
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading || !client}>
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Generating..." : "Download PDF"}
          </Button>
          {!isConverted && (
            <>
              <Link to={`/finance/proformas/${id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {isConverted && proforma.convertedToInvoiceId && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-600" />
              <p className="text-sm">
                This proforma was converted to a Tax Invoice and is now read-only.
              </p>
            </div>
            <Link to={`/finance/invoices/${proforma.convertedToInvoiceId}`}>
              <Button variant="outline" size="sm">
                View Tax Invoice
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Proforma Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 font-medium">Description</th>
                      <th className="text-right py-3 font-medium">Qty</th>
                      <th className="text-right py-3 font-medium">Rate</th>
                      <th className="text-right py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proforma.lineItems.map((item, i) => (
                      <tr key={item.id || i} className="border-b">
                        <td className="py-3">{item.description}</td>
                        <td className="py-3 text-right">{item.quantity}</td>
                        <td className="py-3 text-right">{formatCurrency(item.rate)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-3 text-right font-medium">
                        Subtotal
                      </td>
                      <td className="py-3 text-right">{formatCurrency(proforma.subtotal)}</td>
                    </tr>
                    {proforma.gstType === "CGST_SGST" && (
                      <>
                        <tr>
                          <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                            CGST ({proforma.cgstPercent}%)
                          </td>
                          <td className="py-2 text-right text-sm">{formatCurrency(proforma.cgstAmount || 0)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                            SGST ({proforma.sgstPercent}%)
                          </td>
                          <td className="py-2 text-right text-sm">{formatCurrency(proforma.sgstAmount || 0)}</td>
                        </tr>
                      </>
                    )}
                    {proforma.gstType === "IGST" && (
                      <tr>
                        <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                          IGST ({proforma.igstPercent}%)
                        </td>
                        <td className="py-2 text-right text-sm">{formatCurrency(proforma.igstAmount || 0)}</td>
                      </tr>
                    )}
                    {proforma.discount > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-right font-medium">
                          Discount
                        </td>
                        <td className="py-3 text-right text-green-600">-{formatCurrency(proforma.discount)}</td>
                      </tr>
                    )}
                    <tr className="text-lg border-t">
                      <td colSpan={3} className="py-3 text-right font-bold">
                        Total
                      </td>
                      <td className="py-3 text-right font-bold">{formatCurrency(proforma.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {proforma.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proforma.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Client Info */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{client?.companyName || "Loading..."}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{client?.email || "Loading..."}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{client?.phone || "Not provided"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Proforma Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDate(proforma.issueDate)}</p>
              </div>
              {proforma.validUntil && (
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{formatDate(proforma.validUntil)}</p>
                </div>
              )}
              {project && (
                <div>
                  <p className="text-sm text-muted-foreground">Project</p>
                  <Link to={`/projects/${project.id}`} className="font-medium hover:underline text-primary">
                    {project.title}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PdfPreviewModal
        isOpen={showPreviewModal}
        onClose={handleClosePreviewModal}
        title={`Proforma Preview — ${proforma.proformaNumber}`}
        subtitle={client?.companyName}
        pdfUrl={pdfPreviewUrl}
        onDownload={handleDownloadPdf}
        isDownloading={isDownloading}
      />
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

function ProformaDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}
