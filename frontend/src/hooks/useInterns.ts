import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Intern, InternPaymentStatus, InternDuration } from "@/types";
import {
  getInterns,
  getInternById,
  createIntern,
  updateIntern,
  deleteIntern,
  bulkDeleteInterns,
} from "@/services/internService";
import {
  logInternCreated,
  logInternDeleted,
} from "@/services/activityLogService";
import { useAuthStore } from "@/store/authStore";

// Query keys
export const internQueryKeys = {
  all: ["interns"] as const,
  lists: () => [...internQueryKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...internQueryKeys.lists(), filters] as const,
  details: () => [...internQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...internQueryKeys.details(), id] as const,
};

// Get all interns
export function useInterns() {
  return useQuery({
    queryKey: internQueryKeys.lists(),
    queryFn: getInterns,
  });
}

// Get single intern
export function useIntern(id: string) {
  return useQuery({
    queryKey: internQueryKeys.detail(id),
    queryFn: () => getInternById(id),
    enabled: !!id,
  });
}

// Create intern
export function useCreateIntern() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      phone: string;
      college: string;
      year: string;
      domain: string;
      duration: InternDuration;
      startDate: Date;
      endDate: Date;
      issueDate: Date;
      paymentStatus: InternPaymentStatus;
      brand?: "welbuilt" | "sparks";
    }) => createIntern(data),
    onSuccess: (internId, variables) => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
      if (user?.id) {
        logInternCreated(user.id, internId, variables.name, user.name).catch(() => {});
      }
    },
  });
}

// Update intern
export function useUpdateIntern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Intern> }) =>
      updateIntern(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: internQueryKeys.detail(id) });
    },
  });
}

// Delete intern
export function useDeleteIntern() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteIntern(id),
    onSuccess: (_, { id, name }) => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
      if (user?.id) {
        logInternDeleted(user.id, id, name, user.name).catch(() => {});
      }
    },
  });
}

// Bulk delete interns
export function useBulkDeleteInterns() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ ids }: { ids: string[]; interns: { id: string; name: string }[] }) =>
      bulkDeleteInterns(ids),
    onSuccess: (_, { interns }) => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
      if (user?.id) {
        interns.forEach(({ id, name }) => {
          logInternDeleted(user.id!, id, name, user.name).catch(() => {});
        });
      }
    },
  });
}
