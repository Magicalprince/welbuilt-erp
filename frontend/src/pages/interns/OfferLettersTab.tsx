import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Upload,
  FileText,
  Filter,
  X,
  Loader2,
  FileSpreadsheet,
  Eye,
  Pencil,
  RefreshCw,
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
  Checkbox,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useInterns, useCreateIntern, useUpdateIntern, useDeleteIntern, internQueryKeys } from "@/hooks/useInterns";
import { useQueryClient } from "@tanstack/react-query";
import type { Intern, InternDomain, InternPaymentStatus, InternDuration, InternMode } from "@/types";
import { INTERN_DOMAIN_LABELS, INTERN_MODE_LABELS } from "@/types";
import {
  generateAndDownloadOfferLetter,
  generateAndUploadOfferLetter,
  bulkGenerateOfferLetters,
} from "@/services/offerLetterService";
import { mapDomainString } from "@/services/certificateService";
import { deleteFileFromR2, extractFileKeyFromUrl, getSignedDownloadUrl } from "@/services/r2Service";
import toast from "react-hot-toast";

const domainOptions: { value: InternDomain | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Domains" },
  { value: "WEB_DEVELOPMENT", label: "Web Development" },
  { value: "APP_DEVELOPMENT", label: "App Development" },
  { value: "AI_ML", label: "AI/ML" },
  { value: "DATA_SCIENCE", label: "Data Science" },
  { value: "UI_UX_DESIGN", label: "UI/UX Design" },
  { value: "DIGITAL_MARKETING", label: "Digital Marketing" },
  { value: "CLOUD_COMPUTING", label: "Cloud Computing" },
  { value: "CYBER_SECURITY", label: "Cyber Security" },
  { value: "OTHER", label: "Other" },
];

const yearOptions = [
  { value: "ALL", label: "All Years" },
  { value: "1st Year", label: "1st Year" },
  { value: "2nd Year", label: "2nd Year" },
  { value: "3rd Year", label: "3rd Year" },
  { value: "4th Year", label: "4th Year" },
];

const paymentOptions: { value: InternPaymentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

const durationOptions: { value: InternDuration; label: string }[] = [
  { value: "1-Month", label: "1 Month" },
  { value: "2-Month", label: "2 Months" },
  { value: "3-Month", label: "3 Months" },
  { value: "6-Month", label: "6 Months" },
];

const modeOptions: { value: InternMode; label: string }[] = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-Site" },
];

