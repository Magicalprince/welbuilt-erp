import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Pencil, Trash2, Download, Settings2, FileSignature, Upload, CreditCard } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Modal,
  ConfirmModal,
  Avatar,
  Badge,
  Skeleton,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FOUNDERS } from "@/lib/founders";
import {
  useFounders,
  useSalaryConfig,
  useUpdateSalaryConfig,
  useSalaryByMonth,
  useMarkSalaryTaken,
  useUpdateSalaryRecord,
  useDeleteSalaryRecord,
  useCompanySettings,
  useUpdateCompanySettings,
} from "@/hooks/useFirestore";
import { useAuthStore } from "@/store/authStore";
import { generateAndDownloadSalarySlip, PAYMENT_MODES, type SignatureKey, type PaymentMode } from "@/services/salarySlipPdfService";
import type { FounderPayrollInfo } from "@/services/settingsService";
import { uploadFileToR2 } from "@/services/r2Service";
import toast from "react-hot-toast";
import type { SalaryRecord } from "@/types";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SalaryPage() {
  const { user } = useAuthStore();
  const { data: founders, isLoading: loadingFounders } = useFounders();
  const { data: salaryConfig } = useSalaryConfig();
  const { data: monthGroups, isLoading: loadingHistory } = useSalaryByMonth();
  const { data: companySettings } = useCompanySettings();

  const updateConfigMutation = useUpdateSalaryConfig();
  const markTakenMutation = useMarkSalaryTaken();
  const updateRecordMutation = useUpdateSalaryRecord();
  const deleteRecordMutation = useDeleteSalaryRecord();
  const updateCompanySettingsMutation = useUpdateCompanySettings();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configAmount, setConfigAmount] = useState("");

  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markFounderId, setMarkFounderId] = useState("");
  const [markMonth, setMarkMonth] = useState(currentMonthKey());
  const [markAmount, setMarkAmount] = useState("");
  const [markTakenAt, setMarkTakenAt] = useState(toDatetimeLocalValue(new Date()));
  const [markNotes, setMarkNotes] = useState("");

  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTakenAt, setEditTakenAt] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<SalaryRecord | null>(null);

  const [slipRecord, setSlipRecord] = useState<SalaryRecord | null>(null);
  const [slipSignature, setSlipSignature] = useState<SignatureKey>("baranitharan");
  const [slipPaymentMode, setSlipPaymentMode] = useState<PaymentMode>(PAYMENT_MODES[0]);
  const [isGeneratingSlip, setIsGeneratingSlip] = useState(false);

  // Mock slip — a one-off, editable, custom salary slip for internal use.
  // Never writes to Firestore, never touches a SalaryRecord, so it has no
  // effect whatsoever on salary totals / revenue / bank balance.
  const [mockFounderId, setMockFounderId] = useState("");
  const [mockMonth, setMockMonth] = useState(MONTH_LABELS[new Date().getMonth()]);
  const [mockYear, setMockYear] = useState(String(new Date().getFullYear()));
  const [mockAmount, setMockAmount] = useState("");
  const [mockDesignation, setMockDesignation] = useState("");
  const [mockEmployeeId, setMockEmployeeId] = useState("");
  const [mockDoj, setMockDoj] = useState("");
  const [mockSignature, setMockSignature] = useState<SignatureKey>("baranitharan");
  const [mockPaymentMode, setMockPaymentMode] = useState<PaymentMode>(PAYMENT_MODES[0]);
  const [isGeneratingMock, setIsGeneratingMock] = useState(false);

  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  // Per-founder PAN + personal salary bank account, shown on slips —
  // bank-loan-critical per research, editable here since there's no
  // other settings surface for this yet.
  const [editingPayrollEmail, setEditingPayrollEmail] = useState<string | null>(null);
  const [payrollPan, setPayrollPan] = useState("");
  const [payrollBankAccount, setPayrollBankAccount] = useState("");
  const [payrollBankName, setPayrollBankName] = useState("");
  const [payrollIfsc, setPayrollIfsc] = useState("");
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);

  const founderOptions = useMemo(() => {
    if (!founders) return [];
    return founders.map((f) => ({ value: f.id, label: f.name }));
  }, [founders]);

  const monthOptions = MONTH_LABELS.map((label) => ({ value: label, label }));
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1].map((y) => ({ value: String(y), label: String(y) }));
  }, []);

  const recordsThisMonth = useMemo(() => {
    const thisMonth = monthGroups?.find((g) => g.month === currentMonthKey());
    return thisMonth?.records || [];
  }, [monthGroups]);

  const founderInfo = (founderId: string) => {
    const founder = founders?.find((f) => f.id === founderId);
    const staticInfo = FOUNDERS.find((f) => f.name === founder?.name);
    return { founder, staticInfo };
  };

  // Year-to-date gross for one founder, up to and including a given
  // month — the sum of every SalaryRecord in the same calendar year at
  // or before that month. Only meaningful for a real record (the mock
  // generator has no history to sum, so it omits ytdGross entirely).
  const computeYtdGross = (founderId: string, uptoMonthKey: string): number => {
    if (!monthGroups) return 0;
    const uptoYear = uptoMonthKey.split("-")[0];
    return monthGroups
      .filter((g) => g.month.startsWith(uptoYear) && g.month <= uptoMonthKey)
      .flatMap((g) => g.records)
      .filter((r) => r.founderId === founderId)
      .reduce((sum, r) => sum + r.amount, 0);
  };

  const handleOpenConfig = () => {
    setConfigAmount(String(salaryConfig?.amount ?? 0));
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    const amount = Number(configAmount);
    if (!configAmount || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      await updateConfigMutation.mutateAsync({ amount, updatedBy: user?.id });
      toast.success("Monthly salary amount updated");
      setShowConfigModal(false);
    } catch {
      toast.error("Failed to update salary amount");
    }
  };

  const handleOpenMarkModal = (founderId: string) => {
    setMarkFounderId(founderId);
    setMarkMonth(currentMonthKey());
    setMarkAmount(String(salaryConfig?.amount ?? 0));
    setMarkTakenAt(toDatetimeLocalValue(new Date()));
    setMarkNotes("");
    setShowMarkModal(true);
  };

  const handleMarkTaken = async () => {
    if (!markFounderId || !markAmount || Number(markAmount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await markTakenMutation.mutateAsync({
        founderId: markFounderId,
        month: markMonth,
        amount: Number(markAmount),
        takenAt: new Date(markTakenAt),
        notes: markNotes.trim() || undefined,
      });
      toast.success("Salary marked as taken");
      setShowMarkModal(false);
    } catch (error) {
      console.error("Failed to mark salary taken:", error);
      toast.error("Failed to mark salary as taken");
    }
  };

  const handleOpenEdit = (record: SalaryRecord) => {
    setEditingRecord(record);
    setEditAmount(String(record.amount));
    setEditTakenAt(toDatetimeLocalValue(record.takenAt));
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editAmount || Number(editAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      await updateRecordMutation.mutateAsync({
        salaryId: editingRecord.id,
        data: { amount: Number(editAmount), takenAt: new Date(editTakenAt) },
      });
      toast.success("Salary record updated");
      setEditingRecord(null);
    } catch {
      toast.error("Failed to update salary record");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRecordMutation.mutateAsync(deleteConfirm.id);
      toast.success("Salary record removed");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to remove salary record");
    }
  };

  const handleOpenSlip = (record: SalaryRecord) => {
    setSlipRecord(record);
    setSlipSignature("baranitharan");
    setSlipPaymentMode(PAYMENT_MODES[0]);
  };

  const handleGenerateSlip = async () => {
    if (!slipRecord) return;
    const { founder, staticInfo } = founderInfo(slipRecord.founderId);
    if (!founder || !staticInfo) {
      toast.error("Founder details not found");
      return;
    }
    setIsGeneratingSlip(true);
    try {
      const [year, month] = slipRecord.month.split("-").map(Number);
      await generateAndDownloadSalarySlip({
        founderName: founder.name,
        designation: staticInfo.designation,
        employeeId: staticInfo.employeeId,
        dateOfJoining: new Date(staticInfo.dateOfJoining),
        month: MONTH_LABELS[month - 1],
        year,
        amount: slipRecord.amount,
        signatureKey: slipSignature,
        founderEmail: staticInfo.email,
        ytdGross: computeYtdGross(slipRecord.founderId, slipRecord.month),
        paymentMode: slipPaymentMode,
      });
      toast.success("Salary slip downloaded");
      setSlipRecord(null);
    } catch (error) {
      console.error("Failed to generate salary slip:", error);
      toast.error("Failed to generate salary slip");
    } finally {
      setIsGeneratingSlip(false);
    }
  };

  const handleMockFounderChange = (founderId: string) => {
    setMockFounderId(founderId);
    const { founder, staticInfo } = founderInfo(founderId);
    if (founder && staticInfo) {
      setMockDesignation(staticInfo.designation);
      setMockEmployeeId(staticInfo.employeeId);
      setMockDoj(staticInfo.dateOfJoining);
    }
  };

  const handleGenerateMockSlip = async () => {
    if (!mockFounderId || !mockAmount || Number(mockAmount) <= 0 || !mockDesignation || !mockEmployeeId || !mockDoj) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsGeneratingMock(true);
    try {
      const { founder, staticInfo } = founderInfo(mockFounderId);
      await generateAndDownloadSalarySlip({
        founderName: founder?.name || "Founder",
        designation: mockDesignation,
        employeeId: mockEmployeeId,
        dateOfJoining: new Date(mockDoj),
        month: mockMonth,
        year: Number(mockYear),
        amount: Number(mockAmount),
        signatureKey: mockSignature,
        founderEmail: staticInfo?.email,
        // No ytdGross — a mock slip has no real salary history to sum,
        // so the YTD row is omitted entirely rather than showing a
        // misleading figure.
        paymentMode: mockPaymentMode,
      });
      toast.success("Mock salary slip downloaded");
    } catch (error) {
      console.error("Failed to generate mock salary slip:", error);
      toast.error("Failed to generate mock salary slip");
    } finally {
      setIsGeneratingMock(false);
    }
  };

  const handleOpenPayrollEdit = (email: string) => {
    const existing = companySettings?.founderPayrollInfo?.[email.toLowerCase()];
    setPayrollPan(existing?.pan || "");
    setPayrollBankAccount(existing?.bankAccountNumber || "");
    setPayrollBankName(existing?.bankName || "");
    setPayrollIfsc(existing?.ifscCode || "");
    setEditingPayrollEmail(email);
  };

  const handleSavePayroll = async () => {
    if (!editingPayrollEmail) return;
    setIsSavingPayroll(true);
    try {
      const emailKey = editingPayrollEmail.toLowerCase();
      const data: FounderPayrollInfo = {
        pan: payrollPan.trim() || undefined,
        bankAccountNumber: payrollBankAccount.trim() || undefined,
        bankName: payrollBankName.trim() || undefined,
        ifscCode: payrollIfsc.trim() || undefined,
      };
      await updateCompanySettingsMutation.mutateAsync({
        founderPayrollInfo: {
          ...companySettings?.founderPayrollInfo,
          [emailKey]: { ...companySettings?.founderPayrollInfo?.[emailKey], ...data },
        },
      });
      toast.success("Payroll details updated");
      setEditingPayrollEmail(null);
    } catch (error) {
      console.error("Failed to update payroll details:", error);
      toast.error("Failed to update payroll details");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSignature(true);
    try {
      const { fileUrl } = await uploadFileToR2(file, "settings/signatures");
      await updateCompanySettingsMutation.mutateAsync({ ramachandraaSignatureUrl: fileUrl });
      toast.success("Signature uploaded");
    } catch (error) {
      console.error("Failed to upload signature:", error);
      toast.error("Failed to upload signature");
    } finally {
      setIsUploadingSignature(false);
      e.target.value = "";
    }
  };

  const isDeletingOrUpdating = deleteRecordMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/finance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Founder Salary</h1>
            <p className="text-muted-foreground">
              Monthly salary of {formatCurrency(salaryConfig?.amount ?? 0)} per founder — mark each month taken individually
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleOpenConfig}>
          <Settings2 className="h-4 w-4 mr-2" />
          Edit Monthly Amount
        </Button>
      </div>

      {/* Founder Cards */}
      {loadingFounders ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : founders && founders.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {founders.map((founder, index) => {
            const { staticInfo } = founderInfo(founder.id);
            const takenThisMonth = recordsThisMonth.find((r) => r.founderId === founder.id);
            return (
              <motion.div key={founder.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={founder.name} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{founder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {staticInfo?.designation || "Director"} • {staticInfo?.employeeId || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This month</span>
                        {takenThisMonth ? (
                          <Badge variant="success">Taken</Badge>
                        ) : (
                          <Badge variant="secondary">Not taken</Badge>
                        )}
                      </div>
                      {takenThisMonth && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(takenThisMonth.amount)} on {formatDate(takenThisMonth.takenAt)}
                        </p>
                      )}
                    </div>
                    {takenThisMonth ? (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenSlip(takenThisMonth)}>
                        <Download className="h-4 w-4 mr-1" />
                        Generate Slip
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => handleOpenMarkModal(founder.id)}>
                        Mark as Taken
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">No founder data available</CardContent>
        </Card>
      )}

      {/* Salary History — grouped by month */}
      <Card>
        <CardHeader>
          <CardTitle>Salary History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : monthGroups && monthGroups.length > 0 ? (
            <div className="space-y-6">
              {monthGroups.map((group) => (
                <div key={group.month}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">{monthKeyLabel(group.month)}</h4>
                  <div className="space-y-2">
                    {group.records.map((record) => {
                      const { founder } = founderInfo(record.founderId);
                      return (
                        <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium">{founder?.name || "Founder"}</p>
                            <p className="text-xs text-muted-foreground">Taken on {formatDate(record.takenAt)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">{formatCurrency(record.amount)}</p>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenSlip(record)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(record)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(record)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No salary records yet</p>
          )}
        </CardContent>
      </Card>

      {/* Signature management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Signatures for Salary Slips
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg border">
            <p className="font-medium text-sm mb-1">Baranitharan S</p>
            <p className="text-xs text-muted-foreground">Using existing signature on file</p>
          </div>
          <div className="p-4 rounded-lg border">
            <p className="font-medium text-sm mb-1">Ramachandraa PS</p>
            {companySettings?.ramachandraaSignatureUrl ? (
              <p className="text-xs text-green-600 mb-2">Signature uploaded</p>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">No signature uploaded yet</p>
            )}
            <label className="inline-block">
              <input type="file" accept="image/png" className="hidden" onChange={handleUploadSignature} disabled={isUploadingSignature} />
              <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                <Upload className="h-3 w-3" />
                {isUploadingSignature ? "Uploading..." : "Upload signature (PNG)"}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Payroll details — PAN + personal salary bank account per founder,
          shown on slips. Bank-loan-critical per research: the account
          printed must match what the applicant's bank statements show. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payroll Details
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            PAN and salary bank account shown on each founder&apos;s slip. Until filled in, slips show a clearly-marked placeholder.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {FOUNDERS.map((f) => {
            const info = companySettings?.founderPayrollInfo?.[f.email.toLowerCase()];
            const isComplete = info?.pan && info?.bankAccountNumber && info?.bankName && info?.ifscCode;
            return (
              <div key={f.email} className="p-4 rounded-lg border">
                <p className="font-medium text-sm mb-1">{f.name}</p>
                {isComplete ? (
                  <p className="text-xs text-green-600 mb-2">PAN &amp; bank details on file</p>
                ) : (
                  <p className="text-xs text-destructive mb-2">Incomplete — slip will show placeholders</p>
                )}
                <Button variant="outline" size="sm" onClick={() => handleOpenPayrollEdit(f.email)}>
                  Edit Details
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Mock Slip Generator — no financial effect */}
      <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-amber-600" />
            Generate Mock Slip
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A one-off slip with any amount, for internal use — writes nothing to salary records and has no effect on revenue or bank balance.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Founder *</Label>
              <Select value={mockFounderId} onChange={(e) => handleMockFounderChange(e.target.value)} options={founderOptions} placeholder="Select founder" />
            </div>
            <div className="space-y-2">
              <Label>Month *</Label>
              <Select value={mockMonth} onChange={(e) => setMockMonth(e.target.value)} options={monthOptions} />
            </div>
            <div className="space-y-2">
              <Label>Year *</Label>
              <Select value={mockYear} onChange={(e) => setMockYear(e.target.value)} options={yearOptions} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Designation *</Label>
              <Input value={mockDesignation} onChange={(e) => setMockDesignation(e.target.value)} placeholder="e.g. CTO" />
            </div>
            <div className="space-y-2">
              <Label>Employee ID *</Label>
              <Input value={mockEmployeeId} onChange={(e) => setMockEmployeeId(e.target.value)} placeholder="e.g. FD-080100" />
            </div>
            <div className="space-y-2">
              <Label>Date of Joining *</Label>
              <Input type="date" value={mockDoj} onChange={(e) => setMockDoj(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" min="0" value={mockAmount} onChange={(e) => setMockAmount(e.target.value)} placeholder="Enter custom amount" />
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <Select
                value={mockSignature}
                onChange={(e) => setMockSignature(e.target.value as SignatureKey)}
                options={[
                  { value: "baranitharan", label: "Baranitharan S" },
                  { value: "ramachandraa", label: "Ramachandraa PS" },
                ]}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode of Payment</Label>
              <Select
                value={mockPaymentMode}
                onChange={(e) => setMockPaymentMode(e.target.value as PaymentMode)}
                options={PAYMENT_MODES.map((mode) => ({ value: mode, label: mode }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleGenerateMockSlip} disabled={isGeneratingMock}>
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingMock ? "Generating..." : "Download Mock Slip"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Config Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Edit Monthly Salary Amount">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (applies equally to all founders by default) *</Label>
            <Input type="number" min="0" value={configAmount} onChange={(e) => setConfigAmount(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Taken Modal */}
      <Modal isOpen={showMarkModal} onClose={() => setShowMarkModal(false)} title="Mark Salary as Taken">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Which month is this salary for? *</Label>
            <Input type="month" value={markMonth} onChange={(e) => setMarkMonth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" min="0" value={markAmount} onChange={(e) => setMarkAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date & time the amount was posted *</Label>
            <Input type="datetime-local" value={markTakenAt} onChange={(e) => setMarkTakenAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input placeholder="Optional notes..." value={markNotes} onChange={(e) => setMarkNotes(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowMarkModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkTaken} disabled={markTakenMutation.isPending}>
              {markTakenMutation.isPending ? "Saving..." : "Mark as Taken"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Record Modal */}
      <Modal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} title="Edit Salary Record">
        {editingRecord && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date & time posted *</Label>
              <Input type="datetime-local" value={editTakenAt} onChange={(e) => setEditTakenAt(e.target.value)} />
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setEditingRecord(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateRecordMutation.isPending}>
                {updateRecordMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Generate Slip Modal — choose signature */}
      <Modal isOpen={!!slipRecord} onClose={() => setSlipRecord(null)} title="Generate Salary Slip">
        {slipRecord && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatCurrency(slipRecord.amount)} for {monthKeyLabel(slipRecord.month)}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Signature</Label>
                <Select
                  value={slipSignature}
                  onChange={(e) => setSlipSignature(e.target.value as SignatureKey)}
                  options={[
                    { value: "baranitharan", label: "Baranitharan S" },
                    { value: "ramachandraa", label: "Ramachandraa PS" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>Mode of Payment</Label>
                <Select
                  value={slipPaymentMode}
                  onChange={(e) => setSlipPaymentMode(e.target.value as PaymentMode)}
                  options={PAYMENT_MODES.map((mode) => ({ value: mode, label: mode }))}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setSlipRecord(null)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateSlip} disabled={isGeneratingSlip}>
                <Download className="h-4 w-4 mr-2" />
                {isGeneratingSlip ? "Generating..." : "Download Slip"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Payroll Details Modal */}
      <Modal isOpen={!!editingPayrollEmail} onClose={() => setEditingPayrollEmail(null)} title="Edit Payroll Details">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PAN</Label>
            <Input value={payrollPan} onChange={(e) => setPayrollPan(e.target.value.toUpperCase())} placeholder="e.g. ABCDE1234F" maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label>Bank Account Number</Label>
            <Input value={payrollBankAccount} onChange={(e) => setPayrollBankAccount(e.target.value)} placeholder="Salary account number" />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={payrollBankName} onChange={(e) => setPayrollBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input value={payrollIfsc} onChange={(e) => setPayrollIfsc(e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" maxLength={11} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setEditingPayrollEmail(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePayroll} disabled={isSavingPayroll}>
              {isSavingPayroll ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Remove Salary Record"
        description={
          <>
            Remove this {deleteConfirm ? formatCurrency(deleteConfirm.amount) : ""} salary record for{" "}
            {deleteConfirm ? monthKeyLabel(deleteConfirm.month) : ""}? This cannot be undone.
          </>
        }
        isPending={isDeletingOrUpdating}
      />
    </div>
  );
}
