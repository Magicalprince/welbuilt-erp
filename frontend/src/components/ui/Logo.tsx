import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "symbol";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}

const sizes = {
  sm: { symbol: "h-8 w-8", full: "h-8" },
  md: { symbol: "h-10 w-10", full: "h-10" },
  lg: { symbol: "h-12 w-12", full: "h-12" },
  xl: { symbol: "h-16 w-16", full: "h-16" },
};

export function Logo({ variant = "full", size = "md", className, animated = false }: LogoProps) {
  const sizeClass = sizes[size][variant];

  const imageProps = {
    src: variant === "full" ? "/images/logo-full.png" : "/images/logo-symbol.png",
    alt: "WelBuilt AI",
    className: cn(sizeClass, "object-contain", className),
  };

  if (animated) {
    return (
      <motion.img
        {...imageProps}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    );
  }

  return <img {...imageProps} />;
}

// Animated logo for login/splash screens
export function AnimatedLogo({ size = "xl", className }: Omit<LogoProps, "variant" | "animated">) {
  return (
    <motion.div
      className={cn("relative", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect behind logo */}
      <motion.div
        className="absolute inset-0 blur-2xl bg-primary/30 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.2, opacity: 0.5 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />

      {/* Logo image */}
      <motion.img
        src="/images/logo-symbol.png"
        alt="WelBuilt AI"
        className={cn(sizes[size].symbol, "object-contain relative z-10")}
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          duration: 0.6,
          delay: 0.1,
          type: "spring",
          stiffness: 200,
          damping: 15
        }}
      />
    </motion.div>
  );
}

// Logo with text for sidebar
export function LogoWithText({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <motion.img
        src="/images/logo-symbol.png"
        alt="WelBuilt AI"
        className="h-9 w-9 object-contain"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      />

      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col"
        >
          <span className="font-bold text-lg leading-tight text-foreground">
            WelBuilt
          </span>
          <span className="text-xs text-primary font-medium -mt-0.5">
            AI Solutions
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default Logo;