export default function OfferLettersTab() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<InternDomain | "ALL">("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState<InternPaymentStatus | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editIntern, setEditIntern] = useState<Intern | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Intern | null>(null);

  // Selection for bulk operations
  const [selectedInterns, setSelectedInterns] = useState<string[]>([]);

  // Loading states
  const [generatingLetter, setGeneratingLetter] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, name: "" });

  // Data
  const queryClient = useQueryClient();
  const { data: interns, isLoading } = useInterns();
  const deleteMutation = useDeleteIntern();

  // Refresh intern list
  const refreshInterns = () => {
    queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
  };

  // Filter interns - only show those with offer letter fields (mode, projectTitle)
  const filteredInterns = useMemo(() => {
    if (!interns) return [];

    return interns.filter((intern) => {
      // Only show interns that have offer letter data (mode and projectTitle set)
      if (!intern.mode || !intern.projectTitle) return false;

      const matchesSearch =
        intern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.college.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.internId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDomain = domainFilter === "ALL" || intern.domain === domainFilter;
      const matchesYear = yearFilter === "ALL" || intern.year === yearFilter;
      const matchesPayment = paymentFilter === "ALL" || intern.paymentStatus === paymentFilter;

      return matchesSearch && matchesDomain && matchesYear && matchesPayment;
    });
  }, [interns, searchQuery, domainFilter, yearFilter, paymentFilter]);

  // Handle offer letter generation
  const handleGenerateOfferLetter = async (intern: Intern & { id: string }) => {
    setGeneratingLetter(intern.id);
    try {
      await generateAndUploadOfferLetter(intern);
      toast.success(`Offer letter generated for ${intern.name}`);
      refreshInterns();
    } catch (error) {
      console.error("Failed to generate offer letter:", error);
      toast.error("Failed to generate offer letter");
    } finally {
      setGeneratingLetter(null);
    }
  };

  // Handle offer letter regeneration
  const handleRegenerateOfferLetter = async (intern: Intern & { id: string }) => {
    setGeneratingLetter(intern.id);
    try {
      await generateAndUploadOfferLetter(intern);
      toast.success(`Offer letter regenerated for ${intern.name}`);
      refreshInterns();
    } catch (error) {
      console.error("Failed to regenerate offer letter:", error);
      toast.error("Failed to regenerate offer letter");
    } finally {
      setGeneratingLetter(null);
    }
  };

  // Handle offer letter download
  const handleDownloadOfferLetter = async (intern: Intern) => {
    try {
      await generateAndDownloadOfferLetter(intern);
      toast.success("Offer letter downloaded");
    } catch (error) {
      console.error("Failed to download offer letter:", error);
      toast.error("Failed to download offer letter");
    }
  };

  // Handle view offer letter - opens in new tab using presigned URL
  const handleViewOfferLetter = async (intern: Intern) => {
    if (!intern.offerLetterKey && !intern.offerLetterUrl) {
      toast.error("Offer letter not found");
      return;
    }

    try {
      let fileKey = intern.offerLetterKey;

      if (!fileKey && intern.offerLetterUrl) {
        fileKey = extractFileKeyFromUrl(intern.offerLetterUrl) || undefined;
      }

      if (!fileKey) {
        toast.error("Could not determine offer letter location");
        return;
      }

      const presignedUrl = await getSignedDownloadUrl(fileKey, 3600);
      window.open(presignedUrl, "_blank");
    } catch (error) {
      console.error("Failed to view offer letter:", error);
      toast.error("Failed to view offer letter");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      // Delete offer letter from R2 if exists
      if (deleteConfirm.offerLetterUrl) {
        const fileKey = extractFileKeyFromUrl(deleteConfirm.offerLetterUrl);
        if (fileKey) {
          await deleteFileFromR2(fileKey).catch(console.error);
        }
      }

      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Intern deleted");
      setDeleteConfirm(null);
    } catch (error) {
      toast.error("Failed to delete intern");
    }
  };

  // Handle bulk offer letter generation
  const handleBulkGenerate = async () => {
    const internsToGenerate = filteredInterns.filter(
      (i) => selectedInterns.includes(i.id) && !i.offerLetterUrl
    ) as Array<Intern & { id: string }>;

    if (internsToGenerate.length === 0) {
      toast.error("No interns selected or all already have offer letters");
      return;
    }

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: internsToGenerate.length, name: "" });

    try {
      const results = await bulkGenerateOfferLetters(internsToGenerate, (current, total, name) => {
        setBulkProgress({ current, total, name });
      });

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed > 0) {
        toast.error(`Generated ${successful} offer letters, ${failed} failed`);
      } else {
        toast.success(`Generated ${successful} offer letters successfully`);
      }

      setSelectedInterns([]);
      refreshInterns();
    } catch (error) {
      toast.error("Bulk generation failed");
    } finally {
      setBulkGenerating(false);
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedInterns((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedInterns.length === filteredInterns.length) {
      setSelectedInterns([]);
    } else {
      setSelectedInterns(filteredInterns.map((i) => i.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, college, ID..."
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
          {selectedInterns.length > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkGenerate}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating ({bulkProgress.current}/{bulkProgress.total})
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Selected ({selectedInterns.length})
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsBulkModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsNewModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Offer Letter
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg"
        >
          <div className="min-w-[150px]">
            <Label className="text-xs mb-1 block">Domain</Label>
            <Select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as InternDomain | "ALL")}
              options={domainOptions}
            />
          </div>
          <div className="min-w-[120px]">
            <Label className="text-xs mb-1 block">Year</Label>
            <Select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              options={yearOptions}
            />
          </div>
          <div className="min-w-[120px]">
            <Label className="text-xs mb-1 block">Payment</Label>
            <Select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as InternPaymentStatus | "ALL")}
              options={paymentOptions}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setDomainFilter("ALL");
              setYearFilter("ALL");
              setPaymentFilter("ALL");
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </motion.div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredInterns.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No offer letters found</h3>
          <p className="text-muted-foreground">
            {interns && interns.length > 0
              ? "Try adjusting your search or filters"
              : "Get started by adding your first offer letter"}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">
                      <Checkbox
                        checked={selectedInterns.length === filteredInterns.length && filteredInterns.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium">ID</th>
                    <th className="p-3 text-left text-sm font-medium">Name</th>
                    <th className="p-3 text-left text-sm font-medium">College</th>
                    <th className="p-3 text-left text-sm font-medium">Domain</th>
                    <th className="p-3 text-left text-sm font-medium">Mode</th>
                    <th className="p-3 text-left text-sm font-medium">Stipend</th>
                    <th className="p-3 text-left text-sm font-medium">Project</th>
                    <th className="p-3 text-left text-sm font-medium">Offer Letter</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterns.map((intern) => (
                    <tr key={intern.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedInterns.includes(intern.id)}
                          onChange={() => toggleSelection(intern.id)}
                        />
                      </td>
                      <td className="p-3 text-sm font-mono">{intern.internId}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm">{intern.name}</p>
                          <p className="text-xs text-muted-foreground">{intern.email}</p>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{intern.college}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">
                          {INTERN_DOMAIN_LABELS[intern.domain]}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {intern.mode ? INTERN_MODE_LABELS[intern.mode] : "-"}
                      </td>
                      <td className="p-3 text-sm">
                        {intern.stipend !== undefined && intern.stipend > 0 ? (
                          `₹${intern.stipend.toLocaleString()}`
                        ) : (
                          <span className="text-muted-foreground">Unpaid</span>
                        )}
                      </td>
                      <td className="p-3 text-sm max-w-[150px] truncate" title={intern.projectTitle}>
                        {intern.projectTitle || "-"}
                      </td>
                      <td className="p-3">
                        {intern.offerLetterUrl ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-primary"
                              onClick={() => handleViewOfferLetter(intern)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleDownloadOfferLetter(intern)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              title="Regenerate offer letter"
                              onClick={() => handleRegenerateOfferLetter(intern as Intern & { id: string })}
                              disabled={generatingLetter === intern.id}
                            >
                              {generatingLetter === intern.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleGenerateOfferLetter(intern as Intern & { id: string })}
                            disabled={generatingLetter === intern.id}
                          >
                            {generatingLetter === intern.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <FileText className="h-3 w-3 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title="Edit intern"
                            onClick={() => setEditIntern(intern)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(intern)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Offer Letter Modal */}
      <NewOfferLetterModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onOfferLetterGenerated={refreshInterns}
      />

      {/* Edit Offer Letter Modal */}
      <EditOfferLetterModal
        isOpen={!!editIntern}
        intern={editIntern}
        onClose={() => setEditIntern(null)}
        onSaved={refreshInterns}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImportComplete={refreshInterns}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Intern"
      >
        <p>Are you sure you want to delete {deleteConfirm?.name}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete their offer letter from storage if generated.
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

// New Offer Letter Modal Component
function NewOfferLetterModal({
  isOpen,
  onClose,
  onOfferLetterGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOfferLetterGenerated?: () => void;
}) {
  const createMutation = useCreateIntern();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    year: "1st Year",
    domain: "" as string,
    duration: "1-Month" as InternDuration,
    startDate: "",
    endDate: "",
    issueDate: new Date().toISOString().split("T")[0],
    paymentStatus: "UNPAID" as InternPaymentStatus,
    // Offer letter specific fields
    mode: "REMOTE" as InternMode,
    stipend: 0,
    projectTitle: "",
  });
  const [generateLetter, setGenerateLetter] = useState(true);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      college: "",
      year: "1st Year",
      domain: "",
      duration: "1-Month",
      startDate: "",
      endDate: "",
      issueDate: new Date().toISOString().split("T")[0],
      paymentStatus: "UNPAID",
      mode: "REMOTE",
      stipend: 0,
      projectTitle: "",
    });
    setGenerateLetter(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.college) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    if (!formData.projectTitle) {
      toast.error("Please enter a project title");
      return;
    }

    if (!formData.domain?.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    try {
      const mappedDomain = mapDomainString(formData.domain) as InternDomain;
      const internId = await createMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        college: formData.college,
        year: formData.year,
        domain: mappedDomain,
        duration: formData.duration,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        issueDate: new Date(formData.issueDate),
        paymentStatus: formData.paymentStatus,
      });

      // Update with offer letter fields
      const { updateIntern } = await import("@/services/internService");
      await updateIntern(internId, {
        mode: formData.mode,
        stipend: formData.stipend,
        projectTitle: formData.projectTitle,
      } as Partial<Intern>);

      toast.success("Intern added successfully");

      if (generateLetter) {
        // Generate offer letter after creation
        const intern: Intern & { id: string } = {
          id: internId,
          internId: "",
          ...formData,
          domain: mappedDomain,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          issueDate: new Date(formData.issueDate),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await generateAndUploadOfferLetter(intern, formData.domain.trim());
          toast.success("Offer letter generated");
          onOfferLetterGenerated?.();
        } catch (error) {
          toast.error("Failed to generate offer letter");
        }
      } else {
        onOfferLetterGenerated?.();
      }

      resetForm();
      onClose();
    } catch (error) {
      toast.error("Failed to add intern");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Offer Letter">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Full Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label>Phone *</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXXXXXXX"
            />
          </div>

          <div className="col-span-2">
            <Label>College *</Label>
            <Input
              value={formData.college}
              onChange={(e) => setFormData({ ...formData, college: e.target.value })}
              placeholder="College/University name"
            />
          </div>

          <div>
            <Label>Year</Label>
            <Select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              options={yearOptions.filter((y) => y.value !== "ALL")}
            />
          </div>

          <div>
            <Label>Domain *</Label>
            <Input
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="e.g., Web Development, AI/ML, Data Science"
            />
          </div>

          <div>
            <Label>Duration</Label>
            <Select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value as InternDuration })}
              options={durationOptions}
            />
          </div>

          <div>
            <Label>Payment Status</Label>
            <Select
              value={formData.paymentStatus}
              onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as InternPaymentStatus })}
              options={[
                { value: "PAID", label: "Paid" },
                { value: "UNPAID", label: "Unpaid" },
              ]}
            />
          </div>

          <div>
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>

          <div>
            <Label>End Date *</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          {/* Offer Letter Specific Fields */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Offer Letter Details</h4>
          </div>

          <div>
            <Label>Mode *</Label>
            <Select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as InternMode })}
              options={modeOptions}
            />
          </div>

          <div>
            <Label>Stipend (₹)</Label>
            <Input
              type="number"
              value={formData.stipend}
              onChange={(e) => setFormData({ ...formData, stipend: parseInt(e.target.value) || 0 })}
              placeholder="0 for unpaid"
            />
          </div>

          <div className="col-span-2">
            <Label>Project Title *</Label>
            <Input
              value={formData.projectTitle}
              onChange={(e) => setFormData({ ...formData, projectTitle: e.target.value })}
              placeholder="e.g., AI Chatbot Development"
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="generateLetter"
              checked={generateLetter}
              onChange={(e) => setGenerateLetter(e.target.checked)}
            />
            <Label htmlFor="generateLetter" className="cursor-pointer">
              Generate offer letter immediately
            </Label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
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

