// src/components/ui/Loader.tsx
type LoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Loader({ label, size = "md" }: LoaderProps) {
  const spinnerSize = sizeMap[size];

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-2 border-sky-500 border-t-transparent`}
      />
      {label && <span>{label}</span>}
    </div>
  );
}
