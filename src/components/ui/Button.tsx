import { type ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Button Component
// Variants: primary, secondary, outline, ghost, gradient
// Sizes: sm, md, lg
// Can render as <button> or <Link> (via href prop)
// ─────────────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "gradient";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-electric-600 text-white",
    "hover:bg-electric-700",
    "shadow-sm hover:shadow-glow",
    "border border-transparent",
  ].join(" "),

  secondary: [
    "bg-teal-500 text-white",
    "hover:bg-teal-600",
    "shadow-sm hover:shadow-glow-teal",
    "border border-transparent",
  ].join(" "),

  outline: [
    "bg-transparent text-foreground",
    "border border-border",
    "hover:border-electric-600 hover:text-electric-600",
    "dark:hover:border-electric-400 dark:hover:text-electric-400",
  ].join(" "),

  ghost: [
    "bg-transparent text-foreground",
    "hover:bg-muted",
    "border border-transparent",
  ].join(" "),

  gradient: [
    "bg-brand-gradient text-white",
    "hover:opacity-90",
    "shadow-sm hover:shadow-glow",
    "border border-transparent",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-ui-sm gap-1.5",
  md: "h-10 px-5 text-ui-md gap-2",
  lg: "h-12 px-7 text-ui-lg gap-2.5",
};

const baseClasses = [
  "inline-flex items-center justify-center",
  "rounded-lg font-medium font-sans",
  "transition-all duration-200",
  "cursor-pointer select-none",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-electric-600 focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
].join(" ");

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      href,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    const content = (
      <>
        {isLoading ? (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </>
    );

    // Render as Next.js Link when href is provided
    if (href) {
      return (
        <Link href={href} className={classes}>
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || isLoading}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
