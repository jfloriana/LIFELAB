import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500",
        "transition-all duration-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
export { Input };
