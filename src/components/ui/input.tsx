import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "min-h-touch w-full rounded-md border border-line bg-surface px-4 text-lg text-ink",
      "placeholder:text-ink-secondary/60",
      "focus:border-primary focus:outline focus:outline-2 focus:outline-primary/30",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
