// src/layouts/AppLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";
import type { PageKey } from "../types/navigation";
import { useCurrentUser } from "../lib/useCurrentUser";

const pathToPageKey = (pathname: string): PageKey => {
  switch (pathname) {
    case "/overview":
      return "overview";
    case "/files":
      return "files";
    case "/shared":
      return "shared";
    case "/users":
      return "users";
    case "/trash":
      return "trash";
    case "/departments":
      return "departments";
    default:
      return "overview";
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


  useEffect(() => {
    setActivePage(pathToPageKey(location.pathname));
  }, [location.pathname]);

  const handleNavigate = (page: PageKey) => {
    const pageToPath: Record<PageKey, string> = {
      overview: "/overview",
      files: "/files",
      shared: "/shared",
      users: "/users",
      trash: "/trash",
      departments: "/departments",
    };
    navigate(pageToPath[page]);
  };


  const handleLogout = () => {
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading…
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <TopNav onLogout={handleLogout} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          isAdmin={isAdminOrSuper}
          isSuperAdmin={isSuperAdmin}
        />

        <main className="flex-1 overflow-auto p-6">
          <Outlet
            context={{
              user,
              // For pages that only care about “can see admin things”
              isAdmin: isAdminOrSuper,
              // If a page wants to know if this is truly global Super Admin:
              isSuperAdmin,
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;