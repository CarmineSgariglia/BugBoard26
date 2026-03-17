import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { RequireAuth, PublicOnly } from "./guards";
import {
  IssuePage,
  LoginPage,
  ManageAccountSettingsPage,
  ProjectIssuesPage,
  ProjectsPage,
  RecoverPasswordRequestPage,
  RecoverPasswordVerifyPage,
} from "@pages/index";
import { BreadcrumbProvider } from "@shared/providers";
import { AuthLayout, MainLayout } from "@widgets/index";

export function AppRouter() {
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

        <Route
          element={
            <RequireAuth>
              <Outlet />
            </RequireAuth>
          }
        >
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
