import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Loader2,
  Building2,
  Trash2,
  AlertCircle,
  MapPin,
  FileSignature,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardContent,
  Badge,
  Skeleton,
  Modal,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useSparkedCollegesWithDepts,
  useSparkedCollege,
  useCreateCollege,
  useDeleteCollege,
  useCreateDepartment,
  useChangeDepartmentStatus,
  useDeleteDepartment,
  useDeptFollowUps,
  useAddDeptFollowUp,
  useSignDepartmentMou,
  useSignCollegeWideMou,
} from "@/hooks/useLeads";
import type { SparkedCollegeWithDepts, SparkedDepartment, SparkedDeptStatus } from "@/types";
import { SPARKED_DEPT_STATUS_LABELS } from "@/types";
import toast from "react-hot-toast";

const statusOptionsNoAll: { value: SparkedDeptStatus; label: string }[] = (
  Object.keys(SPARKED_DEPT_STATUS_LABELS) as SparkedDeptStatus[]
).map((s) => ({ value: s, label: SPARKED_DEPT_STATUS_LABELS[s] }));

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

function summarizeStatuses(departments: SparkedDepartment[]): string {
  if (departments.length === 0) return "No departments yet";
  const counts = new Map<SparkedDeptStatus, number>();
  departments.forEach((d) => counts.set(d.status, (counts.get(d.status) || 0) + 1));
  return Array.from(counts.entries())
    .map(([status, count]) => `${count} ${SPARKED_DEPT_STATUS_LABELS[status]}`)
    .join(" · ");
}

export default function SparkedLeadsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewCollegeOpen, setIsNewCollegeOpen] = useState(false);
  const [detailCollegeId, setDetailCollegeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SparkedCollegeWithDepts | null>(null);

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
    } catch {
      toast.error("Failed to delete college");
    }
  };

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
                onClick={() => setDetailCollegeId(c.college.id)}
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

      <CollegeDetailModal
        collegeId={detailCollegeId}
        onClose={() => setDetailCollegeId(null)}
      />

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

