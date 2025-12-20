// src/components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  selectable?: boolean;
  selected?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export function Card({
  children,
  selectable = false,
  selected = false,
  className = "",
  ...props
}: CardProps) {
  const base =
    "relative rounded-md border bg-slate-950/60 p-2 text-xs transition-colors";

  const interactive = selectable
    ? "cursor-pointer hover:border-sky-500/70"
    : "";

  // Subtle selected state: change border + background, no outer ring glow
  const selectedCls = selected
    ? "border-sky-500 bg-slate-900"
    : "border-slate-800";

  const cls = [base, interactive, selectedCls, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}
