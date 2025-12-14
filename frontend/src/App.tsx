import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import DocumentManagerPage from "./pages/DocumentManagerPage";
import UserManagerPage from "./pages/UserManagerPage";
import ReportsPage from "./pages/ReportsPage";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default goes to /login for now */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route path="/overview" element={<DashboardPage />} />
          <Route path="/files" element={<DocumentManagerPage />} />
          <Route path="/users" element={<UserManagerPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
