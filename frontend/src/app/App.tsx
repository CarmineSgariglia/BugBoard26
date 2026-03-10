import { type ReactElement } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { useAuth } from "@shared/providers/AuthContext";
import { BreadcrumbProvider } from "@shared/providers/BreadcrumbContext";
import {
  IssuePage,
  LoginPage,
  ManageAccountSettingsPage,
  ProjectIssuesPage,
  ProjectsPage,
  RecoverPasswordRequestPage,
  RecoverPasswordVerifyPage,
} from "@pages/index";
import { AuthLayout } from "@widgets/layout/AuthLayout";
import { MainLayout } from "@widgets/layout/MainLayout";

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
