import { useState, useMemo } from "react";
import { User, Lock, Building2, Palette, Users, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Avatar, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton, Modal, Badge } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useSettings, useFounders, useUpdateSettings, useUpdateUserProfile } from "@/hooks/useFirestore";
import { getAllInternManagers, createInternManager, sendInternManagerPasswordReset, deleteInternManagerAccount } from "@/services/userService";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const isFounder = user?.role === "FOUNDER";

  const { data: settings, isLoading: loadingSettings } = useSettings();
  const { data: founders, isLoading: loadingFounders } = useFounders();

  const updateSettingsMutation = useUpdateSettings();
  const updateProfileMutation = useUpdateUserProfile();

  // Derive initial values from source data
  const initialProfileData = useMemo(() => ({
    name: user?.name || "",
    phone: user?.phone || ""
  }), [user?.name, user?.phone]);

  const initialCompanyData = useMemo(() => ({
    companyName: settings?.companyName || "",
    gstNumber: settings?.gstNumber || "",
    companyAddress: settings?.companyAddress || "",
    bankAccount: settings?.bankDetails?.accountNumber || "",
    ifscCode: settings?.bankDetails?.ifscCode || "",
  }), [settings?.companyName, settings?.gstNumber, settings?.companyAddress, settings?.bankDetails?.accountNumber, settings?.bankDetails?.ifscCode]);

  // Local edits state - null means no local edits, use source data
  const [profileEdits, setProfileEdits] = useState<{ name: string; phone: string } | null>(null);
  const [companyEdits, setCompanyEdits] = useState<{
    companyName: string;
    gstNumber: string;
    companyAddress: string;
    bankAccount: string;
    ifscCode: string;
  } | null>(null);
  // Current values: local edits if they exist, otherwise source data
  const profileData = profileEdits ?? initialProfileData;
  const companyData = companyEdits ?? initialCompanyData;

  // Setters that create local edits
  const setProfileData = (updater: (prev: typeof profileData) => typeof profileData) => {
    setProfileEdits(updater(profileData));
  };
  const setCompanyData = (updater: (prev: typeof companyData) => typeof companyData) => {
    setCompanyEdits(updater(companyData));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        data: {
          name: profileData.name,
          phone: profileData.phone,
        },
      });
      setProfileEdits(null); // Clear local edits after successful save
      toast.success("Profile updated successfully!");
    } catch {
      toast.error("Failed to update profile");
    }
  };

  const handleSaveCompany = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        companyName: companyData.companyName,
        companyAddress: companyData.companyAddress,
        gstNumber: companyData.gstNumber,
        bankDetails: {
          bankName: "",
          accountNumber: companyData.bankAccount,
          ifscCode: companyData.ifscCode,
          accountHolderName: "",
        },
      });
      setCompanyEdits(null); // Clear local edits after successful save
      toast.success("Company settings saved!");
    } catch {
      toast.error("Failed to save company settings");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="h-4 w-4 mr-2" />
            Company
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          {isFounder && (
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="ring-4 ring-primary/20 rounded-full p-1 bg-gradient-to-br from-primary/20 to-primary/5">
                    <Avatar
                      name={profileData.name || user?.name || ""}
                      email={user?.email}
                      size="2xl"
                      showRing={false}
                    />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{profileData.name || user?.name}</h2>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <p className="text-sm text-primary font-medium mt-1">{user?.equityPercent}% Equity Holder</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={profileData.name}
                    onChange={(e) => setProfileData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={profileData.phone}
                    onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equity Share</Label>
                  <Input value={`${user?.equityPercent || 0}%`} disabled />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" placeholder="Enter current password" />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="Enter new password" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" placeholder="Confirm new password" />
                </div>
              </div>
              <Button>Update Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingSettings ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={companyData.companyName}
                        onChange={(e) =>
                          setCompanyData((p) => ({ ...p, companyName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>GST Number</Label>
                      <Input
                        value={companyData.gstNumber}
                        onChange={(e) =>
                          setCompanyData((p) => ({ ...p, gstNumber: e.target.value }))
                        }
                        placeholder="Enter GST number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={companyData.companyAddress}
                        onChange={(e) =>
                          setCompanyData((p) => ({ ...p, companyAddress: e.target.value }))
                        }
                        placeholder="Company address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank Account</Label>
                      <Input
                        value={companyData.bankAccount}
                        onChange={(e) =>
                          setCompanyData((p) => ({ ...p, bankAccount: e.target.value }))
                        }
                        placeholder="Account number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IFSC Code</Label>
                      <Input
                        value={companyData.ifscCode}
                        onChange={(e) =>
                          setCompanyData((p) => ({ ...p, ifscCode: e.target.value }))
                        }
                        placeholder="IFSC code"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveCompany} disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Company Details"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Founder Equity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFounders ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : founders && founders.length > 0 ? (
                <div className="space-y-4">
                  {founders.map((founder) => (
                    <div
                      key={founder.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="ring-2 ring-primary/20 rounded-full">
                          <Avatar name={founder.name} size="lg" showRing={false} />
                        </div>
                        <div>
                          <span className="font-medium block">{founder.name}</span>
                          <span className="text-sm text-muted-foreground">{founder.email}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">{founder.equityPercent}%</span>
                        <span className="text-xs text-muted-foreground block">Equity</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  No founders configured. Run the seed script to add founder data.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Theme</Label>
                <div className="flex gap-3">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 p-4 rounded-lg border transition-all ${
                        theme === t ? "border-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <span className="capitalize font-medium">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isFounder && (
          <TabsContent value="users">
            <ManageUsersTab />
          </TabsContent>
        )}
        </Tabs>
    </div>
  );
}

function ManageUsersTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { data: managers, isLoading, refetch } = useQuery({
    queryKey: ["intern-managers"],
    queryFn: getAllInternManagers,
  });

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 8) {
      toast.error("Fill all fields. Password must be at least 8 characters.");
      return;
    }
    setCreating(true);
    try {
      await createInternManager(newName.trim(), newEmail.trim(), newPassword);
      toast.success(`Intern Manager account created for ${newName}`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setIsCreateOpen(false);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendInternManagerPasswordReset(email);
      toast.success(`Password reset email sent to ${email}`);
    } catch {
      toast.error("Failed to send password reset");
    }
  };

  const handleDeactivate = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteInternManagerAccount(deleteConfirm.id);
      toast.success(`Account deactivated for ${deleteConfirm.name}`);
      setDeleteConfirm(null);
      refetch();
    } catch {
      toast.error("Failed to deactivate account");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Intern Manager Accounts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage accounts for staff who handle intern onboarding. They can only access the Interns module.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Intern Manager
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !managers?.length ? (
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No intern managers yet</p>
              <p className="text-sm text-muted-foreground">Create accounts for staff who manage intern onboarding</p>
            </div>
          ) : (
            <div className="space-y-3">
              {managers.map((manager) => (
                <div key={manager.id} className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar name={manager.name} size="md" showRing={false} />
                    <div>
                      <p className="font-medium">{manager.name}</p>
                      <p className="text-sm text-muted-foreground">{manager.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Intern Manager</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Send password reset email"
                      onClick={() => handleResetPassword(manager.email)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      title="Deactivate account"
                      onClick={() => setDeleteConfirm({ id: manager.id, name: manager.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Intern Manager">
        <div className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Staff member name" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="staff@company.com" />
          </div>
          <div>
            <Label>Initial Password * (min 8 chars)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a temporary password" />
          </div>
          <p className="text-xs text-muted-foreground">
            The account will have access only to the Interns module. You can send a password reset email after creation.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Deactivate Account">
        <p>Are you sure you want to deactivate <strong>{deleteConfirm?.name}</strong>'s account?</p>
        <p className="text-sm text-muted-foreground mt-2">
          They will no longer be able to log in. All their activity logs are preserved.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={handleDeactivate}>Deactivate</Button>
        </div>
      </Modal>
    </>
  );
}
