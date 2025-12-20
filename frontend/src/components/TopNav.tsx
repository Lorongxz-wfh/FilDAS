import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { api } from "../lib/api";

interface TopNavProps {
  onLogout?: () => void;
}

export default function TopNav({ onLogout }: TopNavProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Call logout endpoint to invalidate token on server
      await api.post("/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Clear local storage
      localStorage.removeItem("fildas_token");
      localStorage.removeItem("fildas_user");

      // Clear auth header
      delete api.defaults.headers.common["Authorization"];

      // Call parent callback if provided
      if (onLogout) {
        onLogout();
      }

      // Redirect to login
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  };

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
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
