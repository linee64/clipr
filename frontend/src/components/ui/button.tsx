import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            // Primary orange-red button
            "bg-[#10B981] text-white hover:bg-[#0D9E6E] shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.55)]":
              variant === "primary",
            // Secondary dark grey button
            "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800":
              variant === "secondary",
            // Premium glass button
            "glass-panel text-white hover:bg-white/10 hover:border-[#10B981]/30":
              variant === "glass",
            // Simple outline button
            "border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-950":
              variant === "outline",
          },
          {
            "px-4 py-1.5 text-xs": size === "sm",
            "px-6 py-2.5 text-sm": size === "md",
            "px-8 py-3.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
