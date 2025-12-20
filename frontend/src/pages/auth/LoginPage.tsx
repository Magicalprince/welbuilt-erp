import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { Button, Input, Card, CardContent, AnimatedLogo } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch {
      toast.error(error || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md px-4 relative z-10"
      >
        {/* Logo */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <AnimatedLogo size="xl" />
        </motion.div>

        {/* Glass card */}
        <Card className="glass-card border-white/10 shadow-2xl">
          <CardContent className="p-8">
            {/* Header */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
              <p className="text-slate-400">Sign in to your WelBuilt account</p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <label className="text-sm font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    type="email"
                    placeholder="founder@welbuilt.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                    required
                  />
                </div>
              </motion.div>

              {/* Password Input */}
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label className="text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </motion.div>

              {/* Remember Me & Forgot Password */}
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-400 hover:text-slate-300">
                  <input type="checkbox" className="rounded border-slate-600 bg-white/5 text-primary focus:ring-primary/20" />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 bg-brand-gradient hover:opacity-90 text-slate-900 font-semibold shadow-lg shadow-primary/25 transition-all duration-200"
                  isLoading={isLoading}
                >
                  {!isLoading && (
                    <>
                      Sign In
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Error Message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <motion.p
          className="mt-8 text-center text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="text-primary font-semibold">WelBuilt AI</span> Solutions - Internal ERP System
        </motion.p>
      </motion.div>
    </div>
  );
}
