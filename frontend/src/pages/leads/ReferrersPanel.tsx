import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Users, Phone, Mail } from "lucide-react";
import { Button, Card, CardContent, Modal, Label, Input, Textarea } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  useReferrersWithStats,
  useCreateReferrer,
  useUpdateReferrer,
  useDeleteReferrer,
} from "@/hooks/useLeads";
import type { Referrer } from "@/types";
import toast from "react-hot-toast";

export default function ReferrersPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: referrersWithStats, isLoading } = useReferrersWithStats();
  const deleteMutation = useDeleteReferrer();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editReferrer, setEditReferrer] = useState<Referrer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Referrer | null>(null);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      toast.success("Referrer deleted");
      setDeleteConfirm(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete referrer";
      toast.error(message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Referrers" size="lg">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditReferrer(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Referrer
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !referrersWithStats || referrersWithStats.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold">No referrers yet</h3>
            <p className="text-sm text-muted-foreground">
              Add a referrer to start tracking referral commissions
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {referrersWithStats.map((stats, index) => (
              <motion.div
                key={stats.referrer.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{stats.referrer.name}</p>
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            <span>{stats.referrer.phone}</span>
                          </div>
                          {stats.referrer.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{stats.referrer.email}</span>
                            </div>
                          )}
                        </div>
                        {stats.referrer.notes && (
                          <p className="mt-2 text-xs text-muted-foreground">{stats.referrer.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Edit"
                          onClick={() => {
                            setEditReferrer(stats.referrer);
                            setIsFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeleteConfirm(stats.referrer)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Referred</p>
                        <p className="font-semibold">{stats.totalReferred}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Converted</p>
                        <p className="font-semibold">{stats.totalConverted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Owed</p>
                        <p className="font-semibold text-amber-500">{formatCurrency(stats.commissionOwed)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-semibold text-green-600">{formatCurrency(stats.commissionPaid)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ReferrerFormModal
        isOpen={isFormOpen}
        referrer={editReferrer}
        onClose={() => {
          setIsFormOpen(false);
          setEditReferrer(null);
        }}
      />

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Referrer">
        <p>Are you sure you want to delete {deleteConfirm?.name}?</p>
        <p className="text-sm text-muted-foreground mt-2">
          Referrers with leads still referencing them cannot be deleted.
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
    </Modal>
  );
}

function ReferrerFormModal({
  isOpen,
  referrer,
  onClose,
}: {
  isOpen: boolean;
  referrer: Referrer | null;
  onClose: () => void;
}) {
  const createMutation = useCreateReferrer();
  const updateMutation = useUpdateReferrer();
  const isEdit = !!referrer;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: referrer?.name || "",
        phone: referrer?.phone || "",
        email: referrer?.email || "",
        notes: referrer?.notes || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, referrer?.id]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    try {
      if (isEdit && referrer) {
        await updateMutation.mutateAsync({
          id: referrer.id,
          data: {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || undefined,
            notes: formData.notes.trim() || undefined,
          },
        });
        toast.success("Referrer updated");
      } else {
        await createMutation.mutateAsync({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });
        toast.success("Referrer added");
      }
      onClose();
    } catch {
      toast.error(isEdit ? "Failed to update referrer" : "Failed to add referrer");
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Referrer" : "New Referrer"}>
      <div className="space-y-4">
        <div>
          <Label>Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Referrer name"
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
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              "Save"
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
