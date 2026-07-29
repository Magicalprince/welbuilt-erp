import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2, Pencil, Check, X } from "lucide-react";
import { Button, Card, CardContent, Badge, Label, Select, Input, Textarea, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  useSparksLeadFollowUps,
  useChangeSparksLeadStatus,
  useAddSparksLeadFollowUp,
  useUpdateSparksLeadFollowUp,
  useDeleteSparksLeadFollowUp,
  useUpdateSparksLead,
  useFindMatchingClient,
  useConvertSparksLead,
} from "@/hooks/useLeads";
import type { SparksLead, SparksLeadStatus, LeadSource, CommissionType, CommissionStatus } from "@/types";
import { LEAD_SOURCE_LABELS, SPARKS_LEAD_STATUS_LABELS } from "@/types";
import FollowUpTimeline, { type FollowUpEditData } from "@/components/leads/FollowUpTimeline";
import AddFollowUpForm from "@/components/leads/AddFollowUpForm";
import toast from "react-hot-toast";

const statusOptionsNoAll: { value: SparksLeadStatus; label: string }[] = (
  Object.keys(SPARKS_LEAD_STATUS_LABELS) as SparksLeadStatus[]
).map((s) => ({ value: s, label: SPARKS_LEAD_STATUS_LABELS[s] }));

function statusBadgeVariant(status: SparksLeadStatus): "secondary" | "warning" | "destructive" | "success" {
  switch (status) {
    case "NEW":
      return "secondary";
    case "IN_CONVERSATION":
      return "warning";
    case "DROPPED":
      return "destructive";
    case "CONVERTED":
      return "success";
  }
}

function isOverdue(lead: SparksLead): boolean {
  if (!lead.nextFollowUpDate) return false;
  if (lead.status === "DROPPED" || lead.status === "CONVERTED") return false;
  return lead.nextFollowUpDate.getTime() < new Date().setHours(0, 0, 0, 0);
}

interface LeadDetailViewProps {
  lead: SparksLead;
  onBack: () => void;
}

