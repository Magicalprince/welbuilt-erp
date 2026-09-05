import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Send, CheckCircle2, CreditCard, Pencil, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Progress, Modal, Select, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useInvoice, useClient, useProject, useRecordPayment, useUpdateInvoice, useDeleteInvoice } from "@/hooks/useFirestore";
import { generateAndDownloadInvoicePdf } from "@/services/invoicePdfService";
import toast from "react-hot-toast";
import type { InvoiceStatus } from "@/types";

const paymentMethods = [
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useInvoice(id || "");
  const { data: client } = useClient(invoice?.clientId || "");
  const { data: project } = useProject(invoice?.projectId || "");

  const recordPaymentMutation = useRecordPayment();
  const updateInvoiceMutation = useUpdateInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{
    id: string;
    description: string;
    amount: number;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!invoice || !client) return;
    setIsDownloading(true);
    try {
      await generateAndDownloadInvoicePdf(invoice, client, project ?? null);
    } catch {
      toast.error("Failed to generate invoice PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const paidAmount = useMemo(() => {
    if (!invoice?.payments) return invoice?.paidAmount || 0;
    return invoice.payments
      .filter((p) => p.status === "PAID")
      .reduce((acc, p) => acc + p.amount, 0);
  }, [invoice]);

  const remainingAmount = (invoice?.total || 0) - paidAmount;
  const progress = invoice?.total ? (paidAmount / invoice.total) * 100 : 0;

  const handleMarkAsPaid = (payment: { id: string; description: string; amount: number }) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedPayment || !id) return;
    try {
      await recordPaymentMutation.mutateAsync({
        paymentId: selectedPayment.id,
        paymentMethod,
        invoiceId: id,
      });
      setShowPaymentModal(false);
      toast.success("Payment recorded successfully!");
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const handleMarkInvoiceAsPaid = async () => {
    if (!invoice || !id) return;
    try {
      await updateInvoiceMutation.mutateAsync({
        invoiceId: id,
        data: {
          status: "PAID" as InvoiceStatus,
          paidAmount: invoice.total,
        },
      });
      setShowMarkPaidModal(false);
      toast.success("Invoice marked as paid!");
    } catch {
      toast.error("Failed to mark invoice as paid");
    }
  };

  const handleDelete = async () => {
    if (!invoice || !id) return;
    if (
      window.confirm(
        `Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteInvoiceMutation.mutateAsync(id);
        toast.success("Invoice deleted successfully");
        navigate("/finance/invoices");
      } catch {
        toast.error("Failed to delete invoice");
      }
    }
  };

  if (isLoading) {
    return <InvoiceDetailSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Invoice not found</h2>
        <p className="text-muted-foreground mt-2">
          The invoice you're looking for doesn't exist.
        </p>
        <Link to="/finance/invoices" className="mt-4 inline-block">
          <Button>Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/finance/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-muted-foreground">
              {client?.companyName || "Loading..."} • {project?.title || "No project"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <Button onClick={() => setShowMarkPaidModal(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              Mark as Paid
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading || !client}>
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Generating..." : "Download PDF"}
          </Button>
          <Button variant="outline">
            <Send className="h-4 w-4 mr-2" />
            Send Reminder
          </Button>
          <Link to={`/finance/invoices/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteInvoiceMutation.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Payment Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Payment Progress</h3>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(paidAmount)} of {formatCurrency(invoice.total)} received
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{Math.round(progress)}%</p>
              <p className="text-sm text-muted-foreground">
                Remaining: {formatCurrency(remainingAmount)}
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Details */}
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
                    {invoice.lineItems.map((item, i) => (
                      <tr key={item.id || i} className="border-b">
                        <td className="py-3">{item.description}</td>
                        <td className="py-3 text-right">{item.quantity}</td>
                        <td className="py-3 text-right">{formatCurrency(item.rate)}</td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-3 text-right font-medium">
                        Subtotal
                      </td>
                      <td className="py-3 text-right">{formatCurrency(invoice.subtotal)}</td>
                    </tr>
                    {/* GST breakdown */}
                    {invoice.gstType === "CGST_SGST" && (
                      <>
                        <tr>
                          <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                            CGST ({invoice.cgstPercent}%)
                          </td>
                          <td className="py-2 text-right text-sm">{formatCurrency(invoice.cgstAmount || 0)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                            SGST ({invoice.sgstPercent}%)
                          </td>
                          <td className="py-2 text-right text-sm">{formatCurrency(invoice.sgstAmount || 0)}</td>
                        </tr>
                      </>
                    )}
                    {invoice.gstType === "IGST" && (
                      <tr>
                        <td colSpan={3} className="py-2 text-right text-sm text-muted-foreground">
                          IGST ({invoice.igstPercent}%)
                        </td>
                        <td className="py-2 text-right text-sm">{formatCurrency(invoice.igstAmount || 0)}</td>
                      </tr>
                    )}
                    {/* Legacy tax field for old invoices without GST breakdown */}
                    {(!invoice.gstType || invoice.gstType === "NONE") && invoice.tax > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-right font-medium">
                          Tax
                        </td>
                        <td className="py-3 text-right">{formatCurrency(invoice.tax)}</td>
                      </tr>
                    )}
                    {invoice.discount > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-right font-medium">
                          Discount
                        </td>
                        <td className="py-3 text-right text-green-600">
                          -{formatCurrency(invoice.discount)}
                        </td>
                      </tr>
                    )}
                    <tr className="text-lg border-t">
                      <td colSpan={3} className="py-3 text-right font-bold">
                        Total
                      </td>
                      <td className="py-3 text-right font-bold">
                        {formatCurrency(invoice.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Phase-wise Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule (Phase-wise)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.payments && invoice.payments.length > 0 ? (
                invoice.payments.map((payment, index) => (
                  <div
                    key={payment.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      payment.status === "PAID"
                        ? "bg-green-500/5 border-green-500/20"
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center",
                            payment.status === "PAID"
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {payment.status === "PAID" ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-medium">{index + 1}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{payment.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Due: {formatDate(payment.dueDate)}
                          </p>
                          {payment.paidDate && (
                            <p className="text-sm text-green-600">
                              Paid: {formatDate(payment.paidDate)} via {payment.paymentMethod}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(payment.amount)}</p>
                        {payment.status === "PAID" ? (
                          <Badge variant="success">Paid</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(payment)}
                            disabled={recordPaymentMutation.isPending}
                          >
                            Mark as Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  No payment schedule defined
                </p>
              )}
            </CardContent>
          </Card>
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
              <CardTitle>Invoice Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDate(invoice.issueDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
              </div>
              {project && (
                <div>
                  <p className="text-sm text-muted-foreground">Project</p>
                  <Link
                    to={`/projects/${project.id}`}
                    className="font-medium hover:underline text-primary"
                  >
                    {project.title}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="font-medium">{selectedPayment.description}</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(selectedPayment.amount)}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select
                options={paymentMethods}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmPayment}
                disabled={recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mark Invoice as Paid Modal */}
      <Modal
        isOpen={showMarkPaidModal}
        onClose={() => setShowMarkPaidModal(false)}
        title="Mark Invoice as Paid"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <p className="font-medium">Invoice: {invoice?.invoiceNumber}</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(invoice?.total || 0)}
            </p>
            {remainingAmount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Remaining: {formatCurrency(remainingAmount)}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            This will mark the entire invoice as fully paid. To record this as revenue, add a corresponding entry in the Income screen.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <Select
              options={paymentMethods}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowMarkPaidModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkInvoiceAsPaid}
              disabled={updateInvoiceMutation.isPending}
            >
              {updateInvoiceMutation.isPending ? "Processing..." : "Confirm Payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<
    InvoiceStatus,
    { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
  > = {
    DRAFT: { label: "Draft", variant: "secondary" },
    PENDING: { label: "Pending", variant: "warning" },
    PAID: { label: "Paid", variant: "success" },
    PARTIAL: { label: "Partial", variant: "default" },
    OVERDUE: { label: "Overdue", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "secondary" },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}

function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64" />
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
