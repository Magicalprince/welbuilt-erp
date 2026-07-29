import { useState, useEffect } from "react";
import { ArrowLeft, AlertCircle, FileSignature, Plus, GraduationCap, Pencil, Check, X } from "lucide-react";
import { Button, Card, CardContent, Badge, Label, Select, Input, Textarea, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useSparkedCollege,
  useChangeDepartmentStatus,
  useAddDeptFollowUp,
  useUpdateDeptFollowUp,
  useDeleteDeptFollowUp,
  useUpdateDepartment,
  useSignDepartmentMou,
  useDeptFollowUps,
  useWorkshopsByDept,
} from "@/hooks/useLeads";
import { getWorkshopFinancials } from "@/services/workshopService";
import type { SparkedDepartment, SparkedDeptStatus } from "@/types";
import { SPARKED_DEPT_STATUS_LABELS, WORKSHOP_STATUS_LABELS } from "@/types";
import FollowUpTimeline, { type FollowUpEditData } from "@/components/leads/FollowUpTimeline";
import AddFollowUpForm from "@/components/leads/AddFollowUpForm";
import AddWorkshopModal from "./AddWorkshopModal";
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

interface DepartmentDetailViewProps {
  collegeId: string;
  deptId: string;
  onBack: () => void;
  /** Omit to hide workshop scheduling entirely (e.g. on the Leads page — workshops are Clients-page-only) */
  onOpenWorkshop?: (workshopId: string) => void;
}

