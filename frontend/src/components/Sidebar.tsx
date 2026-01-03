// src/components/Sidebar.tsx
import type { PageKey } from "../types/navigation";
import { Button } from "./ui/Button";

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export default function Sidebar({
  activePage,
  onNavigate,
  isAdmin,
  isSuperAdmin,
}: SidebarProps) {
  const itemVariant = (active: boolean) =>
    active ? "primary" : ("ghost" as const);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-950/60 px-3 py-4">
      <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {isAdmin ? "Admin" : "Staff"}
      </p>

      <nav className="space-y-1">
        <Button
          variant={itemVariant(activePage === "dashboard")}
          size="sm"
          className="w-full justify-start"
          onClick={() => onNavigate("dashboard")}
        >
          Dashboard
        </Button>

        <Button
          variant={itemVariant(activePage === "documents")}
          size="sm"
          className="w-full justify-start"
          onClick={() => onNavigate("documents")}
        >
          Document Manager
        </Button>

        <Button
          variant={itemVariant(activePage === "shared")}
          size="sm"
          className="w-full justify-start"
          onClick={() => onNavigate("shared")}
        >
          Shared Files
        </Button>

        {isSuperAdmin && (
          <Button
            variant={itemVariant(activePage === "departments")}
            size="sm"
            className="w-full justify-start"
            onClick={() => onNavigate("departments")}
          >
            Departments
          </Button>
        )}

        {isSuperAdmin && (
          <>
            <Button
              variant={itemVariant(activePage === "users")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("users")}
            >
              User Manager
            </Button>

            <Button
              variant={itemVariant(activePage === "archive")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("archive")}
            >
              Archive
            </Button>

            <Button
              variant={itemVariant(activePage === "audit-logs")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("audit-logs")}
            >
              Audit Logs
            </Button>
          </>
        )}
      </nav>
    </aside>
  );
}