// Edit Offer Letter Modal Component
function EditOfferLetterModal({
  isOpen,
  intern,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  intern: Intern | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const updateMutation = useUpdateIntern();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    year: "1st Year",
    domain: "" as string,
    duration: "1-Month" as InternDuration,
    startDate: "",
    endDate: "",
    paymentStatus: "UNPAID" as InternPaymentStatus,
    mode: "REMOTE" as InternMode,
    stipend: 0,
    projectTitle: "",
  });
  const [regenerateLetter, setRegenerateLetter] = useState(true);
  const [saving, setSaving] = useState(false);

  const populateForm = () => {
    if (intern) {
      setFormData({
        name: intern.name,
        email: intern.email,
        phone: intern.phone,
        college: intern.college,
        year: intern.year,
        domain: INTERN_DOMAIN_LABELS[intern.domain] || "",
        duration: intern.duration,
        startDate: intern.startDate instanceof Date
          ? intern.startDate.toISOString().split("T")[0]
          : String(intern.startDate).split("T")[0],
        endDate: intern.endDate instanceof Date
          ? intern.endDate.toISOString().split("T")[0]
          : String(intern.endDate).split("T")[0],
        paymentStatus: intern.paymentStatus,
        mode: intern.mode || "REMOTE",
        stipend: intern.stipend || 0,
        projectTitle: intern.projectTitle || "",
      });
    }
  };

  if (isOpen && intern && formData.name !== intern.name) {
    populateForm();
  }

  const handleSubmit = async () => {
    if (!intern) return;

    if (!formData.name || !formData.email || !formData.phone || !formData.college) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!formData.domain?.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    if (!formData.projectTitle) {
      toast.error("Please enter a project title");
      return;
    }

    setSaving(true);
    try {
      const mappedDomain = mapDomainString(formData.domain) as InternDomain;

      const { updateIntern } = await import("@/services/internService");
      await updateIntern(intern.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        college: formData.college,
        year: formData.year,
        domain: mappedDomain,
        duration: formData.duration as InternDuration,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        paymentStatus: formData.paymentStatus,
      });

      await updateIntern(intern.id, {
        mode: formData.mode,
        stipend: formData.stipend,
        projectTitle: formData.projectTitle,
      } as Partial<Intern>);

      toast.success("Intern updated successfully");

      if (regenerateLetter) {
        const updatedIntern: Intern & { id: string } = {
          ...intern,
          ...formData,
          domain: mappedDomain,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          issueDate: intern.issueDate,
        };

        try {
          await generateAndUploadOfferLetter(updatedIntern, formData.domain.trim());
          toast.success("Offer letter regenerated");
        } catch {
          toast.error("Failed to regenerate offer letter");
        }
      }

      onSaved?.();
      onClose();
    } catch {
      toast.error("Failed to update intern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Offer Letter">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Full Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <Label>Phone *</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <Label>College *</Label>
            <Input
              value={formData.college}
              onChange={(e) => setFormData({ ...formData, college: e.target.value })}
            />
          </div>

          <div>
            <Label>Year</Label>
            <Select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              options={yearOptions.filter((y) => y.value !== "ALL")}
            />
          </div>

          <div>
            <Label>Domain *</Label>
            <Input
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="e.g., Web Development, AI/ML, Data Science"
            />
          </div>

          <div>
            <Label>Duration</Label>
            <Select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value as InternDuration })}
              options={durationOptions}
            />
          </div>

          <div>
            <Label>Payment Status</Label>
            <Select
              value={formData.paymentStatus}
              onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as InternPaymentStatus })}
              options={[
                { value: "PAID", label: "Paid" },
                { value: "UNPAID", label: "Unpaid" },
              ]}
            />
          </div>

          <div>
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>

          <div>
            <Label>End Date *</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          {/* Offer Letter Specific Fields */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Offer Letter Details</h4>
          </div>

          <div>
            <Label>Mode *</Label>
            <Select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as InternMode })}
              options={modeOptions}
            />
          </div>

          <div>
            <Label>Stipend</Label>
            <Input
              type="number"
              value={formData.stipend}
              onChange={(e) => setFormData({ ...formData, stipend: parseInt(e.target.value) || 0 })}
              placeholder="0 for unpaid"
            />
          </div>

          <div className="col-span-2">
            <Label>Project Title *</Label>
            <Input
              value={formData.projectTitle}
              onChange={(e) => setFormData({ ...formData, projectTitle: e.target.value })}
              placeholder="e.g., AI Chatbot Development"
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="regenerateLetter"
              checked={regenerateLetter}
              onChange={(e) => setRegenerateLetter(e.target.checked)}
            />
            <Label htmlFor="regenerateLetter" className="cursor-pointer">
              Regenerate offer letter after saving
            </Label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Regenerate"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Bulk Import Modal Component
