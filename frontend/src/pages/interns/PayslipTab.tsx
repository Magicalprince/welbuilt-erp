import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Download,
  Trash2,
  Receipt,
  Filter,
  X,
  Loader2,
  Eye,
  Pencil,
  RefreshCw,
  Users,
  UserCheck,
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
import { useInterns, useDeleteIntern, internQueryKeys } from "@/hooks/useInterns";
import { useQueryClient } from "@tanstack/react-query";
import type { Intern, InternDomain, InternPaymentStatus } from "@/types";
import { INTERN_DOMAIN_LABELS } from "@/types";
import {
  generateAndDownloadPayslip,
  generateAndUploadPayslip,
  generateAndDownloadEmployeePayslip,
  numberToWords,
} from "@/services/payslipService";
import type { EmployeePayslipData } from "@/services/payslipService";
import { updateIntern } from "@/services/internService";
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

const paymentTypeOptions = [
  { value: "MONTHLY", label: "Monthly Payment" },
  { value: "ONE_TIME", label: "One-Time Payment" },
];

const monthOptions = [
  { value: "", label: "Select Month" },
  { value: "January", label: "January" },
  { value: "February", label: "February" },
  { value: "March", label: "March" },
  { value: "April", label: "April" },
  { value: "May", label: "May" },
  { value: "June", label: "June" },
  { value: "July", label: "July" },
  { value: "August", label: "August" },
  { value: "September", label: "September" },
  { value: "October", label: "October" },
  { value: "November", label: "November" },
  { value: "December", label: "December" },
];

type Mode = "intern" | "employee";

