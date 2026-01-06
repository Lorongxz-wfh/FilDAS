// src/layouts/AppLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";
import type { PageKey } from "../types/navigation";
import { useCurrentUser } from "../lib/useCurrentUser";
import { ToastContainer } from "../components/ui/ToastContainer";

const pathToPageKey = (pathname: string): PageKey => {
  switch (pathname) {
    case "/dashboard":
      return "dashboard";
    case "/qa-approvals":
      return "qa-approvals";
    case "/documents":
      return "documents";
    case "/shared":
      return "shared";
    case "/users":
      return "users";
    case "/trash":
      return "trash";
    case "/departments":
      return "departments";
    case "/activity-logs":
      return "activity-logs";
    case "/reports":
      return "reports";
    default:
      return "dashboard";
  }
};

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<PageKey>(
    pathToPageKey(location.pathname)
  );

  const { user, loading } = useCurrentUser();

  const roleName = user?.role?.name ?? "";
  const isSuperAdmin = roleName === "Super Admin";
  const isDepartmentAdmin = roleName === "Admin";
  const isAdminOrSuper = isSuperAdmin || isDepartmentAdmin;

  // QA flags based on department + role
  const deptIsQa = !!user?.department?.is_qa;
  const isQa = deptIsQa; // any member of a QA department
  const isQaAdmin = deptIsQa && isDepartmentAdmin;

  useEffect(() => {
    setActivePage(pathToPageKey(location.pathname));
  }, [location.pathname]);

  const handleNavigate = (page: PageKey) => {
    const pageToPath: Record<PageKey, string> = {
      dashboard: "/dashboard",
      "qa-approvals": "/qa-approvals",
      documents: "/documents",
      shared: "/shared",
      departments: "/departments",
      users: "/users",
      trash: "/trash",
      "activity-logs": "/activity-logs",
      reports: "/reports",
    };
    navigate(pageToPath[page]);
  };

  const handleLogout = () => {
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e1134]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-[#e7eaef]/30 border-t-[#e7eaef] animate-spin" />
          <p className="text-sm font-medium text-[#e7eaef]">
            Signing you in to FilDAS…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Global toast popup */}
      <ToastContainer />

      <TopNav onLogout={handleLogout} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          isAdmin={isAdminOrSuper}
          isSuperAdmin={isSuperAdmin}
          isQa={isQa}
        />

        <main className="flex-1 overflow-auto p-6">
          <Outlet
            context={{
              user,
              isAdmin: isAdminOrSuper,
              isSuperAdmin,
              isQa,
              isQaAdmin,
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
