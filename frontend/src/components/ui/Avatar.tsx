import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";
import { getFounderImage } from "@/lib/founders";

interface AvatarProps {
  src?: string;
  name: string;
  email?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showRing?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-24 w-24 text-2xl",
};

export function Avatar({ src, name, email, size = "md", className, showRing = true }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Try to get founder image if no src provided
  const founderImage = !src && !imageError ? getFounderImage(email || name) : undefined;
  const imageSrc = src || founderImage;

  if (imageSrc && !imageError) {
    return (
      <img
        src={imageSrc}
        alt={name}
        onError={() => setImageError(true)}
        className={cn(
          "rounded-full object-cover",
          showRing && "ring-2 ring-background",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        showRing && "ring-2 ring-background",
        sizeClasses[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
