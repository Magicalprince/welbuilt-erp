import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Plus,
  Pin,
  Loader2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Progress,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Checkbox,
  Skeleton,
  Modal,
  Input,
  Label,
} from "@/components/ui";
import { cn, formatCurrency, formatDate, getRelativeTime } from "@/lib/utils";
import {
  useProject,
  useClient,
  useNotesByProject,
  useDocumentsByProject,
  useInvoicesByProject,
  useToggleMVPFeature,
  useAddMVPFeature,
  useUpdatePhaseStatus,
  useDeleteProject,
} from "@/hooks/useFirestore";
import type { ProjectStatus } from "@/types";
import toast from "react-hot-toast";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Modal state for adding MVP feature
  const [showMVPModal, setShowMVPModal] = useState(false);
  const [newMVPName, setNewMVPName] = useState("");

  const { data: project, isLoading: loadingProject } = useProject(id || "");
  const { data: client } = useClient(project?.clientId || "");
  const { data: notes } = useNotesByProject(id || "");
  const { data: documents } = useDocumentsByProject(id || "");
  const { data: invoices } = useInvoicesByProject(id || "");

  const toggleMVPMutation = useToggleMVPFeature();
  const addMVPMutation = useAddMVPFeature();
  const updatePhaseMutation = useUpdatePhaseStatus();
  const deleteProjectMutation = useDeleteProject();

  // Calculate financials from invoices for this project
  const financials = useMemo(() => {
    if (!invoices) return { paid: 0, pending: 0 };
    const paid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const pending = invoices.reduce(
      (sum, inv) => sum + (inv.total - inv.paidAmount),
      0
    );
    return { paid, pending };
  }, [invoices]);

  // Calculate progress based on phases and MVP features
  const progressInfo = useMemo(() => {
    if (!project) return { progress: 0, completedItems: 0, totalItems: 0 };

    const phases = project.phases || [];
    const mvpFeatures = project.mvpFeatures || [];

    const completedPhases = phases.filter((p) => p.status === "completed").length;
    const checkedMVPs = mvpFeatures.filter((m) => m.isChecked).length;
    const totalItems = phases.length + mvpFeatures.length;
    const completedItems = completedPhases + checkedMVPs;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return { progress, completedItems, totalItems };
  }, [project]);

  const handleMVPToggle = async (mvpId: string, currentChecked: boolean) => {
    if (!id) return;
    try {
      await toggleMVPMutation.mutateAsync({
        mvpId,
        isChecked: !currentChecked,
        projectId: id,
      });
    } catch {
      toast.error("Failed to update MVP feature");
    }
  };

  const handlePhaseToggle = async (
    phaseId: string,
    currentStatus: "pending" | "in_progress" | "completed"
  ) => {
    if (!id) return;
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await updatePhaseMutation.mutateAsync({
        phaseId,
        status: newStatus,
        projectId: id,
      });
    } catch {
      toast.error("Failed to update phase status");
    }
  };

  const handleAddMVP = async () => {
    if (!id || !newMVPName.trim()) {
      toast.error("Please enter a feature name");
      return;
    }
    try {
      await addMVPMutation.mutateAsync({
        projectId: id,
        name: newMVPName.trim(),
      });
      toast.success("MVP feature added");
      setNewMVPName("");
      setShowMVPModal(false);
    } catch {
      toast.error("Failed to add MVP feature");
    }
  };

  const handleDelete = async () => {
    if (!project || !id) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${project.title}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteProjectMutation.mutateAsync(id);
        toast.success("Project deleted successfully");
        navigate("/projects");
      } catch {
        toast.error("Failed to delete project");
      }
    }
  };

  if (loadingProject) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <p className="text-muted-foreground mt-2">
          The project you're looking for doesn't exist.
        </p>
        <Link to="/projects" className="mt-4 inline-block">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const phases = project.phases || [];
  const mvpFeatures = project.mvpFeatures || [];
  const checkedMVPs = mvpFeatures.filter((m) => m.isChecked).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              Client: {client?.companyName || "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${id}/edit`}>
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

      {/* Project Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project Value</p>
                <p className="font-semibold">{formatCurrency(project.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="font-semibold">{formatCurrency(financials.paid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-semibold">
                  {project.endDate ? formatDate(project.endDate) : "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <User className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="font-semibold">
                  {client?.contactPerson || "Loading..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Project Progress</h3>
              <p className="text-sm text-muted-foreground">
                {progressInfo.completedItems} of {progressInfo.totalItems} items completed
              </p>
            </div>
            <span className="text-2xl font-bold">{progressInfo.progress}%</span>
          </div>
          <Progress value={progressInfo.progress} className="h-3" />

          {/* Phase Progress Bar */}
          {phases.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Milestone Phases</h4>
              <div className="flex flex-wrap items-center gap-2">
                {phases.map((phase, index) => (
                  <div key={phase.id} className="flex items-center">
                    <button
                      onClick={() => handlePhaseToggle(phase.id, phase.status)}
                      disabled={updatePhaseMutation.isPending}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        phase.status === "completed"
                          ? "bg-green-500 text-white"
                          : phase.status === "in_progress"
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {phase.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {phase.name}
                    </button>
                    {index < phases.length - 1 && (
                      <div
                        className={cn(
                          "w-8 h-0.5 mx-1",
                          phases[index].status === "completed"
                            ? "bg-green-500"
                            : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mvp">MVP Features ({mvpFeatures.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents?.length || 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {project.description || "No description provided"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Scope</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                  {project.scope || "No scope defined"}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mvp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>MVP Features Checklist</span>
                <Badge variant="secondary">
                  {checkedMVPs}/{mvpFeatures.length} completed
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Check off features as they are completed. Progress will be
                automatically updated.
              </p>
              {mvpFeatures.length > 0 ? (
                <div className="space-y-3">
                  {mvpFeatures.map((mvp, index) => (
                    <motion.div
                      key={mvp.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                        mvp.isChecked
                          ? "bg-green-500/5 border-green-500/20"
                          : "hover:bg-accent"
                      )}
                    >
                      <Checkbox
                        id={mvp.id}
                        checked={mvp.isChecked}
                        onChange={() => handleMVPToggle(mvp.id, mvp.isChecked)}
                        disabled={toggleMVPMutation.isPending}
                      />
                      <label
                        htmlFor={mvp.id}
                        className={cn(
                          "flex-1 cursor-pointer",
                          mvp.isChecked && "line-through text-muted-foreground"
                        )}
                      >
                        {mvp.name}
                      </label>
                      {mvp.isChecked && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No MVP features defined yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowMVPModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add MVP Feature
                  </Button>
                </div>
              )}
              {mvpFeatures.length > 0 && (
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setShowMVPModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add MVP Feature
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Project Documents
              </CardTitle>
              <Link to={`/documents?projectId=${id}`}>
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
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.type} • {getRelativeTime(doc.createdAt)}
                          </p>
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
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Project Notes
              </CardTitle>
              <Link to={`/notes/new?projectId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {note.isPinned && (
                            <Pin className="h-4 w-4 text-primary shrink-0 mt-1" />
                          )}
                          <div>
                            <p className="font-medium">{note.title}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {note.content}
                            </p>
                          </div>
                        </div>
                        {note.isPinned && <Badge variant="secondary">Pinned</Badge>}
                      </div>
                      {note.checkpoints && note.checkpoints.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {note.checkpoints.slice(0, 3).map((checkpoint) => (
                            <div
                              key={checkpoint.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center",
                                  checkpoint.isChecked
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground"
                                )}
                              >
                                {checkpoint.isChecked && (
                                  <span className="text-white text-xs">✓</span>
                                )}
                              </div>
                              <span
                                className={
                                  checkpoint.isChecked
                                    ? "line-through text-muted-foreground"
                                    : ""
                                }
                              >
                                {checkpoint.text}
                              </span>
                            </div>
                          ))}
                          {note.checkpoints.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{note.checkpoints.length - 3} more items
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {getRelativeTime(note.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notes added yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add MVP Feature Modal */}
      <Modal isOpen={showMVPModal} onClose={() => { setShowMVPModal(false); setNewMVPName(""); }} title="Add MVP Feature">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mvpName">Feature Name</Label>
            <Input
              id="mvpName"
              value={newMVPName}
              onChange={(e) => setNewMVPName(e.target.value)}
              placeholder="e.g., User Authentication, Payment Integration"
              onKeyPress={(e) => e.key === "Enter" && handleAddMVP()}
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowMVPModal(false); setNewMVPName(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddMVP} disabled={!newMVPName.trim() || addMVPMutation.isPending}>
              {addMVPMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Feature"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: ProjectStatus }) {
  const statusConfig: Record<
    ProjectStatus,
    { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
  > = {
    PLANNING: { label: "Planning", variant: "secondary" },
    DESIGN: { label: "Design", variant: "default" },
    DEVELOPMENT: { label: "Development", variant: "default" },
    TESTING: { label: "Testing", variant: "warning" },
    DEPLOYMENT: { label: "Deployment", variant: "success" },
    CLOSURE: { label: "Closure", variant: "success" },
    ON_HOLD: { label: "On Hold", variant: "destructive" },
  };

  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
