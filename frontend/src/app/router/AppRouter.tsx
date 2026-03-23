import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { RequireAuth, PublicOnly } from "./guards";
import { BreadcrumbProvider } from "@shared/providers";

const AuthLayout = lazy(() =>
  import("@widgets/layout/AuthLayout").then((module) => ({ default: module.AuthLayout })),
);
const MainLayout = lazy(() =>
  import("@widgets/layout/MainLayout").then((module) => ({ default: module.MainLayout })),
);
const LoginPage = lazy(() =>
  import("@pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RecoverPasswordRequestPage = lazy(() =>
  import("@pages/auth/RecoverPasswordRequestPage").then((module) => ({
    default: module.RecoverPasswordRequestPage,
  })),
);
const RecoverPasswordVerifyPage = lazy(() =>
  import("@pages/auth/RecoverPasswordVerifyPage").then((module) => ({
    default: module.RecoverPasswordVerifyPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("@pages/projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage })),
);
const ProjectIssuesPage = lazy(() =>
  import("@pages/projects/ProjectIssuesPage").then((module) => ({
    default: module.ProjectIssuesPage,
  })),
);
const IssuePage = lazy(() =>
  import("@pages/issues/IssuePage").then((module) => ({ default: module.IssuePage })),
);
const ManageAccountSettingsPage = lazy(() =>
  import("@pages/settings/ManageAccountSettingsPage").then((module) => ({
    default: module.ManageAccountSettingsPage,
  })),
);

function PublicRouteFallback() {
  return <div className="min-h-screen bg-[#11131A]" />;
}

function PrivateRouteFallback() {
  return (
    <div className="min-h-screen bg-[#11131A]">
      <div className="h-20 border-b border-white/5 bg-[#11141C]/60" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          element={
            <PublicOnly>
              <Suspense fallback={<PublicRouteFallback />}>
                <AuthLayout />
              </Suspense>
            </PublicOnly>
          }
        >
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route
          element={
            <Suspense fallback={<PublicRouteFallback />}>
              <AuthLayout />
            </Suspense>
          }
        >
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
                <Suspense fallback={<PrivateRouteFallback />}>
                  <MainLayout />
                </Suspense>
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
