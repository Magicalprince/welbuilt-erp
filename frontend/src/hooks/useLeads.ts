import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Referrer, SparksLead, SparksLeadStatus, SparkedCollege, SparkedDepartment, SparkedDeptStatus } from "@/types";
import * as referrerService from "@/services/referrerService";
import * as sparksLeadService from "@/services/sparksLeadService";
import * as sparkedLeadService from "@/services/sparkedLeadService";
import { useAuthStore } from "@/store/authStore";

// ============================================
// Query Keys
// ============================================
export const leadQueryKeys = {
  referrers: ["referrers"] as const,
  referrer: (id: string) => ["referrers", id] as const,
  referrerStats: (id: string) => ["referrers", id, "stats"] as const,
  referrersWithStats: ["referrers", "withStats"] as const,

  sparksLeads: ["sparksLeads"] as const,
  sparksLead: (id: string) => ["sparksLeads", id] as const,
  sparksLeadFollowUps: (leadId: string) => ["sparksLeads", leadId, "followUps"] as const,

  sparkedColleges: ["sparkedColleges"] as const,
  sparkedCollege: (id: string) => ["sparkedColleges", id] as const,
  sparkedCollegesWithDepts: ["sparkedColleges", "withDepts"] as const,
  sparkedConvertedColleges: ["sparkedColleges", "converted"] as const,
  sparkedDepartments: (collegeId: string) => ["sparkedDepartments", collegeId] as const,
  sparkedDeptFollowUps: (deptId: string) => ["sparkedDepartments", deptId, "followUps"] as const,
};

// ============================================
// Referrers
// ============================================
export function useReferrers() {
  return useQuery({ queryKey: leadQueryKeys.referrers, queryFn: referrerService.getAllReferrers });
}

export function useReferrersWithStats() {
  return useQuery({
    queryKey: leadQueryKeys.referrersWithStats,
    queryFn: referrerService.getAllReferrersWithStats,
  });
}

export function useReferrerStats(referrerId: string) {
  return useQuery({
    queryKey: leadQueryKeys.referrerStats(referrerId),
    queryFn: () => referrerService.getReferrerStats(referrerId),
    enabled: !!referrerId,
  });
}

export function useCreateReferrer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Referrer, "id" | "createdAt" | "updatedAt">) =>
      referrerService.createReferrer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrers });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrersWithStats });
    },
  });
}

export function useUpdateReferrer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Referrer, "id" | "createdAt" | "updatedAt">> }) =>
      referrerService.updateReferrer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrers });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrersWithStats });
    },
  });
}

export function useDeleteReferrer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => referrerService.deleteReferrer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrers });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.referrersWithStats });
    },
  });
}

// ============================================
// Sparks AI Leads
// ============================================
export function useSparksLeads() {
  return useQuery({ queryKey: leadQueryKeys.sparksLeads, queryFn: sparksLeadService.getAllSparksLeads });
}

export function useSparksLead(id: string) {
  return useQuery({
    queryKey: leadQueryKeys.sparksLead(id),
    queryFn: () => sparksLeadService.getSparksLeadById(id),
    enabled: !!id,
  });
}

export function useSparksLeadFollowUps(leadId: string) {
  return useQuery({
    queryKey: leadQueryKeys.sparksLeadFollowUps(leadId),
    queryFn: () => sparksLeadService.getFollowUpsByLead(leadId),
    enabled: !!leadId,
  });
}

export function useCreateSparksLead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (data: Omit<SparksLead, "id" | "status" | "createdAt" | "updatedAt">) =>
      sparksLeadService.createSparksLead(data, user?.id || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
    },
  });
}

export function useUpdateSparksLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<SparksLead, "id" | "createdAt" | "updatedAt">> }) =>
      sparksLeadService.updateSparksLead(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLead(id) });
    },
  });
}

export function useChangeSparksLeadStatus() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ id, status, dropReason }: { id: string; status: SparksLeadStatus; dropReason?: string }) =>
      sparksLeadService.changeSparksLeadStatus(id, status, user?.id || "", dropReason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLead(id) });
    },
  });
}