export default function DepartmentDetailView({
  collegeId,
  deptId,
  onBack,
  onOpenWorkshop,
}: DepartmentDetailViewProps) {
  const showWorkshops = !!onOpenWorkshop;
  const { data: collegeData, isLoading } = useSparkedCollege(collegeId);
  const { data: followUps, isLoading: loadingFollowUps } = useDeptFollowUps(deptId);
  const { data: workshops, isLoading: loadingWorkshops } = useWorkshopsByDept(showWorkshops ? deptId : "");
  const changeStatusMutation = useChangeDepartmentStatus();
  const addFollowUpMutation = useAddDeptFollowUp();
  const updateFollowUpMutation = useUpdateDeptFollowUp();
  const deleteFollowUpMutation = useDeleteDeptFollowUp();
  const updateDeptMutation = useUpdateDepartment();
  const signMouMutation = useSignDepartmentMou();

  const [isDropPromptOpen, setIsDropPromptOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [isAddWorkshopOpen, setIsAddWorkshopOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const department = collegeData?.departments.find((d) => d.id === deptId);

  if (isLoading || !department) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

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
      await changeStatusMutation.mutateAsync({
        id: department.id,
        status: "DROPPED",
        dropReason: dropReason.trim(),
      });
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

  const handleAddFollowUp = async (data: {
    meetingNotes: string;
    updatedCount?: number;
    updatedAmount?: number;
    nextFollowUpDate?: Date;
  }) => {
    try {
      await addFollowUpMutation.mutateAsync({
        deptId: department.id,
        meetingNotes: data.meetingNotes,
        updatedCount: data.updatedCount,
        updatedAmount: data.updatedAmount,
        nextFollowUpDate: data.nextFollowUpDate,
      });
      toast.success("Follow-up logged");
    } catch {
      toast.error("Failed to log follow-up");
    }
  };

  const handleEditFollowUp = async (followUpId: string, data: FollowUpEditData) => {
    try {
      await updateFollowUpMutation.mutateAsync({ followUpId, deptId: department.id, data });
      toast.success("Follow-up updated");
    } catch {
      toast.error("Failed to update follow-up");
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    try {
      await deleteFollowUpMutation.mutateAsync({ followUpId, deptId: department.id });
      toast.success("Follow-up deleted");
    } catch {
      toast.error("Failed to delete follow-up");
    }
  };

  const handleSaveInfo = async (data: Partial<Omit<SparkedDepartment, "id" | "createdAt" | "updatedAt">>) => {
    try {
      await updateDeptMutation.mutateAsync({ id: department.id, data });
      toast.success("Department updated");
      setIsEditingInfo(false);
    } catch {
      toast.error("Failed to update department");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{department.deptName}</h1>
              <Badge variant={statusBadgeVariant(department.status)}>
                {SPARKED_DEPT_STATUS_LABELS[department.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {department.contactName} · {department.contactNumber}
            </p>
          </div>
        </div>
        {department.status !== "MOU_SIGNED" && (
          <Button variant="outline" onClick={handleSignMou} disabled={signMouMutation.isPending}>
            <FileSignature className="h-4 w-4 mr-2" />
            Sign MOU
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Department Info</h3>
                {!isEditingInfo && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => setIsEditingInfo(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {isEditingInfo ? (
                <EditDepartmentInfoForm
                  department={department}
                  onSave={handleSaveInfo}
                  onCancel={() => setIsEditingInfo(false)}
                  isSaving={updateDeptMutation.isPending}
                />
              ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Department Name</p>
                  <p className="font-medium">{department.deptName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{department.contactName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{department.contactNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Email</p>
                  <p className="font-medium">{department.contactEmail || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">First Spoken</p>
                  <p className="font-medium">{formatDate(department.dateFirstSpoken)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Approached By</p>
                  <p className="font-medium">
                    {department.approachedByName} · {department.approachedByNumber}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rate Discussed</p>
                  <p className="font-medium">{department.rateDiscussed !== undefined ? formatCurrency(department.rateDiscussed) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Approx. Count</p>
                  <p className="font-medium">{department.approxCount !== undefined ? `~${department.approxCount} students` : "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Meeting Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{department.meetingDescription}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{department.notes || "—"}</p>
                </div>
                {department.status === "DROPPED" && department.dropReason && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Drop Reason</p>
                    <p className="font-medium">{department.dropReason}</p>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Follow-up History</h3>
              <AddFollowUpForm
                entityId={department.id}
                showCount
                countLabel="Approx. Count"
                amountLabel="Rate Discussed (₹)"
                currentCount={department.approxCount}
                currentAmount={department.rateDiscussed}
                onSubmit={handleAddFollowUp}
              />
              <FollowUpTimeline
                followUps={followUps || []}
                isLoading={loadingFollowUps}
                showCount
                countLabel="Count"
                amountLabel="Rate"
                originalEntry={{ date: department.dateFirstSpoken, notes: department.meetingDescription }}
                onEdit={handleEditFollowUp}
                onDelete={handleDeleteFollowUp}
              />
            </CardContent>
          </Card>

          {showWorkshops && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Workshops ({workshops?.length || 0})</h3>
                  <Button size="sm" onClick={() => setIsAddWorkshopOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Workshop
                  </Button>
                </div>

                {loadingWorkshops ? (
                  <Skeleton className="h-20 w-full" />
                ) : !workshops || workshops.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No workshops recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workshops.map((w) => {
                      const financials = getWorkshopFinancials(w);
                      return (
                        <button
                          key={w.id}
                          onClick={() => onOpenWorkshop?.(w.id)}
                          className="w-full text-left p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">{w.workshopTitle}</p>
                                <Badge variant={w.status === "COMPLETED" ? "success" : "warning"} className="text-xs">
                                  {WORKSHOP_STATUS_LABELS[w.status]}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {w.targetYear} · {formatDate(w.startDate)} – {formatDate(w.endDate)}
                              </p>
                            </div>
                            <div className="text-right text-xs shrink-0">
                              <p className="text-green-500 font-medium">{formatCurrency(financials.totalEarnings)}</p>
                              <p className="text-muted-foreground">
                                Margin: {formatCurrency(financials.netMargin)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <Label className="mb-0">Status</Label>
              <Select
                value={department.status}
                onChange={(e) => handleStatusChange(e.target.value as SparkedDeptStatus)}
                options={statusOptionsNoAll}
                disabled={changeStatusMutation.isPending}
              />

              {isDropPromptOpen && (
                <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
                  <Label className="flex items-center gap-1.5 text-sm">
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
            </CardContent>
          </Card>
        </div>
      </div>

      {showWorkshops && (
        <AddWorkshopModal
          isOpen={isAddWorkshopOpen}
          deptId={department.id}
          collegeId={collegeId}
          onClose={() => setIsAddWorkshopOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================
// Edit Department Info Form
// ============================================
function EditDepartmentInfoForm({
  department,
  onSave,
  onCancel,
  isSaving,
}: {
  department: SparkedDepartment;
  onSave: (data: Partial<Omit<SparkedDepartment, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const buildForm = () => ({
    deptName: department.deptName,
    contactName: department.contactName,
    contactNumber: department.contactNumber,
    contactEmail: department.contactEmail || "",
    approachedByName: department.approachedByName,
    approachedByNumber: department.approachedByNumber,
    dateFirstSpoken: department.dateFirstSpoken.toISOString().split("T")[0],
    meetingDescription: department.meetingDescription,
    rateDiscussed: department.rateDiscussed !== undefined ? String(department.rateDiscussed) : "",
    approxCount: department.approxCount !== undefined ? String(department.approxCount) : "",
    notes: department.notes || "",
  });

  const [formData, setFormData] = useState(buildForm);

  useEffect(() => {
    setFormData(buildForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department.id]);

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
    await onSave({
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
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Department Name *</Label>
          <Input value={formData.deptName} onChange={(e) => setFormData({ ...formData, deptName: e.target.value })} />
        </div>
        <div>
          <Label>Contact Name *</Label>
          <Input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
        </div>
        <div>
          <Label>Contact Number *</Label>
          <Input value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Contact Email</Label>
          <Input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
        </div>

        <div className="col-span-2 border-t pt-4 mt-2">
          <h4 className="font-medium mb-3">Our Point of Contact</h4>
        </div>
        <div>
          <Label>Approached By *</Label>
          <Input value={formData.approachedByName} onChange={(e) => setFormData({ ...formData, approachedByName: e.target.value })} />
        </div>
        <div>
          <Label>Approached By Number *</Label>
          <Input value={formData.approachedByNumber} onChange={(e) => setFormData({ ...formData, approachedByNumber: e.target.value })} />
        </div>

        <div>
          <Label>Date First Spoken *</Label>
          <Input type="date" value={formData.dateFirstSpoken} onChange={(e) => setFormData({ ...formData, dateFirstSpoken: e.target.value })} />
        </div>
        <div>
          <Label>Rate Discussed (₹)</Label>
          <Input type="number" value={formData.rateDiscussed} onChange={(e) => setFormData({ ...formData, rateDiscussed: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Meeting Notes *</Label>
          <Textarea value={formData.meetingDescription} onChange={(e) => setFormData({ ...formData, meetingDescription: e.target.value })} />
        </div>
        <div>
          <Label>Approx. Count</Label>
          <Input type="number" value={formData.approxCount} onChange={(e) => setFormData({ ...formData, approxCount: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
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
