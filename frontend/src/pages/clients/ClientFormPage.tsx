import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { useClient, useCreateClient, useUpdateClient } from "@/hooks/useFirestore";
import type { ClientStatus } from "@/types";
import toast from "react-hot-toast";

const statusOptions = [
  { value: "PROSPECTIVE", label: "Prospective" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "INACTIVE", label: "Inactive" },
];

const sourceOptions = [
  { value: "", label: "Select source" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "COLD_OUTREACH", label: "Cold Outreach" },
  { value: "NETWORKING", label: "Networking Event" },
  { value: "OTHER", label: "Other" },
];

interface FormData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  status: ClientStatus;
  source: string;
  notes: string;
}

const initialFormData: FormData = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  status: "PROSPECTIVE",
  source: "",
  notes: "",
};

export default function ClientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existingClient, isLoading: loadingClient } = useClient(id || "");
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();

  // Derive initial form data from existing client or use defaults
  const derivedFormData: FormData = isEditMode && existingClient
    ? {
        companyName: existingClient.companyName || "",
        contactPerson: existingClient.contactPerson || "",
        email: existingClient.email || "",
        phone: existingClient.phone || "",
        address: existingClient.address || "",
        status: existingClient.status || "PROSPECTIVE",
        source: existingClient.source || "",
        notes: existingClient.notes || "",
      }
    : initialFormData;

  // Track local edits
  const [formEdits, setFormEdits] = useState<FormData | null>(null);

  // Use local edits if they exist, otherwise use derived data
  const formData = formEdits ?? derivedFormData;

  // Setter that creates local edits
  const setFormData = (data: FormData) => {
    setFormEdits(data);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const isValid = formData.companyName.trim() && formData.contactPerson.trim() && formData.email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (isEditMode && id) {
        await updateClientMutation.mutateAsync({
          clientId: id,
          data: {
            companyName: formData.companyName.trim(),
            contactPerson: formData.contactPerson.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            status: formData.status,
            source: formData.source || undefined,
            notes: formData.notes.trim() || undefined,
          },
        });
        toast.success("Client updated successfully");
        navigate(`/clients/${id}`);
      } else {
        const newClientId = await createClientMutation.mutateAsync({
          companyName: formData.companyName.trim(),
          contactPerson: formData.contactPerson.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          status: formData.status,
          source: formData.source || undefined,
          notes: formData.notes.trim() || undefined,
        });
        toast.success("Client created successfully");
        navigate(`/clients/${newClientId}`);
      }
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error(isEditMode ? "Failed to update client" : "Failed to create client");
    }
  };

  if (isEditMode && loadingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEditMode && !existingClient && !loadingClient) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Client not found</h2>
        <p className="text-muted-foreground mt-2">The client you're trying to edit doesn't exist.</p>
        <Button onClick={() => navigate("/clients")} className="mt-4">
          Back to Clients
        </Button>
      </div>
    );
  }

  const isPending = createClientMutation.isPending || updateClientMutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditMode ? "Edit Client" : "Add Client"}</h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update client information" : "Enter client details to add them to your CRM"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter company name"
                  value={formData.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Contact Person <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter contact person name"
                  value={formData.contactPerson}
                  onChange={(e) => handleChange("contactPerson", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                placeholder="Enter business address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={formData.source}
                onChange={(e) => handleChange("source", e.target.value)}
                options={sourceOptions}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value as ClientStatus)}
                options={statusOptions}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add any notes about this client..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Client"
            ) : (
              "Create Client"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
