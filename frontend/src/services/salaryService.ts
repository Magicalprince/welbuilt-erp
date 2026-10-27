import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  updateDocument,
  deleteDocument,
  createDocument,
  orderBy,
  where,
} from "./firestore";
import type { SalaryRecord, MonthlySalaryConfig } from "@/types";
import { getUserById } from "./userService";
import { logSalaryMarked, logSalaryUpdated, logSalaryDeleted } from "./activityLogService";

// Deliberately does NOT follow withdrawalService.ts's pattern of creating a
// linked Expense — the user explicitly asked for Salary to never appear in
// the Expenses collection/list/donut, while still reducing revenue/bank
// balance via financeCalculations.ts's dedicated totalSalary term.

export interface FirestoreSalaryRecord {
  id: string;
  founderId: string;
  month: string;
  amount: number;
  takenAt: Timestamp;
  notes?: string;
  createdAt: Timestamp;
}

function toSalaryRecord(record: FirestoreSalaryRecord): SalaryRecord {
  return {
    ...record,
    takenAt: record.takenAt.toDate(),
    createdAt: record.createdAt.toDate(),
  };
}

// ── Salary records (per founder, per month) ────────────────────────────────

export async function getSalaryRecordById(id: string): Promise<SalaryRecord | null> {
  const record = await getDocument<FirestoreSalaryRecord>(COLLECTIONS.SALARY_RECORDS, id);
  return record ? toSalaryRecord(record) : null;
}

export async function getAllSalaryRecords(): Promise<SalaryRecord[]> {
  const records = await getDocuments<FirestoreSalaryRecord>(
    COLLECTIONS.SALARY_RECORDS,
    orderBy("takenAt", "desc")
  );
  return records.map(toSalaryRecord);
}

export async function getSalaryRecordsByFounder(founderId: string): Promise<SalaryRecord[]> {
  try {
    const records = await getDocuments<FirestoreSalaryRecord>(
      COLLECTIONS.SALARY_RECORDS,
      where("founderId", "==", founderId)
    );
    return records.map(toSalaryRecord).sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  } catch (error) {
    console.error("Error fetching salary records for founder:", founderId, error);
    return [];
  }
}

export async function getSalaryRecordForFounderMonth(
  founderId: string,
  month: string
): Promise<SalaryRecord | null> {
  try {
    const records = await getDocuments<FirestoreSalaryRecord>(
      COLLECTIONS.SALARY_RECORDS,
      where("founderId", "==", founderId),
      where("month", "==", month)
    );
    return records.length > 0 ? toSalaryRecord(records[0]) : null;
  } catch (error) {
    console.error("Error fetching salary record for founder/month:", founderId, month, error);
    return null;
  }
}

export async function markSalaryTaken(data: {
  founderId: string;
  month: string;
  amount: number;
  takenAt: Date;
  notes?: string;
}): Promise<string> {
  const founder = await getUserById(data.founderId);
  const founderName = founder?.name || "Founder";

  const salaryId = await createDocument(COLLECTIONS.SALARY_RECORDS, {
    founderId: data.founderId,
    month: data.month,
    amount: data.amount,
    takenAt: Timestamp.fromDate(data.takenAt),
    notes: data.notes,
  });

  await logSalaryMarked(data.founderId, salaryId, founderName, data.amount, data.month);

  return salaryId;
}

export async function updateSalaryRecord(
  id: string,
  data: Partial<Pick<SalaryRecord, "amount" | "takenAt" | "notes">>
): Promise<void> {
  const existing = await getSalaryRecordById(id);
  if (!existing) throw new Error("Salary record not found");

  const updateData: Record<string, unknown> = { ...data };
  if (data.takenAt) updateData.takenAt = Timestamp.fromDate(data.takenAt);
  await updateDocument(COLLECTIONS.SALARY_RECORDS, id, updateData);

  const founder = await getUserById(existing.founderId);
  await logSalaryUpdated(
    existing.founderId,
    id,
    founder?.name || "Founder",
    data.amount ?? existing.amount,
    existing.month
  );
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  const existing = await getSalaryRecordById(id);
  await deleteDocument(COLLECTIONS.SALARY_RECORDS, id);

  if (existing) {
    const founder = await getUserById(existing.founderId);
    await logSalaryDeleted(existing.founderId, id, founder?.name || "Founder", existing.month);
  }
}

// ── Aggregates — feed financeCalculations.ts / Finance Overview / Reports ──

export async function getTotalSalaryTaken(): Promise<number> {
  const records = await getAllSalaryRecords();
  return records.reduce((sum, r) => sum + r.amount, 0);
}

export async function getTotalSalaryByFounder(founderId: string): Promise<number> {
  const records = await getSalaryRecordsByFounder(founderId);
  return records.reduce((sum, r) => sum + r.amount, 0);
}

// Groups all salary records by "YYYY-MM" month key, newest first — the
// shape SalaryPage's month-wise history view and the statement PDF's
// salaryToStatementRows helper both consume.
export async function getSalaryByMonth(): Promise<{ month: string; records: SalaryRecord[] }[]> {
  const records = await getAllSalaryRecords();
  const groups = new Map<string, SalaryRecord[]>();
  for (const record of records) {
    if (!groups.has(record.month)) groups.set(record.month, []);
    groups.get(record.month)!.push(record);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, monthRecords]) => ({ month, records: monthRecords }));
}

// ── Monthly salary config — the single editable amount applied by default
// to all founders. Stored as a fixed-id doc in COLLECTIONS.SETTINGS,
// matching settingsService.ts's SETTINGS_DOC_ID convention. ─────────────────

const SALARY_CONFIG_DOC_ID = "salaryConfig";

interface FirestoreSalaryConfig {
  amount: number;
  updatedAt: Timestamp;
  updatedBy?: string;
}

export async function getSalaryConfig(): Promise<MonthlySalaryConfig> {
  const config = await getDocument<FirestoreSalaryConfig>(COLLECTIONS.SETTINGS, SALARY_CONFIG_DOC_ID);
  if (!config) {
    return { amount: 0, updatedAt: new Date() };
  }
  return { ...config, updatedAt: config.updatedAt.toDate() };
}

export async function updateSalaryConfig(amount: number, updatedBy?: string): Promise<void> {
  const configRef = doc(db, COLLECTIONS.SETTINGS, SALARY_CONFIG_DOC_ID);
  await setDoc(configRef, {
    amount,
    updatedBy: updatedBy || null,
    updatedAt: Timestamp.now(),
  });
}
