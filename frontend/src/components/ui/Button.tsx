import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const baseClasses =
  "inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors";

const variantClasses: Record<Variant, string> = {
  primary: "bg-sky-600 text-white hover:bg-sky-500",
  secondary:
    "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
  ghost: "text-slate-200 hover:bg-slate-800/70",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const sizeClasses: Record<Size, string> = {
  xs: "px-2 py-1 text-[11px]",
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "secondary",
  size = "sm",
  leftIcon,
  rightIcon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const cls = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} {...props}>
      {leftIcon && <span className="mr-1.5 flex items-center">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && (
        <span className="ml-1.5 flex items-center">{rightIcon}</span>
      )}
    </button>
  );
}
