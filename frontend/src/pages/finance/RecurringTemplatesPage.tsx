import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Repeat, Pencil, Trash2, Zap, CheckCircle2 } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Skeleton, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  useRecurringTemplates,
  useClients,
  useDeleteRecurringTemplate,
  useGenerateInvoiceFromTemplate,
} from "@/hooks/useFirestore";
import { getDueTemplates } from "@/services/recurringInvoiceService";
import toast from "react-hot-toast";
import type { RecurringInvoiceTemplate } from "@/types";

function currentPeriodLabel(): string {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function RecurringTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<RecurringInvoiceTemplate | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useRecurringTemplates();
  const { data: clients } = useClients();
  const deleteMutation = useDeleteRecurringTemplate();
  const generateMutation = useGenerateInvoiceFromTemplate();

  const clientMap = useMemo(() => {
    if (!clients) return {};
    return clients.reduce((acc, client) => {
      acc[client.id] = client.companyName;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  const dueTemplates = useMemo(() => getDueTemplates(templates || []), [templates]);
  const dueIds = useMemo(() => new Set(dueTemplates.map((t) => t.id)), [dueTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        !q ||
        t.templateName.toLowerCase().includes(q) ||
        (clientMap[t.clientId] || "").toLowerCase().includes(q)
    );
  }, [templates, searchQuery, clientMap]);

  const handleGenerate = async (template: RecurringInvoiceTemplate) => {
    setGeneratingId(template.id);
    try {
      await generateMutation.mutateAsync(template);
      toast.success(`Invoice generated for ${template.templateName}`);
    } catch (error) {
      console.error("Failed to generate invoice from template:", error);
      toast.error(`Failed to generate invoice for ${template.templateName}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAllDue = async () => {
    for (const template of dueTemplates) {
      await handleGenerate(template);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Template deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recurring Invoices</h1>
          <p className="text-muted-foreground">
            Monthly charges like maintenance or hosting — generate Tax Invoices on demand
          </p>
        </div>
        <Link to="/finance/recurring/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </Link>
      </div>

      {dueTemplates.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-600" />
              <p className="text-sm">
                <strong>{dueTemplates.length}</strong> invoice{dueTemplates.length > 1 ? "s" : ""} due for{" "}
                {currentPeriodLabel()}
              </p>
            </div>
            <Button size="sm" onClick={handleGenerateAllDue} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? "Generating..." : "Generate All Due"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <Repeat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No recurring templates found</h3>
          <p className="text-muted-foreground">
            {templates && templates.length > 0
              ? "Try adjusting your search"
              : "Set up a template for monthly maintenance, hosting, or other recurring charges"}
          </p>
          {(!templates || templates.length === 0) && (
            <Link to="/finance/recurring/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((template, index) => {
            const total = template.lineItems.reduce((sum, item) => sum + item.amount, 0) - template.discount;
            const isDue = dueIds.has(template.id);
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={isDue ? "border-amber-500/40" : ""}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold">{template.templateName}</h3>
                          {!template.isActive && <Badge variant="secondary">Paused</Badge>}
                          {isDue && <Badge variant="warning">Due now</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {clientMap[template.clientId] || "Unknown Client"} • Bills on day {template.billingDay} of
                          each month
                        </p>
                        {template.lastGeneratedPeriod && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last generated: {template.lastGeneratedPeriod}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-bold mr-2">{formatCurrency(total)}</p>
                        {isDue ? (
                          <Button
                            size="sm"
                            onClick={() => handleGenerate(template)}
                            disabled={generatingId === template.id}
                          >
                            {generatingId === template.id ? "Generating..." : "Generate"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Up to date
                          </Button>
                        )}
                        <Link to={`/finance/recurring/${template.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(template)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Template">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete <strong>{deleteConfirm?.templateName}</strong>? Invoices already generated
          from it are not affected. This cannot be undone.
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
