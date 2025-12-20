import { forwardRef, type HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// Animated Card with Framer Motion
interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  variant?: "default" | "glass" | "elevated" | "interactive";
  delay?: number;
}

const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, variant = "default", delay = 0, ...props }, ref) => {
    const variants = {
      default: "bg-card border-border",
      glass: "bg-card/80 backdrop-blur-md border-border/50",
      elevated: "bg-card border-border shadow-lg",
      interactive: "bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        whileHover={{
          y: -2,
          transition: { duration: 0.2 }
        }}
        className={cn(
          "rounded-xl border text-card-foreground shadow-sm transition-all duration-300",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

// Standard Card (non-animated, for backwards compatibility)
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, AnimatedCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
