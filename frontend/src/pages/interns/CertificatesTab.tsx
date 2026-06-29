import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Upload,
  Award,
  Filter,
  X,
  Loader2,
  FileSpreadsheet,
  Eye,
  Pencil,
  RefreshCw,
  Zap,
  Building2,
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
import { useInterns, useCreateIntern, useUpdateIntern, useDeleteIntern, useBulkDeleteInterns, internQueryKeys } from "@/hooks/useInterns";
import { useQueryClient } from "@tanstack/react-query";
import type { Intern, InternPaymentStatus, InternDuration } from "@/types";
import {
  generateAndDownloadCertificate,
  generateAndUploadCertificate,
  bulkGenerateCertificates,
  parseInternFile,
  mapDurationString,
  parseDateString,
} from "@/services/certificateService";
import {
  generateAndDownloadSparksCertificate,
  generateAndUploadSparksCertificate,
  bulkGenerateSparksCertificates,
} from "@/services/sparksCertificateService";
import { bulkCreateInterns, getInternById } from "@/services/internService";
import { deleteFileFromR2, extractFileKeyFromUrl, getSignedDownloadUrl } from "@/services/r2Service";
import { logCertificateGenerated } from "@/services/activityLogService";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

// Brand type
type CertBrand = "welbuilt" | "sparks";

// domainOptions built dynamically from data inside the component

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