export default function LeadDetailView({ lead, onBack }: LeadDetailViewProps) {
  const navigate = useNavigate();
  const { data: followUps, isLoading: loadingFollowUps } = useSparksLeadFollowUps(lead.id);
  const changeStatusMutation = useChangeSparksLeadStatus();
  const addFollowUpMutation = useAddSparksLeadFollowUp();
  const updateFollowUpMutation = useUpdateSparksLeadFollowUp();
  const deleteFollowUpMutation = useDeleteSparksLeadFollowUp();
  const findMatchMutation = useFindMatchingClient();
  const convertMutation = useConvertSparksLead();
  const updateLeadMutation = useUpdateSparksLead();

  const [isDropPromptOpen, setIsDropPromptOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [matchResult, setMatchResult] = useState<{ id: string; companyName: string } | "none" | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const handleStatusChange = async (newStatus: SparksLeadStatus) => {
    if (newStatus === lead.status) return;
    if (newStatus === "DROPPED") {
      setIsDropPromptOpen(true);
      return;
    }
    try {
      await changeStatusMutation.mutateAsync({ id: lead.id, status: newStatus });
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
      await changeStatusMutation.mutateAsync({ id: lead.id, status: "DROPPED", dropReason: dropReason.trim() });
      toast.success("Lead marked as dropped");
      setIsDropPromptOpen(false);
      setDropReason("");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const canConvert = lead.status === "NEW" || lead.status === "IN_CONVERSATION";

  const handleConvertClick = async () => {
    try {
      const match = await findMatchMutation.mutateAsync({ email: lead.email, phone: lead.contactNumber });
      setMatchResult(match || "none");
    } catch {
      toast.error("Failed to check for existing clients");
    }
  };

  const doConvert = async (linkToClientId?: string) => {
    try {
      const result = await convertMutation.mutateAsync({ leadId: lead.id, linkToClientId });
      toast.success(linkToClientId ? "Lead linked to existing client" : "Lead converted to client");
      setMatchResult(null);
      navigate(`/clients/${result.clientId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to convert lead";
      toast.error(message);
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
        leadId: lead.id,
        meetingNotes: data.meetingNotes,
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
      await updateFollowUpMutation.mutateAsync({ followUpId, leadId: lead.id, data });
      toast.success("Follow-up updated");
    } catch {
      toast.error("Failed to update follow-up");
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    try {
      await deleteFollowUpMutation.mutateAsync({ followUpId, leadId: lead.id });
      toast.success("Follow-up deleted");
    } catch {
      toast.error("Failed to delete follow-up");
    }
  };

  const handleSaveInfo = async (data: Partial<Omit<SparksLead, "id" | "createdAt" | "updatedAt">>) => {
    try {
      await updateLeadMutation.mutateAsync({ id: lead.id, data });
      toast.success("Lead updated");
      setIsEditingInfo(false);
    } catch {
      toast.error("Failed to update lead");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{lead.leadName}</h1>
            <Badge variant={statusBadgeVariant(lead.status)}>{SPARKS_LEAD_STATUS_LABELS[lead.status]}</Badge>
            <Badge variant="secondary">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
            {isOverdue(lead) && <Badge variant="destructive">Follow-up Overdue</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">{lead.projectName}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Lead Info</h3>
                {!isEditingInfo && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => setIsEditingInfo(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {isEditingInfo ? (
                <EditLeadInfoForm lead={lead} onSave={handleSaveInfo} onCancel={() => setIsEditingInfo(false)} isSaving={updateLeadMutation.isPending} />
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contact Number</p>
                    <p className="font-medium">{lead.contactNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{lead.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source</p>
                    <p className="font-medium">{LEAD_SOURCE_LABELS[lead.source]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Project Name</p>
                    <p className="font-medium">{lead.projectName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium whitespace-pre-wrap">{lead.description}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{lead.address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Quoted Amount</p>
                    <p className="font-medium">{lead.quotedAmount !== undefined ? formatCurrency(lead.quotedAmount) : "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Quotation Notes</p>
                    <p className="font-medium">{lead.quotationNotes || "—"}</p>
                  </div>
                  {lead.commissionType && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Commission</p>
                        <p className="font-medium">
                          {lead.commissionType === "PERCENTAGE"
                            ? `${lead.commissionValue}%`
                            : formatCurrency(lead.commissionValue || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Commission Status</p>
                        <Badge variant={lead.commissionStatus === "PAID" ? "success" : "warning"} className="mt-0.5">
                          {lead.commissionStatus}
                        </Badge>
                      </div>
                    </>
                  )}
                  {lead.status === "DROPPED" && lead.dropReason && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Drop Reason</p>
                      <p className="font-medium">{lead.dropReason}</p>
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
                entityId={lead.id}
                showCount={false}
                amountLabel="Quoted Amount (₹)"
                currentAmount={lead.quotedAmount}
                onSubmit={handleAddFollowUp}
              />
              <FollowUpTimeline
                followUps={followUps || []}
                isLoading={loadingFollowUps}
                amountLabel="Quoted Amount (₹)"
                initialAmount={undefined}
                originalEntry={{ date: lead.createdAt, notes: lead.description }}
                onEdit={handleEditFollowUp}
                onDelete={handleDeleteFollowUp}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <Label className="mb-0">Status</Label>
              <Select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as SparksLeadStatus)}
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
                    placeholder="Why is this lead being dropped?"
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

              <Button
                className="w-full"
                onClick={handleConvertClick}
                disabled={!canConvert || findMatchMutation.isPending}
                title={
                  !canConvert
                    ? `Cannot convert a lead with status ${SPARKS_LEAD_STATUS_LABELS[lead.status]}`
                    : undefined
                }
              >
                {findMatchMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Convert to Client"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={matchResult !== null} onClose={() => setMatchResult(null)} title="Convert to Client">
        {matchResult === "none" ? (
          <div className="space-y-4">
            <p>No existing client matches this lead's contact info. A new client will be created.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setMatchResult(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => doConvert()} disabled={convertMutation.isPending}>
                {convertMutation.isPending ? "Converting..." : "Create Client"}
              </Button>
            </div>
          </div>
        ) : matchResult ? (
          <div className="space-y-4">
            <p>
              An existing client "<strong>{matchResult.companyName}</strong>" matches this lead's contact info.
              Link to it, or create a new separate client?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => doConvert()}
                disabled={convertMutation.isPending}
              >
                Create New
              </Button>
              <Button
                className="flex-1"
                onClick={() => doConvert(matchResult.id)}
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending ? "Linking..." : `Link to ${matchResult.companyName}`}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

// ============================================
// Edit Lead Info Form
// ============================================
function EditLeadInfoForm({
  lead,
  onSave,
  onCancel,
  isSaving,
}: {
  lead: SparksLead;
  onSave: (data: Partial<Omit<SparksLead, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const buildForm = () => ({
    leadName: lead.leadName,
    contactNumber: lead.contactNumber,
    source: lead.source,
    projectName: lead.projectName,
    description: lead.description,
    email: lead.email || "",
    address: lead.address || "",
    quotedAmount: lead.quotedAmount !== undefined ? String(lead.quotedAmount) : "",
    quotationNotes: lead.quotationNotes || "",
    commissionType: lead.commissionType || ("PERCENTAGE" as CommissionType),
    commissionValue: lead.commissionValue !== undefined ? String(lead.commissionValue) : "",
    commissionStatus: lead.commissionStatus || ("OWED" as CommissionStatus),
  });

  const [formData, setFormData] = useState(buildForm);

  useEffect(() => {
    setFormData(buildForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const handleSubmit = async () => {
    if (!formData.leadName.trim() || !formData.contactNumber.trim() || !formData.projectName.trim() || !formData.description.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    await onSave({
      leadName: formData.leadName.trim(),
      contactNumber: formData.contactNumber.trim(),
      source: formData.source,
      projectName: formData.projectName.trim(),
      description: formData.description.trim(),
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      quotedAmount: formData.quotedAmount ? Number(formData.quotedAmount) : undefined,
      quotationNotes: formData.quotationNotes.trim() || undefined,
      commissionType: formData.source === "REFERRAL" ? formData.commissionType : undefined,
      commissionValue:
        formData.source === "REFERRAL" && formData.commissionValue ? Number(formData.commissionValue) : undefined,
      commissionStatus: formData.source === "REFERRAL" ? formData.commissionStatus : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Lead Name *</Label>
          <Input value={formData.leadName} onChange={(e) => setFormData({ ...formData, leadName: e.target.value })} />
        </div>
        <div>
          <Label>Contact Number *</Label>
          <Input value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} />
        </div>
        <div>
          <Label>Source *</Label>
          <Select
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
            options={(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))}
          />
        </div>
        <div className="col-span-2">
          <Label>Project Name *</Label>
          <Input value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Description *</Label>
          <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
        </div>
        <div>
          <Label>Quoted Amount (₹)</Label>
          <Input type="number" value={formData.quotedAmount} onChange={(e) => setFormData({ ...formData, quotedAmount: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Quotation Notes</Label>
          <Textarea value={formData.quotationNotes} onChange={(e) => setFormData({ ...formData, quotationNotes: e.target.value })} />
        </div>

        {formData.source === "REFERRAL" && (
          <div className="col-span-2 border-t pt-4 mt-2 grid grid-cols-2 gap-4">
            <div>
              <Label>Commission Type</Label>
              <Select
                value={formData.commissionType}
                onChange={(e) => setFormData({ ...formData, commissionType: e.target.value as CommissionType })}
                options={[
                  { value: "PERCENTAGE", label: "Percentage" },
                  { value: "FIXED", label: "Fixed" },
                ]}
              />
            </div>
            <div>
              <Label>Commission Value</Label>
              <Input type="number" value={formData.commissionValue} onChange={(e) => setFormData({ ...formData, commissionValue: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Commission Status</Label>
              <Select
                value={formData.commissionStatus}
                onChange={(e) => setFormData({ ...formData, commissionStatus: e.target.value as CommissionStatus })}
                options={[
                  { value: "OWED", label: "Owed" },
                  { value: "PAID", label: "Paid" },
                ]}
              />
            </div>
          </div>
        )}
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
