import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Badge, Label, Select, Textarea, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  useSparksLeadFollowUps,
  useChangeSparksLeadStatus,
  useAddSparksLeadFollowUp,
  useFindMatchingClient,
  useConvertSparksLead,
} from "@/hooks/useLeads";
import type { SparksLead, SparksLeadStatus } from "@/types";
import { LEAD_SOURCE_LABELS, SPARKS_LEAD_STATUS_LABELS } from "@/types";
import FollowUpTimeline from "@/components/leads/FollowUpTimeline";
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
  const findMatchMutation = useFindMatchingClient();
  const convertMutation = useConvertSparksLead();

  const [isDropPromptOpen, setIsDropPromptOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [matchResult, setMatchResult] = useState<{ id: string; companyName: string } | "none" | null>(null);

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
              <h3 className="font-medium">Lead Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{lead.contactNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{lead.email || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium whitespace-pre-wrap">{lead.description}</p>
                </div>
                {lead.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{lead.address}</p>
                  </div>
                )}
                {lead.quotedAmount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Quoted Amount</p>
                    <p className="font-medium">{formatCurrency(lead.quotedAmount)}</p>
                  </div>
                )}
                {lead.quotationNotes && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Quotation Notes</p>
                    <p className="font-medium">{lead.quotationNotes}</p>
                  </div>
                )}
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
                amountLabel="Amount"
                initialAmount={undefined}
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
