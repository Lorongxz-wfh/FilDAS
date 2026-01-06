// src/components/Sidebar.tsx
import type { PageKey } from "../types/navigation";
import { Button } from "./ui/Button";

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isQa: boolean; // current user's department is QA
};

export default function Sidebar({
  activePage,
  onNavigate,
  isAdmin,
  isSuperAdmin,
  isQa,
}: SidebarProps) {
  const itemVariant = (active: boolean) =>
    active ? "primary" : ("ghost" as const);

  const roleLabel = isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Staff";

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-950/60 px-3 py-4">
      <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {roleLabel}
      </p>

      <nav className="space-y-1">
        {/* Common pages for all authenticated users */}
        <Button
          variant={itemVariant(activePage === "dashboard")}
          size="sm"
          className="w-full justify-start"
          onClick={() => onNavigate("dashboard")}
        >
          Dashboard
        </Button>

        {(isSuperAdmin || isQa) && (
          <Button
            variant={itemVariant(activePage === "qa-approvals")}
            size="sm"
            className="w-full justify-start"
            onClick={() => onNavigate("qa-approvals")}
          >
            QA Approval Center
          </Button>
        )}

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

        {/* Super Admin only */}
        {isSuperAdmin && (
          <>
            <Button
              variant={itemVariant(activePage === "departments")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("departments")}
            >
              Departments Manager
            </Button>

            <Button
              variant={itemVariant(activePage === "users")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("users")}
            >
              User Manager
            </Button>

            <Button
              variant={itemVariant(activePage === "reports")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("reports")}
            >
              Reports
            </Button>

            <Button
              variant={itemVariant(activePage === "activity-logs")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("activity-logs")}
            >
              Activity Logs
            </Button>
          </>
        )}

        {/* Department Admin (Admin but not Super Admin):
            Can manage users and view activity logs scoped to their department. */}
        {!isSuperAdmin && isAdmin && (
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
              variant={itemVariant(activePage === "activity-logs")}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate("activity-logs")}
            >
              Activity Logs
            </Button>
          </>
        )}
      </nav>
    </aside>
  );
}
