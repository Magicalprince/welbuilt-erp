import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Mail, Phone, Users, Building2, Zap } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";
import { useClients, useProjects, useInvoices } from "@/hooks/useFirestore";
import type { ClientStatus } from "@/types";
import SparkedClientsView from "./SparkedClientsView";

const statusFilters: { label: string; value: ClientStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Prospective", value: "PROSPECTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Inactive", value: "INACTIVE" },
];

export default function ClientsPage() {
  const [activeBrand, setActiveBrand] = useState<"sparks" | "sparked">("sparks");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "ALL">("ALL");

  const { data: clients, isLoading: loadingClients } = useClients();
  const { data: projects } = useProjects();
  const { data: invoices } = useInvoices();

  // Calculate stats for each client
  const clientsWithStats = useMemo(() => {
    if (!clients) return [];

    return clients.map((client) => {
      const clientProjects = projects?.filter((p) => p.clientId === client.id) || [];
      const clientInvoices = invoices?.filter((i) => i.clientId === client.id) || [];

      const projectCount = clientProjects.length;
      const totalValue = clientProjects.reduce((sum, p) => sum + p.value, 0);
      const paidAmount = clientInvoices.reduce((sum, i) => sum + i.paidAmount, 0);

      return {
        ...client,
        projectCount,
        totalValue,
        paidAmount,
      };
    });
  }, [clients, projects, invoices]);

  const filteredClients = useMemo(() => {
    return clientsWithStats.filter((client) => {
      const matchesSearch =
        client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || client.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clientsWithStats, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        {activeBrand === "sparks" && (
          <Link to="/clients/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveBrand("sparks")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            activeBrand === "sparks"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-transparent text-muted-foreground border-border hover:border-blue-400"
          )}
        >
          <Building2 className="h-3.5 w-3.5" /> Sparks AI
        </button>
        <button
          onClick={() => setActiveBrand("sparked")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            activeBrand === "sparked"
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-transparent text-muted-foreground border-border hover:border-amber-400"
          )}
        >
          <Zap className="h-3.5 w-3.5" /> SparkED
        </button>
      </div>

      {activeBrand === "sparked" ? (
        <SparkedClientsView />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
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

          {loadingClients ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <ClientCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No clients found</h3>
              <p className="text-muted-foreground">
                {clients && clients.length > 0
                  ? "Try adjusting your search or filter"
                  : "Get started by adding your first client"}
              </p>
              {clients && clients.length === 0 && (
                <Link to="/clients/new" className="mt-4 inline-block">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/clients/${client.id}`}>
                    <Card className="card-hover cursor-pointer h-full">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Avatar name={client.companyName} size="lg" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{client.companyName}</h3>
                              <StatusBadge status={client.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">{client.contactPerson}</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span className="truncate">{client.email}</span>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                          <div>
                            <p className="text-muted-foreground">Projects</p>
                            <p className="font-semibold">{client.projectCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Total Value</p>
                            <p className="font-semibold">{formatCurrency(client.totalValue)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mt-4 pt-4 border-t flex justify-between">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const config = {
    PROSPECTIVE: { label: "Prospective", variant: "secondary" as const },
    ACTIVE: { label: "Active", variant: "success" as const },
    COMPLETED: { label: "Completed", variant: "default" as const },
    INACTIVE: { label: "Inactive", variant: "destructive" as const },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}