// ============================================
// College Detail Modal
// ============================================
function CollegeDetailModal({
  collegeId,
  onClose,
}: {
  collegeId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useSparkedCollege(collegeId || "");
  const signCollegeWideMutation = useSignCollegeWideMou();

  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isMouConfirmOpen, setIsMouConfirmOpen] = useState(false);

  const college = data?.college;
  const departments = data?.departments || [];
  const hasUnsignedDept = departments.some((d) => d.status !== "MOU_SIGNED");

  const handleClose = () => {
    setIsAddDeptOpen(false);
    setIsMouConfirmOpen(false);
    onClose();
  };

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

  return (
    <Modal isOpen={!!collegeId} onClose={handleClose} title={college?.collegeName || "College"} size="xl">
      {isLoading || !college ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{college.address}</span>
            </div>
            {hasUnsignedDept && departments.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMouConfirmOpen(true)}
                disabled={signCollegeWideMutation.isPending}
              >
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                Sign College-Wide MOU
              </Button>
            )}
          </div>

          {isMouConfirmOpen && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
              <p className="text-sm">
                This will mark <strong>ALL</strong> departments at {college.collegeName} as MOU Signed.
                Are you sure?
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

          <div className="flex items-center justify-between border-t pt-4">
            <h4 className="font-medium">Departments ({departments.length})</h4>
            <Button size="sm" onClick={() => setIsAddDeptOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Department
            </Button>
          </div>

          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No departments added yet
            </p>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {departments.map((dept) => (
                <DepartmentRow key={dept.id} department={dept} />
              ))}
            </div>
          )}
        </div>
      )}

      <AddDepartmentModal
        isOpen={isAddDeptOpen}
        collegeId={collegeId || ""}
        onClose={() => setIsAddDeptOpen(false)}
      />
    </Modal>
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
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Department"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Department Row (with inline follow-up log + status changer)
// ============================================
function DepartmentRow({ department }: { department: SparkedDepartment }) {
  const { data: followUps, isLoading: loadingFollowUps } = useDeptFollowUps(department.id);
  const changeStatusMutation = useChangeDepartmentStatus();
  const addFollowUpMutation = useAddDeptFollowUp();
  const signMouMutation = useSignDepartmentMou();
  const deleteMutation = useDeleteDepartment();

  const [expanded, setExpanded] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpNextDate, setFollowUpNextDate] = useState("");
  const [isDropPromptOpen, setIsDropPromptOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleStatusChange = async (newStatus: SparkedDeptStatus) => {
    if (newStatus === department.status) return;
    if (newStatus === "DROPPED") {
      setIsDropPromptOpen(true);
      return;
    }
    try {
      await changeStatusMutation.mutateAsync({ id: department.id, status: newStatus });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const confirmDrop = async () => {
    if (!dropReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await changeStatusMutation.mutateAsync({ id: department.id, status: "DROPPED", dropReason: dropReason.trim() });
      toast.success("Department marked as dropped");
      setIsDropPromptOpen(false);
      setDropReason("");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSignMou = async () => {
    try {
      await signMouMutation.mutateAsync(department.id);
      toast.success("MOU signed");
    } catch {
      toast.error("Failed to sign MOU");
    }
  };

  const handleAddFollowUp = async () => {
    if (!followUpNote.trim()) {
      toast.error("Please enter a note");
      return;
    }
    try {
      await addFollowUpMutation.mutateAsync({
        deptId: department.id,
        note: followUpNote.trim(),
        nextFollowUpDate: followUpNextDate ? new Date(followUpNextDate) : undefined,
      });
      toast.success("Follow-up logged");
      setFollowUpNote("");
      setFollowUpNextDate("");
    } catch {
      toast.error("Failed to log follow-up");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(department.id);
      toast.success("Department deleted");
      setDeleteConfirm(false);
    } catch {
      toast.error("Failed to delete department");
    }
  };

  return (
    <div className="border rounded-lg">
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{department.deptName}</p>
              <Badge variant={statusBadgeVariant(department.status)} className="text-xs">
                {SPARKED_DEPT_STATUS_LABELS[department.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {department.contactName} · {department.contactNumber}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {department.status !== "MOU_SIGNED" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSignMou}
                disabled={signMouMutation.isPending}
              >
                <FileSignature className="h-3.5 w-3.5 mr-1" />
                Sign MOU
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Delete"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>First spoken: {formatDate(department.dateFirstSpoken)}</span>
          {department.rateDiscussed !== undefined && <span>Rate: {formatCurrency(department.rateDiscussed)}</span>}
          {department.approxCount !== undefined && <span>Count: ~{department.approxCount}</span>}
          {department.contactEmail && <span className="truncate">{department.contactEmail}</span>}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 space-y-4" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm">
            <span className="text-muted-foreground">Approached by: </span>
            {department.approachedByName} · {department.approachedByNumber}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Meeting notes: </span>
            {department.meetingDescription}
          </p>
          {department.notes && (
            <p className="text-sm">
              <span className="text-muted-foreground">Notes: </span>
              {department.notes}
            </p>
          )}
          {department.status === "DROPPED" && department.dropReason && (
            <p className="text-sm">
              <span className="text-muted-foreground">Drop reason: </span>
              {department.dropReason}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <Label className="mb-0 text-xs">Status</Label>
            <div className="w-44">
              <Select
                value={department.status}
                onChange={(e) => handleStatusChange(e.target.value as SparkedDeptStatus)}
                options={statusOptionsNoAll}
                disabled={changeStatusMutation.isPending}
              />
            </div>
          </div>

          {isDropPromptOpen && (
            <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
              <Label className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                Reason for dropping *
              </Label>
              <Textarea
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="Why is this department being dropped?"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsDropPromptOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={confirmDrop} disabled={changeStatusMutation.isPending}>
                  Confirm Drop
                </Button>
              </div>
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <h5 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Follow-up History</h5>
            <Textarea
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="Log a note about this follow-up..."
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Next follow-up (optional)</Label>
                <Input
                  type="date"
                  value={followUpNextDate}
                  onChange={(e) => setFollowUpNextDate(e.target.value)}
                />
              </div>
              <Button
                className="self-end"
                size="sm"
                onClick={handleAddFollowUp}
                disabled={addFollowUpMutation.isPending}
              >
                Add Follow-up
              </Button>
            </div>

            {loadingFollowUps ? (
              <Skeleton className="h-12 w-full" />
            ) : !followUps || followUps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No follow-ups logged yet</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {followUps.map((f) => (
                  <div key={f.id} className="p-2 border rounded-lg text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{formatDate(f.date)}</p>
                      <p className="text-muted-foreground">{f.loggedBy || "—"}</p>
                    </div>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{f.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete Department">
        <p>Are you sure you want to delete {department.deptName}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete its follow-up history. This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
