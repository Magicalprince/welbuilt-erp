import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Grid,
  List,
  LayoutGrid,
} from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Progress, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useProjects } from "@/hooks/useFirestore";
import type { Project, ProjectStatus } from "@/types";

const statusFilters: { label: string; value: ProjectStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Planning", value: "PLANNING" },
  { label: "Design", value: "DESIGN" },
  { label: "Development", value: "DEVELOPMENT" },
  { label: "Testing", value: "TESTING" },
  { label: "Deployment", value: "DEPLOYMENT" },
  { label: "Closure", value: "CLOSURE" },
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: projects, isLoading, error } = useProjects();

  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    return projects.filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.client?.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage and track all your projects</p>
        </div>
        <Link to="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading projects. Please try again.</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No projects found</h3>
          <p className="text-muted-foreground">
            {projects && projects.length > 0
              ? "Try adjusting your search or filter"
              : "Get started by creating your first project"}
          </p>
          {projects && projects.length === 0 && (
            <Link to="/projects/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredProjects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {filteredProjects.map((project, index) => (
            <ProjectListItem key={project.id} project={project} index={index} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Project Card Component
function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/projects/${project.id}`}>
        <Card className="card-hover cursor-pointer h-full">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg line-clamp-1">{project.title}</h3>
                <p className="text-sm text-muted-foreground">{project.client?.companyName || "No client"}</p>
              </div>
              <StatusBadge status={project.status} />
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {project.description || "No description"}
            </p>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />

              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Value</span>
                <span className="font-semibold">{formatCurrency(project.value)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due</span>
                <span>{project.endDate ? formatDate(project.endDate) : "TBD"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Project List Item Component
function ProjectListItem({ project, index }: { project: Project; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/projects/${project.id}`}>
        <Card className="card-hover cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold truncate">{project.title}</h3>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {project.client?.companyName || "No client"} • {project.description || "No description"}
                </p>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <div className="w-32">
                  <Progress value={project.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{project.progress}%</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(project.value)}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.endDate ? formatDate(project.endDate) : "TBD"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: ProjectStatus }) {
  const statusConfig: Record<ProjectStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
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
