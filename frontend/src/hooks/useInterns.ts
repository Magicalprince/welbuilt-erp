import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Intern, InternPaymentStatus, InternDuration } from "@/types";
import {
  getInterns,
  getInternById,
  createIntern,
  updateIntern,
  deleteIntern,
} from "@/services/internService";

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
    }) => createIntern(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
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

  return useMutation({
    mutationFn: (id: string) => deleteIntern(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: internQueryKeys.all });
    },
  });
}
