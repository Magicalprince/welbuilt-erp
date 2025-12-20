import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { resetPassword } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await resetPassword(email);
      setIsEmailSent(true);
      toast.success("Reset link sent to your email");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary flex items-center justify-center"
            >
              {isEmailSent ? (
                <CheckCircle className="h-8 w-8 text-primary-foreground" />
              ) : (
                <Mail className="h-8 w-8 text-primary-foreground" />
              )}
            </motion.div>

            <CardTitle className="text-2xl">
              {isEmailSent ? "Check Your Email" : "Forgot Password?"}
            </CardTitle>
            <CardDescription>
              {isEmailSent
                ? "We've sent a password reset link to your email address."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!isEmailSent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="founder@welbuilt.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  isLoading={isLoading}
                >
                  Send Reset Link
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsEmailSent(false)}
                >
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
