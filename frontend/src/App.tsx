import { type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./features/auth/LoginScreen";
import { RetrieveStep1Screen } from "./features/auth/RetrieveStep1Screen";
import { RetrieveStep2Screen } from "./features/auth/RetrieveStep2Screen";
import { ProjectsScreen } from "./features/projects/ProjectsScreen";
import { ProjectIssuesScreen } from "./features/projects/ProjectIssuesScreen";
import { ManageAccountSettingsPage } from "./features/settings/ManageAccountSettingsPage";
import { AuthLayout } from "./components/layout/AuthLayout";
import { useAuth } from "./contexts/AuthContext";
import { MainLayout } from "./components/layout/MainLayout";
import { BreadcrumbProvider } from "./contexts/BreadcrumbContext";
import { IssuePage } from "./features/issue/IssuePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();



{/* If the user is authenticated, render the MainLayout, otherwise render the AuthLayout */ }
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

{/* If the user is authenticated, redirect to the projects page, otherwise render the AuthLayout */ }
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>

        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Auth Routes (Public Only) */}
          <Route
            element={
              <PublicOnly>
                <AuthLayout />
              </PublicOnly>
            }
          >
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/forgot-password" element={<RetrieveStep1Screen />} />
            <Route path="/forgot-password/verify" element={<RetrieveStep2Screen />} />
          </Route>

          {/* Private Routes (Protected by RequireAuth and using MainLayout) */}
          <Route
            element={
              <RequireAuth>
                <BreadcrumbProvider>
                  <MainLayout />
                </BreadcrumbProvider>
              </RequireAuth>
            }
          >
            <Route path="/projects" element={<ProjectsScreen />} />
            <Route path="/projects/:projectId/issues" element={<ProjectIssuesScreen />} />
            <Route path="/projects/:projectId/issues/:issueId" element={<IssuePage />} />
            <Route path="/settings" element={<ManageAccountSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
