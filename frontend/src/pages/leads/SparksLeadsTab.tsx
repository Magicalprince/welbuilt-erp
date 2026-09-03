import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  X,
  Loader2,
  Target,
  Trash2,
  Users,
  Globe,
  ArrowRight,
  Archive,
  MailCheck,
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
import { cn, formatCurrency, formatDate, getRelativeTime } from "@/lib/utils";
import {
  useSparksLeads,
  useReferrers,
  useCreateSparksLead,
  useDeleteSparksLead,
  useCreateReferrer,
} from "@/hooks/useLeads";
import { useSparksEnquiries, useUpdateSparksEnquiryStatus } from "@/hooks/useSparksEnquiries";
import type { SparksEnquiry } from "@/services/sparksEnquiriesService";
import type {
  SparksLead,
  SparksLeadStatus,
  LeadSource,
  CommissionType,
  CommissionStatus,
} from "@/types";
import { LEAD_SOURCE_LABELS, SPARKS_LEAD_STATUS_LABELS } from "@/types";
import ReferrersPanel from "./ReferrersPanel";
import LeadDetailView from "./LeadDetailView";
import toast from "react-hot-toast";

type LeadPrefill = {
  leadName: string;
  contactNumber: string;
  email: string;
  projectName: string;
  description: string;
};

const statusOptions: { value: SparksLeadStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "IN_CONVERSATION", label: "In Conversation" },
  { value: "DROPPED", label: "Dropped" },
  { value: "CONVERTED", label: "Converted" },
];

const sourceOptions: { value: LeadSource | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Sources" },
  ...(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({
    value: s,
    label: LEAD_SOURCE_LABELS[s],
  })),
];

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

