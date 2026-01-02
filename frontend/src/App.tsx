import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DocumentManagerPage from "./features/documents/pages/DocumentManagerPage";
import SharedFilesPage from "./pages/SharedFilesPage";
import UserManagerPage from "./pages/UserManagerPage";
// import ReportsPage from "./pages/ReportsPage";
import DepartmentManagerPage from "./pages/DepartmentManagerPage";
import { api, setAuthToken } from "./lib/api";
import AuditLogsPage from "./pages/AuditLogsPage";


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // runs on initial load / refresh
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("fildas_token");

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        setAuthToken(token);

        const response = await api.get("/user", {
          timeout: 5000,
        });

        if (response.status === 200) {
          setIsAuthenticated(true);
        }
      } catch (error: any) {
        console.error("Auth check failed:", {
          status: error?.response?.status,
          message: error?.response?.data?.message,
          error: error?.message,
        });

        localStorage.removeItem("fildas_token");
        localStorage.removeItem("fildas_user");
        setAuthToken(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  // DEBUG
  console.log("App render auth state:", { isAuthenticated, loading });

  // called by LoginPage when login succeeds
  const handleLoginSuccess = (token: string, user: any) => {
    setAuthToken(token);
    localStorage.setItem("fildas_token", token);
    localStorage.setItem("fildas_user", JSON.stringify(user));
    setIsAuthenticated(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Login route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/overview" replace />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        {/* Protected app routes */}
        {isAuthenticated ? (
          <Route element={<AppLayout />}>
            <Route path="/overview" element={<DashboardPage />} />
            <Route path="/files" element={<DocumentManagerPage />} />
            <Route path="/shared" element={<SharedFilesPage />} />
            <Route path="/users" element={<UserManagerPage />} />
            <Route path="/departments" element={<DepartmentManagerPage />} />
            {/* <Route path="/reports" element={<ReportsPage />} /> */}
            <Route path="/audit-logs" element={<AuditLogsPage />} />
          </Route>
        ) : (
          <Route path="/overview" element={<Navigate to="/login" replace />} />
        )}

        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/overview" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
