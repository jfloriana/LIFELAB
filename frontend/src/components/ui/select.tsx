import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500",
        "transition-all duration-200 appearance-none cursor-pointer dark:border-white/10 dark:bg-[#1a1f2e] dark:text-white",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);

Select.displayName = "Select";
export { Select };