export default function SparksLeadsTab() {
  const [view, setView] = useState<"leads" | "enquiries">("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SparksLeadStatus | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [leadPrefill, setLeadPrefill] = useState<LeadPrefill | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SparksLead | null>(null);
  const [isReferrersOpen, setIsReferrersOpen] = useState(false);

  const { data: leads, isLoading } = useSparksLeads();
  const deleteMutation = useDeleteSparksLead();
  const { data: enquiries } = useSparksEnquiries();
  const newEnquiryCount = useMemo(
    () => enquiries?.filter((e) => e.status === "new").length ?? 0,
    [enquiries]
  );

  const handleConvertEnquiry = (enquiry: SparksEnquiry) => {
    setLeadPrefill({
      leadName: enquiry.name,
      contactNumber: enquiry.phone ?? "",
      email: enquiry.email,
      projectName: enquiry.topic || "Website enquiry",
      description: enquiry.projectDescription,
    });
    setIsNewModalOpen(true);
  };

  const detailLead = useMemo(
    () => (detailLeadId ? leads?.find((l) => l.id === detailLeadId) || null : null),
    [leads, detailLeadId]
  );

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const filtered = leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        lead.leadName.toLowerCase().includes(q) ||
        lead.projectName.toLowerCase().includes(q) ||
        lead.contactNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
      const matchesSource = sourceFilter === "ALL" || lead.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });

    return [...filtered].sort((a, b) => {
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [leads, searchQuery, statusFilter, sourceFilter]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Lead deleted");
      setDeleteConfirm(null);
      if (detailLeadId === deleteConfirm.id) setDetailLeadId(null);
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  if (detailLead) {
    return <LeadDetailView lead={detailLead} onBack={() => setDetailLeadId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setView("leads")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            view === "leads"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Leads
        </button>
        <button
          onClick={() => setView("enquiries")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
            view === "enquiries"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          Website Enquiries
          {newEnquiryCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-4">
              {newEnquiryCount}
            </Badge>
          )}
        </button>
      </div>

      {view === "enquiries" ? (
        <WebsiteEnquiriesView onConvert={handleConvertEnquiry} />
      ) : (
      <>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, project, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-primary text-primary-foreground")}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReferrersOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Referrers
          </Button>
          <Button onClick={() => setIsNewModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg"
        >
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">Status</Label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SparksLeadStatus | "ALL")}
              options={statusOptions}
            />
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">Source</Label>
            <Select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | "ALL")}
              options={sourceOptions}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setStatusFilter("ALL");
              setSourceFilter("ALL");
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No leads found</h3>
          <p className="text-muted-foreground">
            {leads && leads.length > 0
              ? "Try adjusting your search or filters"
              : "Get started by adding your first lead"}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Lead</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Project</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Source</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-36">Status</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Quoted</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const overdue = isOverdue(lead);
                  return (
                    <tr
                      key={lead.id}
                      className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setDetailLeadId(lead.id)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {overdue && (
                            <span
                              className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                              title="Follow-up overdue"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{lead.leadName}</p>
                            <p className="text-xs text-muted-foreground">{lead.contactNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground max-w-[220px] truncate" title={lead.projectName}>
                        {lead.projectName}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(lead.status)} className="text-xs">
                            {SPARKS_LEAD_STATUS_LABELS[lead.status]}
                          </Badge>
                          {overdue && (
                            <Badge variant="destructive" className="text-xs">Overdue</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {lead.quotedAmount ? formatCurrency(lead.quotedAmount) : "—"}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(lead);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      </>
      )}

      <NewLeadModal
        isOpen={isNewModalOpen}
        onClose={() => { setIsNewModalOpen(false); setLeadPrefill(null); }}
        prefill={leadPrefill}
      />

      <ReferrersPanel isOpen={isReferrersOpen} onClose={() => setIsReferrersOpen(false)} />

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Lead">
        <p>Are you sure you want to delete {deleteConfirm?.leadName}?</p>
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
// New Lead Modal
// ============================================
function NewLeadModal({
  isOpen,
  onClose,
  prefill,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefill?: LeadPrefill | null;
}) {
  const createMutation = useCreateSparksLead();
  const { data: referrers } = useReferrers();
  const createReferrerMutation = useCreateReferrer();

  const emptyForm = {
    leadName: "",
    contactNumber: "",
    source: "WEBSITE" as LeadSource,
    projectName: "",
    description: "",
    email: "",
    address: "",
    quotedAmount: "",
    quotationNotes: "",
    referrerId: "",
    commissionType: "PERCENTAGE" as CommissionType,
    commissionValue: "",
    commissionStatus: "OWED" as CommissionStatus,
  };
  const [formData, setFormData] = useState(emptyForm);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (isOpen) {
      setFormData(
        prefill
          ? {
              ...emptyForm,
              leadName: prefill.leadName,
              contactNumber: prefill.contactNumber,
              email: prefill.email,
              projectName: prefill.projectName,
              description: prefill.description,
            }
          : emptyForm
      );
      setIsQuickAddOpen(false);
      setQuickAddForm({ name: "", phone: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill]);

  const handleQuickAddReferrer = async () => {
    if (!quickAddForm.name.trim() || !quickAddForm.phone.trim()) {
      toast.error("Referrer name and phone are required");
      return;
    }
    try {
      const id = await createReferrerMutation.mutateAsync({
        name: quickAddForm.name.trim(),
        phone: quickAddForm.phone.trim(),
      });
      setFormData((f) => ({ ...f, referrerId: id }));
      setIsQuickAddOpen(false);
      setQuickAddForm({ name: "", phone: "" });
      toast.success("Referrer added");
    } catch {
      toast.error("Failed to add referrer");
    }
  };

  const handleSubmit = async () => {
    if (!formData.leadName.trim() || !formData.contactNumber.trim() || !formData.projectName.trim() || !formData.description.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    if (formData.source === "REFERRAL" && !formData.referrerId) {
      toast.error("Please select a referrer");
      return;
    }

    try {
      await createMutation.mutateAsync({
        leadName: formData.leadName.trim(),
        contactNumber: formData.contactNumber.trim(),
        source: formData.source,
        projectName: formData.projectName.trim(),
        description: formData.description.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        quotedAmount: formData.quotedAmount ? Number(formData.quotedAmount) : undefined,
        quotationNotes: formData.quotationNotes.trim() || undefined,
        referrerId: formData.source === "REFERRAL" ? formData.referrerId : undefined,
        commissionType: formData.source === "REFERRAL" ? formData.commissionType : undefined,
        commissionValue:
          formData.source === "REFERRAL" && formData.commissionValue
            ? Number(formData.commissionValue)
            : undefined,
        commissionStatus: formData.source === "REFERRAL" ? formData.commissionStatus : undefined,
      });
      toast.success("Lead added");
      onClose();
    } catch {
      toast.error("Failed to add lead");
    }
  };

  const referrerOptions = [
    { value: "", label: "Select referrer..." },
    ...(referrers || []).map((r) => ({ value: r.id, label: `${r.name} (${r.phone})` })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Lead">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Lead Name *</Label>
            <Input
              value={formData.leadName}
              onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
              placeholder="Contact / company name"
            />
          </div>

          <div>
            <Label>Contact Number *</Label>
            <Input
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              placeholder="+91 XXXXXXXXXX"
            />
          </div>

          <div>
            <Label>Source *</Label>
            <Select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
              options={(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({
                value: s,
                label: LEAD_SOURCE_LABELS[s],
              }))}
            />
          </div>

          <div className="col-span-2">
            <Label>Project Name *</Label>
            <Input
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              placeholder="e.g., E-commerce Website"
            />
          </div>

          <div className="col-span-2">
            <Label>Description *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does the lead need?"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label>Quoted Amount (₹)</Label>
            <Input
              type="number"
              value={formData.quotedAmount}
              onChange={(e) => setFormData({ ...formData, quotedAmount: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div className="col-span-2">
            <Label>Quotation Notes</Label>
            <Textarea
              value={formData.quotationNotes}
              onChange={(e) => setFormData({ ...formData, quotationNotes: e.target.value })}
              placeholder="Optional"
            />
          </div>

          {formData.source === "REFERRAL" && (
            <div className="col-span-2 border-t pt-4 mt-2 space-y-4">
              <h4 className="font-medium">Referral Details</h4>

              {!isQuickAddOpen ? (
                <div>
                  <Label>Referrer *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={formData.referrerId}
                        onChange={(e) => setFormData({ ...formData, referrerId: e.target.value })}
                        options={referrerOptions}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsQuickAddOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      New
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Quick-add referrer</p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsQuickAddOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Name"
                      value={quickAddForm.name}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                    />
                    <Input
                      placeholder="Phone"
                      value={quickAddForm.phone}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleQuickAddReferrer}
                    disabled={createReferrerMutation.isPending}
                  >
                    {createReferrerMutation.isPending ? "Adding..." : "Add Referrer"}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
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
                  <Input
                    type="number"
                    value={formData.commissionValue}
                    onChange={(e) => setFormData({ ...formData, commissionValue: e.target.value })}
                    placeholder={formData.commissionType === "PERCENTAGE" ? "e.g., 10" : "e.g., 5000"}
                  />
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
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
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
// Website Enquiries — raw sparksai.in contact-form submissions, read from a
// separate Postgres database (sparks-leads-db on Dokploy), not Firestore.
// See docs/plans/2026-09-03-sparks-website-enquiries-design.md. This view is
// deliberately read-mostly: the only write is the status column, and
// "Convert to Lead" opens NewLeadModal pre-filled rather than silently
// creating a SparksLead, matching how the rest of this module avoids
// auto-creating pipeline records (see leads_crm memory).
// ============================================

const ENQUIRY_STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
];

function enquiryStatusBadgeVariant(status: string): "secondary" | "warning" | "destructive" | "success" {
  switch (status) {
    case "new":
      return "warning";
    case "contacted":
      return "secondary";
    case "converted":
      return "success";
    case "archived":
      return "destructive";
    default:
      return "secondary";
  }
}

function WebsiteEnquiriesView({ onConvert }: { onConvert: (enquiry: SparksEnquiry) => void }) {
  const { data: enquiries, isLoading, error } = useSparksEnquiries();
  const updateStatusMutation = useUpdateSparksEnquiryStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!enquiries) return [];
    return enquiries.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q) ||
        e.projectDescription.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enquiries, searchQuery, statusFilter]);

  const setStatus = async (enquiry: SparksEnquiry, status: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: enquiry.id, status });
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Couldn't load website enquiries</h3>
        <p className="text-muted-foreground text-sm mt-1">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={ENQUIRY_STATUS_OPTIONS} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No website enquiries</h3>
          <p className="text-muted-foreground">
            {enquiries && enquiries.length > 0
              ? "Try adjusting your search or filter"
              : "Submissions from sparksai.in's contact form will show up here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((enquiry) => {
            const isExpanded = expandedId === enquiry.id;
            return (
              <Card key={enquiry.id}>
                <CardContent
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : enquiry.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{enquiry.name}</p>
                        <Badge variant={enquiryStatusBadgeVariant(enquiry.status)} className="text-xs">
                          {enquiry.status}
                        </Badge>
                        {enquiry.sourcePage && (
                          <Badge variant="secondary" className="text-xs">{enquiry.sourcePage}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {enquiry.email} {enquiry.phone ? `• ${enquiry.phone}` : "• no phone given"}
                      </p>
                      <p className={cn("text-sm text-muted-foreground mt-1", !isExpanded && "truncate")}>
                        {enquiry.projectDescription}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground whitespace-nowrap" title={formatDate(enquiry.createdAt)}>
                        {getRelativeTime(enquiry.createdAt)}
                      </span>
                      {enquiry.status !== "contacted" && enquiry.status !== "converted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title="Mark contacted"
                          onClick={() => setStatus(enquiry, "contacted")}
                          disabled={updateStatusMutation.isPending}
                        >
                          <MailCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {enquiry.status !== "archived" && enquiry.status !== "converted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title="Archive"
                          onClick={() => setStatus(enquiry, "archived")}
                          disabled={updateStatusMutation.isPending}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {enquiry.status !== "converted" && (
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => onConvert(enquiry)}
                        >
                          <ArrowRight className="h-3.5 w-3.5 mr-1" />
                          Convert to Lead
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

