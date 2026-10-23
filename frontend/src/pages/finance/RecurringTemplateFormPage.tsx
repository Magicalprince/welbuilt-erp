import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
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
} from "@/components/ui";
import {
  useClients,
  useProjects,
  useCreateRecurringTemplate,
  useUpdateRecurringTemplate,
  useRecurringTemplate,
} from "@/hooks/useFirestore";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import type { GSTType } from "@/types";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

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

// 1-28 only — a template set for the 29th-31st would silently skip
// February (and some months would generate "early" relative to others),
// so the day picker simply never offers those values.
const BILLING_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"} of each month`,
}));

export default function RecurringTemplateFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: clients, isLoading: loadingClients } = useClients();
  const { data: allProjects } = useProjects();
  const { data: existingTemplate, isLoading: loadingTemplate } = useRecurringTemplate(id || "");
  const createMutation = useCreateRecurringTemplate();
  const updateMutation = useUpdateRecurringTemplate();

  const [templateName, setTemplateName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [billingDay, setBillingDay] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const [gstType, setGstType] = useState<GSTType>("NONE");
  const [gstRate, setGstRate] = useState(18);

  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  useEffect(() => {
    if (!existingTemplate) return;
    setTemplateName(existingTemplate.templateName);
    setClientId(existingTemplate.clientId);
    setProjectId(existingTemplate.projectId || "");
    setBillingDay(existingTemplate.billingDay);
    setIsActive(existingTemplate.isActive);
    setGstType(existingTemplate.gstType || "NONE");
    setGstRate(
      existingTemplate.gstType === "IGST"
        ? existingTemplate.igstPercent || 18
        : (existingTemplate.cgstPercent || 0) + (existingTemplate.sgstPercent || 0) || 18
    );
    setDiscount(existingTemplate.discount || 0);
    setNotes(existingTemplate.notes || "");
    setLineItems(
      existingTemplate.lineItems.map((item) => ({
        id: item.id || crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTemplate?.id]);

  const clientProjects = useMemo(() => {
    if (!allProjects || !clientId) return [];
    return allProjects.filter((p) => p.clientId === clientId);
  }, [allProjects, clientId]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const cgstPercent = gstType === "CGST_SGST" ? gstRate / 2 : 0;
  const sgstPercent = gstType === "CGST_SGST" ? gstRate / 2 : 0;
  const igstPercent = gstType === "IGST" ? gstRate : 0;
  const cgstAmount = gstType === "CGST_SGST" ? (subtotal * cgstPercent) / 100 : 0;
  const sgstAmount = gstType === "CGST_SGST" ? (subtotal * sgstPercent) / 100 : 0;
  const igstAmount = gstType === "IGST" ? (subtotal * igstPercent) / 100 : 0;
  const total = subtotal + cgstAmount + sgstAmount + igstAmount - discount;

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

  const addLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  const hasValidLineItems = lineItems.every((item) => item.description && item.amount > 0);
  const isValid = !!templateName.trim() && !!clientId && hasValidLineItems;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const lineItemsData = lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      }));
      const gstFields = {
        gstType,
        ...(gstType === "CGST_SGST" && { cgstPercent, sgstPercent }),
        ...(gstType === "IGST" && { igstPercent }),
      };

      if (isEditMode && id) {
        await updateMutation.mutateAsync({
          templateId: id,
          data: {
            templateName: templateName.trim(),
            clientId,
            projectId: projectId || undefined,
            lineItems: lineItemsData,
            discount,
            notes: notes || undefined,
            billingDay,
            isActive,
            ...gstFields,
          },
        });
        toast.success("Template updated successfully!");
        navigate("/finance/recurring");
        return;
      }

      await createMutation.mutateAsync({
        templateName: templateName.trim(),
        clientId,
        projectId: projectId || undefined,
        lineItems: lineItemsData,
        discount,
        notes: notes || undefined,
        frequency: "MONTHLY",
        billingDay,
        isActive,
        ...gstFields,
      });
      toast.success("Recurring template created successfully!");
      navigate("/finance/recurring");
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} template:`, error);
      toast.error(`Failed to ${isEditMode ? "update" : "create"} template`);
    }
  };

  if (loadingClients || (isEditMode && loadingTemplate)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditMode ? "Edit Recurring Template" : "New Recurring Template"}</h1>
          <p className="text-muted-foreground">
            Monthly charges like maintenance or hosting — generate a real Tax Invoice from this each month
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Acme Corp — Monthly Maintenance"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId("");
                }}
                options={clients?.map((c) => ({ value: c.id, label: c.companyName })) || []}
                placeholder="Select a client"
              />
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
            </div>
            <div className="space-y-2">
              <Label>Billing Day</Label>
              <Select
                value={billingDay.toString()}
                onChange={(e) => setBillingDay(Number(e.target.value))}
                options={BILLING_DAY_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">{isActive ? "Active — will be generated when due" : "Paused — won't be generated"}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate (₹)</div>
              <div className="col-span-2 text-right">Amount (₹)</div>
              <div className="col-span-1"></div>
            </div>

            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    placeholder="e.g. Monthly Maintenance"
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
                <div className="col-span-2 text-right font-medium">{formatCurrency(item.amount)}</div>
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

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-muted-foreground min-w-[80px]">GST Type</span>
                <Select
                  value={gstType}
                  onChange={(e) => setGstType(e.target.value as GSTType)}
                  options={GST_TYPE_OPTIONS}
                  className="w-64"
                />
                {gstType !== "NONE" && (
                  <Select
                    value={gstRate.toString()}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    options={GST_RATE_OPTIONS}
                    className="w-40"
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

              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Discount (₹)</span>
                  <Input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-32 h-8"
                  />
                </div>
                {discount > 0 && <span className="font-medium text-green-600">-{formatCurrency(discount)}</span>}
              </div>

              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">Total per cycle</span>
                <span className="font-bold">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Carried onto every invoice generated from this template..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? "Saving..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Template"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
