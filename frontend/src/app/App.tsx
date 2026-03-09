import { type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, Outlet } from "react-router-dom";

import { AuthLayout } from "../widgets/layout/AuthLayout";
import { MainLayout } from "../widgets/layout/MainLayout";
import { useAuth } from "./providers/AuthContext";
import { BreadcrumbProvider } from "./providers/BreadcrumbContext";
import { LoginPage } from "../pages/auth/LoginPage";
import { RecoverPasswordRequestPage } from "../pages/auth/RecoverPasswordRequestPage";
import { RecoverPasswordVerifyPage } from "../pages/auth/RecoverPasswordVerifyPage";
import { ProjectsPage } from "../pages/projects/ProjectsPage";
import { ProjectIssuesPage } from "../pages/projects/ProjectIssuesPage";
import { IssuePage } from "../pages/issues/IssuePage";
import { ManageAccountSettingsPage } from "../pages/settings/ManageAccountSettingsPage";

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#0D0D12]" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnly({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#0D0D12]" />;
  }

  if (user) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          element={
            <PublicOnly>
              <AuthLayout />
            </PublicOnly>
          }
        >
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<RecoverPasswordRequestPage />} />
          <Route path="/forgot-password/verify" element={<RecoverPasswordVerifyPage />} />
        </Route>

        <Route element={<RequireAuth><Outlet /></RequireAuth>}>
          <Route
            element={
              <BreadcrumbProvider>
                <MainLayout />
              </BreadcrumbProvider>
            }
          >
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId/issues" element={<ProjectIssuesPage />} />
            <Route path="/projects/:projectId/issues/:issueId" element={<IssuePage />} />
            <Route path="/settings" element={<ManageAccountSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