export default function PayslipTab() {
  const [mode, setMode] = useState<Mode>("intern");
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<InternDomain | "ALL">("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState<InternPaymentStatus | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [generateIntern, setGenerateIntern] = useState<Intern | null>(null);
  const [editIntern, setEditIntern] = useState<Intern | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Intern | null>(null);

  // Selection
  const [selectedInterns, setSelectedInterns] = useState<string[]>([]);

  // Loading
  const [generatingSlip, setGeneratingSlip] = useState<string | null>(null);

  // Data
  const queryClient = useQueryClient();
  const { data: interns, isLoading } = useInterns();
  const deleteMutation = useDeleteIntern();

  const refreshInterns = () => {
    queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
  };

  // Filter interns - show ALL interns (shared data from other tabs)
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

  // Handle download (for interns that already have payslip data)
  const handleDownloadPayslip = async (intern: Intern) => {
    try {
      await generateAndDownloadPayslip(intern, {
        referenceNumber: intern.referenceNumber || "",
        numberOfMonths: intern.numberOfMonths || 1,
        paymentType: intern.paymentType || "ONE_TIME",
        month: new Date().toLocaleString("default", { month: "long" }),
        year: new Date().getFullYear(),
        collegeAddress: "",
        monthlyStipend: intern.stipend || 0,
      });
      toast.success("Payslip downloaded");
    } catch (error) {
      console.error("Failed to download payslip:", error);
      toast.error("Failed to download payslip");
    }
  };

  // Handle view
  const handleViewPayslip = async (intern: Intern) => {
    if (!intern.payslipKey && !intern.payslipUrl) {
      toast.error("Payslip not found");
      return;
    }
    try {
      let fileKey = intern.payslipKey;
      if (!fileKey && intern.payslipUrl) {
        fileKey = extractFileKeyFromUrl(intern.payslipUrl) || undefined;
      }
      if (!fileKey) {
        toast.error("Could not determine payslip location");
        return;
      }
      const presignedUrl = await getSignedDownloadUrl(fileKey, 3600);
      window.open(presignedUrl, "_blank");
    } catch (error) {
      console.error("Failed to view payslip:", error);
      toast.error("Failed to view payslip");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.payslipUrl) {
        const fileKey = extractFileKeyFromUrl(deleteConfirm.payslipUrl);
        if (fileKey) await deleteFileFromR2(fileKey).catch(console.error);
      }
      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Intern deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete intern");
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedInterns((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInterns.length === filteredInterns.length) {
      setSelectedInterns([]);
    } else {
      setSelectedInterns(filteredInterns.map((i) => i.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit">
        <Button
          variant={mode === "intern" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("intern")}
          className="gap-2"
        >
          <UserCheck className="h-4 w-4" />
          Intern Mode
        </Button>
        <Button
          variant={mode === "employee" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("employee")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Employee Mode
        </Button>
      </div>

      {mode === "intern" ? (
        <>
          {/* Intern Mode - Action bar */}
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
            <div className="flex gap-2" />
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
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No payslip records found</h3>
              <p className="text-muted-foreground">
                {interns && interns.length > 0
                  ? "Try adjusting your search or add payslip data"
                  : "Get started by creating payslip records"}
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
                        <th className="p-3 text-left text-sm font-medium">Stipend</th>
                        <th className="p-3 text-left text-sm font-medium">Months</th>
                        <th className="p-3 text-left text-sm font-medium">Type</th>
                        <th className="p-3 text-left text-sm font-medium">Total</th>
                        <th className="p-3 text-left text-sm font-medium">Payslip</th>
                        <th className="p-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInterns.map((intern) => {
                        const stipend = intern.stipend || 0;
                        const hasPayslipData = intern.numberOfMonths !== undefined || intern.paymentType !== undefined;
                        const months = intern.numberOfMonths || 1;
                        const total = hasPayslipData ? stipend * months : null;

                        return (
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
                            <td className="p-3 text-sm">
                              {stipend > 0 ? `₹${stipend.toLocaleString("en-IN")}` : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-sm">{hasPayslipData ? months : <span className="text-muted-foreground">-</span>}</td>
                            <td className="p-3">
                              {hasPayslipData ? (
                                <Badge variant="secondary" className="text-xs">
                                  {intern.paymentType === "ONE_TIME" ? "One-Time" : "Monthly"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-sm font-medium">
                              {total !== null && total > 0 ? `₹${total.toLocaleString("en-IN")}` : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3">
                              {intern.payslipUrl ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-primary"
                                    onClick={() => handleViewPayslip(intern)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleDownloadPayslip(intern)}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    title="Regenerate"
                                    onClick={() => setGenerateIntern(intern)}
                                    disabled={generatingSlip === intern.id}
                                  >
                                    {generatingSlip === intern.id ? (
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
                                  onClick={() => setGenerateIntern(intern)}
                                  disabled={generatingSlip === intern.id}
                                >
                                  {generatingSlip === intern.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Generate"
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
                                  onClick={() => setEditIntern(intern)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => setDeleteConfirm(intern)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Employee Mode */
        <EmployeePayslipForm />
      )}

      {/* Generate Payslip Modal - pre-filled with saved data, asks only for missing fields */}
      {generateIntern && (
        <GeneratePayslipModal
          isOpen={!!generateIntern}
          onClose={() => setGenerateIntern(null)}
          intern={generateIntern}
          onSuccess={refreshInterns}
          setGeneratingSlip={setGeneratingSlip}
        />
      )}

      {/* Edit Payslip Modal */}
      {editIntern && (
        <EditPayslipModal
          isOpen={!!editIntern}
          onClose={() => setEditIntern(null)}
          intern={editIntern}
          onSuccess={refreshInterns}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Intern">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete {deleteConfirm?.name}? This will also remove their payslip.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

// ==========================================
// Generate Payslip Modal - pre-fills saved data, only asks for missing
// ==========================================
function GeneratePayslipModal({
  isOpen,
  onClose,
  intern,
  onSuccess,
  setGeneratingSlip,
}: {
  isOpen: boolean;
  onClose: () => void;
  intern: Intern;
  onSuccess: () => void;
  setGeneratingSlip: (id: string | null) => void;
}) {
  const [referenceNumber, setReferenceNumber] = useState(intern.referenceNumber || "");
  const [numberOfMonths, setNumberOfMonths] = useState(intern.numberOfMonths?.toString() || "1");
  const [paymentType, setPaymentType] = useState<"MONTHLY" | "ONE_TIME">(intern.paymentType || "ONE_TIME");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [collegeAddress, setCollegeAddress] = useState("");
  const [monthlyStipend, setMonthlyStipend] = useState((intern.stipend || 0).toString());
  const [generating, setGenerating] = useState(false);

  const stipendAmount = parseFloat(monthlyStipend) || 0;
  const totalStipend = stipendAmount * (parseInt(numberOfMonths) || 1);

  const handleSubmit = async () => {
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    setGenerating(true);
    setGeneratingSlip(intern.id);
    try {
      // Save payslip fields to intern record
      await updateIntern(intern.id, {
        referenceNumber: referenceNumber || undefined,
        numberOfMonths: parseInt(numberOfMonths) || 1,
        paymentType,
      });

      // Generate and upload payslip
      await generateAndUploadPayslip(
        intern as Intern & { id: string },
        {
          referenceNumber,
          numberOfMonths: parseInt(numberOfMonths) || 1,
          paymentType,
          month,
          year: parseInt(year),
          collegeAddress,
          monthlyStipend: stipendAmount,
        }
      );

      toast.success(`Payslip generated for ${intern.name}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to generate payslip:", error);
      toast.error("Failed to generate payslip");
    } finally {
      setGenerating(false);
      setGeneratingSlip(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Stipend Slip">
      <div className="space-y-4">
        {/* Pre-filled intern details (read-only) */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-1">
          <p className="text-sm"><strong>Name:</strong> {intern.name}</p>
          <p className="text-sm"><strong>ID:</strong> {intern.internId}</p>
          <p className="text-sm"><strong>College:</strong> {intern.college}</p>
          <p className="text-sm"><strong>Domain:</strong> {INTERN_DOMAIN_LABELS[intern.domain]}</p>
          <p className="text-sm">
            <strong>Period:</strong> {intern.startDate.toLocaleDateString()} - {intern.endDate.toLocaleDateString()}
          </p>
        </div>

        {/* Payslip-specific fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Month *</Label>
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={monthOptions}
            />
          </div>
          <div>
            <Label>Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Reference Number</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g., WB/STI/2025/001"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Payment Type</Label>
            <Select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "MONTHLY" | "ONE_TIME")}
              options={paymentTypeOptions}
            />
          </div>
          <div>
            <Label>Number of Months</Label>
            <Input
              type="number"
              value={numberOfMonths}
              onChange={(e) => setNumberOfMonths(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <div>
          <Label>Monthly Stipend Amount (₹) *</Label>
          <Input
            type="number"
            value={monthlyStipend}
            onChange={(e) => setMonthlyStipend(e.target.value)}
            placeholder="Enter monthly stipend amount"
            min="0"
          />
        </div>

        <div>
          <Label>College Address</Label>
          <Input
            value={collegeAddress}
            onChange={(e) => setCollegeAddress(e.target.value)}
            placeholder="Enter college address (optional)"
          />
        </div>

        {stipendAmount > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Stipend:</span>
              <span className="font-medium">₹{stipendAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Number of Months:</span>
              <span className="font-medium">{parseInt(numberOfMonths) || 1}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <span className="font-semibold text-green-700 dark:text-green-400">Total Stipend:</span>
              <span className="font-bold text-green-700 dark:text-green-400">₹{totalStipend.toLocaleString("en-IN")}</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">{numberToWords(totalStipend)}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              intern.payslipUrl ? "Regenerate Slip" : "Generate Slip"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// Edit Payslip Modal
// ==========================================
function EditPayslipModal({
  isOpen,
  onClose,
  intern,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  intern: Intern;
  onSuccess: () => void;
}) {
  const [referenceNumber, setReferenceNumber] = useState(intern.referenceNumber || "");
  const [numberOfMonths, setNumberOfMonths] = useState(intern.numberOfMonths?.toString() || "1");
  const [paymentType, setPaymentType] = useState<"MONTHLY" | "ONE_TIME">(intern.paymentType || "ONE_TIME");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateIntern(intern.id, {
        referenceNumber: referenceNumber || undefined,
        numberOfMonths: parseInt(numberOfMonths) || 1,
        paymentType,
      });
      toast.success("Payslip data updated");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update payslip:", error);
      toast.error("Failed to update payslip data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Payslip Data">
      <div className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{intern.name} ({intern.internId})</p>
          <p className="text-xs text-muted-foreground">{intern.college}</p>
          <p className="text-xs text-muted-foreground">
            Stipend: {intern.stipend ? `₹${intern.stipend.toLocaleString("en-IN")}/month` : "Unpaid"}
          </p>
        </div>

        <div>
          <Label>Reference Number</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g., WB/STI/2025/001"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Payment Type</Label>
            <Select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "MONTHLY" | "ONE_TIME")}
              options={paymentTypeOptions}
            />
          </div>
          <div>
            <Label>Number of Months</Label>
            <Input
              type="number"
              value={numberOfMonths}
              onChange={(e) => setNumberOfMonths(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// Employee Payslip Form (standalone)
// ==========================================
function EmployeePayslipForm() {
  const [formData, setFormData] = useState<EmployeePayslipData>({
    name: "",
    employeeId: "",
    designation: "",
    department: "",
    month: "",
    year: new Date().getFullYear(),
    basicSalary: 0,
    hra: 0,
    da: 0,
    otherAllowances: 0,
    pf: 0,
    tax: 0,
    otherDeductions: 0,
  });
  const [generating, setGenerating] = useState(false);

  const grossEarnings = formData.basicSalary + formData.hra + formData.da + formData.otherAllowances;
  const totalDeductions = formData.pf + formData.tax + formData.otherDeductions;
  const netSalary = grossEarnings - totalDeductions;

  const handleGenerate = async () => {
    if (!formData.name || !formData.employeeId || !formData.month) {
      toast.error("Please fill in Name, Employee ID, and Month");
      return;
    }

    setGenerating(true);
    try {
      await generateAndDownloadEmployeePayslip(formData);
      toast.success("Salary slip downloaded");
    } catch (error) {
      console.error("Failed to generate:", error);
      toast.error("Failed to generate salary slip");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Employee Salary Slip</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Generate a standalone salary slip for an employee. This will download directly without saving to the system.
        </p>

        {/* Employee Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Employee Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter employee name"
            />
          </div>
          <div>
            <Label>Employee ID *</Label>
            <Input
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              placeholder="e.g., WBEMP001"
            />
          </div>
          <div>
            <Label>Designation</Label>
            <Input
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g., Software Developer"
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., IT"
            />
          </div>
          <div>
            <Label>Month *</Label>
            <Select
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              options={monthOptions}
            />
          </div>
          <div>
            <Label>Year</Label>
            <Input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
            />
          </div>
        </div>

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Earnings */}
          <div className="space-y-3">
            <h4 className="font-medium text-green-700 dark:text-green-400">Earnings</h4>
            <div>
              <Label>Basic Salary</Label>
              <Input
                type="number"
                value={formData.basicSalary || ""}
                onChange={(e) => setFormData({ ...formData, basicSalary: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div>
              <Label>HRA (House Rent Allowance)</Label>
              <Input
                type="number"
                value={formData.hra || ""}
                onChange={(e) => setFormData({ ...formData, hra: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div>
              <Label>DA (Dearness Allowance)</Label>
              <Input
                type="number"
                value={formData.da || ""}
                onChange={(e) => setFormData({ ...formData, da: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div>
              <Label>Other Allowances</Label>
              <Input
                type="number"
                value={formData.otherAllowances || ""}
                onChange={(e) => setFormData({ ...formData, otherAllowances: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Gross Earnings: ₹{grossEarnings.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <h4 className="font-medium text-red-700 dark:text-red-400">Deductions</h4>
            <div>
              <Label>Provident Fund (PF)</Label>
              <Input
                type="number"
                value={formData.pf || ""}
                onChange={(e) => setFormData({ ...formData, pf: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div>
              <Label>Tax</Label>
              <Input
                type="number"
                value={formData.tax || ""}
                onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div>
              <Label>Other Deductions</Label>
              <Input
                type="number"
                value={formData.otherDeductions || ""}
                onChange={(e) => setFormData({ ...formData, otherDeductions: parseFloat(e.target.value) || 0 })}
                placeholder="₹"
              />
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Total Deductions: ₹{totalDeductions.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* Net Salary Summary */}
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-900">
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            Net Salary: ₹{netSalary.toLocaleString("en-IN")}
          </p>
          {netSalary > 0 && (
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">{numberToWords(netSalary)}</p>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