function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [generateLetters, setGenerateLetters] = useState(true);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload an Excel (.xlsx) or CSV file");
      return;
    }

    setFile(selectedFile);

    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

          const parsed = jsonData.map((row) => ({
            name: String(row["Name"] || row["name"] || ""),
            email: String(row["Email"] || row["email"] || ""),
            phone: String(row["Phone"] || row["phone"] || ""),
            college: String(row["College"] || row["college"] || ""),
            year: String(row["Year"] || row["year"] || "1st Year"),
            domain: String(row["Domain"] || row["domain"] || ""),
            duration: String(row["Duration"] || row["duration"] || "1-Month"),
            startDate: String(row["Start Date"] || row["startDate"] || ""),
            endDate: String(row["End Date"] || row["endDate"] || ""),
            mode: String(row["Mode"] || row["mode"] || "REMOTE"),
            stipend: String(row["Stipend"] || row["stipend"] || "0"),
            projectTitle: String(row["Project Title"] || row["projectTitle"] || row["Project"] || ""),
            paymentStatus: String(row["Payment Status"] || row["paymentStatus"] || "UNPAID"),
          }));

          setParsedData(parsed);
          toast.success(`Found ${parsed.length} records`);
        } catch (error) {
          toast.error("Failed to parse file");
          setFile(null);
        }
      };

      reader.readAsBinaryString(selectedFile);
    } catch (error) {
      toast.error("Failed to read file");
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    setImporting(true);

    try {
      const { createIntern, updateIntern } = await import("@/services/internService");
      const { mapDomainString, mapDurationString, parseDateString } = await import("@/services/certificateService");

      const createdInterns: Array<Intern & { id: string }> = [];

      for (const row of parsedData) {
        // Create intern
        const internId = await createIntern({
          name: row.name,
          email: row.email,
          phone: row.phone,
          college: row.college,
          year: row.year || "1st Year",
          domain: mapDomainString(row.domain) as InternDomain,
          duration: mapDurationString(row.duration) as InternDuration,
          startDate: parseDateString(row.startDate),
          endDate: parseDateString(row.endDate),
          issueDate: new Date(),
          paymentStatus: (row.paymentStatus?.toUpperCase() === "PAID" ? "PAID" : "UNPAID") as InternPaymentStatus,
        });

        // Map mode string
        let mode: InternMode = "REMOTE";
        const modeStr = row.mode?.toUpperCase();
        if (modeStr === "HYBRID") mode = "HYBRID";
        else if (modeStr === "ON_SITE" || modeStr === "ON-SITE" || modeStr === "ONSITE") mode = "ON_SITE";

        // Update with offer letter fields
        await updateIntern(internId, {
          mode,
          stipend: parseInt(row.stipend) || 0,
          projectTitle: row.projectTitle,
        } as Partial<Intern>);

        createdInterns.push({
          id: internId,
          internId: "",
          name: row.name,
          email: row.email,
          phone: row.phone,
          college: row.college,
          year: row.year || "1st Year",
          domain: mapDomainString(row.domain) as InternDomain,
          duration: mapDurationString(row.duration) as InternDuration,
          startDate: parseDateString(row.startDate),
          endDate: parseDateString(row.endDate),
          issueDate: new Date(),
          paymentStatus: (row.paymentStatus?.toUpperCase() === "PAID" ? "PAID" : "UNPAID") as InternPaymentStatus,
          mode,
          stipend: parseInt(row.stipend) || 0,
          projectTitle: row.projectTitle,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      toast.success(`Imported ${createdInterns.length} interns`);

      // Generate offer letters if selected
      if (generateLetters && createdInterns.length > 0) {
        toast.loading("Generating offer letters...", { id: "bulk-gen" });
        const results = await bulkGenerateOfferLetters(createdInterns);
        const successful = results.filter((r) => r.success).length;
        toast.dismiss("bulk-gen");
        toast.success(`Generated ${successful} offer letters`);
      }

      // Reset and close
      setFile(null);
      setParsedData([]);
      onImportComplete?.();
      onClose();
    } catch (error) {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "College",
      "Year",
      "Domain",
      "Duration",
      "Start Date",
      "End Date",
      "Mode",
      "Stipend",
      "Project Title",
      "Payment Status",
    ];
    const csvContent = headers.join(",") + "\n" + "John Doe,john@email.com,9876543210,ABC College,3rd Year,Web Development,2-Month,01/01/2024,28/02/2024,Hybrid,15000,E-Commerce Platform,PAID";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "offer_letter_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Import Offer Letters">
      <div className="space-y-4">
        <div className="text-center border-2 border-dashed rounded-lg p-6">
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileSpreadsheet className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{parsedData.length} records found</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setParsedData([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Upload Excel (.xlsx) or CSV file
              </p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
          />
        </div>

        <Button variant="link" className="text-sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />
          Download Template
        </Button>

        {parsedData.length > 0 && (
          <div className="max-h-40 overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Mode</th>
                  <th className="p-2 text-left">Project</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2">{row.mode}</td>
                    <td className="p-2 truncate max-w-[100px]">{row.projectTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 5 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                ...and {parsedData.length - 5} more
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="genLetters"
            checked={generateLetters}
            onChange={(e) => setGenerateLetters(e.target.checked)}
          />
          <Label htmlFor="genLetters" className="cursor-pointer text-sm">
            Generate offer letters after import
          </Label>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleImport}
            disabled={parsedData.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${parsedData.length} Interns`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
