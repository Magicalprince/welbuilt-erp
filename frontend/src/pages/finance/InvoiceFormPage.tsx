import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Calendar, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
  Checkbox,
} from "@/components/ui";
import { useClients, useProjects, useCreateInvoice, useUpdateInvoice } from "@/hooks/useFirestore";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PaymentPhase {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
}

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get("clientId") || "";

  const { data: clients, isLoading: loadingClients } = useClients();
  const { data: allProjects } = useProjects();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();

  // Form state
  const [clientId, setClientId] = useState(preselectedClientId);
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split("T")[0];
  });
  const [taxPercent, setTaxPercent] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  // Payment phases
  const [paymentPhases, setPaymentPhases] = useState<PaymentPhase[]>([]);
  const [usePaymentSchedule, setUsePaymentSchedule] = useState(false);

  // Mark as paid option
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paidPaymentMethod, setPaidPaymentMethod] = useState("bank");

  // Generate default payment phases
  const generateDefaultPhases = (invoiceTotal: number, issueDt: string, dueDt: string): PaymentPhase[] => {
    const phase1Amount = Math.round(invoiceTotal * 0.3);
    const phase2Amount = Math.round(invoiceTotal * 0.4);
    const phase3Amount = invoiceTotal - phase1Amount - phase2Amount;

    const issueDateObj = new Date(issueDt);
    const dueDateObj = new Date(dueDt);
    const midDate = new Date((issueDateObj.getTime() + dueDateObj.getTime()) / 2);

    return [
      {
        id: crypto.randomUUID(),
        description: "Advance Payment",
        amount: phase1Amount,
        dueDate: issueDt,
      },
      {
        id: crypto.randomUUID(),
        description: "Mid-Project Payment",
        amount: phase2Amount,
        dueDate: midDate.toISOString().split("T")[0],
      },
      {
        id: crypto.randomUUID(),
        description: "Final Payment",
        amount: phase3Amount,
        dueDate: dueDt,
      },
    ];
  };

  // Handler for toggling payment schedule
  const handleTogglePaymentSchedule = (enabled: boolean) => {
    setUsePaymentSchedule(enabled);
    if (enabled && paymentPhases.length === 0) {
      setPaymentPhases(generateDefaultPhases(total, issueDate, dueDate));
    } else if (!enabled) {
      setPaymentPhases([]);
    }
  };

  // Filter projects by selected client
  const clientProjects = useMemo(() => {
    if (!allProjects || !clientId) return [];
    return allProjects.filter((p) => p.clientId === clientId);
  }, [allProjects, clientId]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount - discount;

  // Update line item
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "rate") {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      })
    );
  };

  // Add line item
  const addLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  // Update payment phase
  const updatePaymentPhase = (id: string, field: keyof PaymentPhase, value: string | number) => {
    setPaymentPhases((phases) =>
      phases.map((phase) => (phase.id === id ? { ...phase, [field]: value } : phase))
    );
  };

  // Add payment phase
  const addPaymentPhase = () => {
    setPaymentPhases((phases) => [
      ...phases,
      { id: crypto.randomUUID(), description: "", amount: 0, dueDate: dueDate },
    ]);
  };

  // Remove payment phase
  const removePaymentPhase = (id: string) => {
    setPaymentPhases((phases) => phases.filter((phase) => phase.id !== id));
  };

  // Validate form
  const hasValidLineItems = lineItems.every((item) => item.description && item.amount > 0);
  const scheduleTotal = paymentPhases.reduce((sum, p) => sum + Number(p.amount), 0);
  const hasValidSchedule = !usePaymentSchedule || Math.abs(scheduleTotal - total) <= 1;
  const isValid = !!clientId && hasValidLineItems && hasValidSchedule;

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const invoiceData = {
        clientId,
        projectId: projectId || undefined,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        lineItems: lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        subtotal,
        tax: taxAmount,
        discount,
        total,
        status: "PENDING" as const,
        notes: notes || undefined,
      };

      const paymentSchedule = usePaymentSchedule
        ? paymentPhases.map((phase) => ({
            description: phase.description,
            amount: Number(phase.amount),
            dueDate: new Date(phase.dueDate),
          }))
        : [];

      const invoiceId = await createInvoiceMutation.mutateAsync({ data: invoiceData, paymentSchedule });

      // If marking as paid, update the invoice status immediately
      if (markAsPaid) {
        await updateInvoiceMutation.mutateAsync({
          invoiceId,
          data: {
            status: "PAID",
            paidAmount: total,
          },
        });
        toast.success("Invoice created and marked as paid!");
      } else {
        toast.success("Invoice created successfully!");
      }

      navigate("/finance/invoices");
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error("Failed to create invoice");
    }
  };

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Invoice</h1>
          <p className="text-muted-foreground">Fill in the details to generate a new invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Client & Project</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId(""); // Reset project when client changes
                }}
                options={
                  clients?.map((c) => ({ value: c.id, label: c.companyName })) || []
                }
                placeholder="Select a client"
              />
              {!clientId && (
                <p className="text-xs text-muted-foreground">
                  You must select a client to create an invoice
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Project (Optional)</Label>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={clientProjects.map((p) => ({ value: p.id, label: p.title }))}
                placeholder="Select a project"
                disabled={!clientId}
              />
              {clientId && clientProjects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No projects found for this client
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Dates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {/* Items */}
            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))}
                    className="text-center"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => updateLineItem(item.id, "rate", Number(e.target.value))}
                    className="text-right"
                  />
                </div>
                <div className="col-span-2 text-right font-medium">
                  {formatCurrency(item.amount)}
                </div>
                <div className="col-span-1 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tax</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    className="w-20 h-8"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Discount</span>
                  <Input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-32 h-8"
                  />
                </div>
                <span className="font-medium text-green-600">-{formatCurrency(discount)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">Total</span>
                <span className="font-bold">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payment Schedule</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Split the invoice into multiple payment phases
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usePaymentSchedule}
                onChange={(e) => handleTogglePaymentSchedule(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Enable</span>
            </label>
          </CardHeader>
          {usePaymentSchedule && (
            <CardContent className="space-y-4">
              {paymentPhases.map((phase, index) => (
                <div key={phase.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 text-center font-medium text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="col-span-4">
                    <Input
                      placeholder="Phase description"
                      value={phase.description}
                      onChange={(e) => updatePaymentPhase(phase.id, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={phase.amount}
                      onChange={(e) => updatePaymentPhase(phase.id, "amount", Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="date"
                      value={phase.dueDate}
                      onChange={(e) => updatePaymentPhase(phase.id, "dueDate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePaymentPhase(phase.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addPaymentPhase}>
                <Plus className="h-4 w-4 mr-1" />
                Add Phase
              </Button>

              {/* Schedule Total Check */}
              {paymentPhases.length > 0 && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex justify-between text-sm">
                    <span>Schedule Total:</span>
                    <span
                      className={
                        Math.abs(paymentPhases.reduce((sum, p) => sum + Number(p.amount), 0) - total) <= 1
                          ? "text-green-600"
                          : "text-destructive"
                      }
                    >
                      {formatCurrency(paymentPhases.reduce((sum, p) => sum + Number(p.amount), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Invoice Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  {Math.abs(paymentPhases.reduce((sum, p) => sum + Number(p.amount), 0) - total) > 1 && (
                    <p className="text-xs text-destructive mt-1">
                      Payment schedule must equal invoice total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional notes or terms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Mark as Paid Option */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="markAsPaid"
                checked={markAsPaid}
                onChange={() => setMarkAsPaid(!markAsPaid)}
              />
              <label htmlFor="markAsPaid" className="cursor-pointer">
                <span className="font-medium">Mark as already paid</span>
                <p className="text-sm text-muted-foreground">
                  Check this if payment has already been received for this invoice
                </p>
              </label>
            </div>
            {markAsPaid && (
              <div className="ml-7 space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paidPaymentMethod}
                  onChange={(e) => setPaidPaymentMethod(e.target.value)}
                  options={[
                    { value: "bank", label: "Bank Transfer" },
                    { value: "upi", label: "UPI" },
                    { value: "cash", label: "Cash" },
                    { value: "cheque", label: "Cheque" },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || createInvoiceMutation.isPending || updateInvoiceMutation.isPending}>
            {(createInvoiceMutation.isPending || updateInvoiceMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {markAsPaid ? "Creating & Marking Paid..." : "Creating..."}
              </>
            ) : (
              markAsPaid ? "Create & Mark as Paid" : "Create Invoice"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
