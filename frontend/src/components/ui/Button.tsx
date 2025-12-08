"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "legal";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      "inline-flex items-center justify-center gap-2",
      "font-sans font-medium",
      "transition-all duration-200 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "cursor-pointer"
    );

    const variants = {
      primary: cn(
        "bg-[#0a0a0a] text-white",
        "hover:bg-[#1a1a1a]",
        "focus-visible:ring-[#0a0a0a]",
        "border border-transparent"
      ),
      secondary: cn(
        "bg-[#f5f5f4] text-[#0a0a0a]",
        "hover:bg-[#e7e5e4]",
        "focus-visible:ring-[#78716c]",
        "border border-[#e7e5e4]"
      ),
      outline: cn(
        "bg-transparent text-[#0a0a0a]",
        "border border-[#0a0a0a]",
        "hover:bg-[#0a0a0a] hover:text-white",
        "focus-visible:ring-[#0a0a0a]"
      ),
      ghost: cn(
        "bg-transparent text-[#0a0a0a]",
        "hover:bg-[#f5f5f4]",
        "focus-visible:ring-[#78716c]",
        "border border-transparent"
      ),
      legal: cn(
        "bg-[#0a0a0a] text-white",
        "hover:bg-[#1a1a1a]",
        "focus-visible:ring-[#0a0a0a]",
        "border border-transparent",
        "uppercase tracking-wider"
      ),
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base",
      xl: "h-14 px-10 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
