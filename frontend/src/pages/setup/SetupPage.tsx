import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { Rocket, CheckCircle2, AlertCircle, Users, Building2, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import toast from "react-hot-toast";

// Founder configuration
const FOUNDERS = [
  {
    name: "Ramachandraa PS",
    email: "mail2ramachandraa@gmail.com",
    equityPercent: 34,
    role: "FOUNDER" as const,
  },
  {
    name: "Rohith Babu ME",
    email: "rohithbabu031@gmail.com",
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
  {
    name: "Baranitharan S",
    email: "iambarani.45@gmail.com",
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
];

const COMPANY_SETTINGS = {
  companyName: "WelBuilt AI Solutions",
  companyEmail: "contact@welbuilt.ai",
  companyAddress: "",
  companyPhone: "",
  gstNumber: "",
  invoicePrefix: "INV",
  quotationPrefix: "QUO",
  currency: "INR",
  currencySymbol: "₹",
  dateFormat: "DD/MM/YYYY",
  fiscalYearStart: 4,
  bankDetails: {
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "WelBuilt AI Solutions",
  },
};

type SetupStep = "welcome" | "passwords" | "creating" | "complete";

interface FounderPassword {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>("welcome");
  const [passwords, setPasswords] = useState<FounderPassword[]>(
    FOUNDERS.map((f) => ({ email: f.email, password: "", confirmPassword: "" }))
  );
  const [creationStatus, setCreationStatus] = useState<{
    settings: "pending" | "creating" | "done" | "error";
    founders: ("pending" | "creating" | "done" | "error" | "exists")[];
  }>({
    settings: "pending",
    founders: FOUNDERS.map(() => "pending"),
  });
  const [error, setError] = useState<string | null>(null);

  const handlePasswordChange = (index: number, field: "password" | "confirmPassword", value: string) => {
    setPasswords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validatePasswords = () => {
    for (let i = 0; i < passwords.length; i++) {
      if (passwords[i].password.length < 6) {
        setError(`Password for ${FOUNDERS[i].name} must be at least 6 characters`);
        return false;
      }
      if (passwords[i].password !== passwords[i].confirmPassword) {
        setError(`Passwords for ${FOUNDERS[i].name} do not match`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleStartSetup = async () => {
    if (!validatePasswords()) return;

    setStep("creating");
    setError(null);

    try {
      // Step 1: Create company settings
      setCreationStatus((prev) => ({ ...prev, settings: "creating" }));

      const settingsRef = doc(db, "settings", "company");
      const existingSettings = await getDoc(settingsRef);

      if (!existingSettings.exists()) {
        await setDoc(settingsRef, {
          ...COMPANY_SETTINGS,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      setCreationStatus((prev) => ({ ...prev, settings: "done" }));

      // Step 2: Create founder accounts
      for (let i = 0; i < FOUNDERS.length; i++) {
        const founder = FOUNDERS[i];
        const password = passwords[i].password;

        setCreationStatus((prev) => {
          const newFounders = [...prev.founders];
          newFounders[i] = "creating";
          return { ...prev, founders: newFounders };
        });

        try {
          // Create Firebase Auth user
          const userCredential = await createUserWithEmailAndPassword(auth, founder.email, password);
          const uid = userCredential.user.uid;

          // Create user document in Firestore
          const userRef = doc(db, "users", uid);
          await setDoc(userRef, {
            id: uid,
            name: founder.name,
            email: founder.email,
            equityPercent: founder.equityPercent,
            role: founder.role,
            phone: "",
            avatar: "",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          setCreationStatus((prev) => {
            const newFounders = [...prev.founders];
            newFounders[i] = "done";
            return { ...prev, founders: newFounders };
          });

          // Sign out after creating each user (except the last one)
          if (i < FOUNDERS.length - 1) {
            await signOut(auth);
          }
        } catch (err: unknown) {
          const firebaseError = err as { code?: string };
          if (firebaseError.code === "auth/email-already-in-use") {
            setCreationStatus((prev) => {
              const newFounders = [...prev.founders];
              newFounders[i] = "exists";
              return { ...prev, founders: newFounders };
            });
            // Sign out and continue
            await signOut(auth);
          } else {
            throw err;
          }
        }
      }

      setStep("complete");
      toast.success("Setup completed successfully!");
    } catch (err) {
      console.error("Setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
      toast.error("Setup failed");
    }
  };

  const handleGoToLogin = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {step === "welcome" && (
          <Card>
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-primary flex items-center justify-center"
              >
                <Rocket className="h-10 w-10 text-primary-foreground" />
              </motion.div>
              <CardTitle className="text-2xl">Welcome to WelBuilt AI ERP</CardTitle>
              <p className="text-muted-foreground mt-2">
                Let's set up your ERP system with founder accounts and company settings
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                  <Building2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Company Settings</p>
                    <p className="text-sm text-muted-foreground">
                      WelBuilt AI Solutions with INR currency and invoice prefix
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Founder Accounts</p>
                    <p className="text-sm text-muted-foreground">
                      3 founders with 34/33/33 equity split
                    </p>
                    <div className="mt-2 space-y-1">
                      {FOUNDERS.map((f) => (
                        <p key={f.email} className="text-xs text-muted-foreground">
                          • {f.name} ({f.email}) - {f.equityPercent}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep("passwords")}>
                Continue to Set Passwords
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "passwords" && (
          <Card>
            <CardHeader>
              <CardTitle>Set Founder Passwords</CardTitle>
              <p className="text-muted-foreground">
                Create a password for each founder account
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {FOUNDERS.map((founder, index) => (
                <div key={founder.email} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{founder.name}</p>
                      <p className="text-sm text-muted-foreground">{founder.email}</p>
                    </div>
                    <span className="text-sm font-medium text-primary">{founder.equityPercent}%</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="Min 6 characters"
                        value={passwords[index].password}
                        onChange={(e) => handlePasswordChange(index, "password", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Confirm Password</Label>
                      <Input
                        type="password"
                        placeholder="Confirm password"
                        value={passwords[index].confirmPassword}
                        onChange={(e) => handlePasswordChange(index, "confirmPassword", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("welcome")} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleStartSetup} className="flex-1">
                  Create Accounts
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "creating" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Setting Up Your ERP</CardTitle>
              <p className="text-muted-foreground">Please wait while we create your accounts...</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Settings Status */}
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {creationStatus.settings === "creating" && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {creationStatus.settings === "done" && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {creationStatus.settings === "pending" && (
                  <div className="h-5 w-5 rounded-full border-2" />
                )}
                <span>Company Settings</span>
              </div>

              {/* Founder Accounts Status */}
              {FOUNDERS.map((founder, index) => (
                <div key={founder.email} className="flex items-center gap-3 p-3 rounded-lg border">
                  {creationStatus.founders[index] === "creating" && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {creationStatus.founders[index] === "done" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {creationStatus.founders[index] === "exists" && (
                    <CheckCircle2 className="h-5 w-5 text-yellow-500" />
                  )}
                  {creationStatus.founders[index] === "pending" && (
                    <div className="h-5 w-5 rounded-full border-2" />
                  )}
                  {creationStatus.founders[index] === "error" && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <span>{founder.name}</span>
                    {creationStatus.founders[index] === "exists" && (
                      <span className="text-xs text-yellow-600 ml-2">(Already exists)</span>
                    )}
                  </div>
                </div>
              ))}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card>
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-500 flex items-center justify-center"
              >
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>
              <CardTitle className="text-2xl">Setup Complete!</CardTitle>
              <p className="text-muted-foreground mt-2">
                Your ERP system is ready to use
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted space-y-3">
                <p className="font-medium">Founder Accounts Created:</p>
                {FOUNDERS.map((founder, index) => (
                  <div key={founder.email} className="flex items-center justify-between text-sm">
                    <span>{founder.name}</span>
                    <span className="text-muted-foreground">{founder.email}</span>
                    {creationStatus.founders[index] === "exists" && (
                      <span className="text-xs text-yellow-600">(Existing)</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-primary/10 text-sm">
                <p className="font-medium text-primary mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Log in with any founder email and password</li>
                  <li>Add your first client</li>
                  <li>Create a project</li>
                  <li>Generate an invoice</li>
                </ol>
              </div>

              <Button className="w-full" onClick={handleGoToLogin}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
