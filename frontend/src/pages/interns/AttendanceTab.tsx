import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Trash2,
  CalendarCheck,
  Filter,
  X,
  Loader2,
  Eye,
  Pencil,
  RefreshCw,
  Users,
  UserCheck,
  CheckSquare,
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
import { useInterns, useDeleteIntern, useBulkDeleteInterns, internQueryKeys } from "@/hooks/useInterns";
import { useQueryClient } from "@tanstack/react-query";
import type { Intern, InternPaymentStatus } from "@/types";
import {
  generateAndDownloadAttendance,
  generateAndUploadAttendance,
  generateAndDownloadEmployeeAttendance,
} from "@/services/attendanceService";
import type { EmployeeAttendanceData } from "@/services/attendanceService";
import { updateIntern } from "@/services/internService";
import { deleteFileFromR2, extractFileKeyFromUrl, getSignedDownloadUrl } from "@/services/r2Service";
import toast from "react-hot-toast";

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

type Mode = "intern" | "employee";

export default function AttendanceTab() {
  const [mode, setMode] = useState<Mode>("intern");
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
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
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Data
  const queryClient = useQueryClient();
  const { data: interns, isLoading } = useInterns();
  const deleteMutation = useDeleteIntern();
  const bulkDeleteMutation = useBulkDeleteInterns();

  const handleBulkDelete = async () => {
    const selected = filteredInterns.filter((i) => selectedInterns.includes(i.id));
    try {
      await Promise.allSettled(
        selected
          .filter((i) => i.attendanceUrl)
          .map((i) => {
            const key = extractFileKeyFromUrl(i.attendanceUrl!);
            return key ? deleteFileFromR2(key) : Promise.resolve();
          })
      );
      await bulkDeleteMutation.mutateAsync(selectedInterns);
      toast.success(`Deleted ${selectedInterns.length} interns`);
      setSelectedInterns([]);
      setBulkDeleteConfirm(false);
    } catch {
      toast.error("Failed to delete selected interns");
    }
  };

  const domainOptions = useMemo(() => {
    const domains = interns ? [...new Set(interns.map(i => i.domain).filter(Boolean))].sort() : [];
    return [{ value: "ALL", label: "All Domains" }, ...domains.map(d => ({ value: d, label: d }))];
  }, [interns]);

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

  // Handle download (for interns that already have attendance data)
  const handleDownloadAttendance = async (intern: Intern) => {
    if (intern.totalInternshipDays === undefined || intern.daysPresent === undefined) return;
    try {
      await generateAndDownloadAttendance(intern, {
        totalInternshipDays: intern.totalInternshipDays,
        daysPresent: intern.daysPresent,
        collegeAddress: "",
      });
      toast.success("Attendance report downloaded");
    } catch (error) {
      console.error("Failed to download attendance:", error);
      toast.error("Failed to download attendance report");
    }
  };

  // Handle view
  const handleViewAttendance = async (intern: Intern) => {
    if (!intern.attendanceKey && !intern.attendanceUrl) {
      toast.error("Attendance report not found");
      return;
    }
    try {
      let fileKey = intern.attendanceKey;
      if (!fileKey && intern.attendanceUrl) {
        fileKey = extractFileKeyFromUrl(intern.attendanceUrl) || undefined;
      }
      if (!fileKey) {
        toast.error("Could not determine report location");
        return;
      }
      const presignedUrl = await getSignedDownloadUrl(fileKey, 3600);
      window.open(presignedUrl, "_blank");
    } catch (error) {
      console.error("Failed to view attendance:", error);
      toast.error("Failed to view attendance report");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.attendanceUrl) {
        const fileKey = extractFileKeyFromUrl(deleteConfirm.attendanceUrl);
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

          {/* Bulk Action Bar */}
          <AnimatePresence>
            {selectedInterns.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedInterns.length} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInterns([])}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInterns.length === 0 ? (
            <div className="text-center py-12">
              <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No attendance records found</h3>
              <p className="text-muted-foreground">
                {interns && interns.length > 0
                  ? "Try adjusting your search or add attendance data"
                  : "Get started by creating attendance records"}
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
                        <th className="p-3 text-left text-sm font-medium">Total Days</th>
                        <th className="p-3 text-left text-sm font-medium">Present</th>
                        <th className="p-3 text-left text-sm font-medium">Absent</th>
                        <th className="p-3 text-left text-sm font-medium">%</th>
                        <th className="p-3 text-left text-sm font-medium">Report</th>
                        <th className="p-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInterns.map((intern) => {
                        const hasAttendanceData = intern.totalInternshipDays !== undefined && intern.daysPresent !== undefined;
                        const daysAbsent = hasAttendanceData ? (intern.totalInternshipDays! - intern.daysPresent!) : null;
                        const percentage = hasAttendanceData && intern.totalInternshipDays! > 0
                          ? ((intern.daysPresent! / intern.totalInternshipDays!) * 100).toFixed(1)
                          : null;

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
                            <td className="p-3">
                              <Badge variant="secondary" className="text-xs">
                                {intern.domain}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm">{hasAttendanceData ? intern.totalInternshipDays : <span className="text-muted-foreground">-</span>}</td>
                            <td className="p-3 text-sm text-green-600 font-medium">{hasAttendanceData ? intern.daysPresent : <span className="text-muted-foreground">-</span>}</td>
                            <td className="p-3 text-sm text-red-600 font-medium">{daysAbsent !== null ? daysAbsent : <span className="text-muted-foreground">-</span>}</td>
                            <td className="p-3 text-sm">
                              {percentage !== null ? (
                                <Badge
                                  variant={parseFloat(percentage) >= 75 ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {percentage}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              {intern.attendanceUrl ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-primary"
                                    onClick={() => handleViewAttendance(intern)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleDownloadAttendance(intern)}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    title="Regenerate"
                                    onClick={() => setGenerateIntern(intern)}
                                    disabled={generatingReport === intern.id}
                                  >
                                    {generatingReport === intern.id ? (
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
                                  disabled={generatingReport === intern.id}
                                >
                                  {generatingReport === intern.id ? (
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
        /* Employee Mode - Standalone Form */
        <EmployeeAttendanceForm />
      )}

      {/* Generate Attendance Modal - pre-filled with saved data, asks only for missing fields */}
      {generateIntern && (
        <GenerateAttendanceModal
          isOpen={!!generateIntern}
          onClose={() => setGenerateIntern(null)}
          intern={generateIntern}
          onSuccess={refreshInterns}
          setGeneratingReport={setGeneratingReport}
        />
      )}

      {/* Edit Attendance Modal */}
      {editIntern && (
        <EditAttendanceModal
          isOpen={!!editIntern}
          onClose={() => setEditIntern(null)}
          intern={editIntern}
          onSuccess={refreshInterns}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Intern">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete {deleteConfirm?.name}? This will also remove their attendance report.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Bulk Delete Confirm Modal */}
      <Modal isOpen={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} title="Delete Selected Interns">
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to permanently delete <strong>{selectedInterns.length} intern{selectedInterns.length > 1 ? "s" : ""}</strong>? Their attendance reports will also be removed. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
            ) : (
              `Delete ${selectedInterns.length} Intern${selectedInterns.length > 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ==========================================
// Generate Attendance Modal - pre-fills saved data, only asks for missing
// ==========================================
function GenerateAttendanceModal({
  isOpen,
  onClose,
  intern,
  onSuccess,
  setGeneratingReport,
}: {
  isOpen: boolean;
  onClose: () => void;
  intern: Intern;
  onSuccess: () => void;
  setGeneratingReport: (id: string | null) => void;
}) {
  const [totalDays, setTotalDays] = useState(intern.totalInternshipDays?.toString() || "");
  const [daysPresent, setDaysPresent] = useState(intern.daysPresent?.toString() || "");
  const [collegeAddress, setCollegeAddress] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleSubmit = async () => {
    if (!totalDays || !daysPresent) {
      toast.error("Please fill in Total Days and Days Present");
      return;
    }

    setGenerating(true);
    setGeneratingReport(intern.id);
    try {
      // Save attendance fields to intern record
      await updateIntern(intern.id, {
        totalInternshipDays: parseInt(totalDays),
        daysPresent: parseInt(daysPresent),
      });

      // Generate and upload attendance report
      await generateAndUploadAttendance(
        intern as Intern & { id: string },
        {
          totalInternshipDays: parseInt(totalDays),
          daysPresent: parseInt(daysPresent),
          collegeAddress,
        }
      );

      toast.success(`Attendance report generated for ${intern.name}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to generate attendance:", error);
      toast.error("Failed to generate attendance report");
    } finally {
      setGenerating(false);
      setGeneratingReport(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Attendance Report">
      <div className="space-y-4">
        {/* Pre-filled intern details (read-only) */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-1">
          <p className="text-sm"><strong>Name:</strong> {intern.name}</p>
          <p className="text-sm"><strong>ID:</strong> {intern.internId}</p>
          <p className="text-sm"><strong>College:</strong> {intern.college}</p>
          <p className="text-sm"><strong>Domain:</strong> {intern.domain}</p>
          <p className="text-sm">
            <strong>Period:</strong> {intern.startDate.toLocaleDateString()} - {intern.endDate.toLocaleDateString()}
          </p>
        </div>

        {/* Only ask for attendance-specific fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total Internship Days *</Label>
            <Input
              type="number"
              value={totalDays}
              onChange={(e) => setTotalDays(e.target.value)}
              placeholder="e.g., 30"
            />
          </div>
          <div>
            <Label>Days Present *</Label>
            <Input
              type="number"
              value={daysPresent}
              onChange={(e) => setDaysPresent(e.target.value)}
              placeholder="e.g., 28"
            />
          </div>
        </div>

        {totalDays && daysPresent && (
          <div className="flex gap-4 text-sm">
            <span className="text-red-600">
              Absent: {parseInt(totalDays) - parseInt(daysPresent)}
            </span>
            <span className="text-blue-600">
              Percentage: {parseInt(totalDays) > 0
                ? ((parseInt(daysPresent) / parseInt(totalDays)) * 100).toFixed(1)
                : "0.0"}%
            </span>
          </div>
        )}

        <div>
          <Label>College Address</Label>
          <Input
            value={collegeAddress}
            onChange={(e) => setCollegeAddress(e.target.value)}
            placeholder="Enter college address (optional)"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              intern.attendanceUrl ? "Regenerate Report" : "Generate Report"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// Edit Attendance Modal
// ==========================================
function EditAttendanceModal({
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
  const [totalDays, setTotalDays] = useState(intern.totalInternshipDays?.toString() || "");
  const [daysPresent, setDaysPresent] = useState(intern.daysPresent?.toString() || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!totalDays || !daysPresent) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await updateIntern(intern.id, {
        totalInternshipDays: parseInt(totalDays),
        daysPresent: parseInt(daysPresent),
      });
      toast.success("Attendance data updated");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update attendance:", error);
      toast.error("Failed to update attendance data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Attendance Data">
      <div className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{intern.name} ({intern.internId})</p>
          <p className="text-xs text-muted-foreground">{intern.college}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total Internship Days *</Label>
            <Input
              type="number"
              value={totalDays}
              onChange={(e) => setTotalDays(e.target.value)}
            />
          </div>
          <div>
            <Label>Days Present *</Label>
            <Input
              type="number"
              value={daysPresent}
              onChange={(e) => setDaysPresent(e.target.value)}
            />
          </div>
        </div>

        {totalDays && daysPresent && (
          <div className="flex gap-4 text-sm">
            <span className="text-red-600">
              Absent: {parseInt(totalDays) - parseInt(daysPresent)}
            </span>
            <span className="text-blue-600">
              Percentage: {parseInt(totalDays) > 0
                ? ((parseInt(daysPresent) / parseInt(totalDays)) * 100).toFixed(1)
                : "0.0"}%
            </span>
          </div>
        )}

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
// Employee Attendance Form (standalone)
// ==========================================
function EmployeeAttendanceForm() {
  const [formData, setFormData] = useState<EmployeeAttendanceData>({
    name: "",
    employeeId: "",
    designation: "",
    department: "",
    month: "",
    year: new Date().getFullYear(),
    totalWorkingDays: 0,
    daysPresent: 0,
    daysAbsent: 0,
    leavesTaken: 0,
    holidays: 0,
  });
  const [generating, setGenerating] = useState(false);

  const percentage = formData.totalWorkingDays > 0
    ? ((formData.daysPresent / formData.totalWorkingDays) * 100).toFixed(1)
    : "0.0";

  const handleGenerate = async () => {
    if (!formData.name || !formData.employeeId || !formData.month) {
      toast.error("Please fill in Name, Employee ID, and Month");
      return;
    }

    setGenerating(true);
    try {
      await generateAndDownloadEmployeeAttendance(formData);
      toast.success("Attendance report downloaded");
    } catch (error) {
      console.error("Failed to generate:", error);
      toast.error("Failed to generate attendance report");
    } finally {
      setGenerating(false);
    }
  };

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

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Employee Attendance Report</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Generate a standalone attendance report for an employee. This will download directly without saving to the system.
        </p>

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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div>
            <Label>Total Working Days</Label>
            <Input
              type="number"
              value={formData.totalWorkingDays || ""}
              onChange={(e) => setFormData({ ...formData, totalWorkingDays: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Days Present</Label>
            <Input
              type="number"
              value={formData.daysPresent || ""}
              onChange={(e) => setFormData({ ...formData, daysPresent: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Days Absent</Label>
            <Input
              type="number"
              value={formData.daysAbsent || ""}
              onChange={(e) => setFormData({ ...formData, daysAbsent: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Leaves Taken</Label>
            <Input
              type="number"
              value={formData.leavesTaken || ""}
              onChange={(e) => setFormData({ ...formData, leavesTaken: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Holidays</Label>
            <Input
              type="number"
              value={formData.holidays || ""}
              onChange={(e) => setFormData({ ...formData, holidays: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center gap-6">
          <span className="text-sm font-medium">Attendance: <span className={cn(
            parseFloat(percentage) >= 75 ? "text-green-600" : "text-red-600"
          )}>{percentage}%</span></span>
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
