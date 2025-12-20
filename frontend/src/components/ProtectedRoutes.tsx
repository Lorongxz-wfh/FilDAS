import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  loading?: boolean;
}

export default function ProtectedRoute({
  children,
  isAuthenticated,
  loading = false,
}: ProtectedRouteProps) {
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
