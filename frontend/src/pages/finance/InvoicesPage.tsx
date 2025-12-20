import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, FileText } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInvoices, useClients } from "@/hooks/useFirestore";
import type { InvoiceStatus } from "@/types";

const statusFilters: { label: string; value: InvoiceStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Paid", value: "PAID" },
  { label: "Pending", value: "PENDING" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Overdue", value: "OVERDUE" },
];

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");

  const { data: invoices, isLoading, error } = useInvoices();
  const { data: clients } = useClients();

  // Create a map of client IDs to client names for easy lookup
  const clientMap = useMemo(() => {
    if (!clients) return {};
    return clients.reduce((acc, client) => {
      acc[client.id] = client.companyName;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  // Add client name to invoices
  const invoicesWithClientName = useMemo(() => {
    if (!invoices) return [];
    return invoices.map((invoice) => ({
      ...invoice,
      clientName: clientMap[invoice.clientId] || "Unknown Client",
    }));
  }, [invoices, clientMap]);

  const filteredInvoices = useMemo(() => {
    return invoicesWithClientName.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoicesWithClientName, searchQuery, statusFilter]);

  const totalPending = useMemo(() => {
    if (!invoices) return 0;
    return invoices
      .filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
      .reduce((acc, i) => acc + (i.total - i.paidAmount), 0);
  }, [invoices]);

  const totalOverdue = useMemo(() => {
    if (!invoices) return 0;
    return invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((acc, i) => acc + (i.total - i.paidAmount), 0);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Pending: {formatCurrency(totalPending)} • Overdue: {formatCurrency(totalOverdue)}
          </p>
        </div>
        <Link to="/finance/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
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
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading invoices. Please try again.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No invoices found</h3>
          <p className="text-muted-foreground">
            {invoices && invoices.length > 0
              ? "Try adjusting your search or filter"
              : "Get started by creating your first invoice"}
          </p>
          {(!invoices || invoices.length === 0) && (
            <Link to="/finance/invoices/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/finance/invoices/${invoice.id}`}>
                <Card className="card-hover">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                          <StatusBadge status={invoice.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {invoice.clientName} • Due: {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                        {invoice.paidAmount > 0 && invoice.paidAmount < invoice.total && (
                          <p className="text-sm text-green-600">
                            Paid: {formatCurrency(invoice.paidAmount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Phase-wise Payment Schedule */}
                    {invoice.payments && invoice.payments.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Payment Schedule</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {invoice.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className={`p-3 rounded-lg text-sm ${
                                payment.status === "PAID" ? "bg-green-500/10" : "bg-muted"
                              }`}
                            >
                              <p className="font-medium">{payment.description}</p>
                              <div className="flex justify-between mt-1">
                                <span>{formatCurrency(payment.amount)}</span>
                                <Badge
                                  variant={payment.status === "PAID" ? "success" : "secondary"}
                                  className="text-xs"
                                >
                                  {payment.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
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