export function useDeleteSparksLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sparksLeadService.deleteSparksLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
    },
  });
}

export function useAddSparksLeadFollowUp() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ leadId, note, nextFollowUpDate }: { leadId: string; note: string; nextFollowUpDate?: Date }) =>
      sparksLeadService.addFollowUp(leadId, note, user?.id || "", nextFollowUpDate),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeadFollowUps(leadId) });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLead(leadId) });
    },
  });
}

export function useFindMatchingClient() {
  return useMutation({
    mutationFn: ({ email, phone }: { email?: string; phone?: string }) =>
      sparksLeadService.findMatchingClient(email, phone),
  });
}

export function useConvertSparksLead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ leadId, linkToClientId }: { leadId: string; linkToClientId?: string }) =>
      sparksLeadService.convertSparksLeadToClient(leadId, user?.id || "", linkToClientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparksLeads });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ============================================
// SparkED Colleges & Departments
// ============================================
export function useSparkedColleges() {
  return useQuery({ queryKey: leadQueryKeys.sparkedColleges, queryFn: sparkedLeadService.getAllColleges });
}

export function useSparkedCollegesWithDepts() {
  return useQuery({
    queryKey: leadQueryKeys.sparkedCollegesWithDepts,
    queryFn: sparkedLeadService.getCollegesWithDepts,
  });
}

export function useSparkedConvertedColleges() {
  return useQuery({
    queryKey: leadQueryKeys.sparkedConvertedColleges,
    queryFn: sparkedLeadService.getConvertedColleges,
  });
}

export function useSparkedCollege(id: string) {
  return useQuery({
    queryKey: leadQueryKeys.sparkedCollege(id),
    queryFn: () => sparkedLeadService.getCollegeWithDepts(id),
    enabled: !!id,
  });
}

export function useCreateCollege() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SparkedCollege, "id" | "mouScope" | "createdAt" | "updatedAt">) =>
      sparkedLeadService.createCollege(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
    },
  });
}

export function useUpdateCollege() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<SparkedCollege, "id" | "createdAt" | "updatedAt">> }) =>
      sparkedLeadService.updateCollege(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollege(id) });
    },
  });
}

export function useDeleteCollege() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sparkedLeadService.deleteCollege(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SparkedDepartment, "id" | "status" | "createdAt" | "updatedAt">) =>
      sparkedLeadService.createDepartment(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollege(data.collegeId) });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<SparkedDepartment, "id" | "createdAt" | "updatedAt">> }) =>
      sparkedLeadService.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedConvertedColleges });
    },
  });
}

export function useChangeDepartmentStatus() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ id, status, dropReason }: { id: string; status: SparkedDeptStatus; dropReason?: string }) =>
      sparkedLeadService.changeDepartmentStatus(id, status, user?.id || "", dropReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedConvertedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sparkedLeadService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedConvertedColleges });
    },
  });
}

export function useDeptFollowUps(deptId: string) {
  return useQuery({
    queryKey: leadQueryKeys.sparkedDeptFollowUps(deptId),
    queryFn: () => sparkedLeadService.getDeptFollowUps(deptId),
    enabled: !!deptId,
  });
}

export function useAddDeptFollowUp() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ deptId, note, nextFollowUpDate }: { deptId: string; note: string; nextFollowUpDate?: Date }) =>
      sparkedLeadService.addDeptFollowUp(deptId, note, user?.id || "", nextFollowUpDate),
    onSuccess: (_, { deptId }) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedDeptFollowUps(deptId) });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
    },
  });
}

export function useSignDepartmentMou() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (deptId: string) => sparkedLeadService.signDepartmentMou(deptId, user?.id || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedConvertedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
    },
  });
}

export function useSignCollegeWideMou() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (collegeId: string) => sparkedLeadService.signCollegeWideMou(collegeId, user?.id || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedCollegesWithDepts });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedConvertedColleges });
      queryClient.invalidateQueries({ queryKey: leadQueryKeys.sparkedColleges });
    },
  });
}
