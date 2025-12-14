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
    "relative rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs";
  const interactive = selectable
    ? "transition-colors hover:border-sky-500 cursor-pointer"
    : "";
  const selectedCls = selected ? "ring-2 ring-sky-500" : "";

  const cls = [base, interactive, selectedCls, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}
