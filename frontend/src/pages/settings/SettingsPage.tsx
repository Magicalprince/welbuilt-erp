import { useState, useMemo } from "react";
import { User, Lock, Building2, Palette } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Avatar, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useSettings, useFounders, useUpdateSettings, useUpdateUserProfile } from "@/hooks/useFirestore";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

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

        </Tabs>
    </div>
  );
}