export default function CertificatesTab() {
  // Brand selector — which certificate template to use
  const [activeBrand, setActiveBrand] = useState<CertBrand>("welbuilt");

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
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
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, name: "" });

  // Modal for bulk delete confirmation
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Data
  const queryClient = useQueryClient();
  const { data: interns, isLoading } = useInterns();
  const deleteMutation = useDeleteIntern();
  const bulkDeleteMutation = useBulkDeleteInterns();
  const currentUser = useAuthStore((s) => s.user);

  const domainOptions = useMemo(() => {
    const domains = interns ? [...new Set(interns.map(i => i.domain).filter(Boolean))].sort() : [];
    return [{ value: "ALL", label: "All Domains" }, ...domains.map(d => ({ value: d, label: d }))];
  }, [interns]);

  // Refresh intern list
  const refreshInterns = () => {
    queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
  };

  // Filter interns
  const filteredInterns = useMemo(() => {
    if (!interns) return [];

    return interns.filter((intern) => {
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

  // Handle certificate generation
  const handleGenerateCertificate = async (intern: Intern & { id: string }) => {
    setGeneratingCert(intern.id);
    try {
      if (activeBrand === "sparks") {
        await generateAndUploadSparksCertificate(intern);
      } else {
        await generateAndUploadCertificate(intern);
      }
      toast.success(`${activeBrand === "sparks" ? "Sparks AI" : "WelBuilt AI"} certificate generated for ${intern.name}`);
      if (currentUser?.id) {
        logCertificateGenerated(currentUser.id, intern.id, intern.name, currentUser.name).catch(() => {});
      }
      refreshInterns();
    } catch (error) {
      console.error("Failed to generate certificate:", error);
      toast.error("Failed to generate certificate");
    } finally {
      setGeneratingCert(null);
    }
  };

  // Handle certificate regeneration
  const handleRegenerateCertificate = async (intern: Intern & { id: string }) => {
    setGeneratingCert(intern.id);
    try {
      if (activeBrand === "sparks") {
        await generateAndUploadSparksCertificate(intern);
      } else {
        await generateAndUploadCertificate(intern);
      }
      toast.success(`Certificate regenerated for ${intern.name}`);
      if (currentUser?.id) {
        logCertificateGenerated(currentUser.id, intern.id, intern.name, currentUser.name).catch(() => {});
      }
      refreshInterns();
    } catch (error) {
      console.error("Failed to regenerate certificate:", error);
      toast.error("Failed to regenerate certificate");
    } finally {
      setGeneratingCert(null);
    }
  };

  // Handle certificate download (generates fresh and saves locally)
  const handleDownloadCertificate = async (intern: Intern) => {
    try {
      if (activeBrand === "sparks") {
        await generateAndDownloadSparksCertificate(intern);
      } else {
        await generateAndDownloadCertificate(intern);
      }
      toast.success("Certificate downloaded");
    } catch (error) {
      console.error("Failed to download certificate:", error);
      toast.error("Failed to download certificate");
    }
  };

  // Handle view certificate - opens in new tab using presigned URL
  const handleViewCertificate = async (intern: Intern) => {
    if (!intern.certificateKey && !intern.certificateUrl) {
      toast.error("Certificate not found");
      return;
    }

    try {
      let fileKey = intern.certificateKey;

      // If no certificateKey, try to extract from URL
      if (!fileKey && intern.certificateUrl) {
        fileKey = extractFileKeyFromUrl(intern.certificateUrl) || undefined;
      }

      if (!fileKey) {
        toast.error("Could not determine certificate location");
        return;
      }

      // Get presigned URL for viewing
      const presignedUrl = await getSignedDownloadUrl(fileKey, 3600);
      window.open(presignedUrl, "_blank");
    } catch (error) {
      console.error("Failed to view certificate:", error);
      toast.error("Failed to view certificate");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      // Delete certificate from R2 if exists
      if (deleteConfirm.certificateUrl) {
        const fileKey = extractFileKeyFromUrl(deleteConfirm.certificateUrl);
        if (fileKey) {
          await deleteFileFromR2(fileKey).catch(console.error);
        }
      }

      await deleteMutation.mutateAsync({ id: deleteConfirm.id, name: deleteConfirm.name });
      toast.success("Intern deleted");
      setDeleteConfirm(null);
    } catch (error) {
      toast.error("Failed to delete intern");
    }
  };

  // Handle bulk certificate generation
  const handleBulkGenerate = async () => {
    const internsToGenerate = filteredInterns.filter(
      (i) => selectedInterns.includes(i.id) && !i.certificateUrl
    ) as Array<Intern & { id: string }>;

    if (internsToGenerate.length === 0) {
      toast.error("No interns selected or all already have certificates");
      return;
    }

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: internsToGenerate.length, name: "" });

    try {
      const results = activeBrand === "sparks"
        ? await bulkGenerateSparksCertificates(internsToGenerate, (current, total, name) => {
            setBulkProgress({ current, total, name });
          })
        : await bulkGenerateCertificates(internsToGenerate, (current, total, name) => {
            setBulkProgress({ current, total, name });
          });

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed > 0) {
        toast.error(`Generated ${successful} certificates, ${failed} failed`);
      } else {
        toast.success(`Generated ${successful} ${activeBrand === "sparks" ? "Sparks AI" : "WelBuilt AI"} certificates`);
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

  // Bulk delete selected interns
  const handleBulkDelete = async () => {
    const internsToDelete = filteredInterns.filter((i) => selectedInterns.includes(i.id));

    // Delete R2 files first
    await Promise.allSettled(
      internsToDelete
        .filter((i) => i.certificateUrl)
        .map((i) => {
          const key = extractFileKeyFromUrl(i.certificateUrl!);
          return key ? deleteFileFromR2(key) : Promise.resolve();
        })
    );

    const internsInfo = internsToDelete.map((i) => ({ id: i.id, name: i.name }));
    try {
      await bulkDeleteMutation.mutateAsync({ ids: selectedInterns, interns: internsInfo });
      toast.success(`Deleted ${selectedInterns.length} interns`);
      setSelectedInterns([]);
      setBulkDeleteConfirm(false);
    } catch {
      toast.error("Failed to delete selected interns");
    }
  };

  return (
    <div className="space-y-4">
      {/* Brand Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Certificate Template:</span>
        <div className="flex rounded-lg border border-border/60 overflow-hidden">
          <button
            onClick={() => setActiveBrand("welbuilt")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
              activeBrand === "welbuilt"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            <Building2 className="h-4 w-4" />
            WelBuilt AI
          </button>
          <button
            onClick={() => setActiveBrand("sparks")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-l border-border/60",
              activeBrand === "sparks"
                ? "bg-amber-500 text-white"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            <Zap className="h-4 w-4" />
            Sparks AI
          </button>
        </div>
        {activeBrand === "sparks" && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Generates Sparks AI branded certificates with logo, seal &amp; director signature
          </span>
        )}
      </div>

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
          <Button variant="outline" onClick={() => setIsBulkModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsNewModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Certificate
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
              onChange={(e) => setDomainFilter(e.target.value)}
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

      {/* Bulk action bar — slides in when rows are selected */}
      {selectedInterns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg"
        >
          <span className="text-sm font-medium text-primary">
            {selectedInterns.length} intern{selectedInterns.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkGenerate}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating ({bulkProgress.current}/{bulkProgress.total})</>
              ) : (
                <><Award className="h-3.5 w-3.5 mr-1.5" />Generate Certificates</>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Selected
            </Button>
          </div>
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
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No interns found</h3>
          <p className="text-muted-foreground">
            {interns && interns.length > 0
              ? "Try adjusting your search or filters"
              : "Get started by adding your first intern certificate"}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left w-10">
                    <Checkbox
                      checked={selectedInterns.length === filteredInterns.length && filteredInterns.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">ID</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Intern</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">College</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Domain</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">Payment</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-44">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterns.map((intern) => (
                  <tr key={intern.id} className={cn("border-t hover:bg-muted/30 transition-colors", selectedInterns.includes(intern.id) && "bg-primary/5")}>
                    <td className="p-3">
                      <Checkbox
                        checked={selectedInterns.includes(intern.id)}
                        onChange={() => toggleSelection(intern.id)}
                      />
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{intern.internId}</td>
                    <td className="p-3">
                      <p className="font-medium text-sm">{intern.name}</p>
                      <p className="text-xs text-muted-foreground">{intern.email}</p>
                      <p className="text-xs text-muted-foreground">{intern.phone} · {intern.year}</p>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{intern.college}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className="text-xs">{intern.domain}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={intern.paymentStatus === "PAID" ? "success" : "destructive"} className="text-xs">
                        {intern.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {intern.certificateUrl ? (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-primary text-xs" onClick={() => handleViewCertificate(intern)} title="View">
                              <Eye className="h-3.5 w-3.5 mr-1" />View
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownloadCertificate(intern)} title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRegenerateCertificate(intern as Intern & { id: string })} disabled={generatingCert === intern.id} title="Regenerate">
                              {generatingCert === intern.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleGenerateCertificate(intern as Intern & { id: string })} disabled={generatingCert === intern.id}>
                            {generatingCert === intern.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Award className="h-3.5 w-3.5 mr-1" />Generate</>}
                          </Button>
                        )}
                        <div className="ml-1 border-l pl-1 flex gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditIntern(intern)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(intern)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* New Certificate Modal */}
      <NewCertificateModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCertificateGenerated={refreshInterns}
        brand={activeBrand}
      />

      {/* Edit Certificate Modal */}
      <EditCertificateModal
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
        brand={activeBrand}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Intern"
      >
        <p>Are you sure you want to delete {deleteConfirm?.name}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete their certificate from storage if generated.
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

      {/* Bulk Delete Confirmation */}
      <Modal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Delete Selected Interns"
      >
        <p>
          Are you sure you want to delete <strong>{selectedInterns.length} interns</strong>?
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This will also delete their certificates from storage. This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedInterns.length} Interns`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// New Certificate Modal Component
function NewCertificateModal({
  isOpen,
  onClose,
  onCertificateGenerated,
  brand = "welbuilt",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCertificateGenerated?: () => void;
  brand?: CertBrand;
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
  });
  const [generateCert, setGenerateCert] = useState(true);

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
    });
    setGenerateCert(true);
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

    if (!formData.domain?.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    try {
      const startDate = parseDateString(formData.startDate);
      const endDate = parseDateString(formData.endDate);
      const issueDate = parseDateString(formData.issueDate);

      const internId = await createMutation.mutateAsync({
        ...formData,
        domain: formData.domain.trim(),
        startDate,
        endDate,
        issueDate,
        brand,
      });

      toast.success("Intern added successfully");

      if (generateCert) {
        const createdIntern = await getInternById(internId);
        const intern: Intern & { id: string } = {
          id: internId,
          internId: createdIntern?.internId ?? "",
          ...formData,
          domain: formData.domain.trim(),
          startDate,
          endDate,
          issueDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          if (brand === "sparks") {
            await generateAndUploadSparksCertificate(intern);
          } else {
            await generateAndUploadCertificate(intern, formData.domain.trim());
          }
          toast.success(`${brand === "sparks" ? "Sparks AI" : "WelBuilt AI"} certificate generated`);
          onCertificateGenerated?.();
        } catch (error) {
          toast.error("Failed to generate certificate");
        }
      }

      resetForm();
      onClose();
    } catch (error) {
      toast.error("Failed to add intern");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`New Certificate — ${brand === "sparks" ? "Sparks AI" : "WelBuilt AI"}`}>
      {brand === "sparks" && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Will generate a Sparks AI branded certificate with logo, seal and director signature
          </span>
        </div>
      )}
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

          <div className="col-span-2">
            <Label>Issue Date</Label>
            <Input
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="generateCert"
              checked={generateCert}
              onChange={(e) => setGenerateCert(e.target.checked)}
            />
            <Label htmlFor="generateCert" className="cursor-pointer">
              Generate certificate immediately
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

// Edit Certificate Modal Component
function EditCertificateModal({
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
    issueDate: "",
    paymentStatus: "UNPAID" as InternPaymentStatus,
  });
  const [regenerateCert, setRegenerateCert] = useState(true);
  const [saving, setSaving] = useState(false);

  const populateForm = () => {
    if (intern) {
      setFormData({
        name: intern.name,
        email: intern.email,
        phone: intern.phone,
        college: intern.college,
        year: intern.year,
        domain: intern.domain || "",
        duration: intern.duration,
        startDate: intern.startDate instanceof Date
          ? intern.startDate.toISOString().split("T")[0]
          : String(intern.startDate).split("T")[0],
        endDate: intern.endDate instanceof Date
          ? intern.endDate.toISOString().split("T")[0]
          : String(intern.endDate).split("T")[0],
        issueDate: intern.issueDate instanceof Date
          ? intern.issueDate.toISOString().split("T")[0]
          : String(intern.issueDate).split("T")[0],
        paymentStatus: intern.paymentStatus,
      });
    }
  };

  // Populate when modal opens
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

    setSaving(true);
    try {
      const startDate = parseDateString(formData.startDate);
      const endDate = parseDateString(formData.endDate);
      const issueDate = parseDateString(formData.issueDate);

      await updateMutation.mutateAsync({
        id: intern.id,
        data: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          college: formData.college,
          year: formData.year,
          domain: formData.domain.trim(),
          duration: formData.duration as InternDuration,
          startDate,
          endDate,
          issueDate,
          paymentStatus: formData.paymentStatus,
        },
      });

      toast.success("Intern updated successfully");

      if (regenerateCert) {
        const updatedIntern: Intern & { id: string } = {
          ...intern,
          ...formData,
          domain: formData.domain.trim(),
          startDate,
          endDate,
          issueDate,
        };

        try {
          await generateAndUploadCertificate(updatedIntern, formData.domain.trim());
          toast.success("Certificate regenerated");
        } catch {
          toast.error("Failed to regenerate certificate");
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Certificate">
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

          <div className="col-span-2">
            <Label>Issue Date</Label>
            <Input
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              id="regenerateCert"
              checked={regenerateCert}
              onChange={(e) => setRegenerateCert(e.target.checked)}
            />
            <Label htmlFor="regenerateCert" className="cursor-pointer">
              Regenerate certificate after saving
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
  brand = "welbuilt",
}: {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  brand?: CertBrand;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [generateCerts, setGenerateCerts] = useState(true);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload an Excel (.xlsx) or CSV file");
      return;
    }

    setFile(selectedFile);

    try {
      const data = await parseInternFile(selectedFile);
      setParsedData(data);
      toast.success(`Found ${data.length} records`);
    } catch (error) {
      toast.error("Failed to parse file");
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
      // Convert parsed data to intern format
      const internsData = parsedData.map((row) => ({
        name: row.name,
        email: row.email,
        phone: row.phone,
        college: row.college,
        year: row.year || "1st Year",
        domain: (row.domain || "Other").trim(),
        duration: mapDurationString(row.duration) as InternDuration,
        startDate: parseDateString(row.startDate),
        endDate: parseDateString(row.endDate),
        issueDate: row.issueDate ? parseDateString(row.issueDate) : new Date(),
        paymentStatus: (row.paymentStatus?.toUpperCase() === "PAID" ? "PAID" : "UNPAID") as InternPaymentStatus,
        brand,
      }));

      // Create all interns
      const ids = await bulkCreateInterns(internsData);
      toast.success(`Imported ${ids.length} interns`);

      // Generate certificates if selected
      if (generateCerts && ids.length > 0) {
        toast.loading("Generating certificates...", { id: "bulk-cert-gen" });
        const createdInterns: Array<Intern & { id: string }> = [];
        for (let i = 0; i < ids.length; i++) {
          const intern = await getInternById(ids[i]);
          if (intern) createdInterns.push({ ...intern, id: ids[i] });
        }
        const results = brand === "sparks"
          ? await bulkGenerateSparksCertificates(createdInterns)
          : await bulkGenerateCertificates(createdInterns);
        const successful = results.filter((r) => r.success).length;
        toast.dismiss("bulk-cert-gen");
        toast.success(`Generated ${successful} ${brand === "sparks" ? "Sparks AI" : "WelBuilt AI"} certificates`);
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

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");

    const headers = [
      "Name", "Email", "Phone", "College", "Year",
      "Domain", "Duration", "Start Date", "End Date", "Issue Date", "Payment Status",
    ];

    const brandLabel = brand === "sparks" ? "Sparks AI Solutions" : "WelBuilt AI Solutions";

    const demoRows = [
      ["Arjun Sharma",   "arjun.sharma@email.com",   "9876543210", "IIT Madras",               "3rd Year", "Web Development",    "2-Month", "01/01/2026", "28/02/2026", "01/03/2026", "PAID"],
      ["Priya Nair",     "priya.nair@email.com",     "9876543211", "Anna University",           "2nd Year", "AI/ML",              "3-Month", "01/01/2026", "31/03/2026", "01/04/2026", "PAID"],
      ["Rahul Verma",    "rahul.verma@email.com",    "9876543212", "VIT Chennai",               "4th Year", "Data Science",       "1-Month", "01/02/2026", "28/02/2026", "01/03/2026", "UNPAID"],
      ["Sneha Reddy",    "sneha.reddy@email.com",    "9876543213", "BITS Pilani",               "3rd Year", "UI/UX Design",       "2-Month", "15/01/2026", "15/03/2026", "16/03/2026", "PAID"],
      ["Vikram Patel",   "vikram.patel@email.com",   "9876543214", "NIT Trichy",                "2nd Year", "Mobile Development", "3-Month", "01/03/2026", "31/05/2026", "01/06/2026", "UNPAID"],
      ["Ananya Singh",   "ananya.singh@email.com",   "9876543215", "SRM University",            "1st Year", "Cybersecurity",      "1-Month", "01/04/2026", "30/04/2026", "01/05/2026", "PAID"],
      ["Karan Mehta",    "karan.mehta@email.com",    "9876543216", "Manipal University",        "4th Year", "Cloud Computing",    "6-Month", "01/01/2026", "30/06/2026", "01/07/2026", "PAID"],
      ["Divya Kumar",    "divya.kumar@email.com",    "9876543217", "PSG College of Technology", "3rd Year", "Business Analytics", "2-Month", "01/02/2026", "31/03/2026", "01/04/2026", "UNPAID"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...demoRows]);

    // Column widths
    ws["!cols"] = [
      { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 30 }, { wch: 10 },
      { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Interns");

    // Instructions sheet
    const infoData = [
      [`${brandLabel} — Intern Bulk Upload Template`],
      [""],
      ["FIELD GUIDE:"],
      ["Name",           "Full name of the intern (required)"],
      ["Email",          "Valid email address (required)"],
      ["Phone",          "10-digit phone number (required)"],
      ["College",        "Full college/university name (required)"],
      ["Year",           "1st Year / 2nd Year / 3rd Year / 4th Year"],
      ["Domain",         "Internship domain e.g. Web Development, AI/ML, Data Science"],
      ["Duration",       "1-Month / 2-Month / 3-Month / 6-Month"],
      ["Start Date",     "DD/MM/YYYY format e.g. 01/01/2026"],
      ["End Date",       "DD/MM/YYYY format e.g. 31/03/2026"],
      ["Issue Date",     "DD/MM/YYYY format (optional, defaults to today)"],
      ["Payment Status", "PAID or UNPAID"],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    wsInfo["!cols"] = [{ wch: 18 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");

    XLSX.writeFile(wb, `${brand === "sparks" ? "sparks" : "welbuilt"}_intern_bulk_upload_template.xlsx`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Import — ${brand === "sparks" ? "Sparks AI" : "WelBuilt AI"}`}>
      <div className="space-y-4">
        {/* Brand badge */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
          brand === "sparks"
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
            : "bg-primary/5 border-primary/20 text-primary"
        )}>
          {brand === "sparks" ? <Zap className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
          Certificates will be generated using the{" "}
          <strong>{brand === "sparks" ? "Sparks AI" : "WelBuilt AI"}</strong> template
        </div>

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
          Download Excel Template (.xlsx) with demo data
        </Button>

        {parsedData.length > 0 && (
          <div className="max-h-40 overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">College</th>
                  <th className="p-2 text-left">Domain</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2">{row.college}</td>
                    <td className="p-2">{row.domain}</td>
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
            id="genCerts"
            checked={generateCerts}
            onChange={(e) => setGenerateCerts(e.target.checked)}
          />
          <Label htmlFor="genCerts" className="cursor-pointer text-sm">
            Generate certificates after import
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
