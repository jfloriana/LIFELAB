import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "default" && "bg-surface-light text-text-muted",
        variant === "success" && "bg-success/20 text-success",
        variant === "warning" && "bg-warning/20 text-warning",
        variant === "danger" && "bg-danger/20 text-danger",
        variant === "info" && "bg-info/20 text-info",
        className
      )}
    >
      {children}
    </span>
  );
}
