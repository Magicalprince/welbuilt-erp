import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Loader2, Building2, Trash2, MapPin } from "lucide-react";
import { Button, Input, Card, CardContent, Skeleton, Modal, Label, Textarea } from "@/components/ui";
import { useSparkedCollegesWithDepts, useCreateCollege, useDeleteCollege } from "@/hooks/useLeads";
import type { SparkedCollegeWithDepts, SparkedDepartment, SparkedDeptStatus } from "@/types";
import { SPARKED_DEPT_STATUS_LABELS } from "@/types";
import CollegeDetailView from "./CollegeDetailView";
import DepartmentDetailView from "./DepartmentDetailView";
import WorkshopDetailView from "./WorkshopDetailView";
import toast from "react-hot-toast";

function summarizeStatuses(departments: SparkedDepartment[]): string {
  if (departments.length === 0) return "No departments yet";
  const counts = new Map<SparkedDeptStatus, number>();
  departments.forEach((d) => counts.set(d.status, (counts.get(d.status) || 0) + 1));
  return Array.from(counts.entries())
    .map(([status, count]) => `${count} ${SPARKED_DEPT_STATUS_LABELS[status]}`)
    .join(" · ");
}

type SparkedView =
  | { type: "grid" }
  | { type: "college"; collegeId: string }
  | { type: "department"; collegeId: string; deptId: string }
  | { type: "workshop"; collegeId: string; deptId: string; workshopId: string };

export default function SparkedLeadsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewCollegeOpen, setIsNewCollegeOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SparkedCollegeWithDepts | null>(null);
  const [view, setView] = useState<SparkedView>({ type: "grid" });

  const { data: colleges, isLoading } = useSparkedCollegesWithDepts();
  const deleteMutation = useDeleteCollege();

  const filteredColleges = useMemo(() => {
    if (!colleges) return [];
    const q = searchQuery.toLowerCase();
    return colleges.filter(
      (c) =>
        !q ||
        c.college.collegeName.toLowerCase().includes(q) ||
        c.college.address.toLowerCase().includes(q)
    );
  }, [colleges, searchQuery]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.college.id);
      toast.success("College deleted");
      setDeleteConfirm(null);
      if (view.type !== "grid" && view.collegeId === deleteConfirm.college.id) {
        setView({ type: "grid" });
      }
    } catch {
      toast.error("Failed to delete college");
    }
  };

  if (view.type === "workshop") {
    return (
      <WorkshopDetailView
        workshopId={view.workshopId}
        onBack={() => setView({ type: "department", collegeId: view.collegeId, deptId: view.deptId })}
      />
    );
  }

  if (view.type === "department") {
    return (
      <DepartmentDetailView
        collegeId={view.collegeId}
        deptId={view.deptId}
        onBack={() => setView({ type: "college", collegeId: view.collegeId })}
        onOpenWorkshop={(workshopId) =>
          setView({ type: "workshop", collegeId: view.collegeId, deptId: view.deptId, workshopId })
        }
      />
    );
  }

  if (view.type === "college") {
    return (
      <CollegeDetailView
        collegeId={view.collegeId}
        onBack={() => setView({ type: "grid" })}
        onOpenDepartment={(deptId) => setView({ type: "department", collegeId: view.collegeId, deptId })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search colleges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsNewCollegeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New College
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filteredColleges.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No colleges found</h3>
          <p className="text-muted-foreground">
            {colleges && colleges.length > 0
              ? "Try adjusting your search"
              : "Get started by adding your first college"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredColleges.map((c, index) => (
            <motion.div
              key={c.college.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="card-hover cursor-pointer h-full"
                onClick={() => setView({ type: "college", collegeId: c.college.id })}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{c.college.collegeName}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.college.address}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(c);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t text-sm">
                    <p className="text-muted-foreground text-xs">{summarizeStatuses(c.departments)}</p>
                    <p className="mt-2 font-medium">
                      {c.departments.length} department{c.departments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <NewCollegeModal isOpen={isNewCollegeOpen} onClose={() => setIsNewCollegeOpen(false)} />

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete College">
        <p>Are you sure you want to delete {deleteConfirm?.college.collegeName}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete all {deleteConfirm?.departments.length || 0} department
          {deleteConfirm?.departments.length !== 1 ? "s" : ""} and their follow-up history. This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// New College Modal
// ============================================
const emptyCollegeForm = { collegeName: "", address: "" };

function NewCollegeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createMutation = useCreateCollege();
  const [formData, setFormData] = useState(emptyCollegeForm);

  const handleClose = () => {
    setFormData(emptyCollegeForm);
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.collegeName.trim() || !formData.address.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await createMutation.mutateAsync({
        collegeName: formData.collegeName.trim(),
        address: formData.address.trim(),
      });
      toast.success("College added");
      setFormData(emptyCollegeForm);
      onClose();
    } catch {
      toast.error("Failed to add college");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New College">
      <div className="space-y-4">
        <div>
          <Label>College Name *</Label>
          <Input
            value={formData.collegeName}
            onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
            placeholder="College/University name"
          />
        </div>
        <div>
          <Label>Address *</Label>
          <Textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Full address"
          />
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
