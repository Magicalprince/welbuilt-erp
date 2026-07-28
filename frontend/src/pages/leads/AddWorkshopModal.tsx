import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Input, Label, Modal, Textarea } from "@/components/ui";
import { useCreateWorkshop } from "@/hooks/useLeads";
import toast from "react-hot-toast";

interface AddWorkshopModalProps {
  isOpen: boolean;
  deptId: string;
  collegeId: string;
  onClose: () => void;
}

function buildEmptyForm() {
  return {
    workshopTitle: "",
    targetYear: "",
    durationDays: "1",
    startDate: "",
    endDate: "",
    studentCount: "",
    costPerStudent: "",
    notes: "",
  };
}

export default function AddWorkshopModal({ isOpen, deptId, collegeId, onClose }: AddWorkshopModalProps) {
  const createMutation = useCreateWorkshop();
  const [formData, setFormData] = useState(buildEmptyForm);

  const handleClose = () => {
    setFormData(buildEmptyForm());
    onClose();
  };

  const handleSubmit = async () => {
    if (
      !formData.workshopTitle.trim() ||
      !formData.targetYear.trim() ||
      !formData.durationDays ||
      !formData.startDate ||
      !formData.endDate
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      await createMutation.mutateAsync({
        deptId,
        collegeId,
        workshopTitle: formData.workshopTitle.trim(),
        targetYear: formData.targetYear.trim(),
        durationDays: Number(formData.durationDays),
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        studentCount: formData.studentCount ? Number(formData.studentCount) : undefined,
        costPerStudent: formData.costPerStudent ? Number(formData.costPerStudent) : undefined,
        notes: formData.notes.trim() || undefined,
        expenses: [],
      });
      toast.success("Workshop added");
      setFormData(buildEmptyForm());
      onClose();
    } catch {
      toast.error("Failed to add workshop");
    }
  };

  const handleDurationChange = (value: string) => {
    setFormData((f) => {
      const next = { ...f, durationDays: value };
      const days = Number(value);
      if (f.startDate && days > 0) {
        const start = new Date(f.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + days - 1);
        next.endDate = end.toISOString().split("T")[0];
      }
      return next;
    });
  };

  const handleStartDateChange = (value: string) => {
    setFormData((f) => {
      const next = { ...f, startDate: value };
      const days = Number(f.durationDays);
      if (value && days > 0) {
        const start = new Date(value);
        const end = new Date(start);
        end.setDate(end.getDate() + days - 1);
        next.endDate = end.toISOString().split("T")[0];
      }
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Workshop">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Workshop Title *</Label>
            <Input
              value={formData.workshopTitle}
              onChange={(e) => setFormData({ ...formData, workshopTitle: e.target.value })}
              placeholder="e.g., Full Stack Development"
            />
          </div>
          <div>
            <Label>Target Year *</Label>
            <Input
              value={formData.targetYear}
              onChange={(e) => setFormData({ ...formData, targetYear: e.target.value })}
              placeholder="e.g., 2nd Year"
            />
          </div>
          <div>
            <Label>Duration (days) *</Label>
            <Input
              type="number"
              min="1"
              value={formData.durationDays}
              onChange={(e) => handleDurationChange(e.target.value)}
            />
          </div>
          <div>
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
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
          <div>
            <Label>Student Count</Label>
            <Input
              type="number"
              value={formData.studentCount}
              onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Cost per Student (₹)</Label>
            <Input
              type="number"
              value={formData.costPerStudent}
              onChange={(e) => setFormData({ ...formData, costPerStudent: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Workshop"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
