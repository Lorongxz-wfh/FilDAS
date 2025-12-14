import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = {
  children: ReactNode; // the icon
  size?: "xs" | "sm" | "md";
  variant?: "default" | "ghost" | "danger";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const baseClasses =
  "inline-flex items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors";

const sizeClasses = {
  xs: "h-6 w-6 text-[11px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
};

const variantClasses = {
  default:
    "bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-700",
  ghost: "text-slate-300 hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

export function IconButton({
  children,
  size = "sm",
  variant = "ghost",
  className = "",
  ...props
}: IconButtonProps) {
  const cls = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
