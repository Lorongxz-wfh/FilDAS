// src/components/ui/DropdownMenu.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";

type DropdownContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) {
    throw new Error(
      "DropdownMenu components must be used inside <DropdownMenu>"
    );
  }
  return ctx;
}

type DropdownMenuProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
};

export function DropdownMenu({
  trigger,
  children,
  align = "right",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | globalThis.MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside as any);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside as any);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className="relative inline-block">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {trigger}
        </div>

        {open && (
          <div
            className={`absolute z-30 mt-1 min-w-[140px] rounded-md border border-slate-700 bg-slate-900 py-1 text-xs text-slate-100 shadow-lg ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

type ItemProps = {
  children: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
};

DropdownMenu.Item = function DropdownMenuItem({
  children,
  onClick,
  destructive = false,
}: ItemProps) {
  const { setOpen } = useDropdown();

  const handleClick = () => {
    setOpen(false);
    onClick?.();
  };

  return (
    <button
      type="button"
      className={`flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-800 ${
        destructive ? "text-red-400 hover:text-red-300" : "text-slate-100"
      }`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};
