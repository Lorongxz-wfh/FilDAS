// src/layouts/AppLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";
import type { PageKey } from "../types/navigation";

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
    };
    navigate(pageToPath[page]);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
