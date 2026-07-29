import { useState, useEffect } from "react";
import { ArrowLeft, Plus, FileSignature, MapPin, Trash2, Pencil, Check, X } from "lucide-react";
import { Button, Card, CardContent, Badge, Skeleton, Modal, Label, Input, Textarea } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useSparkedCollege,
  useCreateDepartment,
  useSignCollegeWideMou,
  useDeleteDepartment,
  useUpdateCollege,
} from "@/hooks/useLeads";
import type { SparkedCollege, SparkedDepartment, SparkedDeptStatus } from "@/types";
import { SPARKED_DEPT_STATUS_LABELS } from "@/types";
import toast from "react-hot-toast";

function statusBadgeVariant(status: SparkedDeptStatus): "secondary" | "warning" | "destructive" | "success" | "default" {
  switch (status) {
    case "NEW":
      return "secondary";
    case "IN_CONVERSATION":
      return "warning";
    case "DROPPED":
      return "destructive";
    case "CONVERTED":
      return "success";
    case "MOU_SIGNED":
      return "default";
  }
}

interface CollegeDetailViewProps {
  collegeId: string;
  onBack: () => void;
  onOpenDepartment: (deptId: string) => void;
}

export default function CollegeDetailView({ collegeId, onBack, onOpenDepartment }: CollegeDetailViewProps) {
  const { data, isLoading } = useSparkedCollege(collegeId);
  const signCollegeWideMutation = useSignCollegeWideMou();
  const deleteDeptMutation = useDeleteDepartment();
  const updateCollegeMutation = useUpdateCollege();

  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isMouConfirmOpen, setIsMouConfirmOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SparkedDepartment | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const college = data?.college;
  const departments = data?.departments || [];
  const hasUnsignedDept = departments.some((d) => d.status !== "MOU_SIGNED");

  const handleSignCollegeWide = async () => {
    if (!college) return;
    try {
      await signCollegeWideMutation.mutateAsync(college.id);
      toast.success("College-wide MOU signed");
      setIsMouConfirmOpen(false);
    } catch {
      toast.error("Failed to sign college-wide MOU");
    }
  };

  const handleDeleteDept = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDeptMutation.mutateAsync(deleteConfirm.id);
      toast.success("Department deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete department");
    }
  };

  const handleSaveInfo = async (data: Partial<Omit<SparkedCollege, "id" | "createdAt" | "updatedAt">>) => {
    try {
      await updateCollegeMutation.mutateAsync({ id: collegeId, data });
      toast.success("College updated");
      setIsEditingInfo(false);
    } catch {
      toast.error("Failed to update college");
    }
  };

  if (isLoading || !college) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isEditingInfo ? (
            <div className="flex-1 min-w-0 max-w-md">
              <EditCollegeInfoForm
                college={college}
                onSave={handleSaveInfo}
                onCancel={() => setIsEditingInfo(false)}
                isSaving={updateCollegeMutation.isPending}
              />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{college.collegeName}</h1>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => setIsEditingInfo(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{college.address}</span>
              </div>
            </div>
          )}
        </div>
        {!isEditingInfo && hasUnsignedDept && departments.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setIsMouConfirmOpen(true)}
            disabled={signCollegeWideMutation.isPending}
          >
            <FileSignature className="h-4 w-4 mr-2" />
            Sign College-Wide MOU
          </Button>
        )}
      </div>

      {isMouConfirmOpen && (
        <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
          <p className="text-sm">
            This will mark <strong>ALL</strong> departments at {college.collegeName} as MOU Signed. Are you sure?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsMouConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSignCollegeWide} disabled={signCollegeWideMutation.isPending}>
              {signCollegeWideMutation.isPending ? "Signing..." : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Departments ({departments.length})</h3>
            <Button size="sm" onClick={() => setIsAddDeptOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Department
            </Button>
          </div>

          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No departments added yet</p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onOpenDepartment(dept.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{dept.deptName}</p>
                        <Badge variant={statusBadgeVariant(dept.status)} className="text-xs">
                          {SPARKED_DEPT_STATUS_LABELS[dept.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dept.contactName} · {dept.contactNumber}
                      </p>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <span>First spoken: {formatDate(dept.dateFirstSpoken)}</span>
                        {dept.rateDiscussed !== undefined && <span>Rate: {formatCurrency(dept.rateDiscussed)}</span>}
                        {dept.approxCount !== undefined && <span>Count: ~{dept.approxCount}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(dept);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddDepartmentModal isOpen={isAddDeptOpen} collegeId={collegeId} onClose={() => setIsAddDeptOpen(false)} />

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Department">
        <p>Are you sure you want to delete {deleteConfirm?.deptName}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete its follow-up history. This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDeleteDept}
            disabled={deleteDeptMutation.isPending}
          >
            {deleteDeptMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// Add Department Modal
// ============================================
function AddDepartmentModal({
  isOpen,
  collegeId,
  onClose,
}: {
  isOpen: boolean;
  collegeId: string;
  onClose: () => void;
}) {
  const createMutation = useCreateDepartment();

  const buildEmptyForm = () => ({
    deptName: "",
    contactName: "",
    contactNumber: "",
    contactEmail: "",
    approachedByName: "",
    approachedByNumber: "",
    dateFirstSpoken: new Date().toISOString().split("T")[0],
    meetingDescription: "",
    rateDiscussed: "",
    approxCount: "",
    notes: "",
  });
  const [formData, setFormData] = useState(buildEmptyForm);

  const handleClose = () => {
    setFormData(buildEmptyForm());
    onClose();
  };

  const handleSubmit = async () => {
    if (
      !formData.deptName.trim() ||
      !formData.contactName.trim() ||
      !formData.contactNumber.trim() ||
      !formData.approachedByName.trim() ||
      !formData.approachedByNumber.trim() ||
      !formData.dateFirstSpoken ||
      !formData.meetingDescription.trim()
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await createMutation.mutateAsync({
        collegeId,
        deptName: formData.deptName.trim(),
        contactName: formData.contactName.trim(),
        contactNumber: formData.contactNumber.trim(),
        contactEmail: formData.contactEmail.trim() || undefined,
        approachedByName: formData.approachedByName.trim(),
        approachedByNumber: formData.approachedByNumber.trim(),
        dateFirstSpoken: new Date(formData.dateFirstSpoken),
        meetingDescription: formData.meetingDescription.trim(),
        rateDiscussed: formData.rateDiscussed ? Number(formData.rateDiscussed) : undefined,
        approxCount: formData.approxCount ? Number(formData.approxCount) : undefined,
        notes: formData.notes.trim() || undefined,
      });
      toast.success("Department added");
      setFormData(buildEmptyForm());
      onClose();
    } catch {
      toast.error("Failed to add department");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Department">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Department Name *</Label>
            <Input
              value={formData.deptName}
              onChange={(e) => setFormData({ ...formData, deptName: e.target.value })}
              placeholder="e.g., Computer Science"
            />
          </div>
          <div>
            <Label>Contact Name *</Label>
            <Input
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            />
          </div>
          <div>
            <Label>Contact Number *</Label>
            <Input
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Our Point of Contact</h4>
          </div>

          <div>
            <Label>Approached By *</Label>
            <Input
              value={formData.approachedByName}
              onChange={(e) => setFormData({ ...formData, approachedByName: e.target.value })}
              placeholder="Who from our team spoke to them"
            />
          </div>
          <div>
            <Label>Approached By Number *</Label>
            <Input
              value={formData.approachedByNumber}
              onChange={(e) => setFormData({ ...formData, approachedByNumber: e.target.value })}
            />
          </div>

          <div>
            <Label>Date First Spoken *</Label>
            <Input
              type="date"
              value={formData.dateFirstSpoken}
              onChange={(e) => setFormData({ ...formData, dateFirstSpoken: e.target.value })}
            />
          </div>
          <div>
            <Label>Rate Discussed (₹)</Label>
            <Input
              type="number"
              value={formData.rateDiscussed}
              onChange={(e) => setFormData({ ...formData, rateDiscussed: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="col-span-2">
            <Label>Meeting Description *</Label>
            <Textarea
              value={formData.meetingDescription}
              onChange={(e) => setFormData({ ...formData, meetingDescription: e.target.value })}
              placeholder="What was discussed?"
            />
          </div>
          <div>
            <Label>Approx. Count</Label>
            <Input
              type="number"
              value={formData.approxCount}
              onChange={(e) => setFormData({ ...formData, approxCount: e.target.value })}
              placeholder="Number of students"
            />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add Department"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Edit College Info Form
// ============================================
function EditCollegeInfoForm({
  college,
  onSave,
  onCancel,
  isSaving,
}: {
  college: SparkedCollege;
  onSave: (data: Partial<Omit<SparkedCollege, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const buildForm = () => ({ collegeName: college.collegeName, address: college.address });
  const [formData, setFormData] = useState(buildForm);

  useEffect(() => {
    setFormData(buildForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college.id]);

  const handleSubmit = async () => {
    if (!formData.collegeName.trim() || !formData.address.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    await onSave({ collegeName: formData.collegeName.trim(), address: formData.address.trim() });
  };

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-card">
      <div>
        <Label className="text-xs">College Name *</Label>
        <Input value={formData.collegeName} onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Address *</Label>
        <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="min-h-[60px]" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
          <Check className="h-3.5 w-3.5 mr-1" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
