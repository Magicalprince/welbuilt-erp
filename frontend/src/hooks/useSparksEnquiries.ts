import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSparksEnquiries, updateSparksEnquiryStatus } from "@/services/sparksEnquiriesService";

// Separate from useLeads.ts on purpose — these read a different database
// (sparks-leads-db on Dokploy Postgres, via welbuilt-erp's Express server),
// not Firestore. See docs/plans/2026-09-03-sparks-website-enquiries-design.md.

const sparksEnquiriesQueryKey = ["sparksEnquiries"] as const;

export function useSparksEnquiries() {
  return useQuery({
    queryKey: sparksEnquiriesQueryKey,
    queryFn: getSparksEnquiries,
  });
}

export function useUpdateSparksEnquiryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateSparksEnquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sparksEnquiriesQueryKey });
    },
  });
}
