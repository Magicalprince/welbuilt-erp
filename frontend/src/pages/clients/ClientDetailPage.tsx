import { useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Mail, Phone, MapPin, Trash2, FileText, Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Avatar, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate, getRelativeTime } from "@/lib/utils";
import { useClient, useProjectsByClient, useInvoicesByClient, useNotesByClient, useDocumentsByClient, useDeleteClient } from "@/hooks/useFirestore";
import type { ClientStatus, ProjectStatus, InvoiceStatus } from "@/types";
import toast from "react-hot-toast";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading: loadingClient } = useClient(id || "");
  const { data: projects, isLoading: loadingProjects } = useProjectsByClient(id || "");
  const { data: invoices, isLoading: loadingInvoices } = useInvoicesByClient(id || "");
  const { data: notes } = useNotesByClient(id || "");
  const { data: documents } = useDocumentsByClient(id || "");
  const deleteClientMutation = useDeleteClient();

  const financials = useMemo(() => {
    if (!invoices) return { paid: 0, pending: 0, totalInvoices: 0 };

    const paid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const pending = invoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);

    return {
      paid,
      pending,
      totalInvoices: invoices.length,
    };
  }, [invoices]);

  const handleDelete = async () => {
    if (!client || !id) return;

    if (window.confirm(`Are you sure you want to delete ${client.companyName}? This action cannot be undone.`)) {
      try {
        await deleteClientMutation.mutateAsync(id);
        toast.success("Client deleted successfully");
        navigate("/clients");
      } catch {
        toast.error("Failed to delete client");
      }
    }
  };

  if (loadingClient) {
    return <ClientDetailSkeleton />;
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Client not found</h2>
        <p className="text-muted-foreground mt-2">The client you're looking for doesn't exist.</p>
        <Link to="/clients" className="mt-4 inline-block">
          <Button>Back to Clients</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar name={client.companyName} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{client.companyName}</h1>
                <StatusBadge status={client.status} />
              </div>
              <p className="text-muted-foreground">Client since {formatDate(client.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/clients/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${client.email}`} className="font-medium hover:underline">
                  {client.email}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{client.phone || "Not provided"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{client.address || "Not provided"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {client.source && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Source: <span className="font-medium text-foreground">{client.source}</span></p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects ({projects?.length || 0})</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents?.length || 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projects</CardTitle>
              <Link to={`/projects/new?clientId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : projects && projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <Link key={project.id} to={`/projects/${project.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                        <div>
                          <p className="font-medium">{project.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <ProjectStatusBadge status={project.status} />
                            <span className="text-sm text-muted-foreground">{project.progress}% complete</span>
                          </div>
                        </div>
                        <p className="font-semibold">{formatCurrency(project.value)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No projects yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Financial Summary</CardTitle>
              <Link to={`/finance/invoices/new?clientId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="p-4 rounded-lg bg-green-500/10">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(financials.paid)}</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(financials.pending)}</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold text-primary">{financials.totalInvoices}</p>
                </div>
              </div>

              {loadingInvoices ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium mb-2">Recent Invoices</h4>
                  {invoices.slice(0, 5).map((invoice) => (
                    <Link key={invoice.id} to={`/finance/invoices/${invoice.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <InvoiceStatusBadge status={invoice.status} />
                            <span className="text-sm text-muted-foreground">Due: {formatDate(invoice.dueDate)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                          <p className="text-sm text-muted-foreground">Paid: {formatCurrency(invoice.paidAmount)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No invoices yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Link to={`/documents?clientId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.type} • {getRelativeTime(doc.createdAt)}</p>
                        </div>
                      </div>
                      {doc.fileUrl && (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            Download
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No documents yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Notes</CardTitle>
              <Link to={`/notes?clientId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {client.notes && (
                <div className="p-4 rounded-lg bg-muted mb-4">
                  <p className="text-sm font-medium mb-1">Client Notes</p>
                  <p className="text-muted-foreground">{client.notes}</p>
                </div>
              )}

              {notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{note.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                        </div>
                        {note.isPinned && <Badge variant="secondary">Pinned</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{getRelativeTime(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : !client.notes ? (
                <p className="text-center py-8 text-muted-foreground">No notes yet</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
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

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config: Record<ProjectStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
    PLANNING: { label: "Planning", variant: "secondary" },
    DESIGN: { label: "Design", variant: "default" },
    DEVELOPMENT: { label: "Development", variant: "default" },
    TESTING: { label: "Testing", variant: "warning" },
    DEPLOYMENT: { label: "Deployment", variant: "success" },
    CLOSURE: { label: "Completed", variant: "success" },
    ON_HOLD: { label: "On Hold", variant: "destructive" },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
    DRAFT: { label: "Draft", variant: "secondary" },
    PENDING: { label: "Pending", variant: "warning" },
    PAID: { label: "Paid", variant: "success" },
    PARTIAL: { label: "Partial", variant: "default" },
    OVERDUE: { label: "Overdue", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}
