// src/components/TopNav.tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-sky-400">FilDAS Admin</span>
      </div>

      <div
        className="flex items-center gap-2 text-sm text-slate-200"
        ref={menuRef}
      >
        <IconButton size="sm" variant="ghost" className="md:hidden">
          ☰
        </IconButton>

        <Button
          size="xs"
          variant="secondary"
          className="pl-1.5 pr-2"
          onClick={() => setOpen((v) => !v)}
          leftIcon={
            <span className="h-6 w-6 rounded-full bg-sky-600 text-[11px] flex items-center justify-center">
              A
            </span>
          }
          rightIcon={<span className="text-[10px]">{open ? "▴" : "▾"}</span>}
        >
          Admin
        </Button>

        {open && (
          <div className="absolute right-4 top-12 mt-1 w-40 rounded-md border border-slate-700 bg-slate-900 text-xs shadow-lg z-20">
            <Button
              variant="ghost"
              size="xs"
              className="w-full justify-start rounded-none px-3 py-2"
            >
              User info / Settings
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="w-full justify-start rounded-none px-3 py-2 text-red-400 hover:text-red-300"
            >
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
