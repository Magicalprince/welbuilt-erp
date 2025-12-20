import { useState, useMemo } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Select,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import { useClients, useProject, useCreateProject, useUpdateProject } from "@/hooks/useFirestore";
import type { ProjectStatus } from "@/types";
import toast from "react-hot-toast";

const statusOptions = [
  { value: "PLANNING", label: "Planning" },
  { value: "DESIGN", label: "Design" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "TESTING", label: "Testing" },
  { value: "DEPLOYMENT", label: "Deployment" },
  { value: "CLOSURE", label: "Closure" },
  { value: "ON_HOLD", label: "On Hold" },
];

interface FormData {
  title: string;
  clientId: string;
  description: string;
  scope: string;
  value: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
}

const initialFormData: FormData = {
  title: "",
  clientId: "",
  description: "",
  scope: "",
  value: "",
  startDate: "",
  endDate: "",
  status: "PLANNING",
};

// Helper to format date for input
function formatDateForInput(date: Date | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export default function ProjectFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // Get pre-selected clientId from URL params (when coming from client detail page)
  const preSelectedClientId = searchParams.get("clientId") || "";

  // Fetch clients from Firestore
  const { data: clients, isLoading: loadingClients } = useClients();

  // Fetch existing project if editing
  const { data: existingProject, isLoading: loadingProject } = useProject(id || "");

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  // Create client options for dropdown
  const clientOptions = useMemo(() => {
    if (!clients) return [];
    return clients.map((client) => ({
      value: client.id,
      label: client.companyName,
    }));
  }, [clients]);

  // Derive initial form data from existing project or use defaults
  const derivedFormData: FormData = useMemo(() => {
    if (isEditing && existingProject) {
      return {
        title: existingProject.title || "",
        clientId: existingProject.clientId || "",
        description: existingProject.description || "",
        scope: existingProject.scope || "",
        value: existingProject.value?.toString() || "",
        startDate: formatDateForInput(existingProject.startDate),
        endDate: formatDateForInput(existingProject.endDate),
        status: existingProject.status || "PLANNING",
      };
    }
    // For new projects, pre-fill clientId if provided in URL
    return {
      ...initialFormData,
      clientId: preSelectedClientId,
    };
  }, [isEditing, existingProject, preSelectedClientId]);

  // Track local edits
  const [formEdits, setFormEdits] = useState<FormData | null>(null);
  const formData = formEdits ?? derivedFormData;

  const setFormData = (data: FormData) => {
    setFormEdits(data);
  };

  const [mvpFeatures, setMvpFeatures] = useState<string[]>([]);
  const [newMvpFeature, setNewMvpFeature] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddMvpFeature = () => {
    if (newMvpFeature.trim()) {
      setMvpFeatures((prev) => [...prev, newMvpFeature.trim()]);
      setNewMvpFeature("");
    }
  };

  const handleRemoveMvpFeature = (index: number) => {
    setMvpFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid = formData.title.trim() && formData.clientId && formData.value && formData.startDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Build project data, excluding undefined values (Firestore doesn't accept undefined)
      const projectData = {
        title: formData.title.trim(),
        clientId: formData.clientId,
        value: Number(formData.value),
        startDate: new Date(formData.startDate),
        status: formData.status,
        // Use empty string instead of undefined for optional fields
        description: formData.description.trim() || "",
        scope: formData.scope.trim() || "",
        ...(formData.endDate ? { endDate: new Date(formData.endDate) } : {}),
      };

      if (isEditing && id) {
        await updateProjectMutation.mutateAsync({
          projectId: id,
          data: projectData,
        });
        toast.success("Project updated successfully");
        navigate(`/projects/${id}`);
      } else {
        const newProjectId = await createProjectMutation.mutateAsync({
          data: projectData,
          mvpFeatures: mvpFeatures.length > 0 ? mvpFeatures : undefined,
        });
        toast.success("Project created successfully");
        navigate(`/projects/${newProjectId}`);
      }
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error(isEditing ? "Failed to update project" : "Failed to create project");
    }
  };

  const isPending = createProjectMutation.isPending || updateProjectMutation.isPending;

  // Loading state for edit mode
  if (isEditing && loadingProject) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Not found state for edit mode
  if (isEditing && !existingProject && !loadingProject) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <p className="text-muted-foreground mt-2">The project you're trying to edit doesn't exist.</p>
        <Button onClick={() => navigate("/projects")} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Project" : "New Project"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update project details" : "Create a new project with milestones and MVP features"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="E-commerce Platform"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client <span className="text-destructive">*</span></Label>
                {loadingClients ? (
                  <Skeleton className="h-10 w-full" />
                ) : clientOptions.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">No clients available</p>
                    <Link to="/clients/new">
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Client First
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Select
                    id="clientId"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleInputChange}
                    options={clientOptions}
                    placeholder="Select a client"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the project..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Textarea
                id="scope"
                name="scope"
                value={formData.scope}
                onChange={handleInputChange}
                placeholder="• Frontend: React + Next.js&#10;• Backend: Node.js&#10;• Features: ..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="value">Project Value (₹) <span className="text-destructive">*</span></Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  value={formData.value}
                  onChange={handleInputChange}
                  placeholder="150000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  options={statusOptions}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Expected End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Phases Info */}
        <Card>
          <CardHeader>
            <CardTitle>Milestone Phases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The following default phases will be automatically created for this project:
            </p>
            <div className="flex flex-wrap gap-2">
              {["Planning", "Design", "Development", "Testing", "Deployment", "Closure"].map(
                (phase, index) => (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-3 py-2 rounded-lg bg-muted text-sm font-medium"
                  >
                    {index + 1}. {phase}
                  </motion.div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* MVP Features - Only show for new projects */}
        {!isEditing && (
          <Card>
            <CardHeader>
              <CardTitle>MVP Features (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add custom MVP features that will appear as checkboxes in the project overview.
                Checking these boxes will update the project progress.
              </p>

              {/* Add MVP Feature */}
              <div className="flex gap-2">
                <Input
                  value={newMvpFeature}
                  onChange={(e) => setNewMvpFeature(e.target.value)}
                  placeholder="e.g., User Authentication, Payment Integration"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMvpFeature())}
                />
                <Button type="button" onClick={handleAddMvpFeature}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* MVP Features List */}
              {mvpFeatures.length > 0 && (
                <div className="space-y-2">
                  {mvpFeatures.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                        <span>{feature}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMvpFeature(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}

              {mvpFeatures.length === 0 && (
                <p className="text-center py-4 text-sm text-muted-foreground">
                  No MVP features added yet. Add features to track specific deliverables.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Link to="/projects">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!isValid || isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Update Project" : "Create Project"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
